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
| **7.1** | Agent shell: Electron app, menu-bar icon + Settings window (`ANTHROPIC_API_KEY` input, status, Quit/Restart), launchd auto-start, `.dmg` output. **No API content yet.** | 3–4 d | ⏳ Next |
| **7.2** | Port `server/src/routes/*` into Agent's bundled Node runtime. Agent reads `ANTHROPIC_API_KEY` from config and injects into Claude SDK spawn env. All endpoints work, just served over plain HTTP on localhost. | 2 d | ⏳ Pending |
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

## Context for 7.1 (first step)

**What "done" looks like for 7.1**:
- `agent/` directory created under repo root with its own `package.json` + Electron Builder config
- Running `npm --prefix agent run dev` launches an Electron process with a menu-bar icon (no dock icon) and a Settings window
- Settings window fields: `ANTHROPIC_API_KEY` input (persisted to `~/.workpal-agent/config.json`), agent status (`running`), version, tail of startup log, Quit + Restart Agent buttons
- Menu-bar click shows: `WorkPal Agent v0.1.0 • Open Settings • Quit`
- First launch registers `~/Library/LaunchAgents/com.workpal.agent.plist` so the agent auto-starts on next login
- `npm --prefix agent run build` outputs an unsigned `.dmg` to `agent/dist/`
- Agent has **no API content** yet — it's an empty shell, waiting for 7.2

**What's explicitly NOT in 7.1**:
- HTTPS server (7.3)
- Any `/api/*` endpoints (7.2)
- Auto-update (7.5)
- Frontend changes (7.4)
- `.dmg` signing / notarization

**Patterns to share from the existing web app**:
- Design system tokens (colors, typography) — 7.1 does **not** need to share primitive components with the web UI; a simple vanilla-CSS Settings window that visually echoes WorkPal (gradient accent, same `#142740` text, `#E8E8E8` borders) is enough for MVP. Cross-stack React primitive sharing is deferred.
- `assets/icons` — reuse the WorkPal logomark if a suitable asset already exists; otherwise ship a simple mono icon for the menu bar (template image, auto-inverts in dark mode).

---

## First-message template (currently 7.1)

See the separate Cowork prompt block passed by planning.

---

## Living doc protocol

- Per Phase 5/6 playbook: update the progress table + add a "Context from 7.X" block when each step merges, with lessons for the next step.
- Non-trivial scope changes → propose amendment here, don't just change code.
- "Locked decisions" above can be re-opened only if a concrete blocker surfaces during impl; otherwise they're binding.
