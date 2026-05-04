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

## 50.2. `candidate` — Delete isDraft field entirely (cleanup)

**Surfaced**: §50 + §50.1 ship 后, `isDraft` field 已被 display + sync 两层取消依赖. 真正彻底清理是删 field from `Chat` type / Supabase schema.

**Effort**: ~1-2h (改多处 + delete 字段 schema migration + localStorage 现有 chat isDraft 字段 untouched 但 ignore).

**Defer 原因**: cosmetic cleanup, 现 single source of truth 已经是 `messages.length === 0`. 等真有需要 (e.g. Chat type 改大动作 / Supabase schema migration) 时再做.

---

## How to revisit / add candidates

When a candidate ships → **move the full § entry to [`post-phase-6-archive.md`](./post-phase-6-archive.md)** with `shipped` status + ship date + PR ref. Don't leave shipped entries in this file — the whole point of the split is keeping pending work surface small.
When a new idea surfaces in discussion → add a `candidate` entry here with enough context to pick up cold.
When something moves from blocked → decided-next → in-flight → shipped, update the state label + any newly locked details.
