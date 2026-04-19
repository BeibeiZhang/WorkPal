# WorkPal Phase 6: Project-level workflow (worktree + merge)

## 📍 Current Progress (update after each merge)

| Step | Status | Commit / PR |
|---|---|---|
| **6.1 Project base folder init** | ⏳ **Next** | — |
| 6.2 Session via git worktree | ⏳ Pending | — |
| 6.3 Complete Session + diff preview + FF merge | ⏳ Pending | — |
| 6.4 Conflict detect + CLI hand-off | ⏳ Pending | — |
| 6.5 Orphan worktree reaper | ⏳ Pending | — |

---

## Background

Phase 5 shipped per-session folders + per-folder git repos, so parallel sessions don't step on each other. But sessions are **isolated islands** — work in one session can't flow to a project's canonical state.

Phase 6 bridges that. Mental model:

- **Project = main branch** (canonical state)
- **Session = feature branch** (exploration)
- **Complete Session = merge feature → main**

UX vocabulary stays user-friendly per principle #3 — users see "chat session" and "Complete Session", they **do not** see "worktree / branch / merge". Those are backend concepts.

## Already in place (from Phase 5, reuse — do not rewrite)

- `~/WorkPal/<project>/sessions/<slug>/` folder naming (keep exactly)
- Lazy materialization on first file-write `tool_use` (`folderMaterialized` gate)
- `finally` rmdir of empty folders (5.4e pattern — ENOTEMPTY-safe)
- `server/src/lib/git.ts` — `initIfNeeded`, `commitAfterTool` (per-file `git add -- <path>`), `undoLastCommit`. **Extend with worktree helpers, do not duplicate**.
- `resolveSessionFolder` path guard in `server/src/routes/claudeChat.ts` — reuse pattern for all new endpoints (project-level needs its own variant with different root guard)
- Claude Agent SDK integration (5.4a–5.4e) — unchanged; SDK doesn't care that `cwd` is now a worktree
- `streamFromClaudeAPI(chatId, text, sessionFolder)` argument pass-through (5.5 round 2 fix) — required pattern, don't regress to stale-closure

## Inherited invariants (don't break)

