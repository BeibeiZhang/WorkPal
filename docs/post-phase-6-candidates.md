# WorkPal — post-Phase-6 candidates

Living backlog of what might come after Phase 6 (shipped 2026-04-20). Each item has enough context for a fresh session to pick up cold. Principle #10 living doc — add as ideas surface, remove when shipped or discarded, move between states as decisions happen.

**States**: `candidate` (ideas for later) · `in-flight` (currently being built) · `decided-next` (next to start, prompt-ready) · `blocked` (waiting on an upstream decision)

---

## 1. `in-flight` — Article re-edit feature in DetailPanel

**Started**: 2026-04-20, Cowork impl session in progress.

**What**: DetailPanel's popover mockup ([`src/App.tsx:2426`](../src/App.tsx)) with 4 preset edit actions (Shorter / Extend / Formal / Translate) + custom text input is non-functional. Make it work — user clicks, AI rewrites the article, streams result in place.

**Status**: Prompt sent to impl session. They'll propose change list + 4 scope decisions (preset-only vs. preset+free-text MVP / translate target language / post-edit UX / which card types supported) for planning-session review.

**Effort**: 2-3 days.

**Depends on**: nothing.

**Risk classification**: medium (streaming + state replacement + possibly new endpoint). Planning session **will live-test** — acceptance tests each preset happy path, Cancel/error, multiple card types.

---

## 2. `decided-next` — Quick demo deployment to Vercel

**Decision**: 2026-04-20. After candidate #1 impl session settles, this is next to prompt out.

**What**: Ship a shareable URL (e.g. `workpal-demo.yourdomain.com`) that HRs / interviewers can click and explore. Same codebase as the real app, deployed separately with a build-time demo flag.

**Why now**: Beibei's job-hunt scenario is specifically "send link to HR". Without a demo deployment there's no shareable artifact — only `localhost:2006` (dev) or a `.dmg` (doesn't exist yet, and HRs won't install anything). Quick version is ~1 day of work.

**Architecture clarification locked**:
- **Two Vercel deployments from the same GitHub repo** (not two codebases):
  - `workpal-demo.yourdomain.com` — built with `VITE_WORKPAL_DEMO=true` — mocked features, seeded data, no agent dependency
  - `app.yourdomain.com` — built with the flag off — real features, expects a local agent. This is the eventual "production" target IF we go deployment shape C. Can coexist with `localhost:2006` for dev — both work independently.
- Beibei maintains one codebase; Vercel auto-deploys both on every push. TestFlight-beta + App-Store analogy.

**Feature matrix for demo mode** (locked during 2026-04-20 discussion):

| Feature | Demo? | Reason |
|---|---|---|
| OpenAI chat streaming | ✅ yes | Phase 2 infra, just fetch — works on Vercel serverless |
| Voice mode + transcription | ✅ yes | Whisper API call, no native deps |
| Voice + image attachment | ✅ yes | base64 → OpenAI vision, fetch |
| Web search (Tavily) | ✅ yes | Fetch API, Phase 3 |
| Image search (Unsplash) / video search (YouTube) | ✅ yes | Fetch APIs |
| Memory system | ✅ yes | localStorage, no server dep |
| Gmail / Calendar OAuth | ⚠️ mock | Technically works but don't want HR OAuthing real Google accounts into Beibei's demo app. Show "Try demo data" button → seeded data |
| Claude Code route (`/api/claude-chat`) | ❌ disable | Native binary + persistent cwd — structurally incompatible with Vercel serverless |
| Phase 6 Complete Session / merge / reaper | ❌ disable | Depends on Claude Code backend, same reason |
| Demo of Claude Code capability | (design question) | Pre-recorded screen video, or pre-seeded completed session with static data. Impl session decides during change-list review |

**Scope to lock during change-list review** (impl proposes, planning confirms):
- `VITE_WORKPAL_DEMO` flag name and what exactly it toggles
- Seed data shape (reuse `INITIAL_CHATS`?  richer?)
- Mock connector UI: "Try demo data" button copy, what data to show
- "Demo" visual badge — placement (top bar? corner?)
- Vercel config — rewrite rules for SPA fallback already in `vercel.json`, double-check

**Risk classification**: medium-risk (build flag + cross-deployment consistency + potential for demo data leaking real state). Planning session will live-test by visiting the deployed demo URL in a private browser session.

**Effort**: ~1 day for the flag + seed data. Polished version (richer demo flows, Claude Code capability video) is Phase 7+ or optional follow-up.

---

## 3. `blocked` — Weekly SF activity digest push (Friday afternoons)

**Blocked by**: candidate #5 (deployment shape decision). Without a decision on where WorkPal runs long-term, the scheduler infrastructure (launchd? Vercel cron? always-on local daemon?) can't be designed without risk of rewriting.

**Otherwise unchanged from original entry** — see git history for 2026-04-19 version if needed.

---

## 4. `candidate` — Bilingual UI scaffold (i18n minimal)

Deliberately parked. Re-evaluate when UI surface stabilizes. Unchanged from 2026-04-19 entry.

---

## 5. `blocked` / `deferred-by-design` — Deployment shape decision

**Three shapes on the table** (locked in `memory/project_architecture_direction.md`):
- **A. localhost-only** — `npm run dev` + browser. Current. No sharable link, dev-only.
- **B. Tauri / Electron desktop app** — download `.dmg`, double-click. Works offline; no terminal; can't send a URL link; users re-install on each machine. User UX very low-friction once installed.
- **C. Web + local agent** — Vercel-hosted frontend, user installs an agent (packaged as a `.dmg` like Dropbox / Docker Desktop — **does NOT require the user to open a terminal**, just double-click install and menu-bar icon appears). User gets a shareable URL once set up; agent does file/git ops that browsers can't.

**Current state**: deferred until candidate #2 (demo deployment) ships + gets some real HR usage data. Principle: observation-driven decision beats pure analysis.

**Discussion notes from 2026-04-20**:
- **CLI clarification** — "install a CLI" in option C was initially confusing for non-technical users. The reality: the agent can be packaged as a normal `.dmg` app that auto-starts on login and runs in the menu bar. Dropbox / Docker Desktop / Cloudflare WARP all distribute this way. Users never open a terminal.
- **Agent packaging scope** — if option C gets picked, the work to package Node + Claude SDK + launchd plist + menu-bar UI + API-key onboarding flow is ~1-2 weeks. Significant but not enormous.
- **Demo deployment is partially option-C foundation** — ~70% of demo deployment work is shape-agnostic (connector-disabled graceful state, seed data, demo flag). If we eventually pick C, demo work rolls forward. If we pick B, demo work is separate throwaway but independently useful.
- **User segment heuristic**:
  - Developer users → C acceptable
  - Non-technical users (PM / designer / general knowledge worker) → B smoother
  - Mostly self + occasional demo → stay at A + demo deployment indefinitely

**Decision triggers**: after demo ships + runs for a while + Beibei has real HR-reaction data and self-use feedback across devices.

---

## How to revisit / add candidates

When a candidate ships → remove or mark `shipped`.
When a new idea surfaces in discussion → add a `candidate` entry with enough context to pick up cold.
When something moves from blocked → decided-next → in-flight → shipped, update the state label + any newly locked details.
