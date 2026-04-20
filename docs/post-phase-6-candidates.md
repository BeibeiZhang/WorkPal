# WorkPal — post-Phase-6 candidates

Living backlog of what might come after Phase 6 (shipped 2026-04-20). Each item has enough context for a fresh session to pick up cold. Principle #10 living doc — add as ideas surface, remove when shipped or discarded, move between states as decisions happen.

**States**: `candidate` (ideas for later) · `in-flight` (currently being built) · `decided-next` (next to start, prompt-ready) · `blocked` (waiting on an upstream decision)

---

## 1. `shipped` — Article re-edit feature in DetailPanel

**Shipped**: 2026-04-19 (PR [#87](https://github.com/BeibeiZhang/WorkPal/pull/87), commit `0456668`). Impl session delivered presets-only MVP + "Save to card" + per-preset streaming with Cancel/Undo.

**Implemented scope** (impl picked during change list):
- 4 presets only (no free text) — Shorter / Extend / Formal / Translate
- Translate is auto-detect bidirectional (EN↔中文), no target picker
- Post-edit UX = stream-replace + one-level Undo + manual "Save to card" (commits back to `research.summary` / `meeting.content`)
- Editable card types: `research` + `meeting`; ticket / schedule / demo fallback opt out (popover gated by `editable` prop)

**Backend**: new SSE endpoint `POST /api/edit-article` ([`server/src/routes/editArticle.ts`](../server/src/routes/editArticle.ts)) using `gpt-4o-mini`. Validates preset enum + rejects empty / >20k-char input with 400. Abort propagates `res.on('close')` → `AbortController` → OpenAI stream.

**Live-test results** (2026-04-19 planning session):
- Shorter / Extend / Formal happy path: ✅ all stream correctly, state machine clean
- Translate **EN→中文**: ✅ reliable
- Translate **中文→EN**: ⚠️ flaky on long Chinese articles — gpt-4o-mini keeps emitting Chinese instead of following "If mostly Chinese → English" instruction. Reproduced directly via curl with the exact same payload; short Chinese input works, long input ~800 chars does not. **Not wiring — model steer-ability**. Tracked as candidate #6 for follow-up fix.
- Cancel mid-stream: ✅ rollback to snapshot, Rewriting banner + Cancel button clear, backend stream aborts
- Validation errors (empty / bad preset / >20k): ✅ 400 + clear message
- Save to card persistence: ✅ re-open panel shows saved content as new baseline
- Ticket / schedule opt-out: ✅ verified via code (editable=false default, popover gated)

**Risk decision**: shipped with known issue. CN→EN flake violates principle #8 (bilingual day 1) and is worth fixing, but the other 3 presets + EN→CN all work and the path isn't blocking other work. Fix tracked as candidate #6.

---

## 2. `shipped` — Quick demo deployment to Vercel

**Shipped**: 2026-04-19 (PR #TBD). Impl session delivered `VITE_WORKPAL_DEMO` build flag + `IS_CLAUDE_CODE_AVAILABLE` runtime detection + bilingual demo badge / explainer + seed chats + read-only memory + mocked connectors + static Changes panel on the `alcohol-delivery` seed chat.

**Implemented scope** (impl picked during change-list, planning confirmed):
- Two orthogonal flags in [`src/lib/demoMode.ts`](../src/lib/demoMode.ts):
  - `IS_DEMO` — build-time, `import.meta.env.VITE_WORKPAL_DEMO === 'true'`, inlined by Vite with no `define` plumbing
  - `IS_CLAUDE_CODE_AVAILABLE` — runtime, `hostname === 'localhost' || '127.0.0.1'`. Covers **both** Vercel deployments (demo + self-use) cleanly, since neither can host the Claude Agent SDK
- Demo-only data in [`src/data/demo/`](../src/data/demo/) (separate from `src/data.ts`, so the real app's seed stays untouched): richer chat list, seed memories, static Changes-panel rows
- `DemoBadge` wired **inside** `HeaderBar` so it auto-renders on every page without per-page plumbing. Click → bilingual modal with capability matrix + GitHub link
- Memory page in demo: read-only banner (bilingual) + seed entries visible, Add / Edit / Delete UI completely hidden. Supabase client never initialized (principle #6 lazy-clean); localStorage never written (visitors always land on pristine state)
- Connectors page in demo: all Connect buttons show "Try with demo data / 使用 Demo 数据", click flips local statusMap to "Connected (Demo)"; no OAuth popup, no password prompt, no server fetch
- Claude Code Complete Session button: **tri-state** in [`TaskContextPanel.tsx`](../src/components/TaskContextPanel.tsx):
  - localhost: normal
  - demo (my-workpal): visible but `disabled` + bilingual title tooltip
  - self-use (workpal-beibei): footer hidden entirely
- `postInitProject` and `postReaperRun` also skip on both Vercel builds — no noisy 500s in the console
- `shouldUseClaudeCode` short-circuits to `false` off-localhost, so code/file intents fall back to the OpenAI chat path
- Full bilingual coverage of every new user-visible string (#8): DemoBadge label + modal, Memory banner, Connect labels, Complete-Session tooltip

**Non-goals in this PR** (kept out by the change-list):
- Pre-recorded Claude Code capability video — static Changes panel is enough for v1
- Backend tool-call wall (if the AI model calls gmail/calendar tools in demo, backend 500s show as tool errors in-chat — accepted v1 edge case, tracked if it becomes a real issue)
- Vercel CLI / IaC scripts — Beibei pastes env vars manually into the dashboard per [`docs/vercel-env-setup.md`](./vercel-env-setup.md)

**Risk classification (as executed)**: medium. Planning live-tests three hostnames: the deployed `my-workpal.vercel.app` (incognito) + `workpal-beibei.vercel.app` + `localhost:2013`. Verification checklist is in the PR description.

**Follow-ups** (not blocking ship):
- Candidate #6 — CN→EN translate reliability fix (unrelated, still outstanding)
- If HR feedback shows connector-tool-call errors are confusing, add a tool-call gate as a separate tiny PR
- Demo deployment data itself (HR reaction patterns) feeds back into candidate #5 deployment-shape decision — see §5 trigger

---

## 3. `decided-next` — Bay Area weekend digest as shareable webpage

**Unblocked 2026-04-20**: earlier blocked on #5 deployment shape. New product vision collapses the dependency — everything runs on Vercel serverless (Cron + SSR + Supabase), no local runtime needed.

**Product vision**: every Thursday night, a Vercel Cron generates a curated "this weekend in the Bay Area" webpage. Beibei opens Overview → sees a card with the latest edition's cover → either skims in-app or copies the public URL to share with friends / family. Each week gets its own permalinked URL.

**Scope (locked 2026-04-20)**:
- **Geographic scope**: SF + entire Bay Area (East Bay / Peninsula / South Bay)
- **4 categories**: 节日 festivals / 活动 events / 展览 exhibitions / 集市 markets & fairs
- **~3–5 items per category** (~12–20 total)
- **Per item**: multiple images, location, price, date/time, official URL
- **Public URL**: `workpal-beibei.vercel.app/bay-area-weekend/<ISO-week>` — readable without login, share-friendly (Open Graph preview, social-embed metadata)
- **Overview card**: latest edition's cover image + title + "N spots this weekend" label + click-through
- **Bilingual page (page-local, NOT full-app i18n)**: cron runs OpenAI twice (EN + 中文) at write time, stores both copies in Supabase. Page has EN/中 toggle top-right. Rest of WorkPal stays as-is (#4 still parked).
- **Trigger**: Vercel Cron `0 20 * * 4` Pacific Time (Thursday 8pm PT)
- **Data source**: Tavily web search + OpenAI for structuring, image-picking, translation. No external API integrations (Eventbrite / Funcheap / Meetup) in v1 — add as follow-up if Tavily quality disappoints.

**Architecture**:
- New Supabase table `bay_area_digests` (public-readable via RLS, write via service role from cron only)
- New backend route `POST /api/digests/generate` — cron entry, fetches + structures + translates + writes row. Idempotent on ISO-week key.
- New backend route `GET /api/digests/:week` + `GET /api/digests/latest` — frontend data source
- New frontend route `/bay-area-weekend/:week` — React SPA, client-fetches data, renders digest with EN/中 toggle
- Overview page gains a `WeekendDigestCard` that calls `/api/digests/latest`

**Non-goals for v1** (impl should not scope-creep):
- Push notifications / email (just in-app card + URL)
- Historical archive browser (URLs discoverable by week, no index page)
- Editorial override UI (whatever OpenAI generates ships — impl self-tests output quality)
- Custom location / distance / preference filters
- User-contributed events

**Open for impl change-list**:
- Exact Supabase schema (JSONB column per category? separate rows per item?)
- EN/中 toggle UX — URL param `?lang=zh` vs stateful button vs both
- Image hosting — Tavily returns URLs, re-host via Supabase storage or serve the original domains?
- Cron retry / failover policy if Tavily returns weak results
- Overview card placement (above / below existing cards?)
- Open Graph metadata strategy (static or per-digest)

**Effort**: 3–5 days.

**Risk classification**: **medium**. Planning session will live-test:
- Public URL in incognito (no login, readable, OG preview renders on share)
- EN/中 toggle doesn't leak the other language's copy
- Cron route idempotent (POST twice same week → no duplicates)
- Overview card reads latest, not stale

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

## 6. `candidate` — Translate CN→EN reliability fix (post-#1 follow-up)

**Surfaced**: 2026-04-19 planning-session live test of PR #87.

**Bug**: Translate preset reliably detects direction for short Chinese input (~90 chars) but fails on long Chinese articles (~800+ chars). Model (`gpt-4o-mini`) keeps emitting Chinese instead of following the "If mostly Chinese → English" branch of the conditional prompt. Reproduced directly via curl with the exact UI payload — not a wiring bug, it's a prompt + model steer-ability issue.

**EN→中文** is reliable. Only **中文→EN** flakes on long inputs.

**Impact**: partial violation of principle #8 (bilingual day 1). Users with long Chinese meeting notes / research summaries can't translate them to English.

**Possible fixes** (impl session to pick one during change-list review):
- Upgrade the translate preset specifically to `gpt-4o` (heavier, less flaky for conditional instructions)
- Rewrite the prompt as a forced 2-step: "STEP 1: detect input language. STEP 2: target = the other language. STEP 3: output in target language ONLY, never match input." with few-shot examples
- Frontend language-detect + send explicit `translate-to-english` vs. `translate-to-chinese` preset variants (two API prompts, no conditional)

**Effort**: small — 1-2 hours, mostly prompt-tweaking + re-testing. Low risk unless swapping models.

**Depends on**: nothing. Can be picked any time.

**Risk classification**: low (prompt-only change, same API surface). Impl self-tests (send long CN article both directions, confirm target language output).

---

## How to revisit / add candidates

When a candidate ships → remove or mark `shipped`.
When a new idea surfaces in discussion → add a `candidate` entry with enough context to pick up cold.
When something moves from blocked → decided-next → in-flight → shipped, update the state label + any newly locked details.
