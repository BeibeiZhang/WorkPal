# WorkPal Phase 5: Simplify + Cowork Backend Integration

## 📍 Current Progress (update after each merge)

| Step | Status | Commit / PR |
|---|---|---|
| 5.1 Remove Recents multi-select UI | ✅ Done | `101c0c6` (PR #67) |
| 5.2 Fix single-session "New project…" missing | ✅ Done | `101c0c6` (PR #67) |
| 5.3 Lazy folder materialization (frontend) | ✅ Done | `101c0c6` (PR #67) |
| 5.4a Spawn SDK subprocess + log stream | ✅ Done | `0ff403b` (PR #68) |
| **5.4b SSE + intent routing** | ⏳ **Next** | — |
| 5.4c tool_use → inspector + Changes | ⏳ Pending | — |
| 5.4d PermissionPrompt wiring | ⏳ Pending | — |
| 5.4e Lazy mkdir + open-in-Finder | ⏳ Pending | — |
| 5.5 Auto-commit + real Undo via git | ⏳ After 5.4 | — |

---

## Background

WorkPal is a React + TypeScript + Vite AI workplace assistant. V3 (commit `827d323`, PR #64) finished the single-input UX refactor: auto inspector, session folders, promote-to-project, PermissionPrompt, Changes card with Undo.

**Current state**: UI is complete. Backend has Claude Agent SDK wired up and validated (5.4a). Next: stream real responses to the frontend with intent-based routing.

## Already completed (keep, don't rewrite)

- `src/components/ChatInput.tsx` — single input, no mode selector
- `src/components/TaskContextPanel.tsx` — inspector with Changes / Progress / Folder / Context / Tools active
- `src/components/PermissionPrompt.tsx` — 3-button modal (file-write/read/command/external-url)
- `src/components/NewProjectDialog.tsx` — unified Promote to Project dialog
- `src/components/Sidebar.tsx` — Recents + Projects list, single-session row menu
- `src/components/OverviewPage.tsx` — Dashboard with Scheduled section
- `src/App.tsx` — state + current simulated flow (**progressively replaced by 5.4b–5.4e**)
- `src/types.ts` — `Chat.sessionFolder`, `Chat.folderMaterialized`, `Chat.hasInspector`
- `server/src/lib/claudeCode.ts` — async-generator wrapper around SDK `query()` ✅
- `server/src/routes/claudeChat.ts` — `POST /api/claude-chat` (currently drains stream to console; 5.4b converts to SSE) ✅

## Existing backend

`server/` directory: Express + OpenAI GPT streaming (Phase 1) + `@anthropic-ai/claude-agent-sdk` (5.4a). Uses `ANTHROPIC_API_KEY` from `server/.env`.

---

## Phase 5.4 — shared decisions (locked during planning, reference for all sub-steps)

These apply to every 5.4x step. Don't re-decide.

### Intent routing (used in 5.4b)

Keyword-based heuristic, **no classifier call**. Cheap, deterministic, easy to tweak.

Keyword list must cover **English + Chinese**:

```ts
const CLAUDE_CODE_KEYWORDS = [
  // English
  'write', 'edit', 'create', 'file', 'code', 'rename',
  'refactor', 'save', 'delete', 'modify', 'update', 'generate',
  // Chinese
  '写', '写个', '创建', '新建', '修改', '改', '编辑',
  '删除', '重构', '生成', '保存', '代码', '文件',
];

function shouldUseClaudeCode(text: string): boolean {
  const lower = text.toLowerCase();
  return CLAUDE_CODE_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}
```

### Session folder / cwd

**Use the frontend's existing `Chat.sessionFolder` string as cwd.** Backend just `mkdir -p` it when needed. Root is `~/WorkPal/`. Do **not** invent a new path scheme (e.g. `~/WorkPal-sessions/{chatId}/`) — the UI already renders `sessionFolder` to the user, so paths must match.

Frontend request body shape:

```ts
POST /api/claude-chat
{
  prompt: string,
  sessionId: string,       // Chat.id (used for resolver Map in 5.4d)
  sessionFolder: string,   // e.g. "~/WorkPal/alcohol-delivery-issues/sessions/2026-04-18-x/"
  messages: [...]
}
```

For 5.4b–5.4c, cwd can stay in a sandbox (`/tmp/workpal-sandbox/`). 5.4e switches to real `sessionFolder`.

### SDK event filtering (learned from 5.4a testing)

The SDK yields internal housekeeping events the user doesn't care about. **Filter these out before SSE-forwarding to the frontend** in 5.4b:

| SDK event | Forward? |
|---|---|
| `system.subtype === 'hook_started'` | ❌ drop |
| `system.subtype === 'hook_response'` | ❌ drop |
| `system.subtype === 'init'` | ❌ drop (or forward as meta only, not as text) |
| `assistant` (text chunks) | ✅ forward as `{type: 'text', ...}` |
| `user` (tool_use or tool_result arriving via messages) | ✅ forward with `tool_use` / `tool_result` shape |
| `result` | ✅ forward as `{type: 'done', usage, cost}` |
| errors | ✅ forward as `{type: 'error', message}` |

---

## 5.4b — SSE + intent routing (**next up**)

**Goal**: real Claude responses appear in chat bubbles. OpenAI path for non-tool chat stays intact. No tool mapping yet — just text.

### Scope

1. `server/src/routes/claudeChat.ts` — convert from drain-and-return-count to SSE, matching shape of existing `server/src/routes/chat.ts`. Apply SDK event filter (see above).
2. `src/lib/api.ts` — add `streamClaudeChat(messages)` async generator; extend `StreamChunk` union with Claude-specific types.
3. `src/lib/intentRouter.ts` (new) — `shouldUseClaudeCode(text)` with the keyword list above.
4. `src/App.tsx` — `handleSend` branches: keyword hit → `streamClaudeChat`, else → existing OpenAI `streamChat`.

**Out of scope for 5.4b**: tool_use mapping, PermissionPrompt wiring, real folders. Those are 5.4c / 5.4d / 5.4e.

### Acceptance tests

- [ ] "写个 hello.txt" → routed to Claude, text response streams into chat bubble
- [ ] "看下邮箱" → routed to OpenAI (existing path), nothing changes
- [ ] Claude-routed message uses cwd `/tmp/workpal-sandbox/` (real file ops come in 5.4e)
- [ ] Server logs show only useful event types forwarded (no hook_started / hook_response spam)
- [ ] Existing OpenAI chat continues to work end-to-end

---

## 5.4c — tool_use → inspector + Changes

**Goal**: Write/Edit tool calls flip `hasInspector` and appear in Changes card. Still sandboxed cwd (no real disk writes outside `/tmp/`).

### Scope

- `server/src/lib/claudeCode.ts` — shape `tool_use` events into `{name, input}`, `tool_result` into `{success, summary}`
- `src/lib/api.ts` — extend `StreamChunk` for `tool_use` / `tool_result` / `change_entry`
- `src/App.tsx` — first `tool_use` flips `hasInspector=true`, appends Changes entries, advances Progress steps
- `TaskContextPanel.tsx` — no changes expected (already reads from state)

### Acceptance tests

- [ ] "创建 hello.txt 内容 hi" → inspector auto-opens, Changes shows 1 entry, Progress advances
- [ ] Multiple file edits in one turn → multiple Changes entries, correct order
- [ ] Commit message clearly marks cwd is sandbox, not real sessionFolder

---

## 5.4d — PermissionPrompt wiring

**Goal**: SDK's `canUseTool` callback bridges to the existing frontend `PermissionPrompt` modal.

### Scope

- `server/src/lib/claudeCode.ts` — pass `canUseTool` into SDK options; implementation emits `permission_request` SSE event `{requestId, tool, input}` and awaits a Promise
- New `POST /api/claude-chat/permission/:requestId` — body `{decision:'allow'|'deny'}`; resolves the awaiting Promise
- In-memory `Map<requestId, resolver>` (isolated by sessionId)
- `src/App.tsx` — on `permission_request` show existing `PermissionPrompt`; on user choice POST decision back

### Acceptance tests

- [ ] "读我桌面的 report.pdf" → PermissionPrompt appears
- [ ] Allow → SDK continues, tool_result arrives
- [ ] Cancel → SDK halts gracefully, halt entry added to Changes (existing UI)
- [ ] Multiple sessions in flight → permission requests isolated by sessionId

---

## 5.4e — Lazy mkdir + open in Finder

**Goal**: session folder only materializes on first real Write/Edit. Chip click opens Finder.

### Scope

- `server/src/lib/claudeCode.ts` — resolve cwd = real `Chat.sessionFolder`; `mkdir -p` only on first Write/Edit `tool_use`
- New `POST /api/claude-chat/open-folder` — body `{sessionId}` → on darwin, spawn `open <path>`
- `src/App.tsx` — first Write/Edit flips `chat.folderMaterialized=true`; folder chip click → POST `/open-folder`

### Acceptance tests

- [ ] Pure Q&A → `ls ~/WorkPal/` unchanged
- [ ] File creation → folder appears at real path matching the chip text
- [ ] Chip click → Finder opens at that path
- [ ] Multiple sessions → each has its own folder, no cross-contamination

---

## 5.5 — Auto-commit + real Undo (after 5.4e)

**Depends on real folders existing.**

### Scope

- New `server/src/lib/git.ts`
- Session folder's first `mkdir` → auto `git init`
- After each Write/Edit/Delete tool call → `git add . && git commit -m "Session {id} – {tool} – {step description}"`
- Undo handler: `git reset --hard HEAD~1` → flip Change entry to Undone (UI already done in V3)

### Acceptance tests

- [ ] AI writes file → commit appears on disk, Change entry appears in UI
- [ ] Click Undo → file reverted on disk, commit reverted, entry grays out + strikethrough
- [ ] Undo works in reverse order (latest first)

---

## Non-goals (do NOT do in Phase 5)

- ❌ **Worktree isolation for parallel sessions** → Phase 6
- ❌ Remote agent / cloud Claude Code → local first
- ❌ Multi-user collaboration
- ❌ UI visual changes → UI is final, only data layer moves
- ❌ Don't re-add Recents multi-select (intentionally removed in 5.1)
- ❌ Don't replace OpenAI path with Claude Code. Both routes coexist (5.4b keyword router decides).

---

## Phase 6 preview (NOT for this phase)

After 5.4–5.5 are shipped:
- One git worktree per session → real isolation for concurrent work
- User-initiated merge back to Project base folder
- Conflict resolution UI

---

## Technical references

- **Claude Code docs**: https://docs.claude.com/en/docs/claude-code/overview
- **Claude Agent SDK**: https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk
- **Project path**: `/Users/beibeizhang/Library/Mobile Documents/com~apple~CloudDocs/beibeidesign/WorkPal/Code`
- **Dev server**: `npm run dev` → port 2006; `npm --prefix server run dev` → port 3001
- **SDK install note**: `npm install --legacy-peer-deps` — SDK pulls zod@4, openai peer-optionally wants zod@3; no runtime impact

---

## First message template for a new Cowork session

```
请先读 docs/phase-5-requirements.md 了解进度和下一步。

当前要做：5.4b — SSE + 意图路由。

文档里已经锁定了 shared decisions（关键词列表、sessionFolder 用法、SDK 事件过滤规则），请遵守。

做之前先列具体改动点给我确认，按 5.4b 的 Acceptance tests 跑通后再开 PR。
```

Paste this in a fresh Cowork session — the agent will pick up without needing more context.

---

## How to update this doc

After each PR merges:
1. Flip the status in the progress table at the top (✅ Done + commit hash + PR number)
2. Update the "Next" marker to the next sub-step
3. If lessons emerged during testing, add them to the Shared Decisions section
4. Commit & push directly to main (doc update, no PR needed)

Keeps the doc living so every new Session reads the latest truth.
