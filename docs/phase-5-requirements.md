# WorkPal Phase 5: Simplify + Cowork Backend Integration

## 📍 Current Progress (update after each merge)

| Step | Status | Commit / PR |
|---|---|---|
| 5.1 Remove Recents multi-select UI | ✅ Done | `101c0c6` (PR #67) |
| 5.2 Fix single-session "New project…" missing | ✅ Done | `101c0c6` (PR #67) |
| 5.3 Lazy folder materialization (frontend) | ✅ Done | `101c0c6` (PR #67) |
| 5.4a Spawn SDK subprocess + log stream | ✅ Done | `0ff403b` (PR #68) |
| 5.4b SSE + intent routing | ✅ Done | `9fc9365` (PR #69) |
| 5.4c tool_use → inspector + Changes | ✅ Done | `757be62` (PR #70) |
| 5.4d PermissionPrompt wiring | ✅ Done | `6683788`+`04d2591` (PR #71) |
| 5.4e Lazy mkdir + open-in-Finder | ✅ Done | `1b64629`+`f02cfd4` (PR #73) |
| 5.5 Auto-commit + real Undo via git | ✅ Done | `ed29387`+`742d6fb` (PR #75) |
| 5.6 Ghost-entry drop + Always-allow drain (optional polish) | ✅ Done | `ea086b6` (PR #78) |
| **Phase 5 complete** | 🎉 | — |

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

### Permission mode (5.4c → 5.4d transition)

Without a `canUseTool` callback, the SDK denies Write/Edit/MultiEdit by
default, which blocks any real tool execution in the sandbox. 5.4c sets
`permissionMode: 'acceptEdits'` as a temporary shim so acceptance tests can
run end-to-end. This is safe because cwd is a `/tmp/` sandbox. **5.4d
removes this line** and replaces it with a real `canUseTool` bridge to the
frontend PermissionPrompt modal.

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

## 5.4b — SSE + intent routing ✅ (merged)

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

## 5.4c — tool_use → inspector + Changes ✅ (merged)

**Goal**: Write/Edit tool calls flip `hasInspector` and appear in Changes card. Still sandboxed cwd (no real disk writes outside `/tmp/`).

### Context from 5.4b (read before starting)

- `handleSend` in `App.tsx` currently bypasses the Claude path when `attachments?.length` is truthy. **Don't fix that in 5.4c** — the attachment question (should Claude path accept images? how?) is deferred until after 5.4e. Note it in the PR description.
- SDK `tool_use` blocks arrive inside `assistant.message.content` arrays alongside `text` blocks. The 5.4b filter already iterates those — extend the existing loop rather than adding a new event case.
- SDK `tool_result` blocks arrive inside `user` messages. 5.4b currently drops the whole `user` case — now route these through.

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

## 5.4d — PermissionPrompt wiring ✅ (merged)

**Goal**: SDK's `canUseTool` callback bridges to the existing frontend `PermissionPrompt` modal. Replace the 5.4c `permissionMode: 'acceptEdits'` shim.

### Context from 5.4c (read before starting)

- **Remove** `permissionMode: 'acceptEdits'` from `server/src/lib/claudeCode.ts` (added in 5.4c as a temporary shim). The `canUseTool` callback replaces it; leaving both wired is confusing.
- Changes card entries get appended on `tool_use` (before tool_result arrives). For 5.4d, when user clicks Cancel → the cancelled tool should still leave a visible trace. The existing V3 UI supports `kind: 'halt'` for this — reuse it rather than inventing a new kind.
- `sessionId` flows through the request body (from 5.4a shape). Use it as the key for the resolver Map so concurrent sessions don't cross-wire permission requests.
- Existing `PermissionPrompt` component (`src/components/PermissionPrompt.tsx`) supports 4 scope kinds: `file-write`, `file-read`, `command`, `external-url`. The 5.4d bridge should map SDK tool names to these:
  - `Write` / `Edit` / `MultiEdit` / `NotebookEdit` → `file-write`
  - `Read` → `file-read`
  - `Bash` → `command`
  - `WebFetch` / `WebSearch` → `external-url`
  - Anything else → default to `command` (safest fallback)

### Scope

- `server/src/lib/claudeCode.ts` — remove `permissionMode: 'acceptEdits'`; pass `canUseTool` into SDK options; implementation emits `permission_request` SSE event `{requestId, tool, input, kind}` and awaits a Promise
- New `POST /api/claude-chat/permission/:requestId` — body `{decision:'allow'|'deny'}`; resolves the awaiting Promise
- In-memory `Map<requestId, resolver>` (scoped per `sessionId` for isolation)
- `src/App.tsx` — on `permission_request` chunk, show existing `PermissionPrompt` with the right kind; on user choice POST decision back. On deny, append a `kind:'halt'` Change entry for visibility.

### Acceptance tests

- [ ] "读我桌面的 report.pdf" → PermissionPrompt appears with kind=`file-read`
- [ ] "创建 hello.txt" → PermissionPrompt appears with kind=`file-write` (no longer auto-accepted)
- [ ] Allow → SDK continues, tool_result arrives, Progress step completes
- [ ] Cancel → SDK halts gracefully, halt entry added to Changes
- [ ] Two sessions in flight → each gets its own PermissionPrompt, decisions don't cross-wire
- [ ] Always allow → next same-scope request in the same session skips the modal

---

## 5.4e — Lazy mkdir + open in Finder ✅ (merged)

**Goal**: session folder only materializes on first real Write/Edit. Chip click opens Finder.

### Context from 5.4d (read before starting)

- `cwd` is currently hardcoded to `/tmp/workpal-sandbox` in `server/src/routes/claudeChat.ts`. 5.4e replaces this with the real `Chat.sessionFolder` the frontend sends. The request body already carries `sessionFolder` (wired in 5.4a shape, ignored in 5.4b–5.4d). Just start reading it.
- The `mkdir -p` that currently runs eagerly on every request (line ~130 in `claudeChat.ts`) must become **lazy** — defer until the SDK actually emits a `tool_use` for Write/Edit/MultiEdit/NotebookEdit. Pure Q&A sessions must leave disk untouched.
- Frontend already has `Chat.folderMaterialized: boolean` (from 5.3). Flip it to `true` the moment a file-mutating `tool_use` chunk arrives — that's what gates the folder chip rendering.
- `approvedScopes` is a `useRef` (not `useState`) from 5.4d's race fix. 5.4e's folder-click handler should follow the same pattern if it needs any "remember this" cache — don't regress by using useState.
- Permission scope for file-write is `dirname(file_path)` (see `deriveTargetScope` in `claudeChat.ts`). When cwd moves from `/tmp/workpal-sandbox` to a real per-session folder, the scope strings change — don't hard-code sandbox paths anywhere.
- Path expansion: `Chat.sessionFolder` strings may include `~` (e.g. `~/WorkPal/foo/sessions/bar`). Server must expand these to absolute paths before `mkdir`/`cwd` (node doesn't auto-expand `~`).

### Scope

- `server/src/lib/claudeCode.ts` — no major changes expected (cwd already plumbed through `ClaudeCodeRequest`)
- `server/src/routes/claudeChat.ts` — stop using `SANDBOX_CWD`; resolve cwd from request body's `sessionFolder` (expanding `~`); only `mkdir -p` when first Write/Edit/MultiEdit/NotebookEdit `tool_use` lands for a given session
- New `POST /api/claude-chat/open-folder` — body `{sessionFolder}` → on darwin, spawn `open <resolvedPath>`; return 400 if path escapes `~/WorkPal/` (basic path-traversal guard)
- `src/App.tsx` — on first file-mutating `tool_use` chunk, flip `chat.folderMaterialized=true`; folder chip click handler → POST to `/api/claude-chat/open-folder`
- `src/components/ChatPanel.tsx` — folder chip is already rendered (from 5.3); just wire the click to the new POST

### Acceptance tests

- [ ] Pure Q&A in a fresh session ("翻译 hello") → `ls ~/WorkPal/` shows **no new folder**, no folder chip renders
- [ ] "写个 hello.txt" in a fresh session → the real session folder appears on disk, chip becomes clickable
- [ ] Click folder chip → Finder opens at the exact path shown in the chip
- [ ] Two concurrent sessions → each writes into its own folder, no cross-contamination (use two browser tabs or two chats)
- [ ] Path-traversal attempt via malformed `sessionFolder` POST → rejected (400)
- [ ] `permission_request` scope now reports the real folder path (not `/tmp/workpal-sandbox`)

---

## 5.5 — Auto-commit + real Undo ✅ (merged)

**Depends on real folders existing** (satisfied after 5.4e).

### Lessons from 5.5 testing (PR #75 round-trip)

Two P1 bugs landed in the initial PR and were fixed in `742d6fb` before merge. Record them here so any future sibling work (5.6 polish, Phase 6) doesn't re-introduce them.

- **`git add -A` over-commits when Claude emits multiple file-writes in one assistant turn.** The SDK executes all file-writes before yielding their `tool_result` batch; by the time our loop calls `commitAfterTool` for write #1, write #2's file is already on disk and `git add -A` stages both. Write #1's commit contained both files; write #2's commit was empty (`--allow-empty`). Fix: commit by explicit path (`git add -- <filePath>`) + drop `--allow-empty` + skip commit entirely when `git diff --cached --quiet` says there's no diff. Every future commit path that touches `server/src/lib/git.ts` must keep this invariant: **one commit ⇔ one tool's file edit**.
- **Fresh-chat closure race in `streamFromClaudeAPI`.** handleSend did `setChats(... sessionFolder ...)` then called `streamFromClaudeAPI(chatId, text)` in the same render tick; the callback's closure read stale chats (no sessionFolder), POST hit backend with empty `sessionFolder`, 400. Existed since 5.4e but acceptance tests always sent their first message through a pre-seeded chat so it never surfaced. Fix: handleSend passes the freshly-computed `sessionFolder` as an argument; callback prefers the override. **If you add new state that backend needs and the frontend computes it at handleSend time, pass it by argument — do not round-trip through chat state in the same tick.**

### Context from 5.4e (read before starting)

- Session folders are created **eagerly** at request start in `server/src/routes/claudeChat.ts` (line ~160, `await mkdir(workingDir, { recursive: true })`). This is where `git init` should go — one shot, same place that sets up the session's working directory. Skip `git init` if `.git` already exists (re-open of the same session).
- **Eager mkdir means pure Q&A also gets a session folder** — but the `finally` block calls `rmdir(workingDir)` which fails with `ENOTEMPTY` when any content (including `.git/`) exists. **You'll need to update the cleanup logic**: for pure-Q&A sessions where `folderMaterialized` stayed false, ALSO skip `git init` so rmdir still works. Do git init only when the first Write/Edit/MultiEdit/NotebookEdit `tool_use` arrives (same trigger as `folderMaterialized`).
- `folderMaterialized` is a **request-scoped boolean** in `claudeChat.ts`. Reuse it as the gate for git init so the two invariants stay aligned: "folder has content" ⇔ "folder is a git repo" ⇔ "chip renders".
- `FILE_WRITE_TOOLS` Set already exists in `claudeChat.ts` — use that same Set to decide both "materialize folder" and "git commit after this tool_result".
- SDK binary needs cwd existing (hard lesson from 5.4e). `git init` happens AFTER `mkdir`, so cwd already exists — no new spawn-order issues.
- Claude's first Write often goes to a wrong path (`/root/`, `/repo/`, `/home/user/`) and fails — THEN retries at the real session folder. **Don't commit on the failed attempts**. Gate the commit on `tool_result` with `isError === false`, not on `tool_use`.
- V3 Changes card already has an Undo button that flips the entry to "Undone". 5.5 just needs to wire it to a new `POST /api/claude-chat/undo` endpoint. Don't redesign the UI.

### Scope

- New `server/src/lib/git.ts` — small helpers: `initIfNeeded(cwd)`, `commitAfterTool(cwd, toolName, summary)`, `undoLastCommit(cwd)` (wraps `git reset --hard HEAD~1`). All use `child_process.execFile('git', [...], { cwd })`.
- `server/src/routes/claudeChat.ts`:
  - On first file-mutating `tool_use` (same trigger as `folderMaterialized = true`): `await initIfNeeded(workingDir)` right after `await mkdir`
  - On `tool_result` with `isError === false` for a file-mutating tool: `await commitAfterTool(...)` with a clear message (`Session {sid} – {toolName} – {summary}`)
  - Log commits the same way `tool_use` is logged (one line each)
- New `POST /api/claude-chat/undo` — body `{sessionFolder, changeId}` → validate `sessionFolder` through `resolveSessionFolder` (reuse the guard), run `undoLastCommit`, return `{ok:true, commit:<new HEAD hash>}`.
- `src/App.tsx` — wire the existing `onUndo` handler in the Changes card to POST to `/undo`. On success, flip the Change entry to `Undone` (UI already renders this state). On failure, show an error chip in the Changes card row.

### Acceptance tests

- [ ] AI writes file → `cd session-folder && git log` shows a commit with a clear message; Change entry appears in UI
- [ ] Click Undo on the entry → file reverted on disk, `git log` shows one fewer commit, entry grays out + strikethrough
- [ ] Undo works in reverse order (latest first) — click Undo on the most recent, the one before it becomes undoable
- [ ] Cancel/denied Write does **not** produce a commit (the failed attempt shouldn't be undoable)
- [ ] Pure Q&A session → no `.git` dir appears, rmdir still cleans up the empty folder
- [ ] Two concurrent sessions → each has its own `.git`, Undo in one doesn't affect the other

---

## Non-goals (do NOT do in Phase 5)

- ❌ **Worktree isolation for parallel sessions** → Phase 6
- ❌ Remote agent / cloud Claude Code → local first
- ❌ Multi-user collaboration
- ❌ UI visual changes → UI is final, only data layer moves
- ❌ Don't re-add Recents multi-select (intentionally removed in 5.1)
- ❌ Don't replace OpenAI path with Claude Code. Both routes coexist (5.4b keyword router decides).

---

## 5.6 polish — shipped in PR #78

Both items were picked up as optional polish between Phase 5 and Phase 6. Shipped clean; no regressions.

- **Ghost Change entries for failed writes** — drop entry on matching `tool_result.isError=true`. Mirrors the backend's existing `pendingWrites.delete` cleanup. Inspector now only shows real, commit-backed changes.
- **"Always allow" queue drain** — on click, drain every already-queued `pendingPermissions` entry whose scope now matches the just-approved one. **Note discovered during testing**: the SDK is strictly serial, so in practice the queue only has 1 entry at click time and the drain path rarely activates (the existing `approvedScopesRef.current.has()` check at chunk arrival covers the observable behavior). The drain code is defensive — it handles a race that'd surface if the SDK ever shifts to parallel `canUseTool` or if another frontend code path starts queueing permissions. Safe to keep; no behavioral regression.

## Phase 6 preview (starts after Phase 5 fully shipped)

With 5.5 merged, Phase 5 is done. Phase 6 is the next substantial unit of work — NOT started yet, scope below is just a sketch for planning:

- One git worktree per session → real isolation for concurrent work (today 5.5 gives you one git repo per session folder, but two sessions editing the SAME project's session folder still step on each other)
- User-initiated merge back to Project base folder
- Conflict resolution UI
- Probably want a small Phase 6 requirements doc (same pattern as this one) once we're ready to start.

---

## Technical references

- **Claude Code docs**: https://docs.claude.com/en/docs/claude-code/overview
- **Claude Agent SDK**: https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk
- **Project path**: `/Users/beibeizhang/Library/Mobile Documents/com~apple~CloudDocs/beibeidesign/WorkPal/Code`
- **Dev server**: `npm run dev` → port 2006; `npm --prefix server run dev` → port 3001
- **SDK install note**: `npm install --legacy-peer-deps` — SDK pulls zod@4, openai peer-optionally wants zod@3; no runtime impact

---

## First message template for a new Cowork session

Phase 5 is complete. No current "next step" is locked in — the planning session picks the next scope (5.6 polish, Phase 6, or something else) based on product priorities, then writes a fresh first-message here.

---

## How to update this doc

After each PR merges:
1. Flip the status in the progress table at the top (✅ Done + commit hash + PR number)
2. Update the "Next" marker to the next sub-step
3. If lessons emerged during testing, add them to the Shared Decisions section
4. Commit & push directly to main (doc update, no PR needed)

Keeps the doc living so every new Session reads the latest truth.
