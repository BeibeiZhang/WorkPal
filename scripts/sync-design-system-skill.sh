#!/usr/bin/env bash
# sync-design-system-skill.sh — copy WorkPal design-system files into the
# personal Claude Code Skill at ~/.claude/skills/workpal-design-system/.
#
# Why: the skill ships as plain copies (not symlinks) so it stays portable
# across machines / Claude Code installs. Whenever DESIGN_SYSTEM.md or any
# of the three "materialized" files (src/index.css, src/components/shared.tsx,
# tailwind.config.js) change in this repo, the skill's copies need to be
# refreshed or any OTHER project on this machine that invokes the skill
# will get stale tokens / components.
#
# Triggered automatically by .git/hooks/{post-commit,post-merge,post-rewrite}
# — those hooks are local to each clone (not checked in) because the skill
# destination path is personal-machine specific. Also runnable manually as
# `npm run sync:skill`.
#
# Safe to re-run: plain `cp` overwrite, no state. If the skill directory
# doesn't exist (e.g. someone else cloned this repo without installing the
# skill), the script exits 0 silently — hooks don't break.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_DIR="$HOME/.claude/skills/workpal-design-system"

if [ ! -d "$SKILL_DIR" ]; then
  # Skill not installed on this machine — silent skip so the hook doesn't
  # spam every contributor's terminal with errors.
  exit 0
fi

# source-relative-path | destination-absolute-path
PAIRS=(
  "DESIGN_SYSTEM.md|$SKILL_DIR/DESIGN_SYSTEM.md"
  "src/index.css|$SKILL_DIR/assets/index.css"
  "src/components/shared.tsx|$SKILL_DIR/assets/shared.tsx"
  "tailwind.config.js|$SKILL_DIR/assets/tailwind.config.js"
)

mkdir -p "$SKILL_DIR/assets"

echo "[sync-skill] $SKILL_DIR"
for pair in "${PAIRS[@]}"; do
  src="${pair%%|*}"
  dst="${pair##*|}"
  if [ ! -f "$ROOT_DIR/$src" ]; then
    echo "[sync-skill] missing source: $src — aborting" >&2
    exit 1
  fi
  cp "$ROOT_DIR/$src" "$dst"
  echo "  $src"
done

echo "[sync-skill] done"
