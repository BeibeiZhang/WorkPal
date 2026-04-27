import * as https from 'node:https';
import type { Server as HttpsServer } from 'node:https';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { readConfig } from './config.js';
import { log } from './logger.js';
import { setServerRunning, setServerIdle, setServerPortBusy, findPortHolder } from './serverState.js';

/* 7.2: Supabase anon creds hard-coded here. This file runs inside the agent
 * process, so every end-user install needs the credentials to write to the
 * shared usage_log table. The anon key is *designed* to be public — RLS on
 * the table is what guards the data, not secrecy of the key (matches the
 * same key shipped in the Vercel build's public env).
 *
 * Setting them as process.env BEFORE the shared routes are evaluated (which
 * happens during the dynamic import below) lets server/src/lib/usageLog.ts
 * copy work unmodified — it reads process.env.SUPABASE_* lazily on first
 * logUsage() call, not at import time, so strict ordering isn't required,
 * but doing it here keeps the contract simple to reason about. */
const SUPABASE_URL = 'https://apgcbhysaocinzbncdmt.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwZ2NiaHlzYW9jaW56Ym5jZG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDU3NjIsImV4cCI6MjA5MjAyMTc2Mn0.NI6iobvWWfDScu_rQnkWvZSKeOZbeySEtmoMVN22fNM';
process.env.SUPABASE_URL ??= SUPABASE_URL;
process.env.SUPABASE_ANON_KEY ??= SUPABASE_ANON_KEY;

export const API_PORT = 3001;
export const API_HOST = '127.0.0.1';

let httpsServer: HttpsServer | null = null;

/* 7.3: cert material for the HTTPS listener. Cached at module level so the
 * Retry button (Settings → port-busy card) can re-listen without re-reading
 * cert files from disk. main.ts calls setCertMaterial() at boot before the
 * first startApiServer(); the boot path is the only source of fresh certs
 * (renewal happens inside bootstrapCerts() which main.ts owns). */
interface CertMaterial { key: string; cert: string }
let certMaterial: CertMaterial | null = null;

export function setCertMaterial(m: CertMaterial): void {
  certMaterial = m;
}

/** Middleware that fails fast when a route needs ANTHROPIC_API_KEY but the
 *  user hasn't set one yet. The shared routes don't distinguish — they just
 *  forward to the SDK which throws a cryptic "no key" error. We short-circuit
 *  with a 503 that tells the user exactly where to fix it. Only mounted on
 *  /api/claude-chat (project/session/reaper don't need the key). */
async function requireAnthropicKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const cfg = await readConfig();
  const key = cfg.anthropicApiKey.trim();
  if (!key) {
    res.status(503).json({
      error: 'ANTHROPIC_API_KEY not set — open WorkPal Agent → Settings and paste a key',
    });
    return;
  }
  // Inject into the request-scoped env for this Express worker thread. The
  // Claude Agent SDK reads process.env.ANTHROPIC_API_KEY at spawn time —
  // setting it here (before next()) ensures the SDK child process inherits
  // the current key. Using process.env means a Settings-side key update
  // flows through on the very next request without an agent restart.
  process.env.ANTHROPIC_API_KEY = key;
  next();
}

/** Start the local API server. Non-blocking: resolves once the state has
 *  been recorded (either running or port-busy). The agent is kept alive in
 *  either case — Settings UI shows the appropriate state.
 *
 *  Idempotent over repeated calls that succeed. A successful run leaves
 *  httpsServer non-null; a failing run leaves it null and updates state.
 *
 *  7.3: Hard-flipped from http → https. Same port (3001), same Express app,
 *  same routes. Cert material is set by main.ts via setCertMaterial() before
 *  this is first called; missing material is a programming error (we throw,
 *  not port-busy, because there's no listener-state recovery path for it). */
