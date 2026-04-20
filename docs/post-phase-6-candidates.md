# WorkPal — post-Phase-6 candidates

Ideas surfaced during Phase 6 planning/testing that are **explicitly not** Phase 6 scope. Captured here so they don't get lost between phases.

Not a spec. Not a promise. Just a backlog with enough context for future pickup. Principle #10 (living docs): adds and removes as ideas land or get discarded.

---

## 1. Weekly activity digest push (Friday afternoons, SF Bay Area events)

**What**: WorkPal auto-sends Beibei a curated message every Friday afternoon — upcoming weekend events / festivals / gatherings in SF Bay Area.

**Why deferred**: Requires three pieces WorkPal doesn't have:
1. **Scheduler** — no always-running process outside `npm run dev`. Either local launchd/cron, cloud cron (Vercel Cron), or a dedicated local agent process.
2. **Passive message injection** — no current flow for "backend drops a new assistant message into a chat by itself". UX decision needed (which chat? notification badge? auto-open?).
3. **Data source** — Tavily `web_search` (Phase 3) could work; or integrate Eventbrite / Meetup APIs.

**Strongly coupled to** the deferred "deployment shape" decision (see `memory/project_architecture_direction.md`). Scheduler question answers itself once deployment shape is locked: Tauri/Electron desktop → launchd; cloud + local agent → server-side cron.

**Effort**: ~3-5 days once deployment shape is picked.

---

## 2. Article re-edit feature in DetailPanel

**What**: The DetailPanel already renders a popover mockup (`src/App.tsx:2426`) with "Message WorkPal with your edits" + 4 preset actions (Shorter / Extend / Formal / Translate) + a custom text input. Currently non-functional. Make it work — user clicks action, AI rewrites article, streams result in place.

**Why deferred**: Real feature work (new endpoint + streaming + state), not polish. Not aligned with Phase 6's project-workflow theme. Better done after Phase 6 completes to keep focus.

**Effort**: ~2-3 days.

**Scope to lock before impl**:
- Presets only for MVP, or presets + free-text at once? (recommend: presets first)
- Translate target language — picker, auto-locale, or hard-coded zh↔en?
- Post-edit UX — replace in place + Undo, or side-by-side before/after?
- Which `card.type` values get edit support — all (meeting/research/ticket/schedule), or only text-heavy (research/meeting)?

**Depends on**: nothing blocking. Can start immediately after Phase 6 merges.

---

## 3. Demo deployment for "send link to recruiters" scenario

**What**: Separate Vercel deployment at e.g. `workpal-demo.example.com` with a build-time demo flag. Disables Claude Code (serverless incompatible), mocks connectors, pre-seeds polished demo chats. Recruiters open the link, explore the UX, see capability without risk of hitting real Beibei data.

**Why deferred**: Job-hunt urgency unclear; Phase 6 sessions have right-of-way; partially depends on deployment-shape decision.

**Effort**: ~1 day quick-and-dirty (flag + deploy); ~3 days polished (rich demo flows + Claude Code simulation screens).

**Workaround in the meantime**: record a Loom for links that need to go out before the deployed version exists.

---

## 4. Bilingual UI scaffold (i18n minimal)

**What**: Install `react-i18next`, add `en.json`/`zh.json` stubs, add a language toggle in the profile menu. Extract ~20 top-level strings (sidebar nav + page titles + welcome copy). Deep component copy stays hardcoded — incremental migration over time.

**Why deferred**: Decided not to pursue now. Primary user (Beibei) reads both languages, no functional pain; introduces ongoing translation tax on every new UI PR during Phase 6/7 active development.

**Effort**: 1-2 days for scaffold, weeks of incremental migration afterward.

**Depends on**: UI stabilizing. After Phase 6 + 7 the visible surface should be stable enough to make the tax manageable.

---

## How to revisit

When Phase 6 completes (6.5 merged), the planning session will:
1. Update `docs/phase-6-requirements.md` one final time
2. Ask Beibei to pick the next direction — any candidate above, a new one, or nothing (pause)
3. If picked, create `docs/phase-7-requirements.md` (or name it by theme; the numbering is convention, not required)

Add new candidates here whenever they surface in a conversation. Remove when a candidate ships or is explicitly discarded.
