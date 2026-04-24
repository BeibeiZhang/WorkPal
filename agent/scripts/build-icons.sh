#!/usr/bin/env bash
# Regenerate both icon sets in one shot:
#   • menu-bar template PNGs  (from build/TrayIcon.svg, via build-tray-icon.sh)
#   • app bundle .icns        (from build/AppIcon.svg, via build-app-icon.sh)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
"$HERE/build-tray-icon.sh"
"$HERE/build-app-icon.sh"
