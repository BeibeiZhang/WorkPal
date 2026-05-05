# WorkPal — post-Phase-6 candidates (pending)

Pending backlog of post-Phase-6 work. Each item has enough context for a fresh session to pick up cold. Principle #10 living doc — add as ideas surface, remove when shipped or discarded, move between states as decisions happen.

**Shipped sections live in [`post-phase-6-archive.md`](./post-phase-6-archive.md)** (root cause + 修法 详细) — milestone summary 见 [`phase-history.md`](./phase-history.md) 当前状态段。

**States**: `candidate` (ideas for later) · `in-flight` (currently being built) · `decided-next` (next to start, prompt-ready) · `blocked` (waiting on an upstream decision)

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

## 24. `candidate` — Show routing decision in Progress panel

**Surfaced**: 2026-04-28 reflecting on time spent debugging §21 ship — root cause of confusion was that routing decision (Claude path vs OpenAI fallback) is invisible to user. "AI 还是去邮箱" symptom required cross-checking 5 state variables (URL preview vs main / projectId / agent reachable / refDirs field / §21 code) via screenshots back-and-forth.

**Goal**: First entry of Progress panel shows routing decision string + reason:
- `Routed to Claude · reason: project has 1 ref folder + agent reachable`
- `Routed to OpenAI fallback · reason: no keyword match`
- `Routed to fallback-cloud · reason: agent unreachable`

**Effect**: every chat self-documents which path it took. Eliminates the "is §X really firing?" diagnosis loop without requiring DevTools / console commands.

**Effort**: ~30min. **Risk**: low — append-only UI line, intent string from `getAgentRouteIntent` return value.

---

## 25. `candidate` — Debug overlay (⌘⇧D toggle)

**Surfaced**: 2026-04-28 same diagnostic-pain reflection as §24. Sometimes 5+ state variables (URL / IS_DEMO / agentState / chat.projectId / refDirs / route last) need to be inspected simultaneously, and asking Beibei to F12 + run console one-liners is high friction.

**Goal**: ⌘⇧D toggles a fixed-position debug overlay (top-right) showing live values:
- `agent: reachable | unreachable | unknown`
- `chat.projectId: <id> | (none)`
- `project.refDirs: [/path1, /path2]`
- `IS_DEMO: false`
- `route last: use-claude | fallback-cloud`

Hidden in `IS_DEMO` builds (no debug for HR audience).

**Effort**: ~1h. **Risk**: low — read-only state inspection UI, Mac-only key chord.

---

## 26. `candidate` — Single-ref-folder mode: SDK cwd directly = ref folder

**Surfaced**: 2026-04-28 Beibei reflection during §22 discussion: *"Claude Cowork 里指定一个文件夹，AI 自动找文件，为什么 WorkPal 不行？"*

**Root cause** (architecture): WorkPal's design intentionally separates `cwd = session git worktree` (Phase 5.5 auto-commit + Phase 6.3 Complete Session merge dependencies) from `referenceDirectories` (read-only knowledge sources, Phase 7+). SDK passes ref folders as `additionalDirectories` (permission scope) but **doesn't make them default Glob scope** — AI defaults to cwd (lazy-init empty worktree) → finds nothing → roams `~`. §22 prompt polish is the soft fix within current architecture.

**Proposal (architecture-level)**: when project has exactly 1 ref folder attached, SDK cwd directly = ref folder (skip session worktree). AI auto-scopes per Cowork mental model.

**Trade-off**:
- Pro: full "Cowork simplicity" — AI auto-finds without prompt instruction
- Con: loses git protection (cwd = user's real folder; 5.5 auto-commit + 6.3 Complete Session merge don't apply on this code path; AI edits user files directly with no Undo)

**Trigger condition**: only evaluate AFTER §22 (v0.1.6 dmg) live test — if AI still roams despite §22's "ONLY these folders" prompt, escalate to §26. 80% likely §22 prompt polish suffices. If still insufficient → consider §27 (hard tool-level deny) before §26 (architecture rewrite).

**Effort**: medium-high (architecture change, ref-folder vs worktree semantics rewrite). **Risk**: high (breaks Phase 5.5 + 6.3 invariants on a key path; loses Undo / Complete Session merge UX for ref-folder-only projects).

---

## 27. `candidate` — Tool-level Bash deny outside ref folders (hard constraint)

**Surfaced**: 2026-04-28 §22 impl plan flagged this in out-of-scope: *"Tool-level enforcement (Bash permission deny outside ref folders) — prompt-only is soft constraint, hard constraint requires another §"*. Defensive engineering: if §22's prompt-only soft constraint fails (LLM ignores instructions), tool-permission layer is the backup.

