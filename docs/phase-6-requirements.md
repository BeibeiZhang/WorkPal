# WorkPal Phase 6: Project-level workflow (worktree + merge)

## 📍 Current Progress (update after each merge)

| Step | Status | Commit / PR |
|---|---|---|
| 6.1 Project base folder init | ✅ Done | `8aa722a` (PR #80) |
| **6.2 Session via git worktree** | ⏳ **Next** | — |
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
- **`WORKPAL_ROOT` constant lives in `server/src/lib/paths.ts`** (6.1) — every path-accepting endpoint must import from this single source, not re-derive `pathResolve(homedir(), 'WorkPal')` locally. Principle #5 — one shared decision, one home.

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

### Known limitations (explicit — tracked but deliberately not fixed in Phase 6)

- ⚠️ **Project-slug collisions**: `slugify(projectName)` on the frontend can map two different project names to the same slug (e.g. "Test Alpha" and "test-alpha" both → `test-alpha`), causing both projects to share one `~/WorkPal/<slug>/` folder and git repo. Pre-existing since Phase 5's path nesting shipped; deferred out of 6.1 scope. **Flag for a future step** (likely Phase 7): either enforce unique project slugs at create time on the frontend, or make the backend return a conflict error that the UI disambiguates with a numeric suffix. Not a 6.X blocker — the current worst case is "two visually distinct projects write into one folder," which reads as "shared context" rather than data loss.

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

## 6.2 — Session via git worktree (⏳ **next**)

**Goal**: Replace Phase 5's "session folder gets its own `git init`" with "session folder is a `git worktree add` of the project's `session/<slug>` branch". Auto-commit / Undo / all Phase 5 behaviors work unchanged inside the worktree.

### Context from 6.1 (read before starting 6.2)

- **Reuse, don't duplicate**: `resolveProjectFolder` lives in `server/src/lib/project.ts:27`; `initProjectIfNeeded` at `project.ts:83`. 6.2's backend code should import these — do not re-derive. Same for `WORKPAL_ROOT` — import from `server/src/lib/paths.ts`, never inline `pathResolve(homedir(), 'WorkPal')`.

- **`mkdir` vs `worktree add` ordering — the tricky bit**: Phase 5's `claudeChat.ts` eagerly `mkdir -p workingDir` at request start because the Claude Agent SDK spawns `child_process.spawn(..., { cwd })` and throws ENOENT if cwd doesn't exist. But `git worktree add <path>` **requires `<path>` to NOT exist** — it creates the dir itself. For 6.2 the order for a project-owned chat's first file-write `tool_use` is:
  1. `await initProjectIfNeeded(projectPath)` — defensive, idempotent; catches the race where the user sends a message immediately after project creation before the frontend's fire-and-forget `/project/init` POST has landed.
  2. `git worktree add -b session/<slug> <sessionPath>` — git creates `<sessionPath>`.
  3. Any subsequent SDK spawn already has cwd present.

  **Do NOT eagerly `mkdir sessionPath` before `worktree add`**. The Phase 5 eager-mkdir at request start must branch on project-owned vs legacy: project-owned → skip mkdir (worktree add will create it); legacy → keep the Phase 5 mkdir behavior.

- **Frontend request body needs `projectSlug`**: `/api/claude-chat` currently receives only `sessionFolder`. 6.2 must add `projectSlug` (derived with the existing `slugify` at `src/App.tsx:396`, matching what went to `/project/init` in 6.1). Backend branches on presence:
  - `projectSlug` present → worktree path (use `resolveProjectFolder` on it, then worktree add)
  - `projectSlug` absent → legacy Phase 5 path (`initIfNeeded(sessionFolder)` per-session git repo)

- **Branch name regex — D2's original proposal conflicts with Phase 5 slug reality; relax it**: the shared-decisions `Security` block proposed `/^session\/[a-zA-Z0-9._-]+$/`. This rejects Phase 5 session slugs containing CJK (observed in 5.5 testing: `2026-04-19-生成一个关于云的俳句`). Since branch names pass through `execFile('git', [...])` there's **no shell interpretation** — injection via branch names is not the threat. The real threats are (a) slashes that break our `session/` namespace contract, (b) whitespace / NUL / control chars that break git parsing, (c) git's own reserved chars (`~^:?*[`, leading/trailing `.`, `..`, lock-file suffix `.lock`). Propose a concrete regex in the 6.2 change list and I'll lock it — this **supersedes D2's original text**. Minimum must-reject set: `/`, `\0`, whitespace, `:`, `~`, `^`, `?`, `*`, `[`, `..`, trailing `.lock`. Git's `git check-ref-format` is the authoritative reference if you want to match it byte-for-byte.

- **Frontend patterns from 6.1 are reusable**: fire-and-forget + idempotent backend + `useEffect` hook. But 6.2 likely **doesn't need a new frontend POST** — worktree creation is backend-lazy on the first file-write `tool_use`, same trigger as `folderMaterialized`. Just replace the `initIfNeeded(workingDir)` call with the branching init-project-then-worktree-add logic. The frontend only has to add `projectSlug` to the `/claude-chat` body.

- **Bilingual error shape stays `"English text / 中文文本"`** (single line, `/` separator) — 6.1 used it consistently across `resolveProjectFolder` and route handlers. Keep the format.

### Scope (expand into change list for review before writing code)

- `server/src/lib/git.ts` gains `worktreeAdd(projectPath, sessionPath, branchName)` wrapping `execFile('git', ['-C', projectPath, 'worktree', 'add', sessionPath, '-b', branchName])`. Caller is responsible for validating `branchName` against the regex (see above).
- `server/src/routes/claudeChat.ts`:
  - Extend request body type to include optional `projectSlug: string`
  - Branch the eager mkdir: legacy keeps it, project-owned skips it
  - On first file-write `tool_use`: if `projectSlug`, defensively `initProjectIfNeeded(projectPath)` then `worktreeAdd(...)`; else fall back to Phase 5 `initIfNeeded(sessionFolder)`
- Frontend `src/App.tsx`: when streaming to `/claude-chat`, include `projectSlug: chat.projectId ? slugify(projects.find(p=>p.id===chat.projectId)?.name) : undefined`
- 5.5 auto-commit runs inside the worktree; commits land on `session/<slug>` branch; project `main` stays clean until 6.3

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

你是做 6.2 的 Cowork impl session。

请先读 docs/phase-6-requirements.md —— 整个 Phase 6 的 shared decisions (D1–D5) + 6.2 的 "Context from 6.1" 都锁在里面了,不要重议。**D2 原本的 branch name 正则在 Context from 6.1 里被显式 supersede 了**,按新的最小拒绝集走。也扫一眼 docs/principles.md(15 条原则)。

6.2 的 scope:session folder 从 "Phase 5 per-session git init" 切换到 "project 的 git worktree"。Phase 5 的 auto-commit / Undo 行为原地保留,只是 cwd 现在是 worktree。

做之前先列具体改动点给我 review,不要直接写代码,重点给我这几样:
- `worktreeAdd` 函数签名 + 具体命令 argv
- **branch name 正则的具体提案**(Context from 6.1 里说 supersede D2,你提新的,我 lock)
- `claudeChat.ts` 的分支逻辑:project-owned vs legacy 两条路径的确切决策点
- **mkdir 顺序的分支**:project-owned 要跳过 eager mkdir(不然 `worktree add` 会报 "path exists"),legacy 保留
- 前端 request body 新增 `projectSlug` 的推导方式(应该用 App.tsx:396 的 slugify)
- 你打算写哪些单元测试 / 手测脚本,怎么覆盖 "并发两个 session" 这条 acceptance test

改动点过了 review 再写,按文档里 6.2 Acceptance tests 手测通过再开 PR。

跑 dev:
- 前端 `npm run dev -- --port 2010`(主 session 占 2006,避开)
- 后端需要时 `cd server && unset ANTHROPIC_API_KEY && npm run dev`(shell 会注入空 ANTHROPIC_API_KEY,这步 unset 必须;backend 3001 无状态共享)

**高风险项(async + git + 文件系统 + 并发),按原则 #12 我会 live test,必测。**PR 开了在 planning session 说一声,我会跑:
- 单 project 单 session → worktree + session branch + commit 只在 session branch
- 单 project 双并发 session → 两个 worktree 两个 branch 互不影响,Undo 不交叉
- 纯 Q&A session in project → 无 worktree 创建,finally rmdir 仍工作
- 旧 legacy 路径(chat 无 project)→ 仍然按 Phase 5 行为
- 路径/branch 注入尝试 → 被正则拦住

测完按原则 #13 清场:kill backend + preview_stop、清掉测试 project folder + 用 `git worktree prune` 回收临时 worktree,不留 zombie。
```

---

## How this doc evolves

After each sub-step PR merges:
1. Flip status in the progress table at the top (✅ Done + commit hash + PR number)
2. Add a "Context from 6.X" block to the next sub-step capturing lessons from this one
3. Update the first-message template to point at the next sub-step
4. Commit & push directly to main (doc update, no PR needed)

Living doc — every new Cowork session reads the latest truth.