export async function startApiServer(): Promise<void> {
  if (httpsServer) {
    await log('info', 'server: already running, skip startApiServer');
    return;
  }
  if (!certMaterial) {
    // Caller contract violation — main.ts must call setCertMaterial first.
    // Surface as port-busy with a developer-facing message so a packaged
    // build at least keeps the process alive and shows something useful.
    setServerPortBusy(API_PORT, 'Cert material not initialised — bootstrap order bug.');
    await log('error', 'server: startApiServer called before setCertMaterial');
    return;
  }

  const app = express();
  // 7.3 live-test (Bug C): Chrome 130+ enforces Private Network Access. A
  // public origin (workpal-beibei.vercel.app) fetching a private IP
  // (127.0.0.1) sends an OPTIONS preflight with `Access-Control-Request-
  // Private-Network: true`; if the response doesn't carry
  // `Access-Control-Allow-Private-Network: true`, Chrome silently hangs the
  // fetch until abort. The cors middleware doesn't know about PNA, so set
  // it ourselves on every response — non-PNA browsers ignore the header.
  // Must run BEFORE `cors` so the header is on the OPTIONS response that
  // cors sends for the preflight, not just on the eventual /api/* response.
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    next();
  });
  app.use(cors({ origin: true, credentials: true }));
  // Match server/src/index.ts limit. Chat attachments arrive as base64 data
  // URLs; default 100kb limit is trivially blown by a single screenshot.
  app.use(express.json({ limit: '50mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', pid: process.pid, port: API_PORT });
  });

  // Mount the 4 local-touching routes from agent/src/shared/routes/. Order
  // matches server/src/index.ts so any route-level middleware in the shared
  // code behaves identically between dev server and agent runtime.
  const claudeChat = (await import('../shared/routes/claudeChat.js')).default;
  const project = (await import('../shared/routes/project.js')).default;
  const session = (await import('../shared/routes/session.js')).default;
  const reaper = (await import('../shared/routes/reaper.js')).default;

  app.use('/api', requireAnthropicKey, claudeChat);
  app.use('/api', project);
  app.use('/api', session);
  app.use('/api', reaper);

  // §17 native folder picker. Electron-only — the dev server (server/src/)
  // has no electron import, so this endpoint returns 404 there and the
  // client falls back to a typed text input.
  const pickFolder = (await import('./pickFolder.js')).default;
  app.use('/api', pickFolder);

  // Wrap Express in https.Server (https.createServer takes the same request
  // listener interface as http.createServer; Express's app() qualifies).
  // Cert material is the locally-issued leaf — if Keychain trust isn't yet
  // installed, browsers warn but the listener still binds and serves.
  const server = https.createServer(
    { key: certMaterial.key, cert: certMaterial.cert },
    app,
  );

  // Explicit promise so the caller (main.ts) can await startup and still
  // handle both outcomes without a try/catch on the async-callback shape.
  return new Promise((resolve) => {
    server.listen(API_PORT, API_HOST, () => {
      httpsServer = server;
      setServerRunning(API_PORT);
      void log('info', `server: listening on https://${API_HOST}:${API_PORT}`);
      resolve();
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        setServerPortBusy(
          API_PORT,
          `Port ${API_PORT} is already in use. Close the other process (often \`npm --prefix server run dev\`) and click Retry.`,
        );
        void log('error', `server: EADDRINUSE on ${API_PORT}; keeping agent alive`);
        // Kick off an lsof lookup so the Settings UI can show the PID on the
        // next poll without the user having to trigger it — purely
        // best-effort, ignored if lsof errors. TCP-LISTEN layer is
        // protocol-agnostic so the lookup works the same as it did for HTTP.
        void findPortHolder();
      } else {
        setServerPortBusy(API_PORT, `Listen failed: ${err.message}`);
        void log('error', `server: listen failed: ${err.message}`);
      }
      httpsServer = null;
      resolve();
    });
  });
}

/** Close the HTTPS listener. Best-effort — fired from `before-quit` where
 *  the process is about to exit anyway, so we don't surface callback errors. */
export async function stopApiServer(): Promise<void> {
  if (!httpsServer) return;
  const server = httpsServer;
  httpsServer = null;
  return new Promise((resolve) => {
    server.close(() => {
      setServerIdle();
      resolve();
    });
    // Force after 500ms — open SSE streams can hold `close()` open forever;
    // on quit we'd rather drop them than block shutdown.
    setTimeout(() => resolve(), 500).unref();
  });
}

/** Retry listening after a port-busy state. Called by the Settings Retry
 *  button. Does a fresh startApiServer — which internally re-runs cors + JSON
 *  + mounts routes — because a fresh Express instance is cheaper than
 *  holding references to a dead one. `httpsServer` is null here (port-busy
 *  path set it back to null), so startApiServer will run its main body. */
export async function retryApiServer(): Promise<void> {
  await log('info', 'server: retry requested');
  await startApiServer();
}
