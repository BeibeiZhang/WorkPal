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
| **7.2** | Port local-only routes (`claudeChat` / `project` / `session` / `reaper`, + any others impl audits as local-touching) from `server/src/routes/*` into Agent's bundled Node runtime. Agent reads `ANTHROPIC_API_KEY` from config + injects into Claude SDK spawn env. Served over plain HTTP on 127.0.0.1:3001; HTTPS arrives in 7.3. Cloud-data routes (memory / chats / projects / artifacts / connectors / usage) stay on Vercel serverless — NOT in agent. | 2 d | ⏳ Next |
| **7.3** | First launch: generate a local CA, install it into macOS System Keychain (one sudo prompt), then issue a server cert off the CA for `127.0.0.1:3001`. Subsequent launches reuse the existing CA. No per-browser trust warnings. | 2–3 d | ⏳ Pending |
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

## First-message template (currently 7.1)

See the separate Cowork prompt block passed by planning.

---

## Living doc protocol

- Per Phase 5/6 playbook: update the progress table + add a "Context from 7.X" block when each step merges, with lessons for the next step.
- Non-trivial scope changes → propose amendment here, don't just change code.
- "Locked decisions" above can be re-opened only if a concrete blocker surfaces during impl; otherwise they're binding.