**Goal**: SDK `canUseTool` callback for `Bash` denies any command operating outside `referenceDirectories` (when project has them). Effectively makes ref folder boundary a *hard* invariant rather than a *soft* prompt suggestion.

**Strategy options**:
- A. Parse Bash command → reject if it references `~/Documents`, `/Users/`, `find ~`, etc. outside ref folders. Brittle (regex-based, escape-prone)
- B. Run Bash in a sandbox (chroot / namespace) limited to ref folders. Heavy
- C. Whitelist Bash commands that take a `path` arg → validate path is in ref folders. Middle ground

**Trigger condition**: only evaluate if v0.1.6 live test shows AI still violates §22 soft constraint. 80% likely §22 suffices; this is the backup plan.

**Effort**: medium-high (depending on strategy). **Risk**: medium — wrong rejection breaks legitimate workflows (e.g., AI legitimately needs `cd /tmp` for some reason).

---

## 57. `candidate` — Audit other input/textarea elements for duplicate focus-ring fix

**Surfaced**: 2026-05-04 §56 cowork impl plan grep verification + PR #197 真测发现. 两类 a11y focus indicator gap:

**Type A — input/textarea 用 `outline-none` 但没配套 `focus-visible:outline-none` (§56 模式潜在重复)**：
- `NewProjectDialog.tsx:103, 120, 138` — 3 inputs
- `shared.tsx:337, 374, 1414` — 3 shared input primitives
- `MemoryPage.tsx:78, 98, 108` — 3 inputs

