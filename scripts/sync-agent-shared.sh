#!/usr/bin/env bash
# sync-agent-shared.sh — copy server/src/routes + server/src/lib into
# agent/src/shared/ so the menu-bar agent and the dev Express server run
# identical code.
#
# Phase 7.2 code-sharing strategy = "copy + sync + drift check" (not npm
# workspaces). Rationale in docs/phase-7-requirements.md §"Context from 7.2":
# - server/ is kept around for Beibei's dev loop (`npm --prefix server run dev`
#   still hits :3001 if she runs it manually for troubleshooting), so both
#   trees need the code physically present.
# - 2-day step shouldn't pay the workspace-bootstrap tax up front.
# - Drift is the real risk. Fix with this script + check-agent-shared-sync.sh
#   (which diffs the two trees and fails CI if they're out of step).
#
# Invoked by `npm run sync:shared` from inside agent/. Safe to re-run — it's
# a plain `cp -r` overwrite, no state kept between invocations.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_ROUTES="$ROOT_DIR/server/src/routes"
SRC_LIB="$ROOT_DIR/server/src/lib"
DST_ROUTES="$ROOT_DIR/agent/src/shared/routes"
DST_LIB="$ROOT_DIR/agent/src/shared/lib"

# Only the 4 local-touching routes go into the agent. Cloud / dual-track
# routes stay server-side (memory, chats, projects, connectors, artifacts,
# usage, chat) — they have Vercel serverless equivalents and don't belong
# on a per-user Mac.
LOCAL_ROUTES=(claudeChat.ts project.ts session.ts reaper.ts)

# Lib files the 4 routes transitively need. Regenerate this list if a new
# route is promoted to "local" or if server/src/lib grows a new helper a
# local route pulls in.
SHARED_LIB=(claudeCode.ts git.ts project.ts reaper.ts paths.ts referenceDirs.ts sessionCopy.ts usageLog.ts)

mkdir -p "$DST_ROUTES" "$DST_LIB"

# Overwrite — drift-check is the safety net; we don't try to be clever about
# preserving local edits. If you edited the agent copy, commit it on server
# side first so sync propagates correctly.
echo "[sync] routes → $DST_ROUTES"
for f in "${LOCAL_ROUTES[@]}"; do
  cp "$SRC_ROUTES/$f" "$DST_ROUTES/$f"
  echo "  $f"
done

echo "[sync] lib → $DST_LIB"
for f in "${SHARED_LIB[@]}"; do
  cp "$SRC_LIB/$f" "$DST_LIB/$f"
  echo "  $f"
done

echo "[sync] done"
