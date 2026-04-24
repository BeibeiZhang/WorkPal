#!/usr/bin/env bash
# Rasterize agent/build/AppIcon.svg into the 10-file .iconset layout macOS
# requires, then pack with iconutil into agent/build/icon.icns.
#
# Edit AppIcon.svg to update the Finder / Dock / Applications icon; rerun.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BUILD="$HERE/../build"
SVG="$BUILD/AppIcon.svg"
ISET="$BUILD/AppIcon.iconset"
OUT="$BUILD/icon.icns"

if [[ ! -f "$SVG" ]]; then
  echo "error: $SVG not found. Drop your square brand SVG there and retry." >&2
  exit 1
fi

command -v sips >/dev/null || { echo "error: sips not found (macOS only)" >&2; exit 1; }
command -v iconutil >/dev/null || { echo "error: iconutil not found (macOS only)" >&2; exit 1; }

rm -rf "$ISET"
mkdir -p "$ISET"

# Rasterize each unique pixel size once.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
for size in 16 32 64 128 256 512 1024; do
  sips -s format png -z "$size" "$size" "$SVG" --out "$TMP/$size.png" >/dev/null
done

# Map unique sizes to the 10-file iconset layout.
cp "$TMP/16.png"   "$ISET/icon_16x16.png"
cp "$TMP/32.png"   "$ISET/icon_16x16@2x.png"
cp "$TMP/32.png"   "$ISET/icon_32x32.png"
cp "$TMP/64.png"   "$ISET/icon_32x32@2x.png"
cp "$TMP/128.png"  "$ISET/icon_128x128.png"
cp "$TMP/256.png"  "$ISET/icon_128x128@2x.png"
cp "$TMP/256.png"  "$ISET/icon_256x256.png"
cp "$TMP/512.png"  "$ISET/icon_256x256@2x.png"
cp "$TMP/512.png"  "$ISET/icon_512x512.png"
cp "$TMP/1024.png" "$ISET/icon_512x512@2x.png"

iconutil -c icns "$ISET" -o "$OUT"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
file "$OUT"
