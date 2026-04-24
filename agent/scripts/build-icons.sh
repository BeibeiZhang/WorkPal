#!/usr/bin/env bash
# Regenerate menu-bar template PNGs from scripts/build-icons.py.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
python3 "$HERE/build-icons.py"
