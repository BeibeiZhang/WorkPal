# WorkPal Phase 6: Project-level workflow (worktree + merge)

## 📍 Current Progress (update after each merge)

| Step | Status | Commit / PR |
|---|---|---|
| 6.1 Project base folder init | ✅ Done | `8aa722a` (PR #80) |
| 6.2 Session via git worktree | ✅ Done | `b48c606` (PR #81) |
| 6.3 Complete Session + diff preview + FF merge | ✅ Done | `bbd0bf4` (PR #83) |
| **6.4 CLI hand-off polish (copy-to-clipboard)** | ⏳ **Next** | — |
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

## 6.3 — Complete Session + diff preview + FF merge (⏳ **next**)

**Goal**: User clicks "Complete Session" in the inspector. Modal shows which files this session changed (path + added/modified/deleted + insertion/deletion counts). User approves → `git merge --ff-only session/<slug>` from the project base. Session branch stays around until 6.5 reaper cleans it. Non-FF failures log a clean error and (for 6.4) surface a copyable CLI command.

### Context from 6.2 (read before starting 6.3)

- **Helpers to reuse** — do not re-derive:
  - `WORKPAL_ROOT` from `server/src/lib/paths.ts`
  - `resolveProjectFolder` / `initProjectIfNeeded` from `server/src/lib/project.ts`
  - `SESSION_BRANCH_RE` / `worktreeAddIfNeeded` / `worktreeRemoveIfEmpty` from `server/src/lib/git.ts`
  - The pattern `resolveSessionFolder` + cross-project containment check from `claudeChat.ts` (the "sessionFolder must live under ~/WorkPal/<projectSlug>/sessions/" guard added in 6.2) — **copy this guard to 6.3's endpoints**, a client could still mismatch projectSlug with a session folder pointing elsewhere.

- **Branch name derivation for 6.3**: `branchName = 'session/' + basename(sessionFolder.replace(/\/+$/, ''))` — same formula 6.2 uses. Validate via `SESSION_BRANCH_RE` before passing to any git command. Don't accept a raw `branchName` field from the client (would bypass the regex contract) — always re-derive from `sessionFolder`.

- **6.3 must hard-exclude Phase 5 legacy sessions**: sessions without a `projectSlug` don't have a worktree, don't have a `session/<slug>` branch — they have their own per-session `.git/` dir. "Complete Session" is a no-op concept for them. Two enforcement points:
  - **Frontend**: only render the "Complete Session" button when `chat.projectId` is set (and the project exists)
  - **Backend**: `/api/session/complete` and `/api/session/merge` both 400 when `projectSlug` is missing from the body, with bilingual error

- **Merge happens in the project base repo, not the worktree** — `git -C <projectPath> merge --ff-only session/<slug>`. The worktree stays checked out on its session branch; the project's main HEAD advances. Don't `cd` into the worktree for merge.

- **What does NOT happen on merge (yet)**:
  - The worktree folder on disk is **kept** (session "completed" state; 6.5 reaper handles cleanup later)
  - The session branch is **kept** (same reason)
  - The chat UI moves the session into a "completed" visual state — decide the exact UX with Beibei before impl (default: no sidebar change, just a checkmark + disable "Complete Session" button re-click)
  - No commit on top of main beyond the FF advance — we're literally replaying the session's commits into main's history linearly

- **FF vs non-FF**: `--ff-only` refuses if main has advanced since the session branched. In practice main only advances via prior Complete Session merges. So non-FF means **another session was completed between this session's creation and its Complete Session click, and the two diverged**. 6.4 handles the CLI hand-off; 6.3 just reports the failure clearly (status 409 "conflict / not fast-forwardable", bilingual error) so 6.4 can build the UI on top.

- **Diff shape — minimal, not a full diff viewer** (principle #2 subtract): return `Array<{path, status: 'A'|'M'|'D', insertions, deletions}>` from `git diff --numstat --name-status main...session/<slug>`. Frontend renders a row per file. No inline diff content, no expand-to-view. User wants real diff → they go CLI. If Beibei wants per-file expandable diff later, that's Phase 7+.

- **Commit messages are verbose** (Phase 5 format: `Session <sid8> – Write – <abs-path>`). Don't surface these in the diff preview — the file path is what the user cares about. Use `basename(path)` for the visual label, full path on hover.

- **Bilingual error shape stays `"English / 中文"`** — every new 400/409 error must follow.

### Scope (expand into change list for review before writing code)

**Backend** (`server/src/lib/git.ts` + new `server/src/routes/session.ts`):

- New helper `diffSessionVsBase(projectPath, branchName) → Promise<Array<{path, status, insertions, deletions}>>` — wraps `git -C <projectPath> diff --numstat --name-status main...<branchName>`. Parse stdout into the typed array. Empty array = nothing to merge.
- New helper `mergeSessionFFOnly(projectPath, branchName) → Promise<{ok: true, commit: string} | {ok: false, reason: 'not-ff' | 'other', message: string}>` — wraps `git -C <projectPath> merge --ff-only <branchName>`. Distinguish "non-fast-forward" stderr (returns `ok: false, reason: 'not-ff'`) from other failures (returns `ok: false, reason: 'other'`).
- New route `POST /api/session/complete` — body `{projectSlug, sessionFolder}`; validates both via existing guards + cross-project containment; derives branchName; validates via `SESSION_BRANCH_RE`; returns `{files: [...]}` or 400 on any validation failure
- New route `POST /api/session/merge` — same validation shape; calls `mergeSessionFFOnly`; 200 on success with new HEAD hash, 409 with bilingual `"Session cannot be fast-forwarded..."` on non-FF, 500 otherwise

**Frontend** (`src/lib/api.ts` + `src/components/TaskContextPanel.tsx` + possibly a new modal):

- `src/lib/api.ts`: `postSessionComplete(projectSlug, sessionFolder)` and `postSessionMerge(projectSlug, sessionFolder)` — same shape as `postUndoChange`, return discriminated result types
- `TaskContextPanel.tsx`: "Complete Session" button at the bottom of the panel, **only rendered when `chat.projectId` is set and chat has `folderMaterialized` = true** (nothing to complete if no files were written)
- New `CompleteSessionModal.tsx` (or inline in App): file-list rows (basename, colored icon per status, +N/-N stats), Cancel + Merge buttons
- On Merge success: close modal, disable the Complete Session button, optional toast "N commits merged to main"
- On Merge failure with `reason: 'not-ff'`: show error message + a copyable CLI command string `cd ~/WorkPal/<projectSlug>/ && git merge session/<slug>` (this is the seed of 6.4's work — 6.3 renders the bare string; 6.4 adds the copy-to-clipboard polish)
- On other failure: error in modal, don't close

### Acceptance tests (live-test, high-risk per principle #12 — I will run these)

- [ ] Session with 3 writes (a.txt, b.txt, c.txt) → click Complete Session → modal shows 3 rows with correct status + stats → approve → `git log main` shows 3 session commits now reachable from main's HEAD
- [ ] After merge, clicking Complete Session again on the same session → modal shows empty diff (nothing to merge); button behavior TBD (disable? "Already completed"?)
- [ ] Session with a file edit + a file delete → modal shows `M` and `D` rows correctly
- [ ] Phase 5 legacy chat (no project) → "Complete Session" button does not render
- [ ] Call `/api/session/complete` without `projectSlug` → 400 bilingual
- [ ] Call `/api/session/merge` with branchName injection (bad sessionFolder basename) → 400 bilingual via regex
- [ ] Two sessions under one project, complete A first → main advances. Then try to complete B → (depending on B's commits) 200 FF OR 409 non-FF. If 409, error message contains the right CLI command
- [ ] Cross-project containment: projectSlug A + sessionFolder under project B → 400 bilingual (6.2's guard carries forward)
- [ ] Pure Q&A session that got its worktree cleaned up in finally → backend can't find branch; return bilingual 404 or appropriate error; button shouldn't have been renderable anyway

### Decisions to lock with Beibei before impl writes code

1. **Post-merge UX** — what does the chat's "completed" state look like?
   - (a) No visual change except disabling "Complete Session" re-click
   - (b) Checkmark badge next to the chat title in sidebar
   - (c) Move chat from Recents to a "Completed" section under the project
   - My recommendation: **(a)** simplest, doesn't force a new sidebar pattern. (b)/(c) can be Phase 7+ polish.

2. **Diff rendering per-file** — basename + status icon + stats only, no inline diff content, right? (Confirms principle #2 subtract.)

3. **Merge button placement** — modal Cancel+Merge buttons, or the modal lets user continue to inspect files before a separate "Merge" confirmation? I'd do single-step (Cancel/Merge directly in modal — user has already committed mentally when they clicked Complete Session).

4. **Empty-diff behavior** — session with no commits (possible if Phase 5 legacy didn't migrate, but ruled out by gating; actually reachable only if session made ZERO file writes and materialization is misreported). Show "Nothing to merge" modal? Or disable the button upstream? I'd disable the button via `folderMaterialized === true` gate.

5. **Commit message after FF merge** — none; `--ff-only` is a pointer move, not a new merge commit. Users don't see a "Merge session X" commit on main — they see the session's individual commits linearly. Is this desirable, or do we want a no-ff merge commit for audit? My default: keep FF-only, cleaner log. But Beibei call.

---

## 6.4 — CLI hand-off polish (copy-to-clipboard) (⏳ **next**)

**Goal**: The non-FF 409 error state in `CompleteSessionModal` already renders the CLI command as plain text (6.3). 6.4 adds a **Copy button** with visible feedback so the user can one-click copy and paste into Terminal instead of selecting text manually.

### Context from 6.3 (read before starting 6.4)

- **The CLI command is already displayed**, see `src/components/CompleteSessionModal.tsx` (the 409 error state branch). Command string comes from `postSessionMerge`'s `{reason:'not-ff', cliCommand}` payload — don't re-derive it anywhere else.
- **`cliCommand` is browser-assembled in `src/lib/api.ts`** (per D5 security decision — stays in the same trust boundary as already-validated `sessionFolder`). Don't touch the assembly logic.
- **No backend changes** — this is a pure frontend polish PR. Don't touch `server/`, `git.ts`, or any route.
- **Button UX shape (impl's call, propose in change list)**:
  - Icon button (lucide `Copy` / `ClipboardCopy`) next to or inside the `<pre>` block holding the command
  - On click: `await navigator.clipboard.writeText(cliCommand)` → flash "Copied!" / "已复制" next to the button for ~1.5s → revert
  - On failure (promise rejects; Safari private mode, insecure context in very old browsers): silently fallback to a one-time inline hint "Copy failed — select and ⌘C"; don't alert/toast (low-value polish shouldn't surface modals)
- **`navigator.clipboard.writeText` prerequisite**: requires secure context (HTTPS or localhost). Dev server is `localhost:2008/2006` — always secure-context, no prod issue for now. Flag in code comment for future deployment-shape decision.
- **Bilingual feedback**: "Copied! / 已复制" following the `"EN / 中文"` convention from principles #8.

### Scope

- `src/components/CompleteSessionModal.tsx`: add the Copy button + hover/click states + feedback flash state
- `src/lib/api.ts`: **no change** — `cliCommand` is already in the return shape
- No other file touched

### Acceptance tests (impl self-tests, low-risk per principle #12 — **I do NOT run live tests for this PR**)

Impl runs these in their own browser on port 2010:

- [ ] Trigger non-FF scenario (any two-session FF+diverge setup) → modal error state shows Copy button next to CLI command
- [ ] Click Copy → clipboard has exact CLI command (verify by Cmd+V into a terminal or another field)
- [ ] Visible feedback: "Copied!" text appears, reverts after ~1.5s
- [ ] Button shows correct hover/focus style (matches shared.tsx button patterns)
- [ ] Click Copy twice in rapid succession → second click's feedback replaces first cleanly, no visual glitch
- [ ] Bilingual label on feedback ("Copied! / 已复制")

### Classification — **low-risk, low value**

This is cosmetic polish on an already-working error path (principle #12 low-risk bucket: pure visual/UX change, no async/git/state-machine surface). Planning/testing session does NOT run live tests. Impl self-verifies the 6 acceptance tests above in their browser, describes the test run in the PR description, and ships. 

After merge, I'll update progress table + write 6.5 context block.

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

你是做 6.4 的 Cowork impl session。

请先读 docs/phase-6-requirements.md 里 6.4 那节(小改动,纯前端 polish,为 6.3 已经渲染的 CLI 命令加 Copy 按钮),也扫一眼 docs/principles.md 的 #8 双语、#12 风险分级、#13 清场。

6.4 的 scope 极小:**只改 `src/components/CompleteSessionModal.tsx`**。非 FF 409 error 态里已经显示 CLI 命令字符串(6.3 的产物),只需要:
- 命令旁边加一个 Copy icon 按钮(lucide `Copy` 或 `ClipboardCopy`)
- 点击 → `navigator.clipboard.writeText(cliCommand)`
- 成功 → 原地 flash "Copied! / 已复制" 约 1.5s → 自动 revert
- 失败(Safari 无痕等)→ silent 降级,显示小字提示 "Copy failed — select and ⌘C",**不要弹 toast / alert**
- `cliCommand` 从 `postSessionMerge` 返回的 `{reason:'not-ff', cliCommand}` 拿,**不要**在 modal 里重新拼

做之前列改动点给我 review:
- Copy 按钮的具体放置(inside/outside `<pre>`?)+ 样式套 shared.tsx 的哪个 pattern
- flash 状态怎么管(local useState?timeout cleanup on unmount?)
- 失败 fallback 的具体文案 + 触发时机

改动点过了 review 就写,按文档里 6.4 Acceptance tests(6 条)在你自己的 2010 浏览器里自测。

跑 dev:
- 前端 `npm run dev -- --port 2010`(主 session 占 2006)
- **不需要 backend**,纯前端改动。要复现 409 场景可以手工 mock `postSessionMerge` 的返回值,或者 copy 6.3 的手测脚本造两个 session
- `navigator.clipboard` 需要 secure context(localhost 就是,没问题)

**6.4 按原则 #12 归为 low-risk**(纯视觉 polish、无 async/git/state machine 改动):**planning session 不跑 live test**。你在本地自测 6 条 acceptance tests 通过后,PR description 里列一下你跑了哪几条、输出是什么(clipboard 内容截图、feedback flash 录屏或截图都行),直接开 PR merge,不用拉我。

测完按原则 #13 清场:`preview_stop` 你的 2010,不留 zombie。
```

---

## How this doc evolves

After each sub-step PR merges:
1. Flip status in the progress table at the top (✅ Done + commit hash + PR number)
2. Add a "Context from 6.X" block to the next sub-step capturing lessons from this one
3. Update the first-message template to point at the next sub-step
4. Commit & push directly to main (doc update, no PR needed)

Living doc — every new Cowork session reads the latest truth.
