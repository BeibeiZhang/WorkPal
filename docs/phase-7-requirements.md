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
| **7.5** | GitHub Releases CI on tag push (dual-arch DMG, tag/version guard, unsigned). Boot-time update check via GitHub API + 5th Settings card with bilingual "Download" CTA. Phase 7 ships. | 1–2 d | ✅ Shipped 2026-04-25 (PR [#134](https://github.com/BeibeiZhang/WorkPal/pull/134), commit `70c57b3`) |

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

## Context from 7.5 (shipped 2026-04-25)

**What shipped** (PR #134, commit `70c57b3`, 1 commit — clean ship, zero rework cycles. **Phase 7 complete.**):
- `.github/workflows/release.yml` — tag push (`v*.*.*` glob excludes prereleases) → Setup Node + npm ci → **tag/version guard** (inline bash compare of `GITHUB_REF_NAME` minus `v` prefix vs `package.json.version`, exits 1 with actionable error message on mismatch — this fail-fast saves the ~10min DMG build) → `npm run dist` from `agent/` (`CSC_IDENTITY_AUTO_DISCOVERY: 'false'` + `NOTARIZE: 'false'` belt-and-braces against silent signing) → `softprops/action-gh-release@v2` upload of `agent/dist/*.dmg` glob with `make_latest: 'true'` (this last flag is what makes `/releases/latest` resolve correctly — load-bearing for OnboardingSurface CTA).
- `agent/src/main/updateCheck.ts` (new, ~160 lines) — `parseSemver` (strict `/^\d+$/` per-segment regex rejects prereleases by design; strips leading `v`), `compareSemver` (-1/0/1, three-segment numeric), `fetchLatestRelease` (5s `AbortController` timeout; **never throws**; 404 downgraded to info-level log so empty-Releases case doesn't fill log; `User-Agent` header per GitHub API requirement), `bootstrapUpdateCheck` (top-level orchestration: skip on bad current version, skip on bad latest tag, log + setState). `RELEASES_LATEST_URL` exported and ipc.ts uses it server-side so renderer can't supply arbitrary URLs.
- `agent/src/main/serverState.ts` — `updateState` is the **fourth independent axis** (after `state` / `certState` / port). Three states: `unknown` (default; check failed or hasn't run — card hidden), `up-to-date` (current >= latest — card hidden), `available` (newer release exists — card visible). Two new fields: `updateLatestVersion` (e.g. `"v0.1.1"`) and `updateDownloadUrl` (always points at `/releases/latest` rolling URL, not tag-pinned, so a delay between boot check and click still lands on newest).
- `agent/src/main/preload.cts` — `UpdateState` type + 3 `AgentStatus` fields exposed to renderer, `agent:openLatestRelease` IPC.
- `agent/src/main/ipc.ts` — `agent:openLatestRelease` handler (security: **renderer doesn't pass URL**; the constant is hardcoded server-side, ruling out a renderer compromise opening arbitrary URLs). `agent:getStatus` + `agent:installCa` payload builders extended to include the 3 new update fields.
- `agent/src/main/main.ts` — `void bootstrapUpdateCheck()` after `createTray()`; non-awaited so update check failure can't block boot. Comment explicit: "nothing here can block boot."
- `agent/src/renderer/{index.html, renderer.ts, styles.css}` — 5th Settings card "Update available" / "有新版本可用". Uses `.status-*` DS tokens (success-green for "Update available · 0.1.1" tag), bilingual body, Download CTA opens `/releases/latest` via the IPC. Card hidden when `updateState !== 'available'` so Settings stays compact in the common case.
- `agent/README.md` — "Releasing a new version" section documenting the bump-tag-push flow + post-7.5 status accounting.

**Live-test results (1/2 rounds complete; round 2 is the v1 launch itself)**:
- ✅ **Round 1 — L6 guard fail-fast**. Tagged the PR-branch HEAD with mismatched `v9.9.9` (package.json was `0.1.0`); CI ran ~70s end-to-end, Setup Node + npm ci succeeded, Validate-tag step failed with clear error (`Tag v9.9.9 does not match agent/package.json version 0.1.0` + actionable hint to bump or retag), all subsequent build/publish steps **SKIPPED**, no Release published, tag cleaned up locally + remote. Total CI overhead for fail-fast: ~18s after npm ci. Way better than the 10min DMG build worst case.
- ⏳ **Round 2 — L1+L2+L3+L4+L5 happy path** (the v1 launch flow): bump `agent/package.json` to `0.1.0` if not already, tag `v0.1.0`, push → CI builds dual-arch DMGs and creates the first real GitHub Release. Then bump to `0.1.1`, tag, push → second Release. Restart the running v0.1.0 agent → boot check sees v0.1.1 → 5th Settings card surfaces with Download CTA. **Beibei drives this** as the actual Phase 7 v1 ship.

**Process notes (for the playbook)**:
- **Two clean-ship phases in a row** (7.4 + 7.5, both zero rework cycles). The pattern that worked: planning writes Q&A subsections in the doc with all decisions resolved before impl starts coding; impl self-tests beyond just typecheck (semver had 16/16 unit tests inline before PR opened). Phase 7.3 needed 4 commits and 3 mid-PR live-test bug fixes; 7.4 and 7.5 each needed exactly 1 PR commit cycle. Front-loaded planning + impl-side self-test catches issues earlier in the loop.
- **L6 guard test design**: tagging the PR branch HEAD (not main) for the mismatch test let us validate the workflow file before merge. GitHub Actions runs whatever workflow exists on the tagged commit, so we exercised the actual yml from the PR without merging. Rinse/repeat pattern for any future CI-shape-change reviews.
- **The `make_latest: 'true'` flag is non-default for `softprops/action-gh-release@v2`**: without it, `/releases/latest` may not resolve to the just-published Release (especially if there are existing draft/prerelease entries). Made explicit in the workflow.

**Phase 7 retrospective**:
- 5 / 5 steps shipped over 2 days of calendar (2026-04-24 → 2026-04-25), faster than the 10–13 day estimate. Net ~14 commits + 4 doc commits across 5 PRs.
- Bug-cost distribution: 7.1 zero / 7.2 three (the ENOTDIR saga) / 7.3 three (System keychain, userData path, Chrome PNA) / 7.4 zero / 7.5 zero. The 6 mid-PR bugs in 7.2/7.3 cost ~3-4 hours total of debug + extra commits; planning live-test caught all of them (none made it to main as a regression).
- Most-load-bearing Beibei product calls: Q4 of 7.4 ("WorkPal Agent" untranslated) — applied also to 7.5; product-name decision once made, rippled through 5+ UI strings cleanly.
- Most subtle bug: 7.3 Bug B (LSUIElement menu-bar app + System keychain `SecTrustSettingsSetTrustSettings` admin-domain auth path failing with "no user interaction was possible"). Only catchable on a real packaged `.app` running from launchd context — typecheck + sandbox-preview can't reach it. Shifted the entire CA-trust strategy to login keychain (mkcert pattern, no sudo, Touch-ID friendly).

**Lessons for post-Phase-7 work**:
- **The Phase 7 deployment shape (vercel UI + local Electron agent) is now stable.** Future features that touch local fs / git / SDK go through the agent's existing `/api/*` routes; Phase 7.2's copy-sync mechanism (`scripts/sync-agent-shared.sh` + `check-agent-shared-sync.sh`) keeps server/ and agent/ in lockstep. **Don't drift them — always edit the source-of-truth in `server/src/` and re-sync.** Drift is a real risk now that two copies exist.
- **Auto-update follow-up candidate** (boot-only check is the v1 baseline): periodic 24h `setTimeout` re-check inside the running agent process for users who keep the daemon up indefinitely. Single new line at the bottom of `bootstrapUpdateCheck` once we want it.
- **Apple Developer signing follow-up candidate**: $99/yr enrollment + notarize in `release.yml` would remove the right-click → Open Gatekeeper warning. Defer until user-friction data justifies it (probably a v2 milestone). The unsigned-tier pattern works for the prototype.
- **Onboarding step 3 ("install local CA when prompted") implicitly references 7.3's Settings flow**. If we ever rework Settings naming, OnboardingSurface step 3 + the README "Releasing" notes need to update in lockstep.

---

## Living doc protocol

- Per Phase 5/6 playbook: update the progress table + add a "Context from 7.X" block when each step merges, with lessons for the next step.
- Non-trivial scope changes → propose amendment here, don't just change code.
- "Locked decisions" above can be re-opened only if a concrete blocker surfaces during impl; otherwise they're binding.