**Type B — toolbar buttons `outline-width: 0px` (pre-existing, **比 Type A 更严重 — 完全无 focus ring**)**:
- `ChatInput.tsx` Attach (plus 按钮) — keyboard Tab 到看不见 focus
- `ChatInput.tsx` Send button — 同上
- (PR #197 §56 verify 时 computed-style 真测自抓)

**Key caveat**: Type A 不能一刀切加 `focus-visible:outline-none`. 必须**逐一 audit** — wrapper 是否有自己的视觉 focus indicator (像 ChatInput 的 input-gradient-border)?

- 如果有 → 加 `focus-visible:outline-none` (跟 §56 同 pattern, 消除双重指示)
- 如果无 → **保留蓝色 ring** (global rule 是这元素唯一 WCAG 2.4.7 focus indicator, 删掉 = 破坏 a11y)

特别注意 `shared.tsx:337/374/1414` 的 3 个 shared primitives — 它们被多处 import, audit 决定一处影响全局.

**Type B handling** (Attach / Send buttons — 完全无 focus ring): 必须**加上** focus indicator (反方向). 现在 keyboard 用户看不见 focus. 加法选项:
- 给 toolbar buttons remove `outline: 0` 让 global rule 接管 (蓝色 ring)
- 或加自定义 focus-visible 样式 (e.g. ring-2 ring-accent-blue) 跟 design system 统一

**Goal**: 决定 Type A 每处该不该 opt out + Type B 给 toolbar buttons 加 focus indicator. Same PR 全 ship.

**Effort**: 2-3 hr (Type A audit 1-2hr + Type B fix 30min-1hr).

**Risk**: medium-high — 错误关 Type A = WCAG 退化; Type B 加 focus 视觉如果跟现有 button hover/active state 冲突会视觉 noisy. 必须 per-element 视觉验证.

**Test plan**:
- Type A 每处 audit:
  1. 找 wrapper element (parent div / form-card)
  2. Check wrapper 有没有 `:focus-within` 样式或者 conditional gradient/border on focus
  3. 决定 keep blue ring (no wrapper visual) vs override (has wrapper visual)
- Type A audit 表写进 PR description (3 列: 路径 / wrapper 自带 visual? / 决定)
- Type B fix:
  1. ChatInput Attach + Send 按钮 keyboard Tab 真测 — 现在看不见 focus, 改后看得见
  2. 鼠标 hover 状态视觉不被破坏
- 改完 manual verify keyboard Tab 走 11 处 (9 Type A + 2 Type B), 每处至少一种可见 focus indicator (蓝色 ring **或** wrapper 自身 visual)
- Light + dark 都过

**Why not bundle into §56**: §56 PR 1 行改动 strictly local, 风险低. §57 audit 涉及 9 处 + WCAG 退化风险, 决策每处不同. Bundle = §56 review 复杂度爆炸, §57 决策被埋. 分开 PR 让每个 review boundary 清晰.

**Trigger**: §56 ship 后立即, 趁 cowork session 对 §56 模式 / a11y 链路记忆新鲜. Defer 越久越容易上下文丢.

---

## 58. `decided-next` — Production error logging → Overview "Needs Your Eyes"

**Surfaced**: 2026-05-04 conversation. Beibei 撞 bug (chat 丢失 / 文字错位 / file URL 不 truncate 等) 时只能靠 daily use 自己撞到 surface. 数据类 bug (chat 丢 / fetch 失败 / JS exception) 可以**自动 catch + 推到 Overview Needs Your Eyes**, 不用切 tool. 视觉 bug 类 (字超框 / 错位) 用 `docs/demo-checklist.md` 演示前手动过 (并行做, doc-only ship).

**Goal**: 用户 (主要 Beibei + 偶尔 HR / 朋友) 在 workpal-beibei.vercel.app 撞 JS 报错 / network failure → 自动写 Supabase → Overview 页 Needs Your Eyes section 显示新 bug entry → Beibei 点开看 message + stack → 复制给 planning → 开 § candidate 修. 全程不切 tool, WorkPal 内部闭环.

**Scope (locked 2026-05-04)**:

- **Frontend `src/lib/errorLogger.ts` (new)** — ~60-80 行. listen `window.error` + `window.unhandledrejection` → POST `/api/log-error`. 在 `src/main.tsx` mount 时 setup. **`IS_DEMO=true` 短路** (demo URL 不 log production error).
- **Vercel serverless `api/log-error.ts` (new)** — POST endpoint. body validate (msg 必填, stack 截断 8KB, url + ua 可选, source 自动从 hostname 推 `workpal-beibei` / `my-workpal` / `localhost` / `unknown` — **复用现有 `src/lib/usage.ts` 的 `detectSource()` helper**, 跟 `usage_log` table source 标签一致, 未来 dashboard 能 join 跨表). 写 Supabase `error_log` table.
- **Vercel serverless `api/error-summary.ts` (new)** — GET endpoint. Query Supabase 过去 7 天 unreviewed error, dedup by msg, return top 20.
- **Supabase migration**: new `error_log` table `{ id uuid pk, msg text, stack text, url text, ua text, source text, ts timestamptz default now(), reviewed boolean default false }`. RLS open (API gate by password 同 chat-store pattern).
- **Overview NYE wiring**: `OverviewPage.tsx` 现 NYE section 加新数据源 — `unreadArtifacts` (existing) + **`unreviewedErrors` (本 §58 新加)** + chats with hasUnsavedChanges (§54 待 ship 后再加). fetch `/api/error-summary` mount 时 + 切 page 时. NYE entry 渲染: error.msg + 短 timestamp + click expand 显示 stack. **`IS_DEMO=true` 短路** (demo URL 不显示 error).

**Non-goals**:
- Sidebar Overview tab 红点 (defer; NYE 自身 count 已 serve)
- "Mark reviewed" / dismiss UI (defer; bug 修后自然不再 fire = entry 自然消失)
- Dedup 算法复杂化 (v1 直接全存, summary endpoint group by msg)
- Sentry / LogRocket SaaS 集成 (over-engineer for 1-designer scale)
- 视觉错位 / 字超框类 bug (这种自动 catch 不到, 用 `docs/demo-checklist.md` 兜底)
- Backend Express server / agent shared mirror (errorLogger 只 POST Vercel serverless, 不走本地 agent — production user 不一定有本地 agent)

**Effort**: 3-4 hr.
- errorLogger.ts (frontend, 30min)
- api/log-error.ts + api/error-summary.ts (Vercel serverless, 1h)
- Supabase migration (15min, impl apply via MCP per §17 precedent)
- OverviewPage NYE 加新数据源 wiring (1-1.5h)
- Manual verify + Vitest case (30-45min)

**Risk classification**: medium — Supabase schema 改动 + Vercel serverless 新 endpoint + frontend mount-time hook + OverviewPage NYE 改动. 各部分独立, 不互相 cascade.

**Test plan**:
- 手动触发 JS error (`console` 跑 `throw new Error('test §58')`) → 验 `/api/log-error` 200 + Supabase 一行
- 手动 fetch failure (mock failed network call) → 验同上
- Overview NYE: 'test §58' entry 显示 + click expand 显 stack
- IS_DEMO=true (`my-workpal.vercel.app`): errorLogger 不 fire / NYE 不显 error / network panel 无 `/api/log-error` 请求
- 多次同样 error fire: dedup group by msg, 显示 count 累加
- Vitest (per §28 Standard rule): pin errorLogger 的 hostname → source 推断 logic + IS_DEMO 短路

**Why §58 跟 §54 互不冲突**: §54 改 NYE 加 chats with `hasUnsavedChanges` source. §58 加新 `unreviewedErrors` source. 两个独立 source 加进 NYE list, IS_DEMO branch 各自 short-circuit. §58 不卡 §54 (Beibei thinking 中), §54 不卡 §58.

---

## 59. `decided-next` — NYE error entry polish: divider + Mark reviewed button

**Surfaced**: 2026-05-04 §58 PR #198 verify 后 Beibei 反馈两件:
1. **视觉**: expand 状态下 entry header 跟 stack `<pre>` 视觉粘一起, 没分隔线
2. **Workflow**: 复制 stack 给 planning 处理后, 没法主动 dismiss — entry 留 7 天才自然消失. Beibei 期望"复制完 → 立刻消失"

**Key product call**: 仅 **error type** 加 "Mark reviewed" 按钮. 其他 NYE 类型 (unreadArtifacts / REVIEW_ITEMS mock / 未来 §54 hasUnsavedChanges) **不动** — 它们各自有自然 dismiss action (打开 artifact = viewed / toggle done / save chat → unsaved cleared). Error 类没有自然 dismiss action 才需要 explicit button.

**Goal**:
- 视觉: expanded state 加 1 行 divider 分 header + stack (跟 NYE 其他 entry 之间分隔线视觉一致)
- Action: error type entry 加 "Mark reviewed" button, 点完整 msg group (same-msg all rows) mark reviewed=true → entry 立刻消失
- 一致性: collapsed state 各类视觉一字不差 (都是 icon + title + source/time + chevron); expanded state 才有 type-specific action

**Scope (locked 2026-05-04)**:

- **Visual polish**: `OverviewPage.tsx` error entry expanded `<pre>` className 加 `mt-2 pt-2 border-t border-stroke-outline`. Token 用现有 `--color-stroke-outline`, **不 hex 直写**.
- **PATCH `/api/errors`** (`api/errors.ts` combined file 加新 method handler): PATCH method, body `{ sample_id: string }`. Server 1) SELECT row by sample_id 拿 msg, 2) UPDATE error_log SET reviewed=true WHERE msg=$1 AND reviewed=false. 一次 mark 同 msg 整 group (跟 GET dedup-by-msg 语义一致). Password gate (跟 GET error-summary 一致 — 写权限).
- **Frontend `markErrorReviewed(sampleId, password)` helper** in `src/lib/errors.ts` — fetch PATCH + return ok/fail.
- **Frontend Mark reviewed button** in OverviewPage NYE error entry expanded state — 跟 "Copy stack" button 并排. Click → optimistic `setUnreviewedErrors(prev => prev.filter(e => e.sample_id !== sampleId))` + 调 markErrorReviewed (fail → console.warn, 用户 next refresh 仍能看到 = self-healing).

