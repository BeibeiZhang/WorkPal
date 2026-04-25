# Phase 7 — Web + Local Agent (deployment shape C)

**Kick-off**: 2026-04-24 (Beibei signal to move off `#5 blocked` directly into Phase 7 without A/B ordering discussion — "认定 C 是最终形态，不等验证").

**Goal in one line**: Let `workpal-beibei.vercel.app` edit the user's local files on any Mac that has the WorkPal Agent installed. Web UI stays on Vercel; a locally-installed menu-bar app does the file / git / SDK work the browser can't.

**Estimate**: ~2 weeks for an end-to-end MVP.

---

## Locked decisions (2026-04-24, pre-impl)

| Axis | Pick | Alternative(s) rejected | Why |
|---|---|---|---|
| Agent packaging | **Electron** | Tauri / pure Node daemon + Swift menu-bar | Fastest path to MVP; bundles Node runtime so Claude Agent SDK runs without host Node install; trade-off is ~80 MB `.dmg` |
| Web ↔ Agent transport | **Local CA (mkcert-pattern)** — Agent installs a local CA into the system Keychain during first launch, then issues its own server cert off that CA | Pure self-signed cert (per-browser trust) / Let's Encrypt + DNS / Cloudflare Tunnel | Single sudo prompt at install trusts the CA system-wide; every browser afterward sees a valid cert with no warning. Avoids the per-browser "trust this cert" UX of pure self-signed. No external dependency (unlike Let's Encrypt / Tunnel). Used by Docker Desktop / `mkcert` dev-tool ecosystem |
| `ANTHROPIC_API_KEY` location | **Agent menu-bar Settings window** | Passed from web UI over API | `.dmg` stays secret-free; first-launch onboarding asks for key; decoupled from web auth |
| Platform | **macOS only** | + Windows / + Linux | Beibei uses Mac; Windows only if future users demand it |
| Repo layout | **Monorepo: `agent/` at repo root** | Separate repo | Shares `ChatRecord` / `ProjectRecord` / types + lets one PR touch both halves when protocol changes |

---

## Scope breakdown

