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
| **7.4** | Frontend: hostname-based `IS_CLAUDE_CODE_AVAILABLE` → live `/health` probe against `https://127.0.0.1:3001`. `fetchAgent()` wrapper over 10 local-route fetch sites. New `OnboardingSurface` (bilingual, "WorkPal Agent" untranslated). Boot probe + window.focus + on-fail re-probe with 1500ms timeout / 300ms boot debounce. | 2 d | ✅ Shipped 2026-04-25 (PR [#133](https://github.com/BeibeiZhang/WorkPal/pull/133), commit `641c85b`) |
| **7.5** | GitHub Releases as CDN. `.dmg` build CI. Optional auto-update (agent polls latest release on boot). | 1–2 d | ⏳ Next |

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

## Context from 7.4 (shipped 2026-04-25)

**What shipped** (PR #133, commit `641c85b`, 4 commits — clean ship, zero rework cycles):
- `src/lib/agent.ts` (new, ~150 lines) — `AGENT_BASE_URL` constant, three-state machine (`unknown` / `reachable` / `unreachable`), module-level `state` + listener Set, `useAgentState` hook (with `useState`-vs-listener-add race protection), `isAgentCurrentlyReachable()` sync getter for plain functions (e.g. `intentRouter.shouldUseClaudeCode`), `bootProbe()` (IS_DEMO short-circuit + 1500ms timeout + 300ms-debounced single retry), `triggerReprobe()` (no retry, fail-fast), `fetchAgent()` wrapper (network-throw → `unreachable` + re-probe + `AgentUnreachableError`), `initAgentProbe()` (boot probe + `window.focus` listener with Strict-Mode-safe teardown).
- `src/components/OnboardingSurface.tsx` (new) — bilingual install card, `PrimaryButton` + DS tokens (`panel-border`, `type-h2-emphasized`, `type-detail`, `var(--color-bg-message)`), 3 numbered post-install steps, hardcoded `https://github.com/BeibeiZhang/WorkPal/releases/latest` CTA.
- `src/lib/api.ts` — 10 fetch sites switched to `fetchAgent` (the 4 doc-listed router prefixes plus 5 sub-paths under `/api/claude-chat/*` for permission/undo/open-folder/open-file/read-file). `streamClaudeChat` wraps in try/catch yielding a bilingual error chunk on `AgentUnreachableError`.
- `src/App.tsx` — mount `OnboardingSurface` between the existing `<Onboarding/>` first-time gate and the chat SplitView, gated `!IS_DEMO && agentState === 'unreachable'`. Sidebar + cloud-only views keep working when agent is down (only the chat surface flips). `useEffect(() => initAgentProbe(), [])`. project-init effect: gate on `agentState === 'reachable'`, deps include `agentState` so deferred init fires when state settles. reaper effect: same gate + new `reaperRanRef` to preserve "one sweep per mount" semantics under the new state-driven re-fire window.
- `src/lib/intentRouter.ts` — uses sync getter `isAgentCurrentlyReachable()` (plain function context, not hook).
- C1 cosmetic batch: `IS_CLAUDE_CODE_AVAILABLE` → `IS_AGENT_REACHABLE` grep-replace across `src/` + `agent/src/main/ipc.ts:85` log string `"opening sudo prompt"` → `"opening install prompt"` (post-7.3 keychain install uses Touch-ID, no sudo). Bundled in C1 so reviewer scans rename without semantics. `demoMode.ts:12` keeps a one-line comment breadcrumb pointing old name → new — intentional migration aid.

**Live-test results (7/7 ✅, all from planning, end-to-end via Chrome MCP + curl + agent log inspection)**:
1. ✅ T1 IS_DEMO regression — demo URL loads ChatPanel, no onboarding (mount guard correct)
2. ✅ T2 Boot probe with agent on — preview loads, ChatPanel renders, /health hits agent in ~3ms
3. ✅ T3 Real fetch-fail with agent down — `pkill "WorkPal Agent"` + reload → OnboardingSurface renders fully (bilingual title/body, gradient CTA, 3 numbered steps)
4. ✅ T4 Recovery — restart agent + reload → ChatPanel back (functionally equivalent to focus re-probe path)
5. ✅ T5 SSE cross-origin — vercel preview → click "Create performance goals" chip → CORS preflight OPTIONS 204 → POST `/api/claude-chat` → full Claude markdown reply renders → action footer shows (stream closed cleanly). The 7.4 unblock for cross-origin SSE works end-to-end in Chrome 147 with the 7.3 PNA header.
6. ✅ T6 Cloud routes alive when agent down — sidebar Recents/Projects/Account menu all populated from Vercel routes during the agent-down window
7. ✅ T7 Mobile Safari — iPhone hits the preview URL → no `127.0.0.1` reachability → OnboardingSurface renders

**Process notes (for the playbook)**:
- **Clean ship — zero rework cycles.** Impl answered 6 questions cleanly, Beibei picked Q4 option A (no translation), impl shipped 4 commits + self-tested before opening PR. Planning code-review found no blockers; only post-merge polish item is the `demoMode.ts:12` comment breadcrumb (intentional, not a bug). Contrast with 7.3 which needed 4 commits + 3 mid-PR fixes for live-test bugs (System keychain, userData path, PNA). 7.4's narrower client-side surface area + impl's use of monkey-patched fetch in self-test caught most issues before PR.
- **Live-test ROI is real.** The MCP-driven Chrome flow surfaced one tooling-only issue (`computer.type` doesn't fire React onChange in some configs — coordinate-based click on chips worked instead). End-state verification was unaffected.
- **Role boundary lapse mid-cycle.** Impl pre-emptively wrote a "planning decisions" doc commit (`3e7bfc2`) before planning had updated the doc — content was canonical and approved, but the cross-role write was caught in retrospect. No revert; lesson recorded for future cycles (impl writes code, planning writes doc).

**Lessons for 7.5**:
- **The hardcoded URL `https://github.com/BeibeiZhang/WorkPal/releases/latest` is now load-bearing.** OnboardingSurface CTA points there. As soon as 7.5 cuts the first GitHub Release with a `.app.dmg` asset, that URL self-activates — no frontend change needed. **If 7.5 changes the release tag scheme or asset name expected by `latest`, OnboardingSurface CTA breaks.** Stick with GitHub's `/releases/latest` redirect convention.
- **Agent base URL is a single constant** (`AGENT_BASE_URL = 'https://127.0.0.1:3001'` in `src/lib/agent.ts`). 7.5's auto-update story doesn't need to touch it — agent self-replaces in place; URL stays.
- **`/health` is unauthenticated and stable.** 7.5 can rely on `/health` returning `{status, pid, port}` for any "is the agent alive after auto-update" checks the impl chooses to add.
- **Cert renewal is silent on success** (cert.ts:266+ from 7.3). Auto-update flow doesn't need to handle cert lifecycle — agent regenerates leaf at boot when <30 days remain, regardless of update path.

---

## Context for 7.5 (next step) — GitHub Releases distribution + auto-update

**What "done" looks like for 7.5**:
- GitHub Actions workflow that, on a tagged release (e.g. `v0.1.0`), builds the `.dmg` (already-working `npm run dist` from 7.1) and attaches it as a release asset. Tag → release → asset, all automated.
- The `https://github.com/BeibeiZhang/WorkPal/releases/latest` URL (already wired into 7.4's OnboardingSurface CTA) auto-resolves to the most recent tagged release with a `.dmg` asset that users can click-to-download.
- Optional but valuable: agent boot-time check against the GitHub Releases API for a newer version → surface in Settings (or auto-download + prompt restart). MVP could ship without auto-update if scope tightens.
- README + onboarding hint that says "right-click → Open" the `.app` on first launch (Gatekeeper bypass for unsigned). 7.4 OnboardingSurface step 2 already covers this in-product; the README is the out-of-product redundant copy.

**Open for impl change-list (answer in first reply, no code yet)**:
1. **Auto-update scope** — `(a)` ship 7.5 as distribution-only (just CI + Releases + onboarding link works), defer auto-update to a future phase / `(b)` include a minimal "check on boot, log + Settings notice if newer" / `(c)` full auto-update with download + relaunch. Each adds time. (a) is fastest to v1; (b) gets users on the latest fastest without writing self-replace code; (c) is full polish but adds the most surface.
2. **Tag scheme + version source-of-truth** — `agent/package.json` already has a `version` field (currently `0.1.0`). Drive tags from package.json bumps (`v${version}`) or a separate `app-version` somewhere? CI release tag must match what `app.getVersion()` returns at runtime so users know which version they're on.
3. **CI runner choice** — GitHub-hosted macOS runner (~10 min build) or a self-hosted runner (faster, but Beibei has to maintain). Note: dual-arch DMG (arm64 + x64) needs cross-build; GitHub macOS runners support both since the runner itself is arm64 + x86_64 builds via electron-builder.
4. **Code signing** — Phase 7 locked decision was "skip Apple Developer signing for v1, users right-click → Open". Confirm 7.5 stays unsigned, OR use this CI moment to also wire up an Apple Developer cert (Beibei would need to enroll, $99/yr) and notarize so users don't see Gatekeeper warning. Recommend defer to v2 unless Beibei has the developer account already.
5. **Auto-update channel** — if (b) or (c): just `latest` (always pull newest), or expose `stable` vs `beta` channels (more infra, low MVP value)?
6. **Update prompt placement** — if (b) or (c): Settings card (consistent with 7.1's Local HTTPS / API key cards) or a tray-menu badge ("New version available")? Settings card aligns with the existing UI vocabulary.

**Hard constraints**:
- The `.dmg` build command stays `npm run dist` from `agent/` (electron-builder, dual-arch). 7.5 wraps this in CI but doesn't change the build itself.
- Tag-driven release flow — pushing `v0.1.0` on `main` triggers the CI + asset upload. No manual upload steps in the happy path.
- `https://github.com/BeibeiZhang/WorkPal/releases/latest` resolution **must continue to point to a `.dmg` asset** (not a `.zip` of source). 7.4's OnboardingSurface CTA depends on this.
- Don't rename the .app or its bundle identifier (`com.workpal.agent`). userData paths, Keychain CA name, launchd label — all keyed off this identifier from 7.1/7.2/7.3.
- Unsigned `.app` distribution stays acceptable for v1 (locked decision from Phase 7 kickoff). Gatekeeper warning + right-click → Open is the documented user step.

**What's explicitly NOT in 7.5**:
- Apple Developer enrollment / signing / notarization — defer to v2
- Windows / Linux builds — defer to v2 (Phase 7 locked decision: macOS only)
- Self-hosted update server (e.g. Sparkle / electron-updater's own server) — GitHub Releases is the CDN
- Multi-arch wars beyond what 7.1's electron-builder already handles (dual-arch DMG)

**Patterns to reuse from 7.4 + 7.3 + 7.2**:
- **Bilingual copy** in any new UI strings (keep "WorkPal Agent" untranslated per Q4 of 7.4 — same product-name decision applies to 7.5 update prompts).
- **`.status-*` DS tokens** for any new status surfaces (success / failed / neutral — 7.2's port-busy + 7.3's Local HTTPS card established the convention).
- **Try/catch boundary discrimination** if 7.5 adds the auto-update fetch — a network-layer throw to GitHub API → log silently (it's a non-critical background check); a 4xx/5xx response → surface in Settings.
- **State machine in `serverState.ts`** is the right home for "update available" status if 7.5 chooses (b)/(c). Add as an independent axis (4th, after state / certState / port).

**Live-test points planning will verify (heads-up to impl)**:
1. CI builds the `.dmg` on a tag push and uploads to the Release page (verify by inspecting the resulting Release in GitHub UI)
2. `https://github.com/BeibeiZhang/WorkPal/releases/latest` resolves to the new asset (curl follow-redirects + check Content-Type)
3. Click the OnboardingSurface CTA on a fresh-install browser → downloads the `.dmg` (the 7.4 → 7.5 handshake)
4. Install + run the downloaded `.app` → 7.1/7.2/7.3 flows still work (cert install, HTTPS listener, etc.) — full E2E that the CI build is functionally identical to local `npm run pack`
5. If (b)/(c) ships: bump version in package.json, push a new tag, watch the running agent detect + surface the update notice
6. Gatekeeper right-click → Open works on the CI-built `.app` for first-time users (test on a clean macOS user account or a fresh Mac if available)

---

## Living doc protocol

- Per Phase 5/6 playbook: update the progress table + add a "Context from 7.X" block when each step merges, with lessons for the next step.
- Non-trivial scope changes → propose amendment here, don't just change code.
- "Locked decisions" above can be re-opened only if a concrete blocker surfaces during impl; otherwise they're binding.
