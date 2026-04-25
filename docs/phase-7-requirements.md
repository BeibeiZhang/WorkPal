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
| **7.3** | First launch: generate a local CA + server leaf, install CA into macOS **login** Keychain (SecurityAgent Touch-ID auth, no sudo — shifted from System keychain after live-test), serve HTTPS on `127.0.0.1:3001`. Subsequent launches idempotent. Bug-fix pass added `Access-Control-Allow-Private-Network: true` for Chrome 130+ PNA. | 2–3 d | ✅ Shipped 2026-04-25 (PR [#131](https://github.com/BeibeiZhang/WorkPal/pull/131), commit `c92fcf0`) |
| **7.4** | Frontend: replace hostname-based `IS_CLAUDE_CODE_AVAILABLE` with live `/health` detection against `https://127.0.0.1:3001`. Build an "Install WorkPal Agent" onboarding view for when agent is unreachable. Re-point `fetch('/api/claude-chat')` etc. to agent URL. | 2 d | ⏳ Next |
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

## Context from 7.3 (shipped 2026-04-25)

**What shipped** (PR #131, commit `c92fcf0`, 4 commits to land):
- `agent/src/main/cert.ts` (new, ~400 lines) — `node-forge` RSA-2048 local CA (10y) + server leaf (397d, auto-renew at boot when <30d remain). SANs `127.0.0.1` (IP) + `localhost` (DNS). Atomic-write 0600 to `~/Library/Application Support/workpal-agent/cert/` (dir 0700). Renewal failure is soft — returns `renewalError` field, bundle stays valid until true expiry; main.ts surfaces `cert-error` state so user sees it before the silent break.
- `agent/src/main/server.ts` — `http.createServer` → `https.createServer`. `setCertMaterial()` module-level cache so Retry after port-busy reuses without re-reading disk. Single Express app unchanged. `findPortHolder` (lsof) still works (TCP-LISTEN is protocol-agnostic).
- `serverState.ts` — added `certState` as **independent axis** (`unknown | not-installed | installing | installed | error`), orthogonal to `state`. `certError` field auto-appends bilingual reinstall hint via `REINSTALL_HINT` constant.
- `ipc.ts` — `agent:installCa` IPC returns full `AgentStatus` so renderer re-renders both cards in one round-trip.
- New "Local HTTPS" Settings card (full-width, 4 states), bilingual copy, reuses 7.2 `.status-*` DS tokens.
- `agent/scripts/uninstall.sh` — extended to bootout launchd, remove plist, delete CA (loop up to 8× for orphan dup), wipe cert dir, delete app bundle. Interactive y/n prompts.
- `caKeychainStatus()` → **three-state**: `matching` / `mismatch` / `absent`. SHA-1 hash compare between on-disk CA and Keychain entry detects orphan state (CA in Keychain but userData wiped) and funnels to same "click Install" card — install auto-heals by shadowing the orphan.

**Locked decisions answered during impl**:
| Q | Pick | Notes |
|---|---|---|
| CA library | node-forge RSA-2048 | Pure JS, no native dep — sidesteps the 7.2 ENOTDIR spawn trap. ECDSA path in forge is incomplete. |
| Install timing | Proactive at first launch + Settings card button | Decouples cert generation (silent, 1–3s) from Keychain trust install (user clicks button → SecurityAgent). |
| HTTPS-only vs dual | Hard-flip 3001 → HTTPS-only | No external consumers yet to break. |
| Cert validity | CA 10y / leaf 397d / auto-renew <30d | Apple's 398-day rule is public-CA-only in practice but conservative-safe. |
| Settings UI | Full-width card, no Reinstall affordance | uninstall.sh owns destructive path. |
| Sudo UX | **NONE — login keychain, not System** | Changed during live-test (see Bug B below). |

**Three bugs caught by live-test (principle #12 paying dividends):**

1. **Bug A — userData path mismatch**. Doc + uninstall.sh both said `~/Library/Application Support/WorkPal Agent/`, actual Electron runtime path is `~/Library/Application Support/workpal-agent/` because `app.getName()` reads package.json `"name"` (lowercase-hyphenated), NOT electron-builder.yml `productName` (that only sets Info.plist `CFBundleName`). Fix: update path strings everywhere to match actual runtime. Alternative A2 (add `"productName": "WorkPal Agent"` to package.json) was rejected — would orphan 7.1/7.2 Electron caches in the existing dir.

2. **Bug B — System Keychain + osascript admin privileges fails from menu-bar app**. Error: `SecTrustSettingsSetTrustSettings: The authorization was denied since no user interaction was possible`. Root cause: `LSUIElement: true` + `app.dock.hide()` means the agent's audit session doesn't satisfy macOS's "user interaction available" check for SystemDomain trust modification. **Fix: switch to login keychain (mkcert pattern) — user-domain trust, no admin, no osascript, single SecurityAgent Touch-ID auth.** UX is actually *better* than original plan (no sudo password, just Touch ID). Dropped entire osascript wrapper + /tmp staging + finally-cleanup code path.

3. **Bug C — Chrome 130+ Private Network Access preflight header missing**. `fetch()` from `https://workpal-beibei.vercel.app` → `https://127.0.0.1:3001` **hangs silently until abort** in Chrome because server's CORS preflight reply doesn't carry `Access-Control-Allow-Private-Network: true`. Not strictly 7.3 scope (7.4 frontend rewire surfaces this), but bundled into the fix to unblock 7.4 cleanly. Fix: 5-line Express middleware **before** `cors()` that sets the header on every response. Validated end-to-end via Chrome MCP: hang → 8ms JSON.

**Edge cases NOT live-tested (known, low-risk, deferred)**:
- SecurityAgent Cancel path — Retry button exists; certError state has bilingual reinstall hint.
- Renewal failure with stale-leaf fallback — code has `renewalError` field + cert-error state + keeps the old-but-still-valid leaf serving. Simulate via `chmod 0444 ~/Library/Application Support/workpal-agent/cert/` if needed.

**Cleanup follow-up**: `agent/src/main/ipc.ts:85` log message still says "opening sudo prompt" — no sudo anymore. 1-line cosmetic, fix in 7.4 or as passing drive-by.

**Lessons for 7.4:**
- **Agent URL is fixed**: `https://127.0.0.1:3001`. Frontend's `fetch('/api/claude-chat')` must rewrite to absolute URL against that base. Vercel rewrites don't apply (they're build-time, server-side) — this has to be client-side path construction.
- **Agent reachability probe**: `GET https://127.0.0.1:3001/health` → `{status:'ok', pid, port}` is the canonical liveness endpoint. Responds unauthenticated. Use for `IS_CLAUDE_CODE_AVAILABLE` replacement.
- **CORS + PNA + credentials are all green** for cross-origin fetch from vercel. No further server changes needed for 7.4.
- **Trust lifecycle edge case**: if user uninstalls CA via `uninstall.sh` but keeps using the web UI, HTTPS handshakes will start failing. Frontend should treat "TLS error fetching agent" as "agent unreachable" and surface the Install onboarding — don't swallow + show cryptic error.
- **Cert auto-renewal** is silent on success; `certError` only flips on failure. Frontend doesn't need to know about renewal — it's a background concern handled inside the agent.

---

## Context for 7.4 (next step) — frontend rewire to agent

**What "done" looks like for 7.4**:
- `src/lib/isClaudeCodeAvailable.ts` (or equivalent): replace hostname-sniffing with **live probe** against `https://127.0.0.1:3001/health`. Cache result for the session but re-probe on navigation / focus to catch agent-down transitions.
- `fetch('/api/claude-chat')` / `fetch('/api/project/*')` / `fetch('/api/session/*')` / `fetch('/api/reaper/*')` rewrite to `https://127.0.0.1:3001/api/*` when agent is reachable. **Cloud-data routes (memory / chats / projects / artifacts / connectors / usage) stay on Vercel** — no change.
- New "Install WorkPal Agent" onboarding surface when agent unreachable: link to GitHub Releases download + brief "after install, click menu-bar icon to enter API key" steps. Differentiate from the existing auth gate (that's a login, this is a tool install).
- `IS_DEMO` (workpal.vercel.app) path completely unchanged — demo never reaches an agent.

**Planning decisions for impl (answered 2026-04-24, all 6 approved by Beibei)**:

1. **Rename `IS_CLAUDE_CODE_AVAILABLE` → `IS_AGENT_REACHABLE`** in the same 7.4 PR. Hostname-sniff → live HTTPS probe is a full semantic change; legacy name would mislead reviewers. Bundled with the `agent/src/main/ipc.ts:85` log-string drive-by ("opening sudo prompt" → "opening install prompt") as the first cosmetic-only commit.
2. **Probe cadence**: boot + `window.focus` + on any agent-route fetch failure. No periodic poll — `/health` is <5ms local TCP, chatty for no gain. Hybrid covers all transitions (cold boot, agent crash, mid-session `uninstall.sh`).
3. **Probe timeout / retry**: 1500ms timeout. First-boot debounce — one failure → wait 300ms → retry once → only flip `unreachable` after both fail. Closes the ~200ms window between `app.whenReady` and `listen()` bind that would otherwise flash the onboarding surface. Session-lifetime re-probes (focus / fetch-fail) are fail-fast — no retry, user is active and latency matters.
4. **Onboarding copy**: bilingual card, "WorkPal Agent" kept as-is in both languages (product-name decision, not translated). Full copy below. Download link hardcoded to `https://github.com/BeibeiZhang/WorkPal/releases/latest` — 7.5 cuts the release and this URL activates automatically, cleaner than a placeholder and saves a frontend round-trip once 7.5 ships.
5. **Error-state propagation**: front a `fetchAgent()` wrapper over the 4 local routes. Network-layer throw (`TypeError: Failed to fetch` / timeout / TLS handshake error) → `unreachable` → onboarding surface. `response.ok === false` (4xx / 5xx with JSON body) → reuse existing toast + retry UX. Clean try/catch boundary — exception vs resolved response.
6. **Cert uninstalled mid-session**: no hard-refresh. Q2's fetch-failure-triggered re-probe already covers it — any agent-route fetch crashes on TLS → re-probe flips state to `unreachable` → onboarding appears. User re-installs CA → focus event triggers re-probe → back to `reachable`. Keeps the Vercel page state intact and cloud-only features (memory / chats list) still work while agent is absent.

**Onboarding surface copy (approved 2026-04-24)**:

- **Title**: `Install WorkPal Agent to enable local AI editing` / `安装 WorkPal Agent 以启用本地 AI 编辑`
- **Body**: `WorkPal Agent runs on your Mac so the web app can edit local files, manage git, and stream Claude replies. Once it's running, this page reconnects automatically.` / `WorkPal Agent 在你的 Mac 上运行，让网页能编辑本地文件、管理 git、流式返回 Claude 回复。启动后本页面会自动重连。`
- **CTA button**: `Download WorkPal Agent` / `下载 WorkPal Agent` → `https://github.com/BeibeiZhang/WorkPal/releases/latest`
- **Post-install steps** (numbered list under the CTA):
  1. `Open the .dmg, drag WorkPal Agent to Applications.` / `打开 .dmg，把 WorkPal Agent 拖进 Applications。`
  2. `Right-click WorkPal Agent → Open (first-launch Gatekeeper bypass).` / `右键 WorkPal Agent → 打开（首次启动绕过 Gatekeeper）。`
  3. `Click the menu-bar icon → enter your Anthropic API key → install the local CA when prompted.` / `点击菜单栏图标 → 输入 Anthropic API key → 按提示安装本地 CA。`

**Commit sequence for impl**:
- **C1 (cosmetic only)**: `IS_CLAUDE_CODE_AVAILABLE` → `IS_AGENT_REACHABLE` rename + `agent/src/main/ipc.ts:85` log-string fix. No behavior change. Lands first so the 7.4 implementation commits read cleanly against the new name.
- **C2+**: probe implementation, `fetchAgent()` wrapper, 4-route URL rewrite, onboarding surface + copy, error-state split.

**Hard constraints**:
- `IS_DEMO` codepath untouched. `workpal.vercel.app` must still work exactly as today (no agent, mocked connectors, pre-seeded chats).
- Vercel serverless routes for cloud data (memory / chats / projects / artifacts / connectors / usage / editArticle / animations / agentVideoStatus) stay on Vercel.
- The four local-route rewire targets: `/api/claude-chat` (SSE streaming!), `/api/project/*`, `/api/session/*`, `/api/reaper/*`. Nothing else moves.
- Use the agent's existing `/health` endpoint for probes — don't add new endpoints on the agent for 7.4.
- SSE streaming must survive the origin change: `fetch('https://127.0.0.1:3001/api/claude-chat')` with `ReadableStream` body handling must work end-to-end from vercel origin. Agent already has `cors({ origin: true, credentials: true })` + PNA header; browser should be happy.

**What's explicitly NOT in 7.4**:
- `.dmg` distribution / GitHub Releases (7.5)
- Auto-update on agent boot (7.5)
- Anything on the agent process — all changes client-side

**Patterns to reuse from 7.3 live-test**:
- **Chrome PNA header requirement** — verified working. If 7.4 surfaces any other cross-origin fetch quirks, test with MCP browser in same way: `fetch(target).then(r=>r.json())` with abortable timeout, compare against curl's response headers.
- **Three bugs caught by live-test pattern** — impl's typecheck + sandbox-preview can't catch macOS auth-session quirks, Electron packaging quirks, or browser PNA quirks. **Plan for ≥1 rework cycle after first PR**.

**Live-test points planning will verify (heads-up to impl)**:
1. First load on workpal-beibei.vercel.app with agent running → `/api/claude-chat` hits agent, streams SSE, cost lands in chat
2. Agent down → onboarding surface shows with install CTA; cloud-data routes (memory, chats list) still work
3. Transition: agent started mid-session → UI picks up on next probe (or focus event, depending on Q2 choice)
4. `IS_DEMO` (workpal.vercel.app) path unchanged — still works with no agent
5. 7.3 regression: Settings cert install flow still works end-to-end after 7.4's frontend changes
6. Mobile Safari on iPhone hitting workpal-beibei.vercel.app → can't reach agent (different machine) → onboarding surface shows. (iPhone doesn't get the agent yet; that's a future cross-device story.)

---

## Living doc protocol

- Per Phase 5/6 playbook: update the progress table + add a "Context from 7.X" block when each step merges, with lessons for the next step.
- Non-trivial scope changes → propose amendment here, don't just change code.
- "Locked decisions" above can be re-opened only if a concrete blocker surfaces during impl; otherwise they're binding.
