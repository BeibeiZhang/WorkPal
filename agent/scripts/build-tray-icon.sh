#!/usr/bin/env bash
# Rasterize agent/build/TrayIcon.svg into template PNGs for the macOS menu bar.
#
# Template image rules: only the alpha channel matters visually (macOS renders
# opaque pixels in the current menu-bar color — black in light mode, white in
# dark, system-blue when a menu is open). We still stamp RGB to pure #000000
# before rasterizing so the on-disk PNG is unambiguous.
#
# Source assumption: TrayIcon.svg is a monochrome mark (single color fill).
# If the designer hands over a multi-fill SVG later, extend the sed below or
# switch to a real SVG rewriter.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BUILD="$HERE/../build"
ASSETS="$HERE/../assets"
SVG="$BUILD/TrayIcon.svg"

if [[ ! -f "$SVG" ]]; then
  echo "error: $SVG not found" >&2
  exit 1
fi

command -v sips >/dev/null || { echo "error: sips not found (macOS only)" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Stamp every fill color to pure black — template images want RGB=0 on all
# opaque pixels so the system's color context takes over unambiguously.
sed -E 's/fill="#[0-9A-Fa-f]{3,8}"/fill="#000000"/g' "$SVG" > "$TMP/black.svg"

mkdir -p "$ASSETS"
for spec in "16 menuIconTemplate.png" "32 menuIconTemplate@2x.png"; do
  size="${spec%% *}"
  name="${spec##* }"
  sips -s format png -z "$size" "$size" "$TMP/black.svg" --out "$ASSETS/$name" >/dev/null
  echo "wrote $name ($(file "$ASSETS/$name" | cut -d: -f2-))"
done
