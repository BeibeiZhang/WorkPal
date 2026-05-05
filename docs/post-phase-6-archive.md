# WorkPal — post-Phase-6 archive (shipped)

Shipped § 归档. Root cause + 修法 留这里供 lookup, planning 必读不再读这个文件. Pending candidates 见 [`post-phase-6-candidates.md`](./post-phase-6-candidates.md). Milestone summary 见 [`phase-history.md`](./phase-history.md) 当前状态段.

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

## 15. `shipped` — Mobile graceful degrade for agent features

**Shipped**: 2026-04-26 (PR [#138](https://github.com/BeibeiZhang/WorkPal/pull/138), merge commit `896126b`, 10 files, +333 −68, **clean ship — 0 mid-PR rework**). All 5 audit-needed touchpoints addressed in one PR: new `useIsMobile.ts` (hook + sync getter, matchMedia not userAgent), new `AgentRequiredHint` shared component (card + tip variants), App.tsx OnboardingSurface mount narrowed to `!isMobile`, `intentRouter.getAgentRouteIntent(text, isMobile)` 3-state with `IS_DEMO` short-circuit on the first line, `fetchAgent` wrapper-level mobile guard via `AgentRequiredOnMobileError extends AgentUnreachableError` (belt-and-suspenders so any forgotten upstream gate degrades via existing SSE catches). Mobile button gates: FolderChip / GuardedArtifactCard (caller-side wrap that lets DesignSystemPage previews stay un-gated) / ChangeRow Undo, all with `opacity-50 cursor-not-allowed` + 5s `tip` auto-dismiss matching the existing undo-error pattern. Impl spotted + added a `length >= 2` guard in renderWithCode-pattern style helper beyond planning's spec. Planning live-tested 4 §15 scenarios on Chrome devtools mobile @ 375px: chat panel renders normally (not OnboardingSurface), "帮我改一下 src/App.tsx" → inline AgentRequiredHint card with bilingual EN/ZH (DOM `[role="status"]`, `bg-bg-page rgb(243,244,245)`, `panel-border rounded-[12px] p-4`, Smartphone icon), "湾区周末有什么活动" → no hint (cloud fallback verified via DOM hintCount=1 stable), demo URL static-audited (IS_DEMO build-time inlined). Process this round was textbook — change list approved with 3 small adjustments (A IS_DEMO short-circuit, B `extends AgentUnreachableError`, C 5s tip), all landed in one commit, planning live-test confirmed.

**Follow-up PR [#142](https://github.com/BeibeiZhang/WorkPal/pull/142)** (2026-04-27) — Beibei requested AgentRequiredHint go **English-only** (drop Chinese line in both `card` + `tip` variants). Same PR also fixed a visual nit: `chip-gradient-hover` / `input-gradient-hover` / `toolbar-gradient-hover` now sit on the border-box edge (`inset: -1px` / `-2px`) instead of 1px inside, so chips and the chat input no longer appear to shrink on hover. **Bilingual exception**: AgentRequiredHint is now English-only despite being a non-demo user-visible surface; principle #8 isn't overridden globally, this is a targeted product decision.

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
- **[`src/lib/api.ts:459`](../src/lib/api.ts#L459) (`readFile`)** — UI touchpoint: ArtifactCard click → `onArtifactClick` → `postReadFile` → DetailPanel preview ([`App.tsx:3325`](../src/App.tsx#L3325)). Mobile arm should disable the card + show `AgentRequiredHint` on click; the `postOpenFile` fallback path is also gated by the same UI guard. (Audit corrected post-impl: original §15 missed this.)

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

## 16. `shipped` — Complete Session = "save to project knowledge" UX clarity

**Shipped**: 2026-04-27 (bundled with §17 into PR [#143](https://github.com/BeibeiZhang/WorkPal/pull/143), merge commit `851ca41`). Two strings updated. **[`TaskContextPanel.tsx:443`](../src/components/TaskContextPanel.tsx)** Complete Session button gains a tri-state bilingual tooltip — demo (existing copy) / completed ("Already saved to project knowledge / 已存入 project 知识库") / default ("Adds this session's outputs to project knowledge so future sessions can read them. / 把这次产出存进 project 知识库，以后 session 都能看。"). **[`CompleteSessionModal.tsx:228`](../src/components/CompleteSessionModal.tsx)** success copy reframed bilingually — "Saved to project knowledge — future sessions in this project can read these outputs. / 已存入 project 知识库 —— 这个 project 后续 session 都能读到这些产出。" `alreadyUpToDate` branch matched. Zero behavior change.

**Surfaced**: 2026-04-27 conversation. Beibei asked "do my output files become a project knowledge base?" — answer is **yes** (Phase 6 already auto-merges session outputs back to project main on Complete Session, so the next session naturally reads them via cwd). But this affordance was **invisible** in the UI: nothing in the Complete Session button tooltip or surrounding copy told the user "this stores your work into project knowledge for future sessions to read." Result: outputs would orphan in session branches because users didn't realize they needed to click to "save" them.

**Strategy (locked)**:

1. **Complete Session button tooltip / supplementary line** ([`src/components/TaskContextPanel.tsx`](../src/components/TaskContextPanel.tsx)) — gain bilingual tooltip: "Adds this session's outputs to project knowledge so future sessions can read them. / 把这次产出存进 project 知识库，以后 session 都能看。"

2. **Post-merge confirmation copy** — the existing success toast / banner gains the bilingual "saved to project knowledge / 已存入 project 知识库" framing so the user gets a closing confirmation that matches the tooltip's promise.

3. **Optional one-line note in `Onboarding`** if there's still a relevant slot (only if it doesn't bloat first-touch).

**Out of scope**: no behavior change, no backend touch, no SDK touch — pure copy / tooltip / toast wording.

**Effort**: ~30 min — 1 hour.

**Risk**: low. Pure UX copy.

**Test plan**:
- Hover Complete Session button on Mac → bilingual tooltip shows the "knowledge base" framing
- Click Complete Session → success toast carries the same bilingual framing
- Demo URL: footer hidden per §2 (already covered, no test needed)
- Mobile: button hidden per §15 (already covered)

---

## 17. `shipped` — Project reference folders (external knowledge sources)

**Shipped**: 2026-04-27 (bundled with §16 into PR [#143](https://github.com/BeibeiZhang/WorkPal/pull/143), merge commit `851ca41`, 22 files +846 −11). Full feature ship:
- **DB**: new dedicated `reference_directories jsonb default '[]'::jsonb` column ([`supabase/migrations/0005_project_reference_dirs.sql`](../supabase/migrations/0005_project_reference_dirs.sql)) — **migration applied to production Supabase by impl via MCP tool during implementation** (idempotent + safe; future plan stages should explicitly mark "who applies migration where").
- **Validator**: new [`server/src/lib/referenceDirs.ts`](../server/src/lib/referenceDirs.ts) (sync'd to agent via `SHARED_LIB` whitelist update). 6 checks (non-empty / absolute / no `..` traversal / SYSTEM_BLOCKLIST / not in WORKPAL_ROOT / exists+isDirectory). TS function overload exposes `strict` mode (save: first-error short-circuits with `badPath`) and `filter` mode (use: invalid paths drop silently with `dropped` audit array). Dedupes via `resolved.includes`; persists canonical `pathResolve` output.
- **SDK**: `additionalDirectories?: string[]` plumbed through `ClaudeCodeRequest` ([`claudeCode.ts:30`](../server/src/lib/claudeCode.ts#L30)) using existing conditional-spread pattern. `claudeChat.ts:495` re-validates in filter mode before passing to `runClaudeCode`. Verified at SDK type def `sdk.d.ts:1097`.
- **Picker**: Electron-only [`agent/src/main/pickFolder.ts`](../agent/src/main/pickFolder.ts) wires `dialog.showOpenDialog({ properties: ['openDirectory'] })` with focused-window-then-modeless fallback. Lives in `agent/src/main/` (NOT `shared/routes/`) since `electron` can't be imported in the dev `server/` Express. Mounted in `agent/src/main/server.ts:128` via dynamic import.
- **UI**: new "Reference folders / 参考文件夹" SideCard in [`ProjectPage.tsx:534`](../src/components/ProjectPage.tsx) between Files and Context, mirrors Files shape. ChatPanel header chip `N ref(s)` ([`ChatPanel.tsx:72`](../src/components/ChatPanel.tsx)) next to FolderChip when count > 0. App.tsx `handleAddReferenceDirectory` is **synchronous server validation** (PUT before local state) so user gets immediate inline bilingual errors; `handleRemoveReferenceDirectory` is local-only (auto-flush via existing `scheduleProjectFlush`).
- **Mobile graceful-degrade**: 1:1 reuse of PR #138 `useIsMobile` + `AgentRequiredHint` pattern — no rewrite. Add/Remove buttons trigger 5s tip on mobile click; SideCard list visible read-only.
- **`ProjectValidationError` class** (new in [`projectStore.ts:127`](../src/lib/projectStore.ts#L127)) — `handleResponse` catches 400 + reads bilingual `body.error` so UI surfaces the actual server message ("System directory not allowed / 系统目录不允许") inline rather than a generic "Project API 400".
- **Picker fallback chain**: 404 (dev) → reveal text input row / fetch throw (no agent reachable) → reveal text input row / picker `{ ok: false, reason: 'cancelled' }` → noop / 5xx → bilingual error toast. Three failure modes all gracefully covered.

**Beibei's 3 product picks** during change-list review:
1. **DB schema = dedicated `reference_directories jsonb`** (not generic metadata bag) for type cleanliness; matches existing files/outputs columns.
2. **Picker = agent IPC + Electron `dialog.showOpenDialog`** — impl initially missed that the agent IS Electron 33 (Phase 7), recovered after re-reading memory. Avoids new deps.
3. **Folder picker fallback** — text input always available (dev mode + agent unreachable + future browser-only environments), so the feature degrades gracefully.

**Self-test (impl, all ✅)**: `/etc`, `~/WorkPal/...`, traversal `..`, missing folders all rejected with bilingual errors visible inline; valid path round-trip via Supabase persisted across reload; mobile graceful-degrade with AgentRequiredHint screenshot; dev-mode picker → text input fallback verified end-to-end.

**Not yet covered — deferred to v0.1.2 install verification**:
- Real Electron `dialog.showOpenDialog` in LSUIElement menu-bar context (Phase 7.3 SecurityAgent admin-domain failure was a near neighbor; dialog APIs don't need admin so likely fine, but unverified).
- Real SDK chat using `additionalDirectories` against an attached folder (Read/Glob/Grep coverage).
- These verifications happen after Beibei pulls v0.1.2 dmg and installs.

**Surfaced**: 2026-04-27 conversation. Beibei wanted Codex-style "point AI at a folder before it answers" — e.g., she has `~/Documents/我的设计资料/` and wants the agent to read that folder when answering questions in a project, even though it's outside the project's git repo. Was impossible pre-§17: SDK call set `cwd` to the session worktree only; no `additionalDirectories` passed; no UI to add reference paths.

**Strategy (locked)**:

1. **Project metadata** — extend the project record with `referenceDirectories: string[]`. Persist via existing project store (Supabase `projects` table — JSONB metadata column already exists). Optional field, defaults to `[]`, no SQL migration needed.

2. **Project settings UI** — add a "Reference folders / 参考文件夹" section in the project context panel (or a new project settings modal — impl picks). Lists current paths + "Add folder / 添加文件夹" button. Picker: HTML `<input webkitdirectory>` v1, or agent IPC for a real native picker if the HTML one feels rough — impl picks. Each row: path display + "Remove" icon. Bilingual (principle #8).

3. **Path safety (server-side validate)** — added paths must be: absolute / exist / NOT inside another project's worktree (avoid cross-project leakage) / NOT a system directory (`/`, `/etc`, `/Users`, etc.). Reject with friendly bilingual error.

4. **SDK wiring** — pass paths via `additionalDirectories` in [`server/src/lib/claudeCode.ts`](../server/src/lib/claudeCode.ts). **Verify the exact option name** against `@anthropic-ai/claude-agent-sdk` type definitions before wiring. AI gains Read/Glob/Grep access to those folders during the session, identical to its access to cwd.

5. **Chat header chip** — small "📁 N reference folders / N 个参考文件夹" chip near the existing FolderChip, click → opens settings to manage. Helps the user remember at a glance what AI has access to in this session.

6. **Mobile interaction (per §15 ship)** — Reference folder UI is an agent feature, so on mobile:
   - **Read-only display**: list shows attached folders so user knows what AI sees on Mac, but
   - **Add / Remove buttons disabled** with `AgentRequiredHint` tooltip pattern from §15
   - Match the same "browse but can't agent-edit" mobile shape

**Out of scope (v1)**:
- No "watch folder for live changes" — paths read at SDK call time, no live sync
- No "selective indexing" — SDK Read tool reads on demand, no upfront embedding
- No "include external git history" — only file content, not commits / branches
- No mobile add UI (read-only chip only)

**Effort**: 2-3 hours (UI + persistence + SDK wiring + path safety).

**Risk**: medium. Touches project metadata, SDK call site, file system permissions, mobile graceful-degrade. Live-test required.

**Test plan**:
- Add an external folder via UI on Mac → chip updates to "1 reference folder"
- New session in same project → ask AI "list files in my reference folder" → AI uses Glob/Read against the added path
- Reload page → folder still attached (Supabase persistence)
- Try adding `/etc` or `/Users` → rejected with bilingual error
- Try adding another project's worktree → rejected with bilingual error
- iPhone @ 375px: chip shows attached folders read-only; "Add folder" button → disabled state + AgentRequiredHint tooltip (per §15 mobile pattern)
- Demo URL: chip hidden or static (no real fs access); no add/remove

---

## 18. `shipped` — UI bilingual → English-only sweep + §17 picker hotfix + design system tokens

**Shipped**: 2026-04-27 (PR [#144](https://github.com/BeibeiZhang/WorkPal/pull/144), merge commit `28b282b`, 38 files +286 −292). Bundled **6 items** into one PR after principle #8 flip:

1. **§17 picker hotfix**: bare `fetch('/api/pick-folder')` → `fetchAgent` (was always 404 on vercel.app cross-origin → text-input fallback; now reaches local agent on `:3001` → real macOS native folder picker).
2. **§18 bilingual sweep**: 79 strings across 19 files (frontend + agent + server + agent vanilla HTML) — all `EN / 中文` patterns dropped to English-only per principle #8 flip.
3. **`--color-error` token foundation**: light `#B42318` / dark `#F97066` (D1 lock); 7 hex hardcodes mass-replaced.
4. **Accent.* Tailwind class extension**: `#3171ff` (`accent-blue`) + `#028901` (`accent-green`) were already CSS vars but not exposed as Tailwind classes — components hex-hardcoded them. ~28 sites mass-replaced.
5. **One-off hex / inline tokenization**: `--color-tooltip-bg` (#1a1a1a) / `--color-overlay-loading` (rgba(0,0,0,0.4) light, rgba(255,255,255,0.4) dark — inverted direction) / `--color-fixed-dark-text` (#142740, D4 — Library / ComingSoon force-dark text on always-light overlays). Existing tokens reused: `#E8E8E8` / `#c4c4c4` / `#bebebe` → `border-stroke-outline`.
6. **Tailwind alpha-modifier silent-failure cleanup**: 24 hits across ArtifactPage / ProjectPage / MessageCard / ChatInput / ChatMessage / VoiceMode. `text-text-X/60` silently failed because CSS vars are `rgba()` literals (Tailwind alpha modifier needs RGB triplets) → mapped to closest existing token (`text-text-secondary` rgba .6 / `text-text-tertiary` rgba .4).

**Mid-PR process**: Beibei flipped principle #8 from "bilingual day 1" to "English-first UI" (commit `f66a5be`) after observing `/ 中文` double-line pattern was visually heavy on Reference folders SideCard. CLAUDE.md violations + "Extend, don't bypass" (commit `7c9b612` + alpha-modifier `23a382f`) sections added during this PR. Stale memory `feedback_targeted_english_only.md` deleted after principle flip made it obsolete.

**Skill assets synced**: DESIGN_SYSTEM.md / src/index.css / tailwind.config.js / src/components/shared.tsx all copied to `~/.claude/skills/workpal-design-system/` per CLAUDE.md sync rule.

**Live-test (Beibei)**: 7 scenarios passed — no `/ 中文` residue desktop + iPhone 375px, dark mode `--color-error` resolves to `#F97066`, native folder picker really pops on Mac (proves `fetchAgent` reaches `:3001`), AgentRequiredHint English-only on mobile (no Chinese line per PR #142 follow-up locked in).

**v0.1.3 release**: Beibei bumped `agent/package.json` 0.1.2→0.1.3 + tagged + pushed → CI built dual-arch dmg → installed → agent restart → boot-check → Settings updated.

**Surfaced**: 2026-04-27, after principle #8 flipped from "bilingual day 1" to "English-first UI". All previously-shipped "EN / 中文" double-line UI copy needs to retrofit to English-only. Pure copy edit, zero behavior / logic / type change. Beibei's framing: "EN / 中文 同时显示视觉累赘 + 维护税重" — examples in screenshot included `Reference folders / 参考文件夹`, `Cancel / 取消`, `Paste an absolute path. / 粘贴绝对路径`. Bundled with a small §17 hotfix below since §17 picker is broken in production (dev-mode passed self-test but vercel.app deploy doesn't reach the agent endpoint).

**§17 picker hotfix (production bug, bundle in same PR)**:

[`src/components/ProjectPage.tsx:99`](../src/components/ProjectPage.tsx#L99) uses bare `fetch('/api/pick-folder', ...)` — a relative path. In `workpal-beibei.vercel.app` context this resolves to `vercel.app/api/pick-folder` (no such endpoint on Vercel) → **always 404** → always falls back to text input row. The native picker `dialog.showOpenDialog` is wired correctly in `agent/src/main/pickFolder.ts` and serves on `https://127.0.0.1:3001/api/pick-folder`, but the frontend never calls it. Dev-mode self-test passed because localhost happens to land on the right Express via Vite proxy; production cross-origin doesn't.

Fix:
- Change `fetch('/api/pick-folder', { method: 'POST' })` → `fetchAgent('/api/pick-folder', { method: 'POST' })`
- Add import: `import { fetchAgent, AgentUnreachableError } from '../lib/agent';`
- Existing `catch { setShowInput(v => !v) }` still works for `AgentUnreachableError` (no agent reachable from this device at all) and for 404 (agent up but old version without pickFolder mount). Defensive: log AgentUnreachableError once via console.warn so future debugging has a trail.
- Mobile check above `fetchAgent` call already short-circuits via `triggerHint()`, so AgentRequiredOnMobileError won't bubble in practice — no extra mobile handling needed.

Ship verification: install v0.1.2 agent + open `workpal-beibei.vercel.app` → ProjectPage → Reference folders → Add folder → real macOS native folder picker pops (NOT text input).

**Strategy (locked)**:

1. **Grep enumerate** all bilingual UI strings:
   - `grep -rn '/ [一-鿿]' src/ agent/src/main/ server/src/`
   - Two-`<p>` siblings pattern (`OnboardingSurface` step lines): grep for `text-text-secondary` paragraphs that follow a `text-text-primary` paragraph and contain CJK.
2. **Drop the `/ 中文` half** on each match. Keep the English half.
3. **Visual check** on Mac desktop + iPhone 375px after each component cluster — make sure layout doesn't break when EN-only is shorter than EN+ZH (line counts shrink in some cards).
4. **Don't touch**: AI prompt strings (LLM inputs), intent router keywords, user-entered content, AgentRequiredHint (already English-only via PR #142).

**Surfaces likely affected** (not exhaustive — let grep be authoritative):
- `src/components/ProjectPage.tsx` — Reference folders SideCard title, empty state, Cancel/Add labels, hint text, error toasts
- `src/components/TaskContextPanel.tsx` — Complete Session tri-state tooltip (line 443)
- `src/components/CompleteSessionModal.tsx` — success body copy, alreadyUpToDate copy (lines 228-233)
- `src/components/OnboardingSurface.tsx` — STEPS array `zh` field drops; revert to single-line `en` per step
- `src/components/ChatPanel.tsx` — ReferenceFoldersChip hover title
- `src/App.tsx` — `handleAddReferenceDirectory` inline error strings
- `server/src/lib/referenceDirs.ts` (and agent mirror) — validator error messages
- `src/components/DemoBadge.tsx` + demo modal — labels & explainer
- `src/lib/useAuth.tsx` / LoginScreen / PasswordModal copy
- Memory page demo banner, Connectors page demo "Connected (Demo)" labels

**Out of scope**:
- **AI system prompts** (e.g., `ARTIFACT_PROMPT` in `server/src/routes/claudeChat.ts`) — these are LLM inputs, not UI display.
- **Intent router keywords** (`CLAUDE_CODE_KEYWORDS` Chinese entries in `intentRouter.ts`) — bilingual day 1 still applies per principle #8 "识别层 ≠ 展示层".
- **User-entered content** (chats / memory entries / project descriptions / filenames).
- **`AgentRequiredHint`** — already English-only via PR #142.
- **Comments / code identifiers / commit messages** — these are dev-facing, not user-facing UI.

**Effort**: ~30 min — 1 hour. Pure mechanical edit. Mostly delete + simplify; one `OnboardingSurface` STEPS reshape (drop `zh` field).

**Risk**: low. Pure copy. Visual regression risk only — some cards will be visibly shorter once Chinese drops.

**Test plan**:
- Mac Chrome desktop: ProjectPage Reference folders / Complete Session tooltip / CompleteSessionModal / OnboardingSurface (force agent unreachable on Mac to surface it) all show English only, no `/` separator left in user copy.
- iPhone @ 375px: same surfaces clean.
- Demo URL @ 375px: identical English UI to main site.
- Sanity: AI assistant chat with a Chinese prompt ("帮我写个 hello world") still responds in Chinese — confirms LLM auto-language handling is untouched.
- Sanity: typing "改一下 src/App.tsx" still triggers intentRouter to claude-code path (not artifact / cloud) — confirms keyword bilingual identification still works.

---

## 19. `shipped` — System prompt: AI proactively explores reference folders

**Shipped**: 2026-04-28 (PR [#146](https://github.com/BeibeiZhang/WorkPal/pull/146), merge commit `68f25ee`, bundled with §20). Single conditional system prompt addition in `claudeChat.ts` (server + agent mirror byte-identical). `REFERENCE_FOLDERS_PROMPT(paths: string[])` injected **only when** `referenceDirectories.length > 0` — tells AI to Glob ref folder first / Read candidates / NOT fabricate Gmail / Drive / calendar context. Critical phrasing per planning Flag 1: "Don't write into them directly — your file outputs go to the session working directory (cwd); the user can later choose to merge them into the reference folders via the Complete Session UI" (prevents AI from trying to write directly into ref folders).

**Surfaced**: 2026-04-27, when Beibei tested attached folder + asked "改一下我的简历" — AI hallucinated "I can't access Gmail" instead of Globbing the attached folder. Root cause: SDK gives Read/Glob/Grep on `additionalDirectories` but ARTIFACT_PROMPT didn't tell AI about them.

**§19 follow-up surfaced post-ship**: keyword router miss makes §19 incomplete on its own — Beibei's natural-language prompts ("在我简历加上...") miss `CLAUDE_CODE_KEYWORDS` so chats route to OpenAI fallback, where §19 system prompt is never injected. Tracked as **§21**.

---

## 20. `shipped` — Output → Reference folder via "并入" extension to Complete Session

**Shipped**: 2026-04-28 (PR [#146](https://github.com/BeibeiZhang/WorkPal/pull/146), merge commit `68f25ee`, bundled with §19). Reuses Phase 6.3 "Complete Session" mental model — extends merge gesture to support reference folder targets in addition to existing project main merge. **AI never writes ref folder directly** (pinning hack intact); user controls merge via Complete Session UI.

**Implementation**:
- **`Checkbox` shared primitive** ([`src/components/shared.tsx`](../src/components/shared.tsx)) — first checkbox in design system; reuses Switch's inline-style-with-CSS-var precedent (`var(--color-selected-bg)` / `var(--color-selected-text)` already in `src/index.css`); 100% token, zero hex, zero alpha modifier.
- **CompleteSessionModal target selector** ([`CompleteSessionModal.tsx`](../src/components/CompleteSessionModal.tsx)): checkbox group below file list when `referenceFolders.length > 0`; new `partial-success` phase with three visual treatments — green CheckCircle2 (success), gray AlertCircle + `text-text-tertiary` (warning `no_outputs_dir`), red XCircle (failure). Empty refs → modal degrades to single-action flow.
- **Backend** ([`server/src/lib/sessionCopy.ts`](../server/src/lib/sessionCopy.ts) + agent mirror NEW): `copySessionOutputsToRefFolder(sessionPath, refFolderPath)` strict-to-ARTIFACT_PROMPT layout — copies `<sessionPath>/outputs/*` flat into `<refFolderPath>/`. Missing `outputs/` → `success-with-warning` (`no_outputs_dir`). 4 error codes mapped: `permission_denied` / `not_found` / `disk_full` / `unknown`.
- **`/api/session/merge` extension** ([`server/src/routes/session.ts`](../server/src/routes/session.ts) + agent mirror): accepts `targets?: { project?: boolean, referenceFolders?: string[] }`. Strict serial fail-abort — project first → fail returns early without touching ref folders (atomic abort per Q3 lock); ref folders independent serial copies; per-target failures don't short-circuit each other.
- **Mobile §15 gap fix** ([`TaskContextPanel.tsx`](../src/components/TaskContextPanel.tsx)): visible-but-disabled + 5s `AgentRequiredHint` tip on click, mimics PR #138 FolderChip pattern. **`AgentRequiredHint` extended with `customMessage?: string` prop** (planning Flag 3) so this surface uses specific copy "Open WorkPal Agent on desktop to complete this session"; existing 5 callsites zero-regression default copy.

**Beibei's 4 product locks** (via inline AskUserQuestion mid-impl):
1. **Copy scope** = `outputs/*` flat to `refFolder/` (strict ARTIFACT_PROMPT contract; warning if AI didn't follow layout)
2. **Endpoint** = extend `/api/session/merge` (preserves /complete=preview, /merge=action SRP)
3. **Atomicity** = project fail → abort all ref folder copies
4. **Mobile** = visible-but-disabled + tip (mimic PR #138, 顺手补 §15 gap)

**Planning's 4 mid-plan flags incorporated**:
1. §19 prompt "Don't write into ref folders directly — outputs go to cwd, user merges via Complete Session UI"
2. Token verification confirmed `--color-selected-bg` / `--color-selected-text` exist in `src/index.css:33-34, 174-175`
3. `AgentRequiredHint` `customMessage?` prop (single-prop, 5 existing callsites zero-regression)
4. `no_outputs_dir` warning UI distinct from error (gray AlertCircle + `text-text-tertiary` instead of red `text-error`)

**Verification**: typecheck clean (server + frontend); 3 mirror pairs byte-identical. **Live-test deferred to Beibei's local env** per `feedback_preview_reuse_idle` (port conflict prevented impl preview): scenarios a-e (UI states + atomic abort + permission denied + multi-target) verifiable on Vercel after merge with hard-refresh; scenario g (real SDK chat with ref folder) requires v0.1.4 dmg install.

**v0.1.4 release**: Beibei bumped `agent/package.json` 0.1.3→0.1.4 + tagged + pushed → CI built dual-arch dmg → agent SDK changes (`ARTIFACT_PROMPT` extension + `additionalDirectories` plumbing per §19 mirror) live in production.

**Surfaced**: 2026-04-27 conversation. Beibei rejected direct-write-to-ref-folder design — preferred reusing existing Phase 6.3 "review then merge" gesture as the channel for "AI output → reference folder" loop. Avoids security model rewrite + permission persistence + UI complexity that the original 4-button PermissionPrompt design would have required.

---

## 21. `shipped` — Project ref-folder defaults text chat to Claude (channel-aware routing)

**Shipped**: 2026-04-28 (PR [#150](https://github.com/BeibeiZhang/WorkPal/pull/150), merge commit `1ba8762`, v0.1.5 dmg). Single-file change in [`src/lib/intentRouter.ts`](../src/lib/intentRouter.ts) — `getAgentRouteIntent` gains `referenceDirectories: string[]` 3rd param + new branch after `IS_DEMO` short-circuit / before keyword check (`length > 0 && isAgentCurrentlyReachable() → 'use-claude'`). Caller in [`src/App.tsx:2353`](../src/App.tsx) handleSend threads `project?.referenceDirectories ?? []` via local `chatForRoute`/`projectForRoute` lookup. **Live verified**: 2026-04-28 Beibei test on PR preview URL (after diagnosing browser PNA cold-start cert handshake delay): project with ref folder + natural-language prompt "把这个加到 Beibei Zhang resume 上" → progress panel shows `Glob` / `Read` / `Bash` (Claude SDK path active) instead of `search_gmail` (OpenAI fallback). §19 system prompt now injects on natural-language prompts as designed. **12/12 unit cases verified** ad-hoc in `/tmp/verify-pr150.ts` during planning review.

**Two follow-ups surfaced during live test (both shipped same day)**:
- **§22** — §19 prompt didn't forbid AI roaming `~/Documents` even with ref folder attached. AI ran `Bash: find ~ -name "*resume*"` because original prompt only said "Glob each folder first" without explicit "ONLY these paths" constraint
- **§23** — Local Claude-code Output cards had no preview path. Click only toggled highlight ([`ProjectPage.tsx:658`](../src/components/ProjectPage.tsx:658) only handled hosted artifacts via `o.href`)

**Process learning**: time-consuming testing diagnosis ("AI 还是去邮箱" symptom) traced to 5 confounded state variables (URL preview vs main / projectId standalone vs project / agent reachable / refDirs field actually present / §21 code itself). Surfaced **§24** (routing decision visible in Progress panel) + **§25** (debug overlay) + **§28** (test infra) as ROI-high test-efficiency improvements.

**Original surfacing context follows**:

**Surfaced**: 2026-04-27 conversation, Beibei testing v0.1.3 + §17 ref folder feature with natural-language prompts. Two prompts ("在我简历加上这个记录" / "把这段加到我简历上") both contain "加 / 加到 / 加上" — none in `CLAUDE_CODE_KEYWORDS` ([`src/lib/intentRouter.ts:13`](../src/lib/intentRouter.ts#L13)). Result: chat routes to OpenAI fallback (no tool access), AI hallucinates "I can't access your Gmail" context, never injects §19 system prompt (which only takes effect on Claude path). Growing the keyword list is cat-and-mouse long-tail; the structural fix is making project-with-ref-folder chats default to Claude.

**Channel routing table after §21**:

| Channel | Route | Note |
|---|---|---|
| Voice mode | Always OpenAI | Untouched (different code path, doesn't pass through `getAgentRouteIntent`) |
| **Text + ref folder attached** | **Claude** (let LLM decide tool use) | **§21 new** |
| Text, no ref folder + keyword match | Claude | Existing keyword router |
| Text, no ref folder + no keyword | OpenAI fallback | Existing |
| Text + agent unreachable + mobile | AgentRequiredHint | §15 already shipped |
| Demo URL | Always fallback-cloud | §15 IS_DEMO short-circuit already shipped |

**Strategy (locked)**:

Single-point change in [`src/lib/intentRouter.ts`](../src/lib/intentRouter.ts) — extend `getAgentRouteIntent` signature with `referenceDirectories: string[]` and add a branch right after the IS_DEMO short-circuit, before the keyword check:

```ts
export function getAgentRouteIntent(
  text: string,
  isMobile: boolean,
  referenceDirectories: string[],  // §21 new
): AgentRouteIntent {
  if (IS_DEMO) return 'fallback-cloud';
  // §21: project has ref folders → default text chat to Claude (let LLM
  //      decide whether to use tools). Bypasses keyword match because
  //      natural-language long-tail ("加 / 加到 / 提一下" etc.) can't be
  //      enumerated. Voice mode unaffected (different code path).
  if (referenceDirectories.length > 0 && isAgentCurrentlyReachable()) {
    return 'use-claude';
  }
  if (!matchesClaudeCodeKeyword(text)) return 'fallback-cloud';
  if (isAgentCurrentlyReachable()) return 'use-claude';
  if (isMobile) return 'mac-only-on-mobile';
  return 'fallback-cloud';
}
```

**Caller wiring** ([`src/App.tsx`](../src/App.tsx) handleSend): thread `project?.referenceDirectories ?? []` into the `getAgentRouteIntent` call. Same `project` lookup that already feeds `streamClaudeChat`'s `referenceDirectories` field — single source of truth.

**Edge cases verified**:
- Standalone chat (`chat.projectId === undefined`) → `project` undefined → `?? []` → length 0 → §21 branch skipped → keyword router fall-through
- Project chat but project has no attached ref folders → length 0 → same fall-through
- Project chat with ref folders + agent unreachable → `isAgentCurrentlyReachable()` false → §21 branch skipped → falls through to existing mobile / fallback handling
- IS_DEMO → first short-circuit returns fallback-cloud, §21 branch never reached
- Voice mode → not in this code path; OpenAI always

**Why this design (vs growing keyword list)**:
1. **User attached ref folder = "this project is AI editing workflow"** — explicit signal, not inference
2. **Matches Codex / Cursor mode** — project context default has tool access, natural language works out of the box, no keyword memorization
3. **Long-tail keyword problem unsolved by enumeration** — Chinese natural-language has hundreds of variants ("加 / 加上 / 加到 / 添到 / 补一下 / 提一下 / 修一下 / ..."), list will always lag

**Cost / trade-off**: Each project-with-ref-folder chat spawns a Claude SDK subprocess instead of streaming OpenAI. Slightly slower + more expensive per call. Acceptable because user's intent (attach ref folder) is to use AI editing.

**Effort**: ~30 min. Risk: low — single function signature change + 1 caller site. No backend / SDK / UI / mirror change. `intentRouter.ts` is frontend-only.

**Test plan**:
- Project with attached ref folder, send a non-keyword natural-language prompt ("加一段到我简历" / "记录这个" / "把这写进文档") → progress panel shows `Glob` / `Read` steps (proves Claude path active) → §19 system prompt finally injects → AI Globs ref folder, Reads candidates, proposes edit (NOT "I can't access Gmail").
- Same prompt on project WITHOUT ref folders → keyword router (current behavior unchanged).
- Standalone chat (no project) with same prompt → keyword router (current behavior unchanged).
- Voice mode in project with ref folder → still OpenAI (verify network tab — no Claude SDK process spawn).
- Demo URL → IS_DEMO precedence intact.
- Mobile + project with ref folder + agent unreachable → falls through to existing mobile handling (AgentRequiredHint).

---

## 22. `shipped` — Tighten §19 reference folder prompt to forbid out-of-scope search

**Shipped**: 2026-04-28 (PR [#151](https://github.com/BeibeiZhang/WorkPal/pull/151), merge commit `81c466e`, v0.1.5 dmg). String-only edit, 2 mirror files (+2 −2). Inserts hard-prohibition paragraph at top of `REFERENCE_FOLDERS_PROMPT(paths)` template literal — placed right after paths bullet list (impl reasoning: stronger ordering than appending after "don't write directly" segment). New text: *"These folders are your ONLY source of user content. Do NOT use Bash `find ~`, `ls /Users/...`, or any Glob outside these paths. If the content isn't in these folders, say so explicitly. Don't roam other directories."*

**Files** (mirror pair, byte-identical via `scripts/sync-agent-shared.sh`, drift check passes):
- `agent/src/shared/routes/claudeChat.ts:243` — `REFERENCE_FOLDERS_PROMPT`
- `server/src/routes/claudeChat.ts:243` — mirror

**Surfaced**: 2026-04-28 Beibei testing v0.1.4 dmg post §21 ship — AI ran `Bash: find ~ -name "*resume*"` and `ls -la ~/Documents` despite ref folder attached. Original §19 prompt only said "Glob each folder first" without forbidding outside searches. AI behavior reasonable given LLM defaults but doesn't match Beibei's "ref folder = ONLY scope" mental model.

**Plan-quality highlights** (recorded in memory `feedback_plan_quality_bar.md`):
1. Plan reasoned about prompt position (top vs bottom) explicitly — chose top so hard prohibition reads strongest right after paths list
2. Pre-flagged backtick escape in template literal (`\`find ~\``) — avoided common pitfall
3. Plan's out-of-scope explicitly proposed §27 (Tool-level Bash deny) as the "if §22 soft constraint fails, hard constraint backup" path — defensive engineering

**Risk**: low — string-only edit, no logic change. **Effort**: ~30min. **Live test**: deferred to v0.1.5 dmg install (port :3001 conflict prevented impl dev backend).

---

## 23. `shipped` — Local-file Output card click → DetailPanel preview + Finder reveal escape

**Shipped**: 2026-04-28 (PR [#152](https://github.com/BeibeiZhang/WorkPal/pull/152), merge commit `08c1b8a`, **v0.1.6 dmg** — note: not v0.1.5 because §23 merged 20:53Z after v0.1.5 release at 19:20Z; required separate bump). 7 files (+310 −90).

**Implements**:
- (a) Frontend click on local-file Output card → SplitView wraps ProjectPage with right-side DetailPanel inline preview (markdown / html / plaintext via existing [`renderMarkdownBlocks`](../src/lib/markdown.tsx))
- (b) DetailPanel header gets Finder icon button → new `POST /api/claude-chat/reveal-in-finder` route (`spawn('open', ['-R', path])` — reveal-and-highlight semantics distinct from existing `open-folder` parent-only / `open-file` default-app)
- (c) Binary file fallback (client-side `BINARY_EXT` regex preflight skips doomed read-file → DetailPanel `unsupported` mode placeholder + dual buttons "Reveal in Finder" / "Open with default app")
- (d) Mobile graceful (silent no-op, Finder button hidden — §15 family pattern)
- (e) State split: `chatPreviewArtifact` + `projectPreviewArtifact` independent useState, hoisted `handleArtifactPreview(artifact, which)` callback shared by chat ArtifactCard + ProjectPage routes via `which: 'chat' | 'project'` param, `renderPreviewPanel(state, overlay, onClose)` helper for DRY

**Surfaced**: 2026-04-28 Beibei testing post §21 ship — Claude wrote `Beibei-Zhang-Resume-...` markdown to Career project Output, but click on card only toggled highlight. [`ProjectPage.tsx:658`](../src/components/ProjectPage.tsx:658) `handleClick` only opened hosted artifacts (#3) via `o.href`; local Claude-code outputs had no preview entry. Gap surfaced by §17/§19/§20 ref folder workflow.

**4 decisions locked via AskUserQuestion** (planning):
1. **DetailPanel placement** → SplitView wrap ProjectPage (consistency with chat ArtifactCard preview UX; canFitAllThree handles narrow-screen)
2. **Finder action semantics** → new `POST /api/claude-chat/reveal-in-finder` route (`open -R` highlights file, distinct from existing `open-folder` / `open-file`)
3. **Mobile** → silent no-op (toggle highlight only, Finder button hidden per §15 graceful degrade)
4. **Binary fallback** → impl-designed client-side `BINARY_EXT` regex preflight + DetailPanel `unsupported` mode + **dual buttons** Reveal/Open (impl exceeded planning's spec — gives user 2 escapes covering different intents)

**Plan-quality highlights** (recorded in memory `feedback_plan_quality_bar.md`):
1. Impl's "Key Findings" section grep-verified spec assumptions before coding — discovered 80% infrastructure already exists (`POST /api/claude-chat/read-file` already has 10MB cap + WORKPAL_ROOT jail; [`renderMarkdownBlocks()`](../src/lib/markdown.tsx) already handles markdown). Effort 3-4h → ~3h actual; only new endpoint = reveal-in-finder
2. Step 3 hoist `handleArtifactPreview` shared callback — chat ArtifactCard + ProjectPage Output route through same handler, `which` param decides target state, free regression check (chat .md preview now also gains Finder icon)
3. Plan's reusable utilities list (8 items) all grep-verified existing — principle #4 reuse-not-rebuild strict adherence

**Mid-flight nit incorporated by impl**: planning flagged shared `previewArtifact` state would bleed across chat ↔ ProjectPage routes (chat preview A → switch to ProjectPage → preview B → switch back → A replaced with B). Impl accepted, split into 2 independent useState hooks; final behavior: each route's preview survives navigation, no cross-contamination.

**Files**:
- `src/types.ts` — `OutputItem.path?: string`
- `src/App.tsx` — state split + `handleArtifactPreview` useCallback hoist + `renderPreviewPanel` helper + SplitView wrap ProjectPage
- `src/components/DetailPanel.tsx` — `filePath?` + `mode?: 'preview' | 'unsupported'` props
- `src/components/ProjectPage.tsx` — `onOutputPreview` prop, `useIsMobile()` mobile guard
- `src/lib/api.ts` — `postRevealInFinder()`
- `server/src/routes/claudeChat.ts` + `agent/src/shared/routes/claudeChat.ts` — new reveal-in-finder route (mirror via sync script, drift check passes)

**Migration**: legacy `Project.outputs` entries lack `path` field → fall through to `setSelectedOutputId` toggle behavior. New writes auto-include `path` from `committedPath`. Beibei's existing Career resume Output won't auto-gain preview (re-generate to acquire) — accepted trade-off vs migration complexity.

**Live test**: planning skipped pre-merge live test per principle #12 risk-routed (medium risk, but PR diff thoroughly verified static — backend reveal-in-finder reuses `resolveSessionFolder` jail = zero new validation, frontend state mgmt verified diff-by-diff). Live test deferred to v0.1.6 dmg install (full happy path 5 + edge cases 6 + chat regression check). v0.1.6 release built 2026-04-28 evening.

**Effort**: ~3h (vs spec 3-4h, 80% pre-existing). **Risk**: low-medium.

---

## 31+32. `shipped` — Legacy Output entry path backfill + icon color polish

**Shipped**: 2026-04-28 (PR [#153](https://github.com/BeibeiZhang/WorkPal/pull/153), merge commit `4adfb7d`, frontend-only — Vercel auto-deploy, no dmg bump). 8 files +302 −8.

**§31 (backend + frontend backfill)**:
- New backend route `POST /api/project/scan-outputs` ([server/src/routes/project.ts](../server/src/routes/project.ts), agent mirror) — body `{ projectSlug, names[] }` → `{ matches: [{name, path}] }`. Reuses `resolveProjectFolder` jail (zero new validation code, principle #7). Returns **only unique matches** (0 / multiple → dropped to avoid wrong-path overwrite).
- New helper `indexProjectOutputs(projectPath, maxEntries=5000)` — recursive walk of `<project>/sessions/`, skips `.git/` + `node_modules/`, basename-keyed Map. Node 20+ `Dirent.parentPath` compatibility shim for older `@types/node`.
- New frontend `postScanProjectOutputs(slug, names)` ([src/lib/api.ts](../src/lib/api.ts)) — graceful: agent unreachable / failure → silent `[]` return.
- New `backfillLegacyOutputPaths(project, scan)` pure function ([src/lib/projectStore.ts](../src/lib/projectStore.ts)) — **DI pattern**, scan injected as parameter, store doesn't bind to fetch (testable + decoupled).
- App.tsx wire ([src/App.tsx:1287](../src/App.tsx#L1287)): independent useEffect alongside `postInitProject`. `backfilledProjectsRef: Set<string>` guards once-per-project per session. `setProjects` updater closure uses **latest prev snapshot** to re-merge — concurrent-edit safe (scan in flight + user edits don't get lost). `agentState !== 'reachable'` short-circuits when agent down.

**§32 (UI polish)**: [src/components/ProjectPage.tsx:688](../src/components/ProjectPage.tsx#L688) — `text-text-tertiary` → `text-text-primary` (light mode `#142740` 100% per Beibei spec). Dark mode `text-white` unchanged. Selected state `text-accent-blue` unchanged.

**Surfaced**: 2026-04-28 Beibei testing v0.1.5 dmg post §23 ship — observed legacy Output entries (created before §23 frontend ship 20:53Z, e.g. `workpal_resume`) lack `path` field → click falls back to toggle-highlight only (§23 spec'd as accepted migration trade-off). Beibei requested fix + icon color preference Primary 100%.

**Plan-quality highlights** (continues bar set by §22 / §23): impl self-imposed 3 safety patterns beyond spec — (a) **DI pattern** in `backfillLegacyOutputPaths`, (b) **idempotent guard via Set ref**, (c) **`setProjects` updater closure for concurrent-edit safety**. Plus Node 20+ Dirent compatibility shim. Multi-match drop (instead of fuzzy match) is **stricter than spec** (preferred behavior).

**Trade-off (acceptable)**: legacy entries with **same basename across multiple sessions** (e.g., Beibei's multiple `resume.md` from §21 testing) → multi-match → dropped → those entries remain toggle-only. Workaround: regenerate with unique name. Documented choice over wrong-path overwrite.

**Effort**: ~1.5h (vs spec 1-1.5h). **Risk**: low (frontend-only, no dmg). **Live test**: deferred to post-merge Vercel deploy + Beibei hard-refresh + click on unique-match legacy entry.

---

## 29. `shipped` — ChatInput multi-Enter race fix

**Shipped**: 2026-04-28 (PR [#154](https://github.com/BeibeiZhang/WorkPal/pull/154), frontend-only Vercel auto-deploy). 1 file ChatInput.tsx +22/-3.

**Root cause**: Spec 推 single `if (isStreaming) return` guard 不够 — impl preview MCP 实测 3 Enter → 仍 3 message。React state update 跨 event 也要等 commit；同步 burst 里 prop 仍 stale.

**Fix**: `sendingRef` (useRef) 同步置 true，`useEffect` 监听 `isAiResponding` 回 false 时释放。`handleSend` 双 guard: `if (isAiResponding || sendingRef.current) return`。Plus optional: send button `opacity-50 cursor-not-allowed` when streaming.

**Plan-quality 4th high-bar plan** — impl preview MCP 实测 catch spec wrong + iterate fix.

---

## 30. `shipped` — Output → ref folder convention (prompt + backend fallback)

**Shipped**: 2026-04-28 (PR [#157](https://github.com/BeibeiZhang/WorkPal/pull/157), v0.1.7 dmg). 14 files +740/-101.

**Part A** — §19 `REFERENCE_FOLDERS_PROMPT` 加 closing sentence "Your deliverable file outputs go to `<cwd>/outputs/<name>` (matches ARTIFACT_PROMPT convention)".

**Part B** — backend `copySessionOutputsToRefFolder` 加 fallback：if `outputs/` missing/empty → run `git status --porcelain=v1 -z` → filter top-level + `DELIVERABLE_EXT` (`md|txt|html|pdf|docx?|json|ya?ml|csv`) + `SCAFFOLDING_BLOCK` → copy with `COPYFILE_EXCL`. New `listNewFilesAtTop` git helper + `parseNewFilesPorcelain` testable function. CopyResult union 加 `usedFallback?: true` + `'no_new_deliverables'` warning. Frontend CompleteSessionModal terse messages.

**Plan-quality 5th high-bar plan**. Tests added: `sessionCopy.test.ts` + `git.test.ts` extension — proactive beyond spec. **Known minor nit (deferred to §35)**: `pnpm-lock.yaml` 漏过 blocklist (`.yaml` in deliverable list, lockfile name not in block).

---

## 36. `shipped` — ProjectPage ChatInput voice mode props

**Shipped**: 2026-04-28 (PR [#158](https://github.com/BeibeiZhang/WorkPal/pull/158), bundled with §38, frontend-only).

**Surfaced**: Beibei observed Career ProjectPage 输入框无 mic button while ChatPanel 有.

**Decision via AskUserQuestion**: Strategy 1 = parallel inline mounts (impl grep verified VoiceMode is inline bar above ChatInput, NOT fixed overlay — impl 矫正 planning Strategy A "lift to top-level overlay" 假设).

**Fix**: ProjectPage 加 11 voice props (selectedAvatarId / onVoiceMode / voiceModeActive / onVoiceModeClose / onVoiceMessage / onVoiceImages / onVoiceVideos / onVoiceWebSearch / voicePendingText / voicePendingImages / onVoicePendingTextConsumed). ChatPanel **零改动** (parallel mounts, runtime 只 1 个 active 因为路由互斥).

---

## 38. `shipped` — ProjectPage chat creation routing fix (SHOWSTOPPER)

**Shipped**: 2026-04-28 (PR [#158](https://github.com/BeibeiZhang/WorkPal/pull/158), bundled with §36, frontend-only).

**Surfaced**: Beibei extensive debugging discovered **ProjectPage 内 chat 永远走 OpenAI 不管 §21 ref folder routing**。同样 prompt "创建 hello.md" → standalone chat: Claude SDK Write tool ✅; ProjectPage chat: OpenAI calls `create_calendar_event` ❌.

**Root cause**: `handleCreateChatInProject` (App.tsx:2902) 直接调 `streamFromAPI` 跳过 `getAgentRouteIntent`.

**Fix**: 抽出 `dispatchSendForChat` useCallback，handleSend + handleCreateChatInProject 都调它做 routing decision。`projectIdHint` parameter 显式传 (per defensive engineering — fresh chats setChats 没 flush，closure-only lookup miss).

**Plan-quality 6th high-bar plan**: impl 7 条 pitfalls 全显式 flag (closure flush race / branch order / shouldGenerateArtifact precedence / dep bloat / voice flow / selectedAvatarId / cross-route session reset).

---

## 39+40. `shipped` — streamFromClaudeAPI projectIdOverride + Save to Knowledge rename

**Shipped**: 2026-04-29 (PR [#159](https://github.com/BeibeiZhang/WorkPal/pull/159), v0.1.7 dmg). 4 files +12/-8.

**§39 root cause**: §38 plan 显式 flag `streamFromAPI` projectIdOverride pattern 但漏了 `streamFromClaudeAPI` **also lacks** the parameter — fresh chat from `handleCreateChatInProject` → setChats 没 flush → closure 内 `chat?.projectId` undefined → projectSlug undefined → backend 走 Phase 5 fallback (no `git worktree add -b session/<slug>`) → no branch → no commit → no Output card + Save to Knowledge diff fails.

**§39 fix**: 加 `projectIdOverride?: string` 到 `streamFromClaudeAPI` signature, dispatchSendForChat 传 projectIdHint.

**§40**: Rename "Complete Session" → "Save to Knowledge" 3 处 user-visible (button label + modal title 3 states + error fallback). Component file name / function names / state vars / types 不动.

**Lesson sealed**: when adding parameter override to one stream function, audit ALL similar stream functions for same closure-flush gap.

---

## 41. `shipped` — Ref folder fallback uses `base...session` diff (catch committed files)

**Shipped**: 2026-04-29 (PR [#160](https://github.com/BeibeiZhang/WorkPal/pull/160), v0.1.8 dmg).

**Surfaced**: Beibei §39+§40 ship 后 verify — Save to Knowledge "Project main ✓" 但 ref folder ⚠ "No new deliverable files". 实际 AI 写了 `goodbye.md` 但 §30 fallback 漏过.

**Root cause**: §30 fallback 用 `git status --porcelain` 只 catch 未 commit 的文件（untracked/staged）。但 Phase 5.5 auto-commit 在每次 Write tool 后立刻 `git add && git commit` → `git status` 返回空 → fallback 找不到 → `no_new_deliverables`.

**Fix**: 新 `listAddedTopLevelFiles(projectPath, branchName)` 用 `git diff --diff-filter=A --name-status -z <base>...<session>`. Capture 必须在 `mergeSessionFFOnly` 之前 (post-FF range 空). `copySessionOutputsToRefFolder` 加可选 `addedFiles?: string[]` 三态语义: `undefined` → 旧 git-status path; `[]` → truly empty NOT fallthrough; provided → use it.

Follow-up commit (impl plan review 后): `copyTopLevelNewFiles` 防御性 `/` filter (1 LOC) + `listAddedTopLevelFiles` throw 测试 (钉死 catch-and-warn 降级 contract) + `--no-renames` 注释 (Plugin review 错以为冗余, 加注释防再次误判).

---

## 42. `shipped` — Software Update page

**Shipped**: 2026-04-29 (PR [#166](https://github.com/BeibeiZhang/WorkPal/pull/166), v0.1.9 dmg).

**Goal**: AvatarMenu 新 "Software Update" 页面 6 行 dashboard 实时检查升级状态. 6 sources:
- WorkPal Agent (GitHub `/releases/latest`)
- Claude SDK (`@anthropic-ai/claude-agent-sdk` npm registry)
- OpenAI SDK (`openai` npm registry)
- Claude models (Anthropic `/v1/models`, 需 ANTHROPIC_API_KEY)
- OpenAI text/chat (filter `gpt-*` non-realtime)
- OpenAI voice (filter `realtime`/`whisper`/`transcribe`)

各 row 独立 try/catch + 5s timeout, 单点失败不 500 整页. Mobile §15 graceful degrade. IS_DEMO 短路.

**Plan-quality flag — agent shared mirror missing**: PR 第一版只 touch `server/src/routes/versionInfo.ts`, **没** mirror 到 `agent/src/shared/`. Planning catch + impl follow-up commit 加 mirror + `app.getVersion()` asar-safe 解析 + PRICING dedup model lists. **首次 surface "agent shared mirror is impl-mandatory" pattern → memory `feedback_agent_shared_mirror.md`**.

---

## 43. `shipped` — ProjectPage Output 数据源 main + in-session 合并 + status tag

**Shipped**: 2026-04-30 (PR [#168](https://github.com/BeibeiZhang/WorkPal/pull/168), v0.1.10 dmg).

**Surfaced**: Beibei verify Career project 实际 main 8 deliverable + sessions/ 2 worktree, ProjectPage Output 列表只显 3. Root cause: §31 `indexProjectOutputs` 只 walk `<project>/sessions/`, 不看 main 分支 — Save to Knowledge 后 sessions 被 reaper 清就从列表消失. 文件实际还在 main, 不是真丢, 是显示 bug.

**Goal**: Output 列表反映"项目全部产出": main 已 saved + sessions/ in-flight 合并去重，每行文字 status tag 区分 Saved (绿) / In session (灰).

**Backend** — 新 `GET /api/project/:slug/deliverables`:
1. Saved 列表: `git ls-tree -r --name-only HEAD` filter top-level + `isDeliverable`
2. In-session 列表: 枚举 `sessions/*`, 每 session `listAddedTopLevelFiles(projectPath, 'session/<slug>')`
3. 合并去重 by basename: main + session → `'saved'` (优先); main only → `'saved'`; session only → `'in-session'`
4. Return `{ items: [{name, path, status, mtime, sessionId?}] }` 按 mtime desc

**Frontend**: ProjectPage 进 view 时调 `getProjectDeliverables(slug)` 替换 Project.outputs[] 渲染源 (Project.outputs[] 仍保留作 chat 内 artifact card 即时反馈). Output card 加文字 status tag.

---

## 43.1+43.2+43.3. `shipped` — Save to Knowledge UX batch

**Shipped**: 2026-04-30 (PR [#169](https://github.com/BeibeiZhang/WorkPal/pull/169), v0.1.11 dmg).

**§43.1** — fallback 抓 Modified files: `listAddedTopLevelFiles` rename → `listChangedTopLevelFiles`, `--diff-filter=A` → `--diff-filter=AM`. Beibei 改写 main 已有文件 → AI 改 → diff A 漏 → 误报 "no_new_deliverables". Plus rename chain 抓到 `listSessionBranchDeliverables` 第 2 个 call site (spec 没提, impl 自抓).

**§43.2** — Save to Knowledge button 不再终态 disable: `TaskContextPanel.tsx:460 disabled={sessionCompleted}` + `App.tsx:1560/1602` Save 后 `sessionCompleted=true` 从不 reset → button 永久 disabled. Impl simpler approach: 移除 `sessionCompleted` 从 disable gate, button always enabled, click 时 Phase 6.3 alreadyUpToDate modal 处理 no-changes (planning accept simpler at this time, **后被 §53 revert**).

**§43.3** — Fallback overwrite 一致策略 (Beibei 选 A): `sessionCopy.ts copyTopLevelNewFiles` 移除 `COPYFILE_EXCL`，改 `copyFile(src, dest)` default overwrite，跟 outputs/ 路径 `cp force:true` 心智一致.

Plan-quality 加分: impl Edge-case truth table 5 行 old vs new, 审查所有 chat 创建路径确认 row 4 行为变化在生产中不存在 → no regression. + 非 display 端 isDraft 用法审计 8 处. + Part B race fix 拆 §50.1 follow-up.

---

## 44. `shipped` — Project context system prompt 自动注入

**Shipped**: 2026-04-30 (PR [#167](https://github.com/BeibeiZhang/WorkPal/pull/167), v0.1.10 dmg).

**Surfaced**: Beibei 问 "在项目下的聊天记录和创造的文件会不会成为这个项目下的 memory, AI 会知道之前做过什么吗?" — 现状: 文件 main 上有, AI 有访问权 (Glob/Read) 但**不主动 surface**, 要 prompt 引导.

**Goal**: AI 在 project chat 启动时主动知道项目历史 deliverable. 用户问 "改一下 resume" 等自然引用时, AI 立刻知道哪些文件存在, Glob/Read 后再答, 不 fabricate.

**Fix**: `claudeChat.ts` 加 `PROJECT_CONTEXT_PROMPT(deliverables)` system prompt segment, 在 `chat.projectId` set + main worktree 有 deliverable 时注入. 复用 `isDeliverable` from `sessionCopy.ts`. Fail-quiet on git error. Array-join system prompt 重构 (extensible §45/§46 future).

Prompt 文字关键: "Glob and Read the matching file in your working directory FIRST — it was branched from main and contains the real content. Do not fabricate from scratch."

---

## 50. `shipped` — Chat isDraft display layer fix (find chat-930)

**Shipped**: 2026-05-01 (PR [#170](https://github.com/BeibeiZhang/WorkPal/pull/170), frontend-only Vercel auto-deploy). 5+/7- in 2 files.

**Surfaced**: Beibei v0.1.11 测 — WorkPal project chat ("给予你对这个项目资料的了解...") AI 生成网页 + PREVIEW marker + 给 PermissionPrompt 权限 → 完成后 chat 从 sidebar Recents 和 ProjectPage chat 列表都消失. Planning verify 数据**全在** (chat-930 完整在 localStorage / index.html 80KB + i18n.ts 在 ~/WorkPal/workpal/ main / git log 2 commits today)，**不是 data loss，是 filter bug**.

**Root cause**:
- `ProjectPage.tsx:473` filter: `chats.filter(c => c.projectId === project.id && !c.isDraft && c.messages.length > 0)`
- `Sidebar.tsx:501-502` filter: `isDraftLike(c) = c.isDraft || (c.title === 'New Session' && c.messages.length === 0)`

两处都 hide `isDraft: true` chat. chat-930 的 isDraft 字段没在 first message 后 reset (race), 所以 UI 都看不到.

**Fix Part A (Defensive, this PR)**: 移除 `!c.isDraft &&` from ProjectPage filter; `isDraftLike` 简化成 `c.messages.length === 0`. 新 invariant: **`messages.length > 0` = not a draft**.

**Part B (race fix) 拆 §50.1 follow-up**: 因为 race 路径多, Part A defensive-first.

---

## 50.1. `shipped` — isDraft cross-device sync fix

**Shipped**: 2026-05-01 (PR [#174](https://github.com/BeibeiZhang/WorkPal/pull/174), frontend-only). 9+/7- in 2 files.

**Surfaced**: §50 (PR #170) Part A 修了 display layer。但 isDraft 字段本身 race 仍存在 — chat-930 messages.length===4 但 isDraft 卡 true. Race 影响 cross-device sync:
- `App.tsx:904,914,1037,1063` cloud sync 跳过 isDraft chat → chat-930 不上传 Supabase
- `chatStore.ts:262` bulk upload 同样跳过
- 后果: Beibei iPhone workpal-beibei.vercel.app 看不到 chat-930

**Root cause (impl disprove planning hypothesis)**: 原 spec 假设 stale-closure race. Impl grep + verify 实际所有 isDraft mutation 已用 functional updater. **chat-930 stale state 实际是 historical data** (从早期 wiring 不全时 persist 进来), 不是 active race.

**Fix — 3 layers**:
- **Layer 1 boot normalization**: `chatStore.loadChatsCache` + `recordToChat` (closes cloud→client loop): `isDraft && messages>0` → `undefined`
- **Layer 2 defensive sync filter**: `App.tsx:904, 914, 1063` + `chatStore.bulkUploadChats` skip only if `isDraft && messages.length === 0`. Line 1037 reconciliation guard 不动 (destructive path)
- **Layer 3 defense-in-depth**: `addMessage` helper + `handleChipClick` + `handleCardAction` set-agent 都 reset isDraft

---

## 51. `shipped` — Sidebar 双 highlight fix

**Shipped**: 2026-05-01 (PR [#171](https://github.com/BeibeiZhang/WorkPal/pull/171), frontend-only Vercel auto-deploy). 1 LOC.

**Surfaced**: Beibei 反复观察 Sidebar 中 "New Session" 和 project entry 同时 highlight (gradient border).

**Root cause**: `Sidebar.tsx:511 isNewSessionActive = activeView === 'chat' && !!activeChat && isDraftLike(activeChat)` + `Sidebar.tsx:589` project entry `active={activeProjectId === proj.id}` — 两个 active 判断独立, 没 mutual exclusion → project draft chat 状态下两者同时 true.

**Fix**: `Sidebar.tsx:511` 加 `&& !activeProjectId` guard. **Impl spec correctness override**: 我 spec 说 `!activeChat.projectId`, 但 impl 在 browser verify 显示 top-level draft chats `projectId === undefined` even after project navigation — `activeProjectId` 是 prop that actually flips。

新 semantics:
- Project 状态下 → 只 highlight project entry
- Standalone draft chat → 只 highlight "New Session"

---

## 52. `shipped` — File preview multi-candidate path resolve chain

**Shipped**: 2026-05-01 (PR [#175](https://github.com/BeibeiZhang/WorkPal/pull/175), v0.1.12 dmg). 7 files.

**Surfaced**: Beibei v0.1.11 测 — chat 内编辑 `workpal_resume.md` → Save to Knowledge → session worktree 被 reaper 清 → 回 chat click file chip → DetailPanel "Cannot preview this file type" (实际 file 在 main 顶层 ✓ 文件没丢, 是 path 没 fallback). Beibei 重要 product 提醒: Save 是 user-choice (可选 main / 多 ref folder / 都不选), path **不能固定**, 需要按用户选择动态 resolve.

**Goal**: Chat 内 file chip click → preview 永远 work（如果 file 还能找到）+ 友好 message 当 file 真清了。

**Fix**:
- Backend `/api/claude-chat/read-file` 接 `fallbackPaths` 字段, 按优先级 resolve: session path → main path → ref folder paths → 都不在 → `file_no_longer_accessible` reason
- Frontend DetailPanel 加 `'inaccessible'` mode, friendly "This file is no longer accessible" + FileX icon (区分 binary "Cannot preview")

**Plan-quality flag — agent mirror missing (二次 surface)**: PR 第一版只 touch server, 没 mirror agent. Planning catch (memory `feedback_agent_shared_mirror.md` 已沉淀). Impl follow-up commit 加 mirror with explanation: "Without this mirror, the installed v0.1.11 dmg agent would still run the old read-file route — frontend's fallbackPaths would be ignored".

---

## 53. `shipped` — Save to Knowledge button reactive + backend graceful for reaped branch

**Shipped**: 2026-05-02 (PR [#178](https://github.com/BeibeiZhang/WorkPal/pull/178), v0.1.13 dmg). 332+/15- in 7 files.

**Surfaced**: Beibei v0.1.12 测 — §43.2 simpler approach (button always enabled + click then alreadyUpToDate modal) 实战暴露 2 问题:
1. **Visual lies about state** — saved chat 显 enabled. Beibei 期望 saved + 无新 changes → button **disabled** (visual), 不是 click 才知道. Saved 后又改 → enabled.
2. **Reaped session crashes** — clicking already-saved chat whose `session/<branch>` 被 reaper 清 → backend `git diff main...session/<...>` → `fatal: ambiguous argument` → modal raw git error popup.

**§53 revert §43.2 simpler approach + 加 backend graceful**.

**Backend** (B1 + B2):
- `diffSessionVsBase`: pre-flight `git rev-parse --verify --quiet refs/heads/<branchName>` → return `[]` if missing
- `mergeSessionFFOnly`: same pre-flight → return `{ ok: true, alreadyUpToDate: true, commit: <HEAD> }` if missing

**Frontend** (F1-F5):
- App.tsx 加 `chatHasUnsavedChanges: Record<string, boolean | undefined>` 三态 (`undefined` = "fetch in flight", 防 disabled-then-enabled flash)
- AbortController per-chat Map + 500ms debounce
- 3 trigger sites: chat enter / AI commit chunk (impl 选 commit not tool_result, 避免 wasted round trip per read) / post-merge
- TaskContextPanel: `disabled = IS_DEMO || isMobile || hasUnsavedChanges === false`. Label/icon 三 case matrix.
- `fetchAgent` 加 AbortError re-throw 不触发 "unreachable" side effects (impl beyond plan).

**Plan-quality 加分**: impl 自加 5+ patterns beyond spec — `boolean | undefined` 三态 / commit chunk vs tool_result reasoning / AbortController per-chat Map / `refs/heads/<branchName>` explicit namespace / `--quiet` suppress stderr / `useEffect` deps 故意 omit 防 fetch storm.

---

## 28. `shipped` — Test infra (vitest unit Phase 1)

**Shipped**: 2026-05-03 (PR [#182](https://github.com/BeibeiZhang/WorkPal/pull/182), frontend dev infra — no dmg). 736+/22- in 8 files.

**Surfaced**: 2026-04-28 Beibei reflection: *"我们花了很多时间在测试，现在有没有更好的办法？"* Routing-layer changes (§17 / §19 / §21 / §22) historically required Beibei manual-test in browser per PR.

**Implemented**:
- **vitest dev infra**: `vitest` + `@vitest/ui` dev deps + `npm run test` / `test:run` scripts. `vitest.config.ts` scope `src/**/*.test.ts` only — server's existing 141 node:test stay separate.
- **`src/lib/intentRouter.test.ts`** — 12 cases (a1-a3 / b / c / e1-e2 / f1-f3 / r1-r2) promoted from `/tmp/verify-pr150.ts`, by-construction branch coverage of every `if`-arm in `getAgentRouteIntent` (IS_DEMO short-circuit / §21 refDirs+reachable / keyword path / mobile fallback §15 / Mac silent-degrade).
- **`src/lib/referencePrompt.test.ts`** — §22 "ONLY these folders" guard + 4 invariants (sentence + bullet rendering + `find ~` guard + `<cwd>/outputs/` contract) — stronger than spec's single-string assertion.
- **`REFERENCE_FOLDERS_PROMPT` extracted** to zero-dep `server/src/lib/referencePrompt.ts` so frontend test can import without dragging express/SDK/node deps. Single source of truth — `claudeChat.ts` imports from here. Agent mirror via `SHARED_LIB` list in `scripts/sync-agent-shared.sh` — `agent/src/shared/lib/referencePrompt.ts` byte-identical.
- **`.github/workflows/test.yml`** — Node 20, `npm ci`, `npm run test:run` per PR + push to main. `concurrency` group cancel-stale (impl self-review add).
- **`tsconfig.json`** excludes `**/*.test.ts` so cross-tree import in `referencePrompt.test.ts` doesn't break prod tsc build.

**Plan-quality**: impl 选 spec option (a) export REFERENCE_FOLDERS_PROMPT but **超 spec 抽到独立 zero-dep 模块** (better single-source-of-truth than just exporting from claudeChat.ts). Agent mirror handled correctly first try (`feedback_agent_shared_mirror` 教训内化, 不像 §42 / §52 需 follow-up commit). `vi.hoisted` + getter pattern correctly handles `IS_DEMO` const live-binding. `beforeEach` resets mock flags防 test order coupling.

**CI verify**: 16/16 vitest pass ~200ms · server's 141/141 node:test untouched · `tsc --noEmit` clean · CI green on first PR run (test job 20s).

**Standard rule going forward** (folded into impl prompt footer mental model — surfaced in PR description): 改 `intentRouter.ts` / `REFERENCE_FOLDERS_PROMPT` 字串 → 同 PR 必须加 vitest case 钉新行为.

**Phase 2 Playwright e2e (4-6h)** deferred per spec — only启动 if first UI-layer regression escapes to prod.

---

## 55. `shipped` — Subscription Health Check 锁 30d (跟 Range tab 解耦)

**Shipped**: 2026-05-04 (PR [#194](https://github.com/BeibeiZhang/WorkPal/pull/194), commit `7ae30e3`, frontend-only — Vercel auto-deploy). 214+/173- in OverviewPage.tsx + new `src/lib/health.ts` (extracted) + `src/lib/health.test.ts`.

**Surfaced**: 2026-05-04 conversation. Beibei 看 OverviewPage 发现 Voice mode "past 30d 326 min / past 7d 1398 min" 看着反逻辑 (30d 累计 < 7d 累计不可能). 实际真相: `computeHealth(spend, rangeDays)` 用 `scaleToMonth(value, rangeDays) = value/rangeDays * 30` 推算月预估, 跟月 quota 比对; **不是累计**. UX 心智矛盾 — Range tab "past N days" 暗示累计, 但 Health Check 段实际显示月预估, 切 range 数字看着违反"30 ≥ 7"直觉.

**Implemented (Option A locked)**:
- 加独立 `spend30d` useState + mount-once `fetchUsage(30)` useEffect (cancelled flag 防 unmount race)
- `computeHealth(spend30d, 30)` 替换 `computeHealth(spend, spendRange)` callsite. `scaleToMonth(value, 30) === value`, voiceMin / chatTurns / monthlyApiCost 等显示 = 30d 累计原值 (no projection scaling)
- API Spend section 不动 (仍 `spend` / `spendRange` driven, 提供累计 per range)
- Voice mode 显示 326 min stable across 1d/7d/30d Range tabs

**Plan-quality 加分**: impl plan grep verify spec 后**自抓 critical bug** — planning spec line 19 "改 1 处 callsite 即覆盖" 是错的 (因 `spend` 是 range-filtered, single callsite 改成 `(spend, 30)` 当 spendRange=7 时 value 仍是 7d 累计, 比 monthly quota 反而更错). 必须新增独立 `spend30d` parallel state, surface 给 planning override spec. Plus 抽 `src/lib/health.ts` zero-dep module 跟 `lib/usage.ts` / `lib/intentRouter.ts` pattern 一致 — spec 没要求, impl 自加。

**Plan-quality bar 高分**: PR description 表格 1d/7d/30d × light/dark 真实测 — Health Check 数字 + Verdict (api direct $22.05/mo cheaper than $40/mo combo) **完全 stable** across Range tabs。Vitest 3 cases pin `scaleToMonth(value, 30) === value` invariant + sub-30 projection + invalid range edge.

**No polling 决策**: planning v1 review push "去掉 60s setInterval" — 跟主 spend state 行为对称 + DevTools network panel clean 利于 HR 演示. impl 接受改 mount-once。

---

## 56. `shipped` — Suppress duplicate focus ring on chat textarea

**Shipped**: 2026-05-04 (PR [#197](https://github.com/BeibeiZhang/WorkPal/pull/197), commit `e93b319`, frontend-only — Vercel auto-deploy). 1+/1- in ChatInput.tsx (single line className).

**Surfaced**: 2026-05-04 Beibei 发现 ChatInput 输入框 focus 时画**蓝色 2px outline rectangle** 围着 plus button + textarea 整个 row. 紫粉 gradient (input-gradient-border 自身 active state visual) **跟蓝色 outline 双重指示**, 视觉冗余. 关 Grammarly + 换浏览器后仍存在 → 排除外部插件, 是 WorkPal 自己 CSS.

**Root cause**: `src/index.css:227-228` 全局 a11y rule (WCAG 2.4.7 keyboard focus indicator) 给所有 focus-visible 元素画 2px solid 蓝色 outline. ChatInput textarea 同时触发该 rule + wrapper isActive 紫粉 gradient → 双重视觉指示.

**Implemented**: `src/components/ChatInput.tsx:478` textarea className 加 `focus-visible:outline-none` Tailwind class. CSS specificity (0,0,2,0) 战胜 global rule (0,0,1,0). Pattern precedent: `OverviewPage.tsx:518` 已用同 class. 不动 `src/index.css:227-228` global rule.

**Plan-quality 高分**: 
- Computed style 真测 (`getComputedStyle()`): light `rgb(49,113,255)` / dark `rgb(115,178,255)` → both `rgba(0,0,0,0)` ✓
- `:focus-visible` pseudo-class 仍 matches (semantics 不破坏, screen reader 仍知 focus state)
- 回归测 5 个 sidebar / button 元素仍有 2px solid blue ring (global rule intact)
- `git diff --name-only` 仅 ChatInput.tsx (global a11y rule 一字不动 verified)

**Self-caught surface during verify**: PR 自抓 ChatInput 内部 Attach (plus) + Send buttons `outline-width: 0px` (pre-existing a11y bug, 完全无 focus ring). 不在 §56 scope, surface 给 §57 audit (planning 已 commit `f49d852` 扩展 §57 scope 加 Type B handling)。

**WCAG 2.4.7 合规保**: textarea focus 三层 indicator (wrapper 紫粉 gradient + cursor blinking + send button reveal) 仍 visible.

---

## 58. `shipped` — Production error logging → Overview "Needs Your Eyes"

**Shipped**: 2026-05-04 (PR [#198](https://github.com/BeibeiZhang/WorkPal/pull/198), commit `dad54e4`, Vercel auto-deploy + Supabase migration `0008_error_log.sql` applied via MCP). 723+/22- in 13 files.

**Surfaced**: 2026-05-04 conversation. Beibei 撞 bug (chat 丢失 / 文字错位 等) 时只能靠 daily use 自己撞到 surface. 数据类 bug (chat 丢 / fetch 失败 / JS exception) 可以**自动 catch + 推到 Overview NYE**, 不用切 tool. 视觉 bug 类 (字超框 / 错位) 用 `docs/demo-checklist.md` (同一 batch ship `bf603f7` part A) 演示前手动过.

**Implemented**:
- **Frontend `src/lib/errorLogger.ts`**: window-level `error` + `unhandledrejection` listeners → POST `/api/log-error`. IS_DEMO 短路, mount before createRoot 抓 initial render error
- **Vercel serverless** `api/usage.ts` (combined endpoint per Hobby-plan 12-fn cap): POST `/api/log-error` (anonymous, validation + clamp + source whitelist + fail-quiet) + GET `/api/error-summary` (password-gated, 7-day window, dedup by msg, top 20)
- **`api/_lib/error-log-store.ts`**: insertError + summarizeUnreviewed + Supabase singleton + KNOWN_SOURCES whitelist
- **Supabase `error_log` table**: id / msg / stack / url / ua / source / ts / reviewed. RLS open + 2 indexes (ts desc + unreviewed partial)
- **Frontend `src/lib/errors.ts`**: fetchErrorSummary helper, IS_DEMO double-gate, password header
- **`src/lib/timeAgo.ts` extracted from ChatMessage.tsx** (§55 spec-original 漏 ship, §58 顺手 catch up — principle #4 reuse)
- **OverviewPage NYE 加 unreviewedErrors 数据源** + cancellation-flag mount-once fetch (mirror §55 spend30d) + click expand inline + Copy stack button
- **`shared.tsx`** `'Error': AlertTriangle` 进 REVIEW_TYPE_ICONS map

**Plan-quality 高分**:
- Impl session **6 个 spec drift catches** via grep verify (Migration number 0006→0008 / Source labels production→workpal-beibei / Source by frontend not server / timeAgo extraction / api/usage.ts not api/errors.ts file name / RLS UPDATE policy missing)
- Architecture: combined `api/usage.ts` 避 Vercel 12-function 限制 (per §63 chat-store ship 教训)
- PII guard 三层: 客户端只读 4 字段 + 8KB stack truncate + 服务端 double-truncate + source whitelist
- Fail-quiet pattern 完整: errorLogger fetch `.catch()` / api insert 返 200 console.warn / fetchErrorSummary try-catch 返 `[]`
- Mount 时机超 spec: setupErrorLogger 在 createRoot 之前 = 抓 initial React render 错
- 5 follow-up §s self-proposed

**Planning v1 review pushes**: 2 个全接住 — password 真 wire (useAuth.getCachedPassword) 不 placeholder + click expand 用 inline (Option A) 不 alert(stack) fallback

**Ship verify (post-deploy)**: Beibei DevTools console `setTimeout(() => throw new Error('test §58'), 0)` → Supabase row + NYE entry 显示. IS_DEMO branch (my-workpal) 验过 0 fetch.

---

## 59. `shipped` — NYE error entry polish (divider + Mark reviewed button)

**Shipped**: 2026-05-04 (PR [#199](https://github.com/BeibeiZhang/WorkPal/pull/199), commit `d1b5082`, Vercel auto-deploy + Supabase migration `0009_error_log_update_policy.sql` applied via MCP by planning). 225+/6- in 7 files.

**Surfaced**: 2026-05-04 §58 PR #198 verify 后 Beibei 反馈两件:
1. **视觉**: expand 状态下 entry header 跟 stack `<pre>` 视觉粘一起, 没分隔线
2. **Workflow**: 复制 stack 给 planning 处理后无法主动 dismiss, entry 留 7 天才消失

**Key product call**: 仅 error type 加 "Mark reviewed" button. 其他 NYE 类型 (unreadArtifacts / REVIEW_ITEMS mock / 未来 §54 hasUnsavedChanges) 不动 — 它们各自有自然 dismiss action (打开 artifact = viewed / toggle done / save chat).

**Implemented**:
- **Visual divider**: `OverviewPage.tsx:335` wrapper className 改 `pt-2 border-t border-stroke-outline` (替换原 `-mt-1`). Border 加 wrapper 不加 `<pre>` (因 `<pre>` 自带 bg-bg-message #F2F3F4, vs border-stroke-outline #E8E8E8 对比度 1.05:1 几乎不可见 — impl visual contrast catch 救命)
- **PATCH `/api/errors`** (`api/usage.ts` combined file 加新 method handler): body `{ sample_id }`, password gate, 调 `markReviewedByMsg` helper. Method-agnostic vercel.json rewrite `/api/errors → /api/usage?endpoint=mark-error-reviewed`
- **`markReviewedByMsg` data helper** (`api/_lib/error-log-store.ts`): SELECT msg by sample_id (maybeSingle) → UPDATE all rows WHERE msg=? AND reviewed=false. 一次 mark 整 group (跟 GET dedup-by-msg 语义一致). `marked: 0` 收口 stale id / multi-tab race / RLS-denied 三种失败
- **Frontend `markErrorReviewed(sampleId, password)` helper** (`src/lib/errors.ts`): IS_DEMO 短路 + try/catch 返 boolean ok/fail
- **OverviewPage Mark reviewed button** in error entry expanded state, 跟 Copy stack 并排 flex row. Optimistic filter + functional updater closure 拿 snapshot + 失败 revert (no UX lying on 401 / network blip)
- **Supabase migration `0009_error_log_update_policy.sql`**: `0008` 只 SELECT+INSERT policies, 漏 UPDATE — 不加 PATCH 静默返 0 rows, frontend 假装 work 实际 Supabase 不动. Critical catch by impl plan grep verify

**Plan-quality 极高**:
- Impl plan **8 个 spec correction**: api/errors.ts→api/usage.ts file name / handler 直写 SQL→layered helper / vercel.json rewrite 漏 / button primitive→bare-button / `gap-2`→已有 gap-3 / `password` variable→useAuth.getCachedPassword / "self-healing via refresh"→optimistic-revert needed / **🚨 RLS UPDATE policy 漏 = silent fail catch (would have shipped假装能用)**
- Visual contrast catch (border vs `<pre>` bg ~1.05:1 invisible)
- 7 vitest cases 覆盖 IS_DEMO / 200 / 401 / network throw / marked=0 / network race
- `marked: 0` 三态收口 (stale + race + RLS-denied → 都返 success, UI 该消失就消失)

**Planning role applied migration 0009 via MCP** (跟 §17 / §58 spec "impl runs migration" precedent 不同 — 这次 impl 把 migration apply 留给 Beibei 手动, Beibei 让 planning 用 MCP 直接 apply 兜底). 验过 3 policies (`error_log_read_all` SELECT / `error_log_write_all` INSERT / `error_log_update_all` UPDATE) 都在.

**Ship verify (post-deploy)**: Beibei 测试 `throw new Error('test §59')` 10× → NYE 显示单条 `Uncaught Error: test §59 · 10×`. Click Mark reviewed → entry 消失 + reload 不回来 (verify migration 真 apply, RLS UPDATE 真 work). 旧 §58 测试残留 `test §58` 56m ago 也 click Mark reviewed 清掉 — NYE 干净.

---


## 61. `shipped` — OG link preview + iOS home-screen icon + PWA manifest

**Shipped**: 2026-05-05 (PR [#203](https://github.com/BeibeiZhang/WorkPal/pull/203), commit `eb85731`, frontend-only Vercel auto-deploy). 41+/0- in 6 files.

**Surfaced**: 2026-05-05 conversation. 分享 `https://workpal-beibei.vercel.app` 到 iMessage / LinkedIn / Slack 抓到 bare "WorkPal" 文本无图; iOS Safari "Add to Home Screen" 没 W logo. `index.html` 完全无 OG / Twitter Card metadata, `public/` 无 og-image / apple-touch-icon asset.

**Implemented**:
- **5 个 output asset to `public/`** (macOS native `sips` conversion, no ImageMagick):
  - `og-image.jpg` 1200×630 113KB — center-crop from `~/github/beibeizhang.github.io/workpal-hero.jpg` 3840×2160 (上下各 72px → 3840×2016 → resize 1200×630)
  - `apple-touch-icon.png` 180×180 — `sips -Z 512` 一次 + downsample from `~/Library/.../WorkPal/Logo/Property 1=110.pdf`
  - `icon-192.png` 192×192 / `icon-512.png` 512×512 (PWA Android Chrome / 高 DPI)
  - `manifest.json` 469B (name / start_url:/ / display:standalone / theme_color:#7652B9 / icons[])
- **`index.html` +27 行 meta block** 在 `<title>` 下方插入: `<meta name="description">` + OG (og:type/url/title/description/image with width/height/type) + Twitter Card (summary_large_image) + `<link rel="apple-touch-icon">` + 3 个 apple-mobile-web-app-* + `<link rel="manifest">`.
- **OG copy**: Title "WorkPal — your AI workplace assistant" + Description "Chat + tasks in the same project, voice-enabled rich input, selective knowledge output."
- **Source asset 只读复制副本**: `workpal-hero.jpg` + `Property 1=110.pdf` 原位不动 (Beibei portfolio 资产管理纪律, planning spec 明文 不可 mv / 改名).

**Plan-quality 高分**:
- Planning Spotlight `mdfind` 反查 chat-pasted image 真 disk path — process learning: "chat-paste 没 disk path" 半对, 原文件在 disk 仍能 reverse-find. 节省 Beibei 转 file 一步.
- Substantive flag (planning self-found pre-prompt-finalize): `og:image` 必须 absolute URL 指 production, PR preview opengraph.xyz 假阴性陷阱 (preview HTML og:image 指 production, merge 前 production 没 .jpg → 404 → 空 banner). Verify 拆 cowork merge-前 (curl + grep dist/) / Beibei merge-后 (opengraph.xyz on production).

**Plan-quality 偏离 (accept)**:
- Cowork skip `/engineering:code-review` self-run, 用 manual self-review 替代. Reasoning sound: 100% 静态 metadata + JSON manifest + image binary, plugin 主要价值面 (security/perf/defensive 代码 gap) 全无 surface. Equivalent manual self-review 已写 PR body 覆盖 security / perf / defensive 三面. Planning accept. **教训**: 静态 asset only PR 该有 fast-lane exception, future spec 可加.
- 初始 PR title 误用 §60 (与 paste prompt 顶 typo 一致), planning review catch 后 `gh pr edit` 改 §61.

**0 文件 overlap with §62 (parallel ship demonstrated)**: §61 改 `index.html` + `public/`; §62 改 `App.tsx` + `chatStore.ts` + `chatStore.test.ts`. Phase 6 worktree 隔离设计实战验证, 两个 cowork session 同时跑互不 block.

**Ship verify (post-deploy)**: iMessage 给自己发 vercel.app URL → preview 显 banner thumbnail; iOS Safari → 添加到主屏幕 → W logo + standalone mode; opengraph.xyz on production → 完整 banner render.

---

## 62. `shipped` — Chat 丢失 bug: my-workpal non-null assertion 谎言 → chats array 含 undefined → useEffect crash

**Shipped**: 2026-05-05 (PR [#204](https://github.com/BeibeiZhang/WorkPal/pull/204), commit `f25b2c0`, frontend-only Vercel auto-deploy). 85+/1- in 3 files.

**Surfaced**: 2026-05-05 §60 PR #201 verify 时 Beibei 在 production preview 输入 "testing 60" → AI 真回复 + logUsage 真写 row (`source='workpal-beibei'` 验证 §60 fix) → **但 sidebar Recents 看不到 + Supabase chats table 0 row + 同时段其他 chats visibilitychange flush 正常**. Triple symptom 暗示 chat 没成功进 state.chats array.

**Root cause** (pre-fix `App.tsx:2699`):
```ts
setChats(prev => [newChat, ...prev.filter(c => c.id !== 'my-workpal'), prev.find(c => c.id === 'my-workpal')!]);
```
非空断言 (`!`) 在可能返 `undefined` 的 `prev.find(...)` — TS 谎言 (运行时不检查), undefined 真被 spread 进 array. **触发条件**: cloud-only hydrate (DEMO_CHAT_IDS 不 round-trip Supabase) prev 不含 my-workpal → fresh-chat branch (line 2688 else) → undefined 塞 array.

**Crash 链** (triple symptom 完美 align):
1. `App.tsx:991` dirty useEffect: `new Map(chats.map((c) => [c.id, c]))` → `undefined.id` → `TypeError`
2. useEffect throw → React 跳过 commit → state.chats 没真正 commit → sidebar 看不到 ✓
3. `dirtyChatsRef` 没 add → `scheduleChatFlush` 没触发 → cloud 没 PUT row ✓
4. 但 `dispatchSendForChat` 已 fire-and-forget 走 streamFromAPI → backend 真处理 + 真写 usage_log ✓

**Implemented**:
- **`chatStore.ts:149-160` 新 helper `pinMyWorkPalToEnd(prev, newChat)`** — pure function with ternary guard (`myWorkPal ? [...] : [...]`). JSDoc 解释 returning user / cloud-only / DEMO_CHAT_IDS rationale.
- **`App.tsx:2697` callsite swap** 1 行替换 inline non-null spread.
- **`chatStore.test.ts` 4 vitest cases**: (1) prev 不含 my-workpal `not.toContain(undefined)` 钉死 triple-symptom 退化; (2) prev 含 my-workpal 顺序对; (3) empty prev fresh user; (4) ordering 跨 branch 完整 sanity.
- **`App.tsx:3167` 干净** `setChats(prev => [newChat, ...prev])` — `handleCreateChatInProject` 不动, bug 限 line 2699 single site (planning self-grep verify before approval).

**Plan-quality 链式协作模板** (cowork ↔ planning 三阶段都加分):
- **Cowork Step 1 grep verify catch planning spec drift**: plan 写 `App.tsx:1846-2086` handleSend, 实际 1846-2086 是 `streamFromAPI` (不创建 chat), `handleSend` 真位置 `2627-2729`, chat 创建 setChats 在 2699 + 3167. Plan 文件 `## Spec deltas` 暂停等 review.
- **Cowork hypothesis 2.1 narrow** (beyond spec-restatement): `prev.find(...)!` non-null 谎言导致 undefined leak → useEffect 991 crash, 用 triple-symptom + crash chain 结构性 prove.
- **Planning approval roundtrip**: Read `App.tsx:2699 + 991 + 3167` confirm 真有 bug + line 3167 干净 (bug single site) → plan 文件 append `## Planning approval` section: 同意 hypothesis + fix proposal (ternary guard) + 3 vitest cases.
- **Cowork helper extraction beyond spec**: planning approval 提 inline ternary in handleSend, cowork 自决 extract 到 pure function in `chatStore.ts` — vitest 不需 React mounting + App.tsx 改动更小 + cohesion 更好. Planning accept (reasoning sound).
- **Browser reproduce impractical 改 vitest deterministic**: bug 触发条件 (returning user + cloud-only hydrate, localStorage 不含 my-workpal) 浏览器手工模拟代价高; cowork 用 vitest case 1 `not.toContain(undefined)` 作 deterministic 复现 (pre-fix fail / post-fix pass). Hypothesis 2.1 chain 结构性 proof + code-level regression test 已经覆盖 — accept.

**Ship verify (post-deploy)**: 退出登录再 login → fresh hydrate 不含 my-workpal → 输入 "testing fix 62" → sidebar 立即显 + reload 还在 + Supabase chats 有新 row.

**Process learning sealed**: §62 是 **plan-quality 链路三阶段最强体现** — cowork (grep verify drift + hypothesis narrow + helper extraction beyond spec) 跟 planning (read code confirm + fix proposal + accept impl deviations) 形成可复用的 bug-fix 协作模板. 跟 §59 (planning catch RLS UPDATE policy missing) 配对成 plan-quality 双向网, 各自一头守 spec drift.

---
