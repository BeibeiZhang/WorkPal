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

## 60. `decided-next` — `usage_log.source` 6 callsite 漏写 + historical backfill + UI copy clarify

**Surfaced**: 2026-05-05 Beibei OverviewPage Range tab "1d" 仍显示 `Unknown / pre-2026-04-28 · $9.31 · 4 calls`. 1d 累计 = 过去 24h, 不应该有 "pre-2026-04-28" 数据 → bug.

**Root cause** (Supabase MCP query verify): 7 天 usage_log row source 分布:
- `null`: 55 calls / $16.76 — first 2026-04-28 / **last 2026-05-05 04:46** (still firing!)
- `workpal-beibei`: 8 calls / $0.99 — only 2026-05-04 23:47-23:50 (3 分钟窗口)
- `localhost`: 1 call / $0.00

7 个 logUsage callsite 中**只有 `api/usage.ts:156`** (voice mode endpoint, frontend 上报 source body) 写了 source 字段. **其他 6 个 callsite 全漏** —— migration `0007_usage_log_source` 加 schema 时只 update 了 voice path:
- `api/chat.ts:191, 620` (Vercel chat handler 主路径)
- `server/src/lib/llm.ts:479` (Express dev LLM)
- `server/src/lib/webSearch.ts:60` (Tavily web search)
- `server/src/routes/claudeChat.ts:736` (Claude SDK)
- `server/src/routes/usage.ts:59` (dev usage)
- `agent/src/shared/...` (mirror of server, 同漏)

Beibei 主用 chat (api/chat.ts) → null → bucket "unknown". Voice 偶尔用 → 唯一正确分类.

**Goal**: 3 件:
1. 6 callsite 加 `source` 字段写入 (server-side detect from req.origin)
2. Historical backfill SQL (2026-04-28 之后 null row → workpal-beibei, Beibei confirm 时间段她主从 vercel.app 访问)
3. UI copy "Unknown / pre-2026-04-28" → "Pre-tracking" (清理 4-28 之前真不知道的部分, 不暗示 unknown=数据出问题)

**Scope (locked 2026-05-05)**:

- **`detectSourceFromRequest(req)` helper** in `api/_lib/usage-store.ts` + mirror `server/src/lib/usageLog.ts` + `agent/src/shared/lib/usageLog.ts`:
  ```ts
  export function detectSourceFromRequest(req): Source {
    const origin = req.headers.origin || req.headers.referer || '';
    if (origin.includes('workpal-beibei')) return 'workpal-beibei';
    if (origin.includes('my-workpal')) return 'my-workpal';
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return 'localhost';
    return 'unknown';
  }
  ```
- **6 callsite 加 `source: detectSourceFromRequest(req)` 字段**:
  - `api/chat.ts:191, 620` (Vercel)
  - `server/src/lib/llm.ts:479` + `webSearch.ts:60` + `routes/claudeChat.ts:736` + `routes/usage.ts:59` (Express dev)
  - **Agent shared mirror sync** (per `feedback_agent_shared_mirror`): `agent/src/shared/routes/claudeChat.ts` + 相关 lib via `scripts/sync-agent-shared.sh`
- **Historical backfill SQL** (impl apply via Supabase MCP):
  ```sql
  UPDATE usage_log SET source = 'workpal-beibei' 
  WHERE source IS NULL AND ts >= '2026-04-28';
  ```
  2026-04-28 之前 row 保留 NULL (真不知道, UI copy 改 "Pre-tracking" 解释).
- **UI copy in OverviewPage by_source render**: "Unknown / pre-2026-04-28" → "Pre-tracking" (or "Pre-tracking · before source field added"). 视觉清晰不暗示数据 bug.
- **Vitest case** (per §28 Standard rule): pin `detectSourceFromRequest` hostname → source mapping (mirror `errorLogger.test.ts` pattern: 4 cases, workpal-beibei / my-workpal / localhost / unknown).