**Non-goals**:
- 其他 NYE 类型加 dismiss button (artifacts / mock / future chats) — 各类已有 implicit dismiss
- Per-occurrence (sample-id 单行) vs per-msg group dismiss 选择 — 简化 v1 always per-msg group
- "Un-mark" / "重新 review" UI — 真要 un-mark 改 Supabase 直接 query
- Audit log who/when reviewed — over-engineer for 1-designer scale
- 视觉 polish 推广到其他 NYE entry expanded state — 仅 error 一类 expandable

**Effort**: 1.5-2 hr.

**Risk classification**: low — 1 行 CSS + 1 PATCH endpoint (mirror §58 GET endpoint pattern) + 1 frontend button + 1 helper. 不动 unreadArtifacts / mock / future chat path.

**Test plan**:
- Trigger 5x same error → NYE 显示 "test §59 · 5×"
- Click expand → divider 在 header 跟 stack 之间 (light + dark 都过)
- Click "Mark reviewed" → entry 立刻 disappear (optimistic) → 刷新 page 不回来 (Supabase 真 marked)
- Trigger 不同 error msg → 仍 fire 进 NYE (其他 msg 不受影响 — group by msg 隔离)
- IS_DEMO branch (`my-workpal.vercel.app`): error section 整段不显, button 也不显
- Vitest (per §28 Standard rule): pin markErrorReviewed helper hostname + IS_DEMO 短路 + group-by-msg PATCH contract

---

## 50.2. `candidate` — Delete isDraft field entirely (cleanup)

**Surfaced**: §50 + §50.1 ship 后, `isDraft` field 已被 display + sync 两层取消依赖. 真正彻底清理是删 field from `Chat` type / Supabase schema.

**Effort**: ~1-2h (改多处 + delete 字段 schema migration + localStorage 现有 chat isDraft 字段 untouched 但 ignore).

