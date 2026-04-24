#!/usr/bin/env bash
# Regenerate both icon sets in one shot:
#   • menu-bar template PNGs   (parametric, via build-icons.py)
#   • app bundle .icns          (from build/AppIcon.svg, via build-app-icon.sh)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
python3 "$HERE/build-icons.py"
"$HERE/build-app-icon.sh"
