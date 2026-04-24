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

## 9. `candidate` — LoginScreen double-submit race fix (post-#8 follow-up)

**Surfaced**: 2026-04-24 planning-session live-test of PR #126.

**Bug**: In [`src/components/LoginScreen.tsx`](../src/components/LoginScreen.tsx), `<PrimaryButton onClick={() => void handleSubmit()}>` inside `<form onSubmit={handleSubmit}>` with button default `type="submit"` causes `handleSubmit` to run twice on mouse click — once from `onClick`, once from native form submission. Network panel confirms two `POST /api/memories/verify` requests per click. Some React batching of the overlapping `setError(null)` / `setError('Wrong username or password')` calls across the two concurrent runs leaves `error` state `null` after both complete, so the inline error message doesn't render.

**Not a repro for Enter-key**: password input's `onKeyDown` calls `preventDefault() + handleSubmit()` once, bypassing the native submit and running handleSubmit a single time. Error renders correctly.

**Impact**: low. Keychain-autofilled flows on Mac / iOS typically submit via Enter. Only users who *click* "Sign in" after typing a wrong password lose the inline error feedback — they'd be confused until they try again.

**Fix**: drop the `onClick` prop from the PrimaryButton in LoginScreen; rely on the form's `onSubmit` + button default `type="submit"`. Single entry, single run.

**Effort**: 5 minutes. One-line change. Low risk, trivial regression surface.

**Depends on**: nothing. Can be picked any time.

**Risk classification**: low. Impl self-test on the click path + planning preview-verify the error renders after click is sufficient.

---

## How to revisit / add candidates

When a candidate ships → remove or mark `shipped`.
When a new idea surfaces in discussion → add a `candidate` entry with enough context to pick up cold.
When something moves from blocked → decided-next → in-flight → shipped, update the state label + any newly locked details.
