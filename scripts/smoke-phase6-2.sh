#!/usr/bin/env bash
#
# scripts/smoke-phase6-2.sh
#
# Phase 6.2 smoke test — exercises the git layer of the worktree/branch
# workflow directly, bypassing the SSE/SDK pipeline. Runs in ~1 second, no
# network, no API keys. Lives under `scripts/` so `npm`-less contributors can
# eyeball the git contract without standing up the full backend.
#
# What it proves (and what it doesn't):
#   ✓ initProjectIfNeeded shape works (baseline commit, repo-local identity)
#   ✓ Two concurrent `git worktree add` calls against the same base don't
#     corrupt each other — verifies git's own concurrency guarantees on
#     the real filesystem, not the `express` route handler's async flow
#   ✓ A session commit lands on its session branch only; main stays clean
#   ✓ Undo in one session doesn't touch the sibling or main
#   ✗ The route handler's state machine (isProjectOwned branching,
#     folderMaterialized, pendingWrites) — that needs a live backend.
#     Drive that via the UI per the PR description's manual test plan.
#
# Run:  bash scripts/smoke-phase6-2.sh
# Requires: git, a POSIX shell, write access to a tmp dir.

set -euo pipefail

# Isolate the smoke into a throwaway tmp dir so it can't collide with a real
# ~/WorkPal setup. mktemp -d avoids name clashes when the script is run
# repeatedly; trap cleans it up even on failed assertions.
ROOT="$(mktemp -d -t workpal-smoke-6-2-XXXX)"
trap 'rm -rf "$ROOT"' EXIT

PROJ="$ROOT/test-proj"
SA="$PROJ/sessions/2026-04-19-sess-a"
SB="$PROJ/sessions/2026-04-19-sess-b"
# CJK in the slug — covers the real case from 5.5 testing that forced D2's
# branch-name regex supersede.
SC="$PROJ/sessions/2026-04-19-生成一个关于云的俳句"

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "ok   $*"; }

# --- Setup: project base repo (mirrors initProjectIfNeeded in project.ts)
mkdir -p "$PROJ"
git -C "$PROJ" init -q
git -C "$PROJ" config --local user.email workpal@local
git -C "$PROJ" config --local user.name WorkPal
git -C "$PROJ" commit --allow-empty -q -m "WorkPal project baseline"

# Sanity: base exists and has exactly one commit.
BASE_COMMITS=$(git -C "$PROJ" rev-list --count HEAD)
[ "$BASE_COMMITS" = "1" ] || fail "baseline commit count: expected 1, got $BASE_COMMITS"
pass "project base has 1 baseline commit"

# --- Concurrent worktree adds (acceptance test: two parallel sessions)
# `mkdir` the sessions/ parent first — `git worktree add` doesn't create
# intermediate dirs, matching what claudeChat.ts does before worktreeAdd.
mkdir -p "$PROJ/sessions"
# Run both adds in parallel via & ... & wait. If git's worktree.lock serializes
# correctly (it does), both succeed; any race/corruption would surface as
# either command exiting non-zero or the branch list diverging.
(git -C "$PROJ" worktree add "$SA" -b session/2026-04-19-sess-a -q) &
(git -C "$PROJ" worktree add "$SB" -b session/2026-04-19-sess-b -q) &
wait
pass "two concurrent worktree adds completed"

# Third worktree with CJK slug — sequential, just verifying the regex-allowed
# non-ASCII path works end-to-end.
git -C "$PROJ" worktree add "$SC" -b session/2026-04-19-生成一个关于云的俳句 -q
pass "CJK-slug worktree add succeeded"

# Expect: 4 worktrees (main + 3 sessions).
WT_COUNT=$(git -C "$PROJ" worktree list | wc -l | tr -d ' ')
[ "$WT_COUNT" = "4" ] || fail "worktree count: expected 4 (main + 3), got $WT_COUNT"
pass "git worktree list shows 4 entries"

# --- Session-scoped commits (acceptance: commits land on branch, not main)
# Each session writes + commits; main branch HEAD must NOT move.
MAIN_HEAD_BEFORE=$(git -C "$PROJ" rev-parse HEAD)

echo "hello from A" >"$SA/a.txt"
git -C "$SA" add -- a.txt
git -C "$SA" commit -q -m "A wrote a.txt"

echo "hello from B" >"$SB/b.txt"
git -C "$SB" add -- b.txt
git -C "$SB" commit -q -m "B wrote b.txt"

MAIN_HEAD_AFTER=$(git -C "$PROJ" rev-parse HEAD)
[ "$MAIN_HEAD_BEFORE" = "$MAIN_HEAD_AFTER" ] || fail "main HEAD moved after session commits"
pass "main branch HEAD unchanged after session commits"

SA_COMMITS=$(git -C "$SA" rev-list --count HEAD)
SB_COMMITS=$(git -C "$SB" rev-list --count HEAD)
[ "$SA_COMMITS" = "2" ] || fail "session A commits: expected 2 (baseline + write), got $SA_COMMITS"
[ "$SB_COMMITS" = "2" ] || fail "session B commits: expected 2 (baseline + write), got $SB_COMMITS"
pass "each session branch has baseline + 1 session commit"

# --- Undo in A doesn't touch B or main (acceptance: undo isolation)
git -C "$SA" reset --hard -q HEAD~1
SA_COMMITS_AFTER_UNDO=$(git -C "$SA" rev-list --count HEAD)
SB_COMMITS_AFTER_UNDO=$(git -C "$SB" rev-list --count HEAD)
MAIN_HEAD_AFTER_UNDO=$(git -C "$PROJ" rev-parse HEAD)
[ "$SA_COMMITS_AFTER_UNDO" = "1" ] || fail "A post-undo commits: expected 1, got $SA_COMMITS_AFTER_UNDO"
[ "$SB_COMMITS_AFTER_UNDO" = "2" ] || fail "B post-undo commits: expected 2, got $SB_COMMITS_AFTER_UNDO"
[ "$MAIN_HEAD_BEFORE" = "$MAIN_HEAD_AFTER_UNDO" ] || fail "main HEAD moved during A's undo"
[ ! -e "$SA/a.txt" ] || fail "A's a.txt should be gone after reset --hard"
[ -e "$SB/b.txt" ] || fail "B's b.txt should still exist"
pass "undo in A left B and main untouched"

# --- Teardown: worktreeRemoveIfEmpty contract on the third (unused) session.
# Mimic the finally-block behavior for a pure Q&A session with a worktree
# that never got a file write: `git worktree remove --force` + `git branch -D`.
git -C "$PROJ" worktree remove --force "$SC"
git -C "$PROJ" branch -D session/2026-04-19-生成一个关于云的俳句
[ ! -e "$SC" ] || fail "SC folder should be gone after worktree remove"
BRANCHES=$(git -C "$PROJ" branch --list 'session/*' | wc -l | tr -d ' ')
[ "$BRANCHES" = "2" ] || fail "session/* branch count: expected 2 (A,B), got $BRANCHES"
pass "worktree remove + branch -D cleanup path clean"

echo
echo "smoke-phase6-2.sh: all checks passed"