| Step | Deliverable | Est | Status |
|---|---|---|---|
| **7.1** | Agent shell: Electron app, menu-bar icon + Settings window (`ANTHROPIC_API_KEY` input, status, Quit/Restart), launchd auto-start, `.dmg` output. **No API content yet.** | 3–4 d | ✅ Shipped 2026-04-24 (PR [#128](https://github.com/BeibeiZhang/WorkPal/pull/128), commit `8702171`) |
| **7.2** | Port local-only routes (`claudeChat` / `project` / `session` / `reaper`, + any others impl audits as local-touching) from `server/src/routes/*` into Agent's bundled Node runtime. Agent reads `ANTHROPIC_API_KEY` from config + injects into Claude SDK spawn env. Served over plain HTTP on 127.0.0.1:3001; HTTPS arrives in 7.3. Cloud-data routes (memory / chats / projects / artifacts / connectors / usage) stay on Vercel serverless — NOT in agent. | 2 d | ✅ Shipped 2026-04-25 (PR [#129](https://github.com/BeibeiZhang/WorkPal/pull/129), commit `40d3ac8`) |
| **7.3** | First launch: generate a local CA, install it into macOS System Keychain (one sudo prompt), then issue a server cert off the CA for `127.0.0.1:3001`. Subsequent launches reuse the existing CA. No per-browser trust warnings. | 2–3 d | ⏳ Next |
| **7.4** | Frontend: replace hostname-based `IS_CLAUDE_CODE_AVAILABLE` with live `/ping` detection against agent. Build an "Install WorkPal Agent" onboarding view for when agent is unreachable. Re-point `fetch('/api/claude-chat')` etc. to agent URL. | 2 d | ⏳ Pending |
| **7.5** | GitHub Releases as CDN. `.dmg` build CI. Optional auto-update (agent polls latest release on boot). | 1–2 d | ⏳ Pending |

**Total: ~10–13 days of impl. Plus planning live-tests and rework cycles, ~2 weeks calendar.**

---

## Non-goals

- Windows / Linux builds
- Multi-user accounts (agent is single-user per Mac)
- Agent-resident AI (all AI still goes through Claude / OpenAI API over network, agent is just the file + git actor)
- Browser UI rendered inside Electron (agent = daemon only; UI stays on Vercel web)
- Code signing / Apple notarization (first-pass skipped; user sees Gatekeeper warning and right-clicks → Open. Can revisit for v2 with Apple Developer account)
- Bundling `npm install` for user projects (agent assumes the user's existing `node` / `bun` / git toolchains — those still need to be on the host Mac)

---

## Context from 7.1 (shipped 2026-04-24)

**What shipped** (PR #128, commit `8702171`):
- `agent/` monorepo sibling to `src/` / `server/`; Electron 33 + electron-builder 25; dual-arch DMG (arm64 + x64)
- Settings window (vanilla HTML/CSS + tsc, no bundler) with WorkPal logo (`Property 1=20.svg`), SecondaryButton styling, StatusTag `success` variant for "RUNNING" (`rgba(2,137,1,0.1)` / `#028901`), API key input, auto-start toggle
- App bundle icon (`.icns`) generated from `Property 1=110.svg`, Tray template PNG from `16 Dark.svg` (8-bit RGBA, dark mode auto-invert confirmed)
- `LSUIElement: true` in Info.plist (menu-bar app, no dock)
- `KeepAlive: false` + single-instance lock + window-close-hides-not-quits
- launchd plist with **dynamic `process.execPath`** + self-heal on app move
- Config atomic write to `~/.workpal-agent/config.json` (0600 perms, trim, `.tmp` → rename)
- Unsigned `.dmg`; README documents the Gatekeeper right-click-Open first-launch flow

**Lessons for 7.2** (observed during 7.1):
- Agent's packaged Electron runtime bundles its own Node — we don't depend on host Node. Good, but it means we re-install the `server/src/routes/*` dependency tree inside `agent/node_modules`. Treat agent as an independent npm workspace.
- `process.execPath` inside a packaged `.app` points into `Contents/MacOS/...` — 7.1's launchd plist uses this correctly. 7.2's API code reading `process.execPath` for CWD-agnostic path resolution should match.
- `app.isPackaged` is the clean check for "am I running from dev or from .app?"; 7.1 uses this to skip launchd registration in dev. 7.2 can use the same signal for path-resolution choices.
- Tray PNG 8-bit RGBA is required for template-image auto-invert; verified via `file` command. Keep this invariant through icon regenerations.
- **Process note** (not a 7.1 issue, just recording): Beibei flagged visual details (Secondary button vs gradient, StatusTag tokens, correct logo paths, app bundle icon, delete Recent log module) in the review cycle — 4–6 UI revisions landed in the same PR via additional commits. 7.2 has less visual surface, but expect similar review-loop density for the API shapes / port / HTTP envelope.

---

## Context for 7.2 (next step)

**Local-only routes (must move to agent)**:
- `server/src/routes/claudeChat.ts` — Claude Agent SDK spawn + streaming
- `server/src/routes/project.ts` — git init on local repo
- `server/src/routes/session.ts` — worktree create / complete
- `server/src/routes/reaper.ts` — orphan worktree cleanup

**Cloud / dual-track routes (stay on Vercel serverless, NOT in agent)**:
- `memory.ts` / `chats.ts` / `projects.ts` / `artifacts.ts` / `connectors.ts` / `usage.ts` — Supabase-backed, already have Vercel equivalents at `api/*.ts`
- `chat.ts` — OpenAI proxy, stateless, Vercel is fine
- `editArticle.ts` / `animations.ts` / `agentVideoStatus.ts` — impl to audit: if the route is pure OpenAI / Supabase / no local file touch, stays on Vercel

**Impl audit expected**: open each of the "local-only" candidates + the 3 gray-area routes, confirm whether it reads / writes the user's local file system, spawns git, or invokes Claude Agent SDK. Produce a final "moves to agent" list before coding.

**Agent side**:
- New `agent/src/main/server.ts` (or similar) — starts an Express (or raw HTTP) server on 127.0.0.1:3001 after Electron is ready
- Port conflict handling: if 3001 is busy (e.g. user runs `npm --prefix server run dev` simultaneously), log the error to Settings and keep agent alive with a visible "port busy" state
- Claude SDK receives `ANTHROPIC_API_KEY` from `readConfig()` (already implemented in 7.1)
- Code sharing strategy between `server/` and `agent/` — open for impl change-list: copy-paste (risk of drift) vs monorepo shared package vs TS path alias

**Not in 7.2**: HTTPS (7.3), frontend rewire (7.4), auto-update (7.5). 7.2 agent stays HTTP-only.

---

## Context from 7.2 (shipped 2026-04-25)

**Route audit (final):**
| Route | Local fs / git / SDK | Move to agent | Notes |
|---|---|---|---|
| `claudeChat.ts` | ✅ all three + spawn `open` | **Moved** | 940 lines, the biggest file; brings `lib/{claudeCode,git,project,reaper,paths,usageLog}.ts` with it. |
| `project.ts` | fs + git init | **Moved** | Baseline commit on project creation. |
| `session.ts` | git diff / merge-ff | **Moved** | Only reads `.git/` presence + runs ff-only merge. |
| `reaper.ts` | git worktree list / remove / prune | **Moved** | Destructive, but already jailed to `~/WorkPal/`. |
| `editArticle.ts` | OpenAI-only | **Stayed on Vercel** | Pure SSE proxy. |
| `animations.ts` | deletes repo-checkout `public/animations/*.mp4` | **Stayed on server/** | Dev-only admin endpoint; Vercel-deploy makes it a no-op (static build). **→ candidate #11**. |
| `agentVideoStatus.ts` | r/w `server/data/agent-video-status.json` | **Stayed on server/** | Already half-broken on Vercel (ephemeral fs). **→ candidate #12**. |

**Locked during impl:**
- Agent main-process module system **flipped CJS → ESM** (`"type": "module"` in agent/package.json, `"module": "NodeNext"` in tsconfig.main.json). Unavoidable: `@anthropic-ai/claude-agent-sdk` 0.2.114 ships ESM-only (`.mjs`), so `require()` from shared code would throw `ERR_REQUIRE_ESM`. preload kept CJS via `.cts` extension (sandbox:true preload can't load ESM).
- **Code sharing: "copy + sync script + drift check"** (not npm workspaces). `scripts/sync-agent-shared.sh` copies `server/src/{routes,lib}/*` → `agent/src/shared/{routes,lib}/*`. `scripts/check-agent-shared-sync.sh` fails with an actionable message on drift. Post-phase-7 revisit if frontend fully migrates off server/ — then promote to workspaces / kill server/ entirely.
- **Supabase anon creds hard-coded** in `agent/src/main/server.ts` (set before shared routes load). Anon key is public by RLS contract; saved one extra Vercel proxy hop in exchange.
- **API key injection**: per-request `requireAnthropicKey` middleware on `/api/claude-chat`. Reads `readConfig()` every call (no cache) so a Settings-side key update flows through on the very next request without agent restart. 503 + bilingual error when key is missing.
- **PATH harvesting** (`agent/src/main/pathEnv.ts`): at boot, before `app.whenReady()`, shell out to `$SHELL -l -c 'printf "%s" "$PATH"'` and merge into `process.env.PATH`. Fallback prepends `/opt/homebrew/bin` + `/usr/local/bin`. Fixes the launchd-GUI PATH trap that would otherwise break `git` / `claude-code-cli` spawns. Smoke-tested against a simulated minimal launchd PATH — git + node resolve.
- **Port-conflict UX**: `startApiServer()` catches `EADDRINUSE`, keeps agent alive, flips `serverState` to `port-busy`. Settings Status tag uses the DS `.status-failed` token (`--status-bg: rgba(220,38,38,0.12) / --status-fg: #C93838` light; `#DC2626` bg / white fg dark) mirrored into `agent/src/renderer/styles.css`. Retry button calls `startApiServer()` fresh; `lsof -iTCP:<port> -sTCP:LISTEN -P -n -t` pulls the holding PID into the card copy.

**Lessons for 7.3:**
- Agent's `dist-main/` layout is now two-level: `dist-main/main/main.js` + `dist-main/shared/**`. 7.3's CA/cert generation should write into `app.getPath('userData')` (i.e. `~/Library/Application Support/WorkPal Agent/`) not into the agent bundle itself — bundle is read-only in packaged mode.
- When 7.4 rewires `fetch('/api/claude-chat')` at Vercel → `https://127.0.0.1:3001/api/claude-chat`, CORS already allows any origin (`origin: true`) so browsers from `workpal-beibei.vercel.app` can hit the local agent. Mixed-content block is the 7.3 (HTTPS) concern, not 7.2.
- `@anthropic-ai/claude-agent-sdk` bundles its own CLI binaries as optional deps (`@anthropic-ai/claude-agent-sdk-darwin-arm64/x64`). electron-builder packaging must not strip `optionalDependencies` — default `asarUnpack` / `files` config preserves them, but verify once 7.3's build pipeline lands (7.2 dev mode ran npm install normally).

**Candidates surfaced (for the Phase 7 living tracker):**
- **#11** `animations.ts` — DELETE endpoint only makes sense from a local dev server (removes a repo-checkout file); Vercel-deploy users get a no-op. Decide whether to drop the endpoint entirely, move to a build-time CLI, or port to agent (if agent ever handles repo-admin workflows).
- **#12** `agentVideoStatus.ts` — writes JSON to `server/data/`; already ephemeral on Vercel. Either promote storage to Supabase (per-user) or drop the server round-trip and make it localStorage-only (revert pre-PR behavior).

**ENOTDIR saga (3 commits to land 7.2 — process note for 7.3 + future spawning work):**
1. Initial commit: SDK spawn `claude` binary → `spawn ENOTDIR` in packaged `.app`
2. Hypothesis 1 (incorrect): `app.asar` virtualization blocks the binary path → fix attempt: `asarUnpack: ["node_modules/@anthropic-ai/claude-agent-sdk/**", "node_modules/@anthropic-ai/**/*.node"]`. Verified `sdk.mjs` physically present in `app.asar.unpacked/`. **Did not fix.**
3. Hypothesis 2 (correct): Even with files unpacked, **`import.meta.url` from inside `sdk.mjs` still resolves through Electron's asar virtual mount**, so SDK computes the binary path with `app.asar/` segment in it. The kernel's `posix_spawn()` doesn't go through Electron's redirection layer → asar segment is a file, not directory → ENOTDIR. **Fix: `asar: false` in `electron-builder.yml`.** No more virtual mount, all files plain on disk. Trade-off: slightly slower module loading + .app size unchanged (~160 MB). Live-test confirmed via planning curl: `Write` tool → file landed → auto-commit → SSE `claude_done` chunk with cost.

**Take-away for 7.3 + 7.4:** any SDK / library that uses `import.meta.url` to find adjacent native binaries inside Electron will trip the same trap. Defaulting to `asar: false` avoids the entire class. Revisit only if `.app` size becomes a real constraint.

---

## Context for 7.3 (next step) — local CA / mkcert-pattern HTTPS

**What "done" looks like for 7.3**:
- `agent/src/main/cert.ts` (new) — generates a local CA on first launch (RSA-4096 or ECDSA P-256), installs into **macOS System Keychain** (`security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain` — requires sudo prompt **once**), issues a server cert from that CA for `127.0.0.1` + `localhost` SANs
- `agent/src/main/server.ts` switches from `http.createServer` → `https.createServer` with `key` + `cert` from cert.ts. **Port stays 3001.** Same Express app handlers — only the listener wraps differently.
- CA + server cert + private key persist under `app.getPath('userData')` (macOS: `~/Library/Application Support/workpal-agent/` — Electron's `app.getName()` reads the npm name, not the productName from Info.plist). **NOT inside the agent bundle** — bundle is read-only in packaged mode (note from 7.2 lessons-for-7.3).
- Settings window: new card showing CA status (`Installed` / `Not installed` / `Error: <reason>`). When not installed, button "Install local CA" triggers the sudo flow. After 7.3 ships, this card replaces the "Status: Running on :3001" tag's role for diagnostics around HTTPS readiness.

**Open for impl change-list (these need answers in your first reply, not code yet)**:
1. **CA library choice** — `node-forge` (pure JS, slow keygen but no native deps) vs `selfsigned` (slim wrapper around node-forge) vs running Apple's `security` CLI as a child process (no JS lib, but separate binary). Pick one + cite trade-off.
2. **CA install timing** — `(a)` proactively at first launch (sudo prompt before user even asks) / `(b)` lazily on first HTTPS request (server boots HTTP + auto-promotes once CA installed) / `(c)` only via Settings button click. Which gives the cleanest UX given that 7.4 will rewire the frontend to HTTPS?
3. **HTTPS-only or HTTP+HTTPS during 7.3** — do we keep HTTP listener on 3001 (for backwards-compat with anyone curling) and add an HTTPS listener on a different port, or hard-flip 3001 to HTTPS-only? Frontend in 7.4 will fetch HTTPS regardless. Recommend hard-flip + simpler code; want to verify.
4. **Cert validity windows** — propose CA: 10 years, server cert: 1 year + auto-renew on each agent launch if <30 days remaining? Or longer server cert (5y) and skip renewal logic? Pick one.
5. **Settings UI shape** — same card style as Status tag, or a new full-width card with "Install local CA" button + uninstall affordance? Mock the bilingual copy strings.
6. **Sudo prompt UX** — `osascript -e 'do shell script "..." with administrator privileges'` (Apple's standard auth dialog) is the only non-Terminal-requiring path. Confirm using that, or propose alternative.

**Hard constraints**:
- CA install must be **idempotent**. Already-installed CA detection: `security find-certificate -c "WorkPal Agent CA" /Library/Keychains/System.keychain` returns 0.
- CA uninstall path: provide a documented `agent/scripts/uninstall.sh` extension that also removes the CA from Keychain (`security delete-certificate -c "WorkPal Agent CA"`). Not a Settings-window button (destructive + rare).
- HTTPS server **must reuse the same Express app** registered in 7.2 — no route re-registration. Wrap the existing app, don't fork.
- 503 / port-busy state machine from 7.2 still applies. Test that the `findPortHolder` lsof path still works on HTTPS listener (it should — TCP-layer LISTEN is the same).

**What's explicitly NOT in 7.3**:
- Frontend rewire (7.4) — frontend keeps fetching HTTP from `localhost:2006` until 7.4
- Auto-update (7.5)
- Apple Developer signing / notarization (still v2 territory)
- Cert revocation list / OCSP stapling (overkill for a single-machine local CA)

**Patterns to reuse from 7.2**:
- Status state machine in `agent/src/main/serverState.ts` — extend with `'cert-missing'` / `'cert-installed'` axis so the Settings card has one source of truth
- Bilingual error copy in `requireAnthropicKey` middleware — same pattern for sudo failures or CA generation errors

**Live-test points planning will verify (heads-up to impl)**:
1. First-launch sudo prompt fires + CA lands in System Keychain (verify via `security find-certificate`)
2. Subsequent launches detect installed CA + skip re-install (idempotency)
3. Server cert serves valid HTTPS — `curl https://127.0.0.1:3001/health` returns OK with no `-k` flag
4. Mac Chrome / Safari open `https://127.0.0.1:3001/health` directly, **no security warning**
5. Mixed-content from `https://workpal-beibei.vercel.app` fetching `https://127.0.0.1:3001/api/*` works (this unblocks 7.4)
6. CA / cert files persist under `~/Library/Application Support/WorkPal Agent/` and survive `.app` reinstall (DON'T re-prompt sudo on .app upgrade)
7. Reinstall path: `rm -rf "/Applications/WorkPal Agent.app"` + new install → CA already in Keychain → no sudo prompt + HTTPS just works
8. Uninstall script removes both `.app` + plist + CA from Keychain (no orphans)

---

## Living doc protocol

- Per Phase 5/6 playbook: update the progress table + add a "Context from 7.X" block when each step merges, with lessons for the next step.
- Non-trivial scope changes → propose amendment here, don't just change code.
- "Locked decisions" above can be re-opened only if a concrete blocker surfaces during impl; otherwise they're binding.
