#!/usr/bin/env bash
# check-design-system-skill-sync.sh — fail if the personal skill copy at
# ~/.claude/skills/workpal-design-system/ has drifted from this repo's
# design-system files.
#
# Mirror of sync-design-system-skill.sh — same file list, opposite direction
# (compare instead of copy). Run before pushing to verify the auto-sync hook
# actually fired; useful as a guardrail since the hook is local-only.
#
# Exit 0 iff every pair matches byte-for-byte. If the skill isn't installed
# on this machine, exit 0 silently (no skill = nothing to drift against).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_DIR="$HOME/.claude/skills/workpal-design-system"

if [ ! -d "$SKILL_DIR" ]; then
  exit 0
fi

PAIRS=(
  "DESIGN_SYSTEM.md|$SKILL_DIR/DESIGN_SYSTEM.md"
  "src/index.css|$SKILL_DIR/assets/index.css"
  "src/components/shared.tsx|$SKILL_DIR/assets/shared.tsx"
  "tailwind.config.js|$SKILL_DIR/assets/tailwind.config.js"
)

drift=0
for pair in "${PAIRS[@]}"; do
  src="${pair%%|*}"
  dst="${pair##*|}"
  if ! diff -q "$ROOT_DIR/$src" "$dst" >/dev/null 2>&1; then
    echo "DRIFT: $src"
    drift=1
  fi
done

if [ "$drift" -eq 1 ]; then
  echo ""
  echo "Design-system skill is out of sync with this repo."
  echo "Run: npm run sync:skill"
  exit 1
fi

echo "[check-skill] design-system skill in sync"
