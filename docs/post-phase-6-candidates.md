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

## 3. `decided-next` — Artifact generation capability (first template: Bay Area weekend)

**Unblocked 2026-04-20**, re-scoped 2026-04-20 after vision discussion with Beibei. Supersedes earlier "fixed Bay Area weekend digest" framing (see commit `f9ea7f1`).

**Actual vision** (2026-04-20):

> "这是一个案例。通过这个案例,以后我可以直接跟 WorkPal 说写这样的周报。"

WorkPal gains a **generic "artifact" primitive**. User asks in chat — e.g. "写个 SF 美食周刊" or "给我生成湾区科技活动月报" — and WorkPal:
1. Intent-routes the prompt to the artifact pipeline
2. Backend runs Tavily web search + OpenAI to generate structured content (both EN + 中文)
3. Writes an `artifacts` row to Supabase
4. Returns a public shareable URL `/artifact/<slug>`

Each new **kind** of digest is a **template** (config / prompt variant), not a new engineering feature. Bay Area weekend digest ships as the **first template** alongside the primitive.

**Scope (locked 2026-04-20)**:

- **Primitive endpoint: `POST /api/artifacts/generate`** — accepts `{ templateId, topic?, lang?, weekKey? }`. Runs Tavily + OpenAI, writes artifact row, returns `{ id, slug, url }`. Used by **both** chat-initiated and cron-initiated generation.
- **Supabase**: `artifacts` table (public-readable RLS, service-role write); `artifact_subscriptions` table (`{ templateId, scheduleCron, lastRunAt, enabled }`) for recurring. Impl proposes final schema in change list.
- **Public route**: `/artifact/:slug` — standalone page, public read (no login), OG metadata for share preview, EN/中 toggle top-right. No WorkPal nav shell — meant to look like a standalone webpage when shared.
- **Chat intent routing**: `intentRouter.ts` gains `shouldGenerateArtifact(text)` — bilingual keywords: `周报 / 周刊 / 月报 / digest / newsletter / guide / weekly / write-up`. Follows the same keyword-heuristic pattern as `shouldUseClaudeCode`. Bilingual day 1 (principle #8).
- **First template: `bay-area-weekend`**:
  - 4 categories: 节日 festivals / 活动 events / 展览 exhibitions / 集市 markets & fairs
  - 3–5 items per category (~12–20 total)
  - Per item: ≥1 image, location, price, date/time, official URL
  - Tavily query templates hard-coded for this template
- **Recurring via cron**: Vercel Cron `0 20 * * 4` Pacific Time (Thursday 8pm PT) → sweeps `artifact_subscriptions WHERE enabled` → POSTs `/api/artifacts/generate` for each. Ships with one seed row (`templateId='bay-area-weekend'`).
- **Overview card**: `LatestArtifactCard` queries latest `bay-area-weekend` artifact → cover image + title + "N spots this weekend" → click-through to the artifact URL. When more templates exist, card can generalize; v1 pins to weekend digest.
- **Bilingual page (page-local, NOT full-app i18n)**: cron runs OpenAI twice (EN + 中), stores both under `content_en` / `content_zh`. Toggle switches between stored copies at render. #4 full-app i18n still parked.
- **Data source**: Tavily + OpenAI only. No external API integrations (Eventbrite / Funcheap / Meetup) in v1.

**Non-goals for v1** (impl should not scope-creep):
- Template authoring UI (new templates = new code; user-defined templates is a later candidate)
- Email / push delivery
- Artifact archive / browsing UI
- Editorial override UI
- Non-weekly recurring schedules (schema supports, UI doesn't expose)
- Multi-user sharing permissions
- Chat-side inline preview of the generated artifact (v1: chat returns the URL as a card)

**Open for impl change-list**:
- Exact `artifacts` + `artifact_subscriptions` schema (content stored as flat JSONB vs. relational item rows? status enum?)
- Slug strategy: `<templateId>-<weekKey>` for recurring vs. `<topic-slug>-<shortid>` for ad-hoc chat-initiated
- How a chat-initiated artifact surfaces in the chat: card with URL? auto-open in a side panel? both?
- Image hosting: Tavily returns URLs — serve originals vs. re-host via Supabase storage
- Idempotency: POST `/generate` with same `(templateId, weekKey)` → return existing vs. regenerate
- Cron retry / failover if Tavily returns weak results
- OG metadata strategy (static vs. per-artifact)
- `intentRouter` keyword list and disambiguation (must NOT trigger on every "write a summary" chat)
- Overview card placement

**Effort**: 5–7 days.

**Risk classification**: **medium**. Planning live-tests:
- Chat-initiated flow ("写个 SF 美食周报" → intent routed → returns URL → URL opens a valid artifact)
- Cron-initiated flow (trigger sweep manually → new Bay Area weekend row written)
- Public URL in incognito (no login, OG preview renders, EN/中 toggle works)
- `POST /api/artifacts/generate` idempotent on `(templateId, weekKey)`
- Overview card reads latest, not stale
- Non-weekend keywords in chat don't spuriously trigger artifact generation

---

## 4. `candidate` — Bilingual UI scaffold (i18n minimal)

Deliberately parked. Re-evaluate when UI surface stabilizes. Unchanged from 2026-04-19 entry.

---

## 5. `shipped` — Deployment shape: C (Web + local agent) — Phase 7 complete + v0.1.1 launched

**Shipped**: 2026-04-25 — Phase 7 delivered in 5 sub-phases (7.1 → 7.5) over ~2 calendar days. Full per-step ship details live in [`docs/phase-7-requirements.md`](./phase-7-requirements.md) and the Phase 7 row in [`docs/phase-history.md`](./phase-history.md). Result: `https://workpal-beibei.vercel.app/overview` is the primary cross-device entry; `WorkPal Agent.app` (~160 MB dual-arch DMG) ships from `/Applications/` on Beibei's main Mac, OnboardingSurface guides install on any other Mac, GitHub Releases auto-update via boot-time check.

**Three shapes on the table** (locked in `memory/project_architecture_direction.md`):
- **A. localhost-only** — `npm run dev` + browser. Current. No sharable link, dev-only.
- **B. Tauri / Electron desktop app** — download `.dmg`, double-click. Works offline; no terminal; can't send a URL link; users re-install on each machine. User UX very low-friction once installed.
- **C. Web + local agent** — Vercel-hosted frontend, user installs an agent (packaged as a `.dmg` like Dropbox / Docker Desktop — **does NOT require the user to open a terminal**, just double-click install and menu-bar icon appears). User gets a shareable URL once set up; agent does file/git ops that browsers can't.

**Final state**: shipped via Phase 7 (see top **Shipped** block).

**Original deferral reasoning** (kept for record): observation-driven decision was the plan until #2 demo deployment accumulated HR reactions + #7 + #8 made `workpal-beibei.vercel.app` cross-device usable. In practice Beibei skipped the observation phase once #7 + #8 proved the cross-device foundation worked; "I open the web page and edit local files" remains the core value prop and is the only shape that delivers it.

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

## 7. `shipped` — Chats + projects to Supabase (cross-device sync)

**Shipped**: 2026-04-23 (PR [#123](https://github.com/BeibeiZhang/WorkPal/pull/123), merge commit `cbc749e`). Supabase-backed persistence for chats + projects replaces the localStorage-only story — step 1 toward `workpal-beibei.vercel.app` as primary entry across Mac + iPhone. Independent of candidate #5 (deployment shape).

**Why this existed**: `chats` and `projects` used to live in `localStorage` only — each browser an isolated island even when pointed at the same URL. Memory / artifacts / connectors / Gmail / Calendar were already cross-device; these were the last local-only stores blocking read-anywhere use.

**Implemented scope**:
- **Schema** ([`supabase/migrations/0003_chats_projects.sql`](../supabase/migrations/0003_chats_projects.sql)): two tables with text PKs (legacy `chat-<ts>` + new `chat-<uuid>` coexist), JSONB `messages` / `files` / `outputs`, `(updated_at desc)` index + partial `project_id` index. RLS open, API layer is the gate. Chat **GET also requires password** (unlike memory) — chat content is more sensitive.
- **Dual-track stores** ([`api/_lib/chat-store.ts`](../api/_lib/chat-store.ts), [`server/src/lib/chatStore.ts`](../server/src/lib/chatStore.ts), same for projects): Vercel serverless + local Express share one module. `upsertChat` idempotent on `id`, `bulkUpsertChats` uses `ignoreDuplicates: true` so two devices uploading the same legacy chat don't collide.
- **Client** ([`src/lib/chatStore.ts`](../src/lib/chatStore.ts), [`src/App.tsx`](../src/App.tsx)):
  - localStorage stays as offline first-paint cache
  - Mount-time hydration only if password is session-cached (never triggers the password modal itself)
  - 1.5s debounced per-id PUT on state change, `streamingChatIdsRef` guard so long Claude runs don't write-storm (flush happens only after stream completes)
  - `visibilitychange` → flush local dirty set first, then fetch cloud + reconcile; dirty ids skipped on reconcile so local pending edits don't get trampled
  - 401 on flush → chat stays in dirty set for retry
  - Per-device migration flag `workpal-chats-cloud-migrated-v1` + `ignoreDuplicates`-backed one-time upload (seed + draft ids excluded)
- **UUID IDs** ([`src/App.tsx:71-83`](../src/App.tsx#L71)): new chats / projects get `crypto.randomUUID()`; legacy `chat-<ts>` / `proj-1` preserved — text PK, no forced migration.
- **Attachment cap** ([`src/components/ChatInput.tsx:83`](../src/components/ChatInput.tsx#L83), [`src/lib/attachments.ts`](../src/lib/attachments.ts)): 2MB per attachment (post-base64 ~2.7MB) to stay under Vercel's 4.5MB body limit; 10 attachments per message max.
- **Demo mode preserved**: 8 `IS_DEMO` short-circuits guard every cloud entry point — `workpal` Vercel project never initializes Supabase.

**Restructure during PR**: impl added a follow-up commit [`0feb8eb`](https://github.com/BeibeiZhang/WorkPal/commit/0feb8eb) consolidating `api/{chats,projects,memories}/` directory-of-files into three single-file handlers routed via `vercel.json` rewrites. Reason: Vercel Hobby-plan 12-function limit. Behavior-equivalent (same auth gate, same route handlers, all `checkPassword` positions preserved) with one small hardening — `PUT /api/chats/:id` overrides body `id` with path `id` so a client typo can't silently retarget. **Process note for future PRs**: this commit landed after planning green-lighted the original directory structure and was not re-reviewed before merge. Next time: impl should ping planning before pushing new commits to an already-greenlit PR, even for refactors believed to be behavior-preserving.

**Live-test results** (impl self-test, all ✅):
1. Streaming write storm: 0 PUT during stream + 1 PUT after 1.5s debounce
2. Multi-tab race: `storage` event → cloud re-fetch triggered, dirty-set protected
3. Migration idempotent: first reload bulk-upserts, second reload GET-only
4. 1.5MB attachment round-trip: SHA256 identical both directions, PUT/GET each ~2.0MB (2.5MB Vercel headroom)
5. Demo URL isolation: `VITE_WORKPAL_DEMO=true` → zero `/api/chats` calls
6. UUID id format: `chat-086a0fc9-…` shape landed in Supabase
7. Password cached hydration: sessionStorage inject → reload → normal GET + bulk-upsert + per-id GET flow
8. 401 fallback: no password on first mount → 0 cloud calls, 0 console errors, UI rendered from cache

**Known limits** (documented in the PR's "Known limits" section):
- **Single message with ≥2 cap-size attachments** will 413 — 2 × ~2.7MB (base64-inflated) exceeds Vercel's 4.5MB body limit once JSON wrapping is added. If this surfaces in practice, the fix is moving attachments to Supabase Storage, not raising the cap.
- **Sidebar sorts by `updated_at desc`** (server-authoritative), not by `timestamp` (user-activity). First paint on a freshly-migrated new device reshuffles seed chats to the top once because `bulkUpsert` rewrote their `updated_at`. UX cosmetic; not a data bug.
- **Projects fetch is not metadata-only** (projects tend to be few — full-payload GET acceptable for now). Future optimization if project file sizes grow.

**Risk classification (as executed)**: medium. Planning reviewed schema / stores / client hydration / streaming guard / migration / visibilitychange statically; declined to live-rerun impl's #2 (multi-tab race) and #5 (demo isolation) after confirming they were statically auditable — `IS_DEMO` is build-time inlined so a network-panel re-run proves nothing new, and the `storage`-event + dirty-set + reconcile three-way interaction is traceable in the diff. Playbook principle #12 (risk-routed testing) applied.

---

## 8. `shipped` — Login gate: full-screen sign-in for self-use (closes the #7 UX gap)

**Shipped**: 2026-04-24 (PR [#126](https://github.com/BeibeiZhang/WorkPal/pull/126), merge commit `60ab48d`). Full-screen username + password sign-in for `workpal-beibei.vercel.app`, localStorage-persisted session, 401 auto-bounce across every `*AuthError` path, Sign out in AvatarMenu. Demo URL is never gated.

**Why this existed**: after #7 shipped, users had cloud-sync plumbing but no way to enable it without blundering into Memory / Connectors to accidentally trigger a password modal — zero UI feedback that "sync is off". Users saw the localStorage first-paint cache and thought it worked, then discovered days later that nothing synced. The fix is a proper sign-in entry point that makes "I'm logged in" a first-class app state.

**Implemented scope**:
- **`<AuthProvider><AuthGate><App/></AuthGate></AuthProvider>`** wiring in [`src/main.tsx`](../src/main.tsx): wrapper-component pattern (not conditional hooks), hooks order stays constant across authed/unauthed transitions. `/artifact/:slug` route bypasses the gate so candidate #3's public pages stay public.
- **`useAuth` context** ([`src/lib/useAuth.tsx`](../src/lib/useAuth.tsx)): `workpal-auth-v1` localStorage key, `{ user, password }` stored plaintext (same-origin JS can already read localStorage; obfuscation = 0 value), `signIn` verifies via `/api/memories/verify`, `signOut` clears cache + flips state, **cross-tab `storage` event** sync so one tab's signOut propagates. Legacy `sessionStorage['workpal-memory-pw']` dropped on first boot.
- **`useMemoryAuth` re-plumbed** ([`src/lib/useMemoryAuth.tsx`](../src/lib/useMemoryAuth.tsx)): default-path `ensurePassword()` resolves synchronously from `useAuth.getCachedPassword()` — **no modal pop for first-touch Memory / Connectors edits**. Force-path (destructive delete) still re-prompts + re-verifies with backend; on success `updateCachedPassword(pw)` keeps user signed in if the server password rotated.
- **LoginScreen** ([`src/components/LoginScreen.tsx`](../src/components/LoginScreen.tsx)): centered card on brand-gradient background, WorkPal `.gradient-text` title + sub-copy, two `TextField` inputs with `autoComplete="username"` / `autoComplete="current-password"` + `name` attrs (Keychain-compatible), gradient "Sign in" button. Enter on username focuses password; Enter on password submits.
- **New shared `TextField` primitive** ([`src/components/shared.tsx` §7e](../src/components/shared.tsx)): filled (`bg-hover`) card-style input with label / leadingIcon / inline red `#B42318` error + `role="alert"`. Consumed by LoginScreen × 2 and migrated into [`PasswordModal.tsx`](../src/components/PasswordModal.tsx). Shows up on the Design System page automatically.
- **Sign out** ([`Sidebar.tsx` `AvatarMenu`](../src/components/Sidebar.tsx)): appended at the end of the items list with a `border-t border-stroke-outline` divider + `LogOut` icon. `!IS_DEMO &&` gate — demo URL's AvatarMenu stays at 5 items, unchanged.
- **401 auto-bounce**: 8 catch sites unified — `flushChats` + `flushProjects` + `hydrateChats` + `hydrateProjects` + 3 memory CRUD handlers + Connectors connect/disconnect — all call `signOut()` on `*AuthError`. Stale password → automatic return to LoginScreen.
- **App.tsx auth-read helper** ([`src/App.tsx`](../src/App.tsx)): direct `localStorage.getItem(AUTH_KEY)` inside stable `useCallback` closures (rather than pulling through `useAuth`) so flush callbacks don't get invalidated on every signIn/signOut state change. Minor `AUTH_KEY` duplication across `useAuth.tsx` and `App.tsx` acknowledged as a nit — can be `export`/`import`ed in a future pass.
- **Demo preserved**: `IS_DEMO=true` synthesizes `isAuthed: true` + hardcoded `user: 'Beibei Zhang'` in the AuthProvider value memo, short-circuits all localStorage I/O, hides Sign out. Demo URL behavior is bitwise-identical to pre-gate.

**Live-test results** — impl self-test ✅ + planning independent complement ✅:
- **Impl self-test (all ✅)**: LoginScreen render + autocomplete attrs • wrong-password inline error • correct-password → "Hi, Beibei" • Memory first Add **no modal** (cache hit) • Memory Delete **pops modal** (force path) • Sign out → cache cleared + LoginScreen returns • Demo URL zero localStorage writes + Sign out hidden • 401 bounce via tampered localStorage.
- **Planning independent (Chromium preview, complementary)**: `autoComplete` DOM-verified both inputs; wrong-password `<p role="alert">` renders at `rgb(180, 35, 24)` + `type-caption` class; localStorage stays `null` on failure; LoginScreen preserved; demo URL (`VITE_WORKPAL_DEMO=true`) shows "Hi, Beibei" + Demo badge + AvatarMenu 5 items **without** Sign out, zero `workpal-auth-v1` written.
- ⚠️ **Keychain real-device**: iOS Safari + macOS Safari still need real-device verification (Chromium preview can't exercise system-level Keychain).

**Known limits / follow-ups**:
- **LoginScreen double-submit race on mouse click** (candidate #9): click path suppresses inline error due to double-fire; Enter path works. 5-min fix. See §9.

**Risk classification (as executed)**: medium. Planning code-reviewed AuthGate wrapper structure, IS_DEMO short-circuit placement, cross-tab storage event, force-path `updateCachedPassword`, legacy-key migration, `/artifact/:slug` bypass, all 8 signOut wiring sites, TextField primitive quality. Independently live-tested LoginScreen render + autocomplete + wrong-password flow + demo URL zero-pollution on local Chromium preview. Playbook principle #12 applied — Keychain system behavior punted to real-device since preview can't reach it.

---

## 9. `shipped` — LoginScreen double-submit race fix (post-#8 follow-up)

**Shipped**: 2026-04-24 (bundled with §10 into PR [#127](https://github.com/BeibeiZhang/WorkPal/pull/127), merge commit `8dfec64`). Dropped the `onClick` prop from the PrimaryButton in [`src/components/LoginScreen.tsx`](../src/components/LoginScreen.tsx), letting `<form onSubmit>` + button default `type="submit"` handle the click path in a single `handleSubmit` run. Click path now renders the inline error correctly, matching the Enter-key path.

**Root cause (preserved for record)**: `<PrimaryButton onClick={handleSubmit}>` inside `<form onSubmit={handleSubmit}>` with button default `type="submit"` caused two concurrent `handleSubmit` runs per click (one from `onClick`, one from native submit), and the overlapping `setError(null)` / `setError('Wrong...')` calls across the two runs left `error` state `null` after both completed. Enter-key path was unaffected because password `onKeyDown` calls `preventDefault()` + `handleSubmit()` in a single run.

---

## 10. `shipped` — Sidebar Recents sort fix (post-#7 follow-up, corrects the §7 known-limit)

**Shipped**: 2026-04-24 (bundled with §9 into PR [#127](https://github.com/BeibeiZhang/WorkPal/pull/127), merge commit `8dfec64`). One-line change in [`src/components/Sidebar.tsx`](../src/components/Sidebar.tsx) — `filteredChats` now `.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))` after the existing `.filter(...)`. Seed demo chats and real chats interleave correctly by last-active time.

**Root cause + §7 correction (preserved for record)**: the sidebar never sorted at all — my §7 "known limit" description that *"sidebar sorts by `updated_at desc`; first-paint reshuffles seed chats once"* was wrong. The server returns `updated_at desc` from `listChatMetadata`, but the client never propagated that order to the Recents UI — `reconcileChats` uses `map.set` which preserves insertion order of the prev state, so cloud-fetched chats that already existed locally kept their stale position. Net: Recents order was arbitrary (initial `INITIAL_CHATS` + whatever reconcile appended). Fix propagates each chat's `timestamp` field (which App.tsx already updates on every send) into the render sort.

**Risk classification**: low. Impl self-test: send a new message in a mid-list chat → that chat moves to the top of Recents; seed chats fall into place by their `timestamp`.

---

## 11. `shipped` — `animations.ts` DELETE endpoint cleanup (Phase 7.2 surfaced)

**Shipped**: 2026-04-26 (bundled with §12 + §14 into PR [#136](https://github.com/BeibeiZhang/WorkPal/pull/136), merge commit `7d13e26`). Picked option **A** — dropped the route entirely. Grep confirmed zero frontend callers of `/api/animations` (only a docstring reference remained in [`src/agentVideos.ts`](../src/agentVideos.ts)). Deleted [`server/src/routes/animations.ts`](../server/src/routes/animations.ts) (-79 lines) + import / mount in [`server/src/index.ts`](../server/src/index.ts). The `'deleted'` enum value in `src/agentVideos.ts` was kept defensively with an inline comment (`// historical value: kept for back-compat with existing localStorage entries`) so any leftover entries from the now-removed endpoint don't get silently coerced and resurrect into the rotation pool.

[`server/src/routes/animations.ts`](../server/src/routes/animations.ts) DELETE handler removes a repo-checkout file under `public/animations/*.mp4`. Only meaningful when running the dev server from a checked-out repo; on Vercel deploy it's a no-op against the static build's read-only filesystem (already a half-broken endpoint pre-7.2). Phase 7.2 audit decided to leave it on `server/` rather than port to agent (it's repo-management dev-only, not local-fs-on-user's-Mac territory). Three cleanup options considered:

- **A. Drop the endpoint entirely**. Lose the dev-server convenience of "click delete in admin UI to wipe a video"; that flow is rare. ~10 lines.
- **B. Convert to a build-time CLI** at `scripts/clean-animation.ts`. Keeps the convenience, removes the broken endpoint. ~30 lines.
- **C. Port to agent** if Beibei wants the agent to handle repo-admin chores generally. Out of scope for current work; revisit only if agent grows broader scope.

Risk: low. No user-facing surface today (admin tools page only). Pick (A) by default unless we discover dev usage.

---

## 12. `shipped` — `agentVideoStatus.ts` ephemeral storage (Phase 7.2 surfaced)

**Shipped**: 2026-04-26 (bundled with §11 + §14 into PR [#136](https://github.com/BeibeiZhang/WorkPal/pull/136), merge commit `7d13e26`). Picked an **A-variant**: drop the server route, but couldn't drop the caller — grep showed the toggle UI is admin-only (`DesignSystemPage` AgentVideosTab) but the read consumer is product-facing ([`ChatPanel:114`](../src/components/ChatPanel.tsx#L114) drives the welcome video rotation pool), so converted the frontend to localStorage-only with cross-tab `storage` event sync instead. Deleted [`server/src/routes/agentVideoStatus.ts`](../server/src/routes/agentVideoStatus.ts) (-81 lines) + import / mount in [`server/src/index.ts`](../server/src/index.ts); collapsed [`src/agentVideos.ts`](../src/agentVideos.ts) (-73 / +19 lines) — dropped `fetchServerMap` / `patchServerStatus` / `API_PATH` / `void refresh()` boot fetch / `onFocus` listener; kept `loadCachedMap` / `cacheMap` / `CHANGE_EVENT` / `'storage'` cross-tab sync. Top-of-file docstring rewritten with a Supabase-promotion breadcrumb pointing to `chatStore` / `projectStore` (`api/_lib/chat-store.ts` pattern) for the day cross-device sync is wanted.

[`server/src/routes/agentVideoStatus.ts`](../server/src/routes/agentVideoStatus.ts) reads/writes `server/data/agent-video-status.json`. **Already broken on Vercel** (serverless ephemeral fs — every request potentially hits a fresh container with empty `server/data/`). Phase 7.2 audit decided to leave it on `server/` because no one's actively using it (the symptom would be silent state loss; we'd notice via product feedback if it mattered). Two cleanup paths considered:

- **A. Drop the endpoint + caller**. Find the frontend caller (likely also dev-only admin), wire it to localStorage instead, delete server route. Pure removal of a stale code path.
- **B. Promote to Supabase** (per-user agent-video-status row). Worth doing only if Beibei wants this state to persist across devices. Higher cost, real product question first.

Risk: low. Track until we know whether B is justified by use, then default to (A).

---

## 13. `candidate` — Sequoia "is damaged" Gatekeeper hits unsigned `.app` from browser download (Phase 7.5 surfaced)

**Symptom** (real, observed 2026-04-25 during 7.5 v0.1.1 install live-test): on macOS Sequoia (and likely Sonoma late updates), double-clicking an unsigned `.app` that was just downloaded via Chrome / Safari shows the **harsher** dialog "*"WorkPal Agent" 已损坏，无法打开。 你应该将它移到废纸篓。*" / "*"WorkPal Agent" is damaged and can't be opened.*" — **NOT** the milder "Unidentified developer" dialog that the existing OnboardingSurface step 2 + agent README "right-click → Open" instructions assume. The right-click → Open trick is **silently ineffective** in this code path; the dialog has no Open button, only Cancel + Move to Trash.

**Root cause**: macOS sets `com.apple.quarantine` xattr on browser-downloaded files. Sequoia's stricter Gatekeeper validates the .app's signature; for an unsigned bundle the validation fails, and Sequoia chose to surface the failure as "damaged" rather than as the legacy "unidentified developer" path. The code-path divergence between Sequoia and earlier macOS for unsigned + quarantined files is the core bug.

**Workaround verified working**:
```bash
sudo xattr -dr com.apple.quarantine "/Applications/WorkPal Agent.app"
```

After clearing the quarantine attribute, double-click opens normally (no further Gatekeeper dialog at all on subsequent runs).

**Three fix options for the next planning round**:

- **A. Documentation-only update** (cheapest). [`src/components/OnboardingSurface.tsx`](../src/components/OnboardingSurface.tsx) step 2 currently reads "Right-click WorkPal Agent → Open (first-launch Gatekeeper bypass)" / "右键 WorkPal Agent → 打开（首次启动绕过 Gatekeeper）". Update to two-tier instruction: "Right-click → Open. **If you see "is damaged"**, run `sudo xattr -dr com.apple.quarantine \"/Applications/WorkPal Agent.app\"` in Terminal first." Same change into [`agent/README.md`](../agent/README.md) installation section. ~10 lines. Doesn't fix the underlying friction — users still need a Terminal command — but at least the path is documented.
- **B. Pre-clear quarantine via DMG postinstall script** (medium polish). The .dmg can include a `.command` file or postinstall hook that runs `xattr -dr com.apple.quarantine` on the freshly-dropped `.app` automatically. Limits: still requires user to allow the postinstall, and `xattr` writes inside `/Applications` may need sudo on Sequoia. Worth testing whether the drag-to-/Applications path keeps quarantine — if it strips quarantine in the drag step, this option is moot.
- **C. Apple Developer enrollment + notarize in CI** (full fix). Phase 7 kickoff locked decision was "skip signing for v1". The Sequoia "is damaged" friction is the strongest argument for revisiting. Signed + notarized `.app` skips the entire dialog. Cost: $99/yr Apple Developer enrollment + Apple ID + app-specific password as GitHub Actions secrets + ~5min added to release.yml CI runtime per release. Already flagged in [`docs/phase-7-requirements.md`](./phase-7-requirements.md) "Lessons for post-Phase-7 work" as a v2 follow-up; this live-test confirms it'd be a real UX win, not just polish.

**Risk classification**: medium. Beibei's own install flow is documented (the `xattr` workaround works on her machine); future users hitting `/releases/latest` would experience this same friction without guidance. Pick (A) first as a fast docs unblock; revisit (C) when Beibei wants to enroll in Apple Developer for the long-term fix.

**Status update 2026-04-25**: Option A shipped via PR [#135](https://github.com/BeibeiZhang/WorkPal/pull/135) (`docs(install): Sequoia "is damaged" xattr workaround`). Option C remains a deferred candidate inside this entry — revisit when Beibei wants the "double-click and run" experience for self or external users (priced at $99/yr Apple Developer + ~half-day CI signing/notarize wiring). Beibei's screenshot of System Settings → Privacy & Security confirmed empirically: **no "Open Anyway" button appears** for the Sequoia "is damaged" path on her macOS version, so a GUI-only bypass is not a fourth option — it's Terminal-or-sign, no middle ground. (Apple deliberately removed the easy-bypass for the unsigned + browser-downloaded combination.)

---

## 14. `shipped` — OnboardingSurface command rendering: literal backticks → `<code>` + monospace (post-#13 polish)

**Shipped**: 2026-04-26 (bundled with §11 + §12 into PR [#136](https://github.com/BeibeiZhang/WorkPal/pull/136), merge commit `7d13e26`). Picked option **B** — inline ~10-line regex helper, no markdown lib. Helper splits on `` /(`[^`]+`)/ `` and wraps captured segments in `<code className="font-mono bg-bg-message px-1 py-0.5 rounded">`. Impl added a `part.length >= 2` guard beyond the original spec so a stray single backtick can't be mis-detected as both `startsWith('`') && endsWith('`')`. Same wrapping for both EN + 中文 lines; computed-CSS verified `font-family: ui-monospace, SFMono-Regular, Menlo, ...` + `background-color: rgba(20, 39, 64, 0.05)` on both, with Chinese prose context staying in SF Pro (sans-serif fallback intact — only the command segment is monospace). Planning skipped independent live-test after impl provided computed CSS + screenshot evidence (principle #12 — ROI of ceremonial re-run was zero for pure rendering polish).

**Surfaced**: candidate #13 PR [#135](https://github.com/BeibeiZhang/WorkPal/pull/135) review (2026-04-25). The OnboardingSurface step 2 included a Terminal command (`sudo xattr -dr com.apple.quarantine "/Applications/WorkPal Agent.app"`) wrapped in markdown-style backticks. Rendering path was `<p>{step.en}</p>` — **plain text, no markdown parsing** — so users saw **literal backtick characters** around the command instead of a code block. Functionally OK (the command was identifiable + copy-able), but visually rough; the README equivalent renders correctly because GitHub Markdown does parse fenced code.

**Scope** (~30 lines):
- Lift `STEPS[]` entry shape in [`src/components/OnboardingSurface.tsx`](../src/components/OnboardingSurface.tsx) from `{en: string, zh: string}` to `{en: ReactNode, zh: ReactNode}`, OR pass through a tiny inline-markdown-to-JSX helper that handles two patterns only: `` `code` `` and `**bold**`.
- Wrap the command segment in `<code className="font-mono text-text-primary bg-bg-message px-1 py-0.5 rounded">...</code>` so it pops as a code block — monospace, selectable, visually distinct from prose.
- Don't introduce a markdown library — keep the helper inline (~10 lines of regex split). Bundle bloat is the wrong cost for two inline patterns.
- Bilingual unchanged — same `` `code` ``→`<code>` treatment in both `en` and `zh` lines, preserving the "WorkPal Agent" untranslated decision (Q4 of 7.4).

**Why not in #13 PR**: scope discipline. #13 Option A's target was strictly "docs copy update only". Component shape change is a separate concern — bundling would muddy the review and risk introducing a render bug into a docs-only PR.

**Risk classification**: low. Pure rendering polish, no behavior change. Can ship as a small drive-by alongside any future OnboardingSurface change, or solo whenever Beibei feels the literal-backticks look bothers her enough to fix.

---

## 15. `decided-next` — Mobile graceful degrade for agent features

**Surfaced**: 2026-04-26 conversation. iPhone visiting `workpal-beibei.vercel.app` triggers `agentState='unreachable'` (127.0.0.1 on iPhone is the phone itself, not Beibei's Mac), which currently slams the entire chat panel with `OnboardingSurface` carrying a `.dmg` download CTA — a **wrong indicator** for a phone where the .dmg can't be installed. Audit below maps every agent touchpoint and proposes a unified strategy: mobile = "chat + browse" mode; agent UI becomes an inline `AgentRequiredHint` instead of a hard wall.

**Audit — already graceful (no change needed)**:
- `shouldUseClaudeCode` falls back to OpenAI when `!isAgentCurrentlyReachable()` ([`src/lib/intentRouter.ts:23`](../src/lib/intentRouter.ts#L23))
- `postInitProject` effect early-returns when agent unreachable ([`src/App.tsx:1215`](../src/App.tsx#L1215))
- `postReaperRun` effect early-returns when agent unreachable ([`src/App.tsx:1243`](../src/App.tsx#L1243))
- `Complete Session` button hidden unless `agentState === 'reachable' || IS_DEMO` ([`src/components/TaskContextPanel.tsx:390`](../src/components/TaskContextPanel.tsx#L390))
- Demo URL: untouched, fully mocked

**Audit — needs change**:
- **[`src/App.tsx:3162`](../src/App.tsx#L3162)** — `!IS_DEMO && agentState === 'unreachable'` mounts OnboardingSurface, slamming the chat region. **On mobile this kills chat entirely** (OpenAI fallback never gets a chance to render).
- **[`src/lib/intentRouter.ts`](../src/lib/intentRouter.ts)** — silent OpenAI fallback for `shouldUseClaudeCode` is fine on Mac (probe in flight / agent restarting), but on mobile a user typing "改一下 src/App.tsx" gets a text-only OpenAI reply that pretends to do work. Mobile arm should not fall back; render `AgentRequiredHint` inline so the user knows the request needs a Mac.
- **[`src/lib/api.ts:424`](../src/lib/api.ts#L424) / [`:442`](../src/lib/api.ts#L442) (`openFolder`, `openFile`)** — UI button click → fetchAgent → fails. Mobile users see an opaque error toast. Should disable button + show `AgentRequiredHint` on click.
- **[`src/lib/api.ts:184`](../src/lib/api.ts#L184) (`undoLastFileChange`)** — depends on `streamClaudeChat` having run; with the chat fix above, this path is virtually unreachable on mobile. Defense-in-depth catch in the fetchAgent wrapper anyway.
- **[`src/lib/api.ts:459`](../src/lib/api.ts#L459) (`readFile`)** — internal dep, no independent UI touchpoint. Same defense-in-depth.

**Strategy (locked)**:

1. **New shared component `AgentRequiredHint`** (~30 lines) in [`src/components/shared.tsx`](../src/components/shared.tsx) per the design-system-shared-first rule:
   - Bilingual one-card + inline-tip variants
   - Copy: "此功能需要在 Mac 上运行 WorkPal Agent。请用电脑打开 workpal-beibei.vercel.app 使用。 / This needs WorkPal Agent on your Mac. Open the page on your computer to use it."
   - Visual: `panel-border` + `bg-bg-message` tokens; lucide `Smartphone`/`Monitor` icon. "WorkPal Agent" untranslated (Q4 of 7.4).

2. **[`src/App.tsx:3162`](../src/App.tsx#L3162)** — OnboardingSurface mount condition gains `&& !isMobile`. Mobile + agent unreachable → chat panel renders normally (cloud chat works). Mac + agent unreachable → OnboardingSurface still shows (Mac can install).

3. **[`src/lib/intentRouter.ts`](../src/lib/intentRouter.ts)** — extend the routing signal so the mobile-unreachable case is distinguishable from Mac-probe-in-flight. Either: `shouldUseClaudeCode` returns a 3-state union (`'use'` / `'fallback-cloud'` / `'mac-only-on-mobile'`), or a sibling `getAgentRouteIntent()`. handleSend in App.tsx watches for the mobile-only signal and posts an inline assistant message rendering `AgentRequiredHint` content (instead of dispatching to OpenAI which would silently pretend).

4. **`openFolder` / `openFile` callsites** — grep to find UI buttons (likely [`MessageCard`](../src/components/MessageCard.tsx) / changes panel). Add a mobile-aware disabled state + `AgentRequiredHint` tooltip-on-click. Don't remove the buttons; users may scroll the same message on Mac later and the affordance still belongs there.

5. **`fetchAgent` wrapper defense** — at the wrapper boundary in [`src/lib/agent.ts`](../src/lib/agent.ts): if `isMobile`, throw `AgentRequiredOnMobileError` before calling `fetch`. Callers catch and surface `AgentRequiredHint`. This is a belt-and-suspenders guard — every UI path above should also gate, but if someone misses one the wrapper catches it.

**Out of scope**:
- Remote-control-from-phone (Tailscale / Cloudflare Tunnel / relay server) — Phase 8 territory, not a candidate fast-lane
- Voice chat / voice search — those are cloud (OpenAI) routes already, no agent touch
- Memory / chats / projects-list / connectors / dashboard — all cloud, untouched

**Mobile detection**: reuse the existing `isMobile` from [`src/App.tsx:599`](../src/App.tsx#L599) (`useSyncExternalStore` + `matchMedia`). Either thread via prop or export a `useIsMobile` hook. **Do not sniff `userAgent`** — the matchMedia path already in use is correct + keeps SSR-friendly.

**Risk**: low. No backend changes. Pure frontend graceful-degrade. Demo URL untouched. Mac UX untouched (only mobile branches added).

**Effort**: ~2-3 hours.

**Test plan** (planning will live-test):
- Mac Chrome with agent reachable: behavior identical to today
- Mac Chrome with agent stopped: OnboardingSurface still shows (the install-on-Mac flow)
- iPhone Safari (or Chrome devtools mobile emulation @ 375px width): chat panel renders normally; typing "帮我改 src/App.tsx" produces inline `AgentRequiredHint` instead of an OpenAI fallback; "Open in Finder"-style buttons disabled with tooltip; chat history / memory / projects / connectors views unaffected
- Demo URL on mobile: untouched (DemoBadge + chat work as before)

---

## How to revisit / add candidates

When a candidate ships → remove or mark `shipped`.
When a new idea surfaces in discussion → add a `candidate` entry with enough context to pick up cold.
When something moves from blocked → decided-next → in-flight → shipped, update the state label + any newly locked details.