**Defer 原因**: cosmetic cleanup, 现 single source of truth 已经是 `messages.length === 0`. 等真有需要 (e.g. Chat type 改大动作 / Supabase schema migration) 时再做.

---

## 54. `decided-next` — Overview real-data + IS_DEMO 分流 (NYE / AAW / Scheduled)

**Surfaced**: 2026-05-03 conversation. `OverviewPage.tsx:41-65` 三个 section (`REVIEW_ITEMS` / `IN_PROGRESS` / `SCHEDULED`) 全 mock data. Beibei: "demo URL 给 HR 看 + workpal-beibei.vercel.app 自用" — 两个观众都要服务好.

**Goal**: `IS_DEMO=true` 现状不动 (mock 精致 demo); `IS_DEMO=false` 走真实数据, 空 section hide, **统一一个 banner** 表达 "X clear", 文案动态.

**Scope (locked 2026-05-03)**:

- **Needs Your Eyes**: 真实 = `unreadArtifacts` (existing) + `chats.filter(c => chatHasUnsavedChanges[c.id] === true)` (跟 §53 三态对齐, button enabled = pending review). 数据空 → hide section.
- **Agents at Work**: 真实 = `chats.filter(c => streamingChatIds.has(c.id))`. **No progress bar** — Claude SDK 不报进度, 用 spinner + "Streaming" 替代 (Beibei 明确反对 fake number). 数据空 → hide section.
- **Scheduled**: 现在没 backend (§3 才 ship `artifact_subscriptions`) → empty array → hide section. 注释标 `// TODO §3: query artifact_subscriptions table when shipped`.
- **Single banner** (real 模式 only): 任 ≥1 section hide → 三 section 区域**底部**显示一行 ✓ banner, 文案 lookup table 8 cases:

| Hidden | Banner copy |
|---|---|
| 0 | (no banner) |
| NYE only | "✓ Inbox zero — all reviews caught up" |
| AAW only | "✓ AI's resting — nothing running" |
| Scheduled only | "✓ Open runway — no automations queued" |
| NYE + AAW | "✓ All caught up — your AI's taking a break" |
| NYE + Scheduled | "✓ Inbox zero · nothing scheduled" |
| AAW + Scheduled | "✓ All quiet · agents idle, nothing scheduled" |
| All 3 | "🎉 Nothing pending, nothing running, nothing scheduled. Nice work — take a break." |

**Tone**: positive + supportive, not corporate clean. Beibei feedback 2026-05-03: "让他感觉 did good job, everything done 可以休息了之类". Banner shouldn't lean punish-tone (avoid "no X / nothing X" framing where possible); prefer "caught up", "resting", "open runway", "✨ done" wording. If a phrase feels wrong on second read, revisit during PR review.

**Non-goals (impl 不要 scope-creep)**:
- 不动 demo branch (`IS_DEMO=true` 行为现状一字不变)
- 不写 progress bar fake number (spinner-only)
- 不动 §3 backend (Scheduled real wire 等 §3 ship 后 follow-up)

**Open for impl change-list**:
- Banner 视觉用 design system 哪个 primitive (Hint / SuccessBanner / 新建?) — impl 选
- `streamingChatIds` 怎么 lift 进 OverviewPage (props vs context vs internal mirror) — impl 选
- Test infra (per §28 Standard rule, ship 2026-05-03): banner 8-case matrix 加 vitest test

**Effort**: 1-2 hours.

**Risk classification**: low — frontend-only, `IS_DEMO` build-time inline 已有 pattern, chats / chatHasUnsavedChanges / streamingChatIds props pattern 跟 §53 一致, banner read-only UI. Mobile 自动 fall-through (mobile 没 agent → AAW 永远空 → banner 自然 mention).

**Test plan**:
- Demo URL: 三 section 全显 mock 不变
- Self-use + 三 section 全有数据: 不显 banner
- Self-use + 任 1 section 空: 该 section hide, banner 显示对应 case 文案
- Self-use + 三 section 全空 (新装 user, 没 unsaved chat, 没 streaming, §3 未 ship): banner = full clear copy
- Mobile: AAW 永远空 → banner mention "no agents running"
- Vitest: 8-case banner copy lookup matrix (per §28 Standard rule)

---

## How to revisit / add candidates

When a candidate ships → **move the full § entry to [`post-phase-6-archive.md`](./post-phase-6-archive.md)** with `shipped` status + ship date + PR ref. Don't leave shipped entries in this file — the whole point of the split is keeping pending work surface small.
When a new idea surfaces in discussion → add a `candidate` entry here with enough context to pick up cold.
When something moves from blocked → decided-next → in-flight → shipped, update the state label + any newly locked details.