**Non-goals**:
- 重新 design source 概念 (e.g. 加 client_ip / user_agent 等更细 metadata) — over-engineer
- Backfill pre-2026-04-28 row (真不知道, 让 "Pre-tracking" copy 解释)
- 改 schema (字段 type / constraint 不动)
- Voice endpoint behavior 改 (api/usage.ts 已 work, 不动)

**Effort**: 1.5-2 hr.
- `detectSourceFromRequest` helper × 3 mirror (15min)
- 6 callsite 加 source (30min)
- Agent shared mirror sync (10min)
- Backfill SQL via MCP (5min, 1 SQL statement)
- UI copy 改 (5min)
- Vitest case (15min)

**Risk classification**: medium — touches 3 mirror trees (api/_lib + server/src/lib + agent/src/shared/lib) + backfill historical data. 但 detectSourceFromRequest 是 read-only req.headers, 没副作用. Backfill SQL 仅 update NULL → 'workpal-beibei' (不破坏现 source row).

**Test plan**:
- Send chat from `workpal-beibei.vercel.app` → usage_log row source = 'workpal-beibei'
- Send chat from `my-workpal.vercel.app` → row source = 'my-workpal' (但 IS_DEMO 短路应该 cloud chat 仍走, 验)
- Send chat from `localhost:2006` → row source = 'localhost'
- Backfill SQL apply 后, 4 月 28 后 null row 全 → 'workpal-beibei' (Supabase MCP verify)
- Overview by_source 1d range → 不再显示 "Unknown / pre-2026-04-28" (那部分被 backfill 走了)
- Overview by_source 30d range → 显示 "Pre-tracking" group (4-28 之前真 null row, copy 改)

**Verify path**: cross-cutting:
- Frontend UI copy → Vercel auto-deploy
- Vercel serverless `api/chat.ts` → Vercel auto-deploy
- Express server (`server/src/...`) + agent shared mirror → dmg ship verify (但 production user 走 Vercel 不走 agent, 所以 dmg verify 主要为 Beibei 本地 agent path correct)
- Supabase backfill → MCP apply, 验证看 row source 字段 update

---

## 63. `decided-next` — errorLogger filter cross-origin "Script error." noise (extension content script protection)

**Plan**: `~/.claude/plans/63-script-error-filter-silent-wren.md`

**Surfaced**: 2026-05-06 NYE 显示 1d-old "Script error. · No stack available · at /chat/chat-1776973503002" entry. Mark reviewed dismiss 后起 §63 防未来 NYE 被 extension noise 持续淹.

**Root cause** (browser security mechanism, NOT WorkPal code bug):
- 跨 origin script 抛 error 时 ErrorEvent 被 mask: `e.message === 'Script error.'`, `e.error === null`, `e.filename === ''`, `e.lineno === 0`. Same-Origin Policy 防 content leak.
- 最常见来源: 浏览器 extension content scripts (Grammarly / 1Password / 翻译插件 / 各种 dev tools). Extension 跑 isolated world = 跨 origin = browser mask. 不可控.
- 没 stack 没真 message → **无法 dig** = NYE 永远显 "No stack available" + Mark reviewed 它没意义 = 噪音.

**Goal**: `src/lib/errorLogger.ts:61-69` 'error' handler 顶部加 filter:

```ts
if (e.message === 'Script error.' && !e.error) return;
```

双条件收敛 (message + !error) 不误杀合法 `new Error('Script error.')`. 不动 unhandledrejection (separate concern).

**Effort**: ~30 min.

**Risk classification**: low — 1 个 if-return guard 加 callback 顶部, 不动 send / setupErrorLogger 整体 wiring. Vitest 钉死 invariant.

**Test plan**: 4 vitest cases (filter triggered / filter not greedy / regression normal error / unhandledrejection unaffected).

**Verify path**: frontend-only Vercel auto-deploy (no dmg, no agent mirror, no Supabase).

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
