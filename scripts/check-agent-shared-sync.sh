#!/usr/bin/env bash
# check-agent-shared-sync.sh — fail if agent/src/shared/ drifted from
# server/src/{routes,lib}/.
#
# Runs a `diff -r` of the source and copy directories, limited to the exact
# files sync-agent-shared.sh maintains. Exit 0 iff every pair matches byte-
# for-byte. Not perfect against accidental additions to server/src/routes
# (those won't trip the check since we only diff the whitelisted files) —
# but the whitelist is also in sync-agent-shared.sh, so adding a new shared
# file requires editing both scripts deliberately.
#
# Intended uses:
#   - Local: `npm --prefix agent run check:shared-drift` before committing
#     a change that touched server/src/{routes,lib}/.
#   - CI (future): wire into GitHub Actions once .github/workflows/ exists.
#     No network / no install needed — pure file compare.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_ROUTES="$ROOT_DIR/server/src/routes"
SRC_LIB="$ROOT_DIR/server/src/lib"
DST_ROUTES="$ROOT_DIR/agent/src/shared/routes"
DST_LIB="$ROOT_DIR/agent/src/shared/lib"

LOCAL_ROUTES=(claudeChat.ts project.ts session.ts reaper.ts)
SHARED_LIB=(claudeCode.ts git.ts project.ts reaper.ts paths.ts referenceDirs.ts sessionCopy.ts usageLog.ts)

drift=0
for f in "${LOCAL_ROUTES[@]}"; do
  if ! diff -q "$SRC_ROUTES/$f" "$DST_ROUTES/$f" >/dev/null 2>&1; then
    echo "DRIFT: routes/$f"
    drift=1
  fi
done
for f in "${SHARED_LIB[@]}"; do
  if ! diff -q "$SRC_LIB/$f" "$DST_LIB/$f" >/dev/null 2>&1; then
    echo "DRIFT: lib/$f"
    drift=1
  fi
done

if [ "$drift" -eq 1 ]; then
  echo ""
  echo "Agent shared/ is out of sync with server/src/{routes,lib}/."
  echo "Run: npm --prefix agent run sync:shared"
  exit 1
fi

echo "[check] agent shared/ in sync with server/src/"