- **One commit ⇔ one tool's file edit** (5.5 round 2 fix: `git add -- <path>`, no `git add -A`)
- **Bilingual from day 1** for all new error messages (principle #8)
- **Path-traversal guards** on every new endpoint that accepts path-like input (principle #7)
- **Lazy create + finally cleanup** — no eager creation of "maybe needed" state (principle #6)
- **Frontend-generated paths flow through unchanged** — UI path = backend path = git path (principle #9)

---

## Phase 6 — shared decisions (LOCKED during planning; do NOT revisit per sub-step)

These were debated and settled 2026-04-19. All 6.X sub-steps reference them; no sub-step may re-decide.

### D1 — Project base folder path
`~/WorkPal/<project-slug>/` **IS** the base git repo.

- Sessions: `~/WorkPal/<project-slug>/sessions/<session-slug>/`
- NO extra `<project>/base/` layer
- Reason: UI already shows this path via Phase 5's `sessionFolder` chip. Principle #9 — visible path == real path.

### D2 — Isolation mechanism: `git worktree add`
Not fs clone.

- Branch name per session: `session/<session-slug>`
- `git worktree` shares object storage with the base repo (cheap; git's designed intent)
- Principle #4: reuse git's primitive, don't roll our own clone logic

### D3 — Lifecycle: lazy create, clean up on exit
- Project base `git init` fires on **first entry into the project** (lazy; principle #6)
- Session worktree `add` fires on **first file-write tool_use** (reuse Phase 5's `folderMaterialized` trigger)
- Pure Q&A session → no worktree, no branch, `finally` rmdir cleans the empty folder (same as 5.4e)
- Orphan cleanup: 6.5 sub-step
- **Migration**: Phase 5 legacy sessions (those with their own per-session `.git`) keep the old model. No auto-migration. Phase 7+ decides if we unify.

### D4 — Merge trigger UX: "Complete Session" → diff preview → approve → FF merge
- Inspector gets a "Complete Session" button (wording final; avoid "merge" in UI per principle #3)
- Click → backend computes diff of session branch vs project base → modal shows file list + per-file summary
- User approves → `git merge --ff-only session/<slug>` from project base `cwd`
- If merge succeeds, session branch stays around (reaper in 6.5 handles it)
- If merge fails non-FF (conflicts) → D5 path
- Explicitly NOT auto-merge. User always confirms. Principle #7 safe-by-default.

### D5 — Conflict strategy: detect only, CLI hand-off
- No in-app diff/merge editor (principle #2 subtract; principle #4 reuse the user's CLI)
- On non-FF merge failure: modal shows N files in conflict + copyable command
  - Command shape: `cd ~/WorkPal/<project-slug>/ && git merge session/<slug>`
  - Copy-to-clipboard button (sanitized — see security note)
- Error messages **bilingual** (principle #8):
  - EN: "N files have conflicts. Resolve in terminal:"
  - ZH: "N 个文件有冲突,请在终端解决:"
- User resolves outside the app, returns when done; no "re-enter app and resume merge" state machine

### Security (principle #7)
- New path-accepting endpoints reuse `resolveSessionFolder` pattern (or a new `resolveProjectFolder` sibling — same guard shape, `WORKPAL_ROOT` rooted, rejects `..` escapes)
- Branch name validation: `/^session\/[a-zA-Z0-9._-]+$/` — reject anything else. Protects against git command injection via malicious branch names.
- Copy-to-clipboard string is **frontend-assembled** from already-validated path + branch; server never hands the user a raw shell command

### Non-goals (explicit — do NOT do any of these in Phase 6)

- ❌ In-app diff / merge editor (too much scope, principle #2)
- ❌ Auto-merge on session close
- ❌ Phase 5 legacy-session migration to worktree
- ❌ Branch visualization UI / cherry-pick / multi-session parallel preview
- ❌ Renaming "Project" → "Repo" or any vocabulary shuffle (UI vocabulary is final per Phase 4/5)
- ❌ Exposing "task" in user-facing copy (principle #3)

---

## 6.1 — Project base folder init (⏳ **next**)

**Goal**: First time user enters (or creates) a project, initialize a git repo at `~/WorkPal/<project-slug>/` with a baseline empty commit. Idempotent. Subsequent 6.X sub-steps assume the base repo exists.

### Scope

**Backend**
- New `server/src/lib/project.ts`:
  - `resolveProjectFolder(projectSlug: unknown) → { ok, resolved } | { ok:false, reason }` — mirrors `resolveSessionFolder`'s shape but rooted at `WORKPAL_ROOT` and expects a single path segment (no nested paths; no `/sessions/` suffix). Validates no `..`, no absolute path escape.
  - `initProjectIfNeeded(projectPath: string) → Promise<void>` — if `.git` doesn't exist: `git init -q` + `git config user.email workpal@local` + `git config user.name WorkPal` + empty baseline commit `'WorkPal project baseline'`. Matches the identity pattern from `initIfNeeded` in `server/src/lib/git.ts:31`.
- New route `POST /api/project/init`:
  - Body: `{ projectSlug: string }`
  - Validates via `resolveProjectFolder`; 400 on bad input
  - `mkdir -p` the resolved path if missing (under `~/WorkPal/`)
  - Calls `initProjectIfNeeded`
  - Returns `{ ok: true }` on success, 500 with bilingual error on failure

**Frontend**
- `src/lib/api.ts`: `postInitProject(projectSlug: string) → Promise<{ok: boolean; error?: string}>`
- `src/App.tsx`:
  - `NewProjectDialog` success path → fire-and-forget `postInitProject(slug)` after the Project object is added to state
  - When user opens an existing project that has no `.git` (server returns "not initialized" on first worktree add in 6.2, OR we can proactively fire on project open) — **recommendation**: fire on project open, idempotent. Keep it simple.

### Acceptance tests

- [ ] Create new project "Test Alpha" via NewProjectDialog → `ls ~/WorkPal/test-alpha/` shows `.git/`, `git -C ~/WorkPal/test-alpha log --oneline` shows one baseline commit
- [ ] Close and reopen the same project → POST fires again, backend no-ops (idempotent — no second baseline commit)
- [ ] Pre-existing project folder without `.git` (e.g. legacy Phase 5 project the user had) → first open after upgrade fires init, `.git` appears, baseline commit present
- [ ] Path-traversal: `projectSlug: "../.."` → 400, no filesystem changes
- [ ] Path-traversal: `projectSlug: "/etc"` → 400
- [ ] Slug with spaces / Chinese chars → allowed if under `~/WorkPal/<that-slug>/`, rejected if it escapes
- [ ] After 6.1, running `git worktree add` from project folder (anticipating 6.2) succeeds — baseline commit provides a valid target

### Context for 6.2 (read before starting 6.2)

- Every Phase 6-era project has `.git/` at `~/WorkPal/<slug>/` and a baseline commit after 6.1
- `resolveProjectFolder` lives in `server/src/lib/project.ts` — **reuse it in 6.2's worktree-add endpoint** instead of duplicating the guard
- `initProjectIfNeeded` is idempotent (`.git` check) — it's safe to call defensively at the start of any endpoint that needs the project repo to exist
- Identity config pattern (`workpal@local` / `WorkPal` via `git config --local`) matches Phase 5 exactly — keep for consistency and to avoid polluting the user's global git config (principle #7)
- Baseline commit is `--allow-empty` — no files get staged. That's what allows future `git worktree add` calls to target `HEAD` even before any real work happens.

---

## 6.2 — Session via git worktree (⏳ pending)

**Goal**: Replace Phase 5's "session folder gets its own `git init`" with "session folder is a `git worktree add` of the project's `session/<slug>` branch". Auto-commit / Undo / all Phase 5 behaviors work unchanged inside the worktree.

### Scope (sketch — expand after 6.1 merges)

- `server/src/lib/git.ts` gains `worktreeAdd(projectPath, sessionPath, branchName)` wrapping `git -C <projectPath> worktree add <sessionPath> -b <branchName>`
- `server/src/routes/claudeChat.ts`: on first file-write `tool_use`, if the chat has a `projectSlug`, call `worktreeAdd` instead of `initIfNeeded(sessionFolder)`. Keep Phase 5's legacy path as fallback when chat has no project.
- Branch name: `session/<session-slug>`, validated against the allow-list regex
- 5.5 auto-commit runs inside the worktree, commits land on the session branch — project base `git log` stays clean until 6.3 merges

### Acceptance tests (sketch)

- [ ] New session under existing project → `git -C <project> worktree list` shows the session path
- [ ] Auto-commit on file write → `git log` on the session branch has the commit; `git log` on project main does not
- [ ] Two parallel sessions under same project → two worktrees, two branches, each with its own commits
- [ ] Undo in one session doesn't affect project main or sibling session
- [ ] Pure Q&A session → no worktree created, folder rmdir'd on finally

---

## 6.3 — Complete Session + diff preview + FF merge (⏳ pending)

Sketch only; detail in "Context from 6.2" once 6.2 merges.

**Goal**: "Complete Session" button in inspector → `POST /api/session/complete` computes diff of session branch vs project base, returns file list + changes. Frontend shows modal; on approve, `POST /api/session/merge` runs `git merge --ff-only`.

---

## 6.4 — Conflict detection + CLI hand-off (⏳ pending)

Sketch. Goal: if 6.3's `git merge --ff-only` fails (non-FF needed), modal shows the CLI command with copy-to-clipboard. No in-app resolution.

---

## 6.5 — Orphan worktree reaper (⏳ pending)

Sketch. Goal: on app start (or periodic), backend scans `~/WorkPal/<project>/sessions/*`, cross-references with the Chat state snapshot, `git worktree remove --force` + `git worktree prune` for orphans.

---

## Technical references

- Phase 5 doc: [docs/phase-5-requirements.md](./phase-5-requirements.md) (shipped reference; reuse patterns)
- Phase history: [docs/phase-history.md](./phase-history.md)
- Principles: [docs/principles.md](./principles.md) — cited throughout
- `git worktree` manual: https://git-scm.com/docs/git-worktree
- Project path: `/Users/beibeizhang/Library/Mobile Documents/com~apple~CloudDocs/beibeidesign/WorkPal/Code`

### Dev server ports

- Main: 2006, backend: 3001 (shared)
- Cowork impl session: pick free port per principle #11 (2010/2011/2012 as Phase 5 precedent)
- Planning/testing session doesn't run dev — no port needed

---

## First message template for a new Cowork session

Paste the block below into a fresh Cowork impl window. The impl agent will pick up everything it needs from `docs/phase-6-requirements.md`.

```
git pull

你是做 6.1 的 Cowork impl session。

请先读 docs/phase-6-requirements.md —— 整个 Phase 6 的 shared decisions (D1–D5) 都锁在里面了,不要重议。也扫一眼 docs/principles.md(15 条原则,和 Phase 5/6 决策深度挂钩)。

6.1 的 scope:Project base folder init。新建/首次进入 project 时初始化 git repo + baseline commit。幂等。

做之前先列具体改动点给我 review,不要直接写代码:
- 新文件 server/src/lib/project.ts(resolveProjectFolder + initProjectIfNeeded)
- 新 route POST /api/project/init
- 前端 hook 点:NewProjectDialog 成功后 + existing project 首次打开
- 路径守卫:复用 claudeChat.ts 里 resolveSessionFolder 的 shape,改成 project 层
- Identity 复用 server/src/lib/git.ts 里 workpal@local / WorkPal,用 git config --local
- 基线 commit 用 --allow-empty,消息 "WorkPal project baseline"

改动点过了 review 再写,按文档里 6.1 Acceptance tests 手测通过再开 PR。

跑 dev:
- 前端 `npm run dev -- --port 2010`(主 session 占 2006,避开)
- 后端需要时 `cd server && unset ANTHROPIC_API_KEY && npm run dev`(shell 会注入空 ANTHROPIC_API_KEY,这步 unset 必须;backend 3001 无状态共享)

高风险项(异步/git/文件路径),按原则 #12 我会 live test。PR 开了在 planning session 说一声。

测完按原则 #13 清场:kill backend + preview_stop、清掉测试 project folder,不留 zombie。
```

---

## How this doc evolves

After each sub-step PR merges:
1. Flip status in the progress table at the top (✅ Done + commit hash + PR number)
2. Add a "Context from 6.X" block to the next sub-step capturing lessons from this one
3. Update the first-message template to point at the next sub-step
4. Commit & push directly to main (doc update, no PR needed)

Living doc — every new Cowork session reads the latest truth.
