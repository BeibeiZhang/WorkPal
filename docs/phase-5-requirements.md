# WorkPal Phase 5: Simplify + Cowork Backend Integration

## 📍 Current Progress (update after each merge)

| Step | Status | Commit / PR |
|---|---|---|
| 5.1 Remove Recents multi-select UI | ✅ Done | `101c0c6` (PR #67) |
| 5.2 Fix single-session "New project…" missing | ✅ Done | `101c0c6` (PR #67) |
| 5.3 Lazy folder materialization (frontend) | ✅ Done | `101c0c6` (PR #67) |
| **5.4 Claude Code CLI integration** | ⏳ **Next** | — |
| 5.5 Auto-commit + real Undo via git | ⏳ After 5.4 | — |

---

## Background

WorkPal is a React + TypeScript + Vite AI workplace assistant. V3 merged (commit `827d323`, PR #64) finished the single-input UX refactor: auto inspector, session folders, promote-to-project, PermissionPrompt, Changes card with Undo.

**Current state**: UI and interactions are complete but **all AI flows are frontend-simulated**. Phase 5 goal: cut excess complexity (5.1), then wire to real Claude Code CLI as backend (5.4–5.5).

## Already completed (keep, don't rewrite)

- `src/components/ChatInput.tsx` — single input, no mode selector
- `src/components/TaskContextPanel.tsx` — inspector with Changes / Progress / Folder / Context / Tools active
- `src/components/PermissionPrompt.tsx` — 3-button modal (file-write/read/command/external-url)
- `src/components/NewProjectDialog.tsx` — unified Promote to Project dialog
- `src/components/Sidebar.tsx` — Recents + Projects list, single-session row menu
- `src/components/OverviewPage.tsx` — Dashboard with Scheduled section
- `src/App.tsx` — state + current simulated flow (**Phase 5.4 focus**)
- `src/types.ts` — `Chat.sessionFolder`, `Chat.folderMaterialized`, `Chat.hasInspector`

## Existing backend

`server/` directory: Express + OpenAI GPT streaming (Phase 1 completed). Phase 5.4 adds Claude Code integration here.

---

## 5.4 Claude Code CLI integration (the big one)

**Recommended**: use `@anthropic-ai/claude-agent-sdk` (npm) for Node-side Claude Code invocation. Cleaner than raw spawn.

### What to build

1. **Backend (`server/`)**:
   - New file: `server/src/claudeCode.ts` — spawn Claude Code per session, pipe `--output-format stream-json`
   - Working directory = session folder (lazy: only `mkdir -p` on first Write/Edit tool call)
   - Convert CLI's JSON stream into SSE and forward to frontend
   - Use `ANTHROPIC_API_KEY` from `server/.env` (already configured)

2. **Frontend (`src/App.tsx` + `src/lib/api.ts`)**:
   - Replace simulated flow with real SSE consumption
   - Map events to existing UI:
     - `tool_use` (Write/Edit/Bash) → existing auto-inspector triggers
     - `permission_request` → show existing `PermissionPrompt`, return user choice to CLI
     - File create/edit → add entry to Changes card (real file, not simulated)
     - Step complete → update Progress
   - **Lazy folder**: when first Write/Edit arrives, flip `Chat.folderMaterialized = true` AND tell backend to `mkdir -p`

### Acceptance tests

- [ ] Pure Q&A ("translate hello to French") → no new folder on disk, no folder chip in UI
- [ ] "Create hello.txt with 'hi'" → backend actually creates session folder + file; chip appears
- [ ] "Read my desktop report.pdf" → `PermissionPrompt` appears; Allow/Cancel both work end-to-end
- [ ] Click folder chip → opens Finder at the real path
- [ ] Multiple concurrent sessions stay in their own folders, don't cross-contaminate

---

## 5.5 Auto-commit + real Undo

**Depends on 5.4** (needs real folders/files on disk).

### What to build

- New file: `server/src/git.ts`
- On session folder's first `mkdir`: auto `git init`
- After every Write/Edit/Delete tool call: `git add . && git commit -m "Session {id} – {tool} – {step description}"`
- Undo handler: `git reset --hard HEAD~1` for the tracked change entry → flip UI state to Undone (UI already done in V3)

### Acceptance tests

- [ ] AI writes file → disk shows commit, Change entry appears
- [ ] Click Undo on entry → file reverted on disk, commit reverted, entry grays out + strikethrough
- [ ] Undo works in reverse order (latest first)

---

## Non-goals (do NOT do in Phase 5)

- ❌ **Worktree isolation for parallel sessions** → Phase 6
- ❌ Remote agent / cloud Claude Code → local first
- ❌ Multi-user collaboration
- ❌ UI visual changes → UI is final, only data layer moves
- ❌ Don't re-add Recents multi-select (intentionally removed in 5.1)

---

## Phase 6 preview (NOT for this phase)

After 5.4–5.5 are shipped:
- One git worktree per session → real isolation for concurrent work
- User-initiated merge back to Project base folder
- Conflict resolution UI

---

## Technical references

- **Current commit**: `origin/main` latest
- **Claude Code docs**: https://docs.claude.com/en/docs/claude-code/overview
- **Claude Agent SDK**: https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk
- **Project path**: `/Users/beibeizhang/Library/Mobile Documents/com~apple~CloudDocs/beibeidesign/WorkPal/Code`
- **Dev server**: `npm run dev` → port 2006; `npm --prefix server run dev` → port 3001

---

## Development order (risk ascending)

| Step | Content | Risk | Estimate |
|---|---|---|---|
| 5.4a | Spawn Claude Code subprocess, log stream to console | 🟡 medium | 2-3 hrs |
| 5.4b | SSE forward to frontend, simplest echo | 🟡 medium | 2-3 hrs |
| 5.4c | Map tool_use events → inspector triggers + Changes | 🔴 high | 4-6 hrs |
| 5.4d | Wire PermissionPrompt request/response | 🔴 high | 2-4 hrs |
| 5.4e | Lazy folder real `mkdir` + open-in-Finder | 🟢 low | 1-2 hrs |
| 5.5 | Auto-commit + real Undo | 🟡 medium | half day |
| Test | Full Phase 5 acceptance checklist | 🟢 low | half day |

**Each sub-step → own commit**. Easier to bisect and revert.

---

## First message template for a new Cowork session

```
请先读 docs/phase-5-requirements.md 了解进度和下一步。

当前要做：5.4 Claude Code CLI 集成（查看文档里的子步骤 5.4a–5.4e）。

做之前先列具体改动点给我确认，按 5.4a → 5.4e 顺序，每步单独 commit 单独 PR。
```

Paste this in a fresh Cowork session and the agent will pick up cleanly.

---

## How to update this doc

After each PR merges:
1. Flip the status in the table at top (✅ Done + commit hash)
2. Commit & push directly to main (this is a doc, not code — no PR needed)

Keeps the doc living, so every new Session reads the latest truth.
