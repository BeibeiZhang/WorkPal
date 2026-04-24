#!/usr/bin/env python3
"""
Generate menu-bar template PNGs for WorkPal Agent.

Template images on macOS must be pure black with alpha — the system handles
dark-mode inversion and active-state coloring. A rough v0 is fine; iterate
later if the shape doesn't read well at 16x16.

Shape: a chat bubble silhouette (rounded square + triangular tail at bottom-left).

Outputs:
  assets/menuIconTemplate.png    (16x16)
  assets/menuIconTemplate@2x.png (32x32)

Uses Python stdlib only (zlib + struct) — no PIL dependency.
"""
from __future__ import annotations

import os
import struct
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "assets"


def bubble_mask(size: int) -> list[list[int]]:
    """Return a size x size mask (1 = filled, 0 = transparent) of a chat bubble."""
    mask = [[0] * size for _ in range(size)]
    # Body: rounded rect occupying rows [pad_y .. size - pad_y - tail] roughly.
    # Scale paddings by size so 16 and 32 versions match.
    s = size
    pad_x = max(1, s * 2 // 16)        # left/right padding
    pad_top = max(1, s * 2 // 16)      # top padding
    body_bottom = s - max(2, s * 4 // 16)  # leaves room for tail below
    radius = max(2, s * 4 // 16)

    left, right = pad_x, s - pad_x - 1
    top, bottom = pad_top, body_bottom
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            # Rounded corners via distance-to-corner check.
            in_corner = False
            if x < left + radius and y < top + radius:
                cx, cy = left + radius, top + radius
                in_corner = (cx - x) ** 2 + (cy - y) ** 2 > radius * radius
            elif x > right - radius and y < top + radius:
                cx, cy = right - radius, top + radius
                in_corner = (cx - x) ** 2 + (cy - y) ** 2 > radius * radius
            elif x < left + radius and y > bottom - radius:
                cx, cy = left + radius, bottom - radius
                in_corner = (cx - x) ** 2 + (cy - y) ** 2 > radius * radius
            elif x > right - radius and y > bottom - radius:
                cx, cy = right - radius, bottom - radius
                in_corner = (cx - x) ** 2 + (cy - y) ** 2 > radius * radius
            if not in_corner:
                mask[y][x] = 1

    # Tail: triangle hanging from the bottom-left portion of the body.
    # Apex points down-left. Width and height scale with size.
    tail_h = max(2, s * 3 // 16)
    tail_start_x = left + max(1, s * 2 // 16)
    tail_end_x = tail_start_x + max(3, s * 4 // 16)
    for i in range(tail_h):
        y = bottom + 1 + i
        if y >= s:
            break
        # Taper: at each step down, the right edge moves left.
        x_right = tail_end_x - i
        x_left = tail_start_x
        if x_right < x_left:
            break
        for x in range(x_left, x_right + 1):
            if 0 <= x < s and 0 <= y < s:
                mask[y][x] = 1

    return mask


def mask_to_rgba_bytes(mask: list[list[int]]) -> bytes:
    """Serialize mask as raw RGBA scanlines prefixed with filter byte (0)."""
    size = len(mask)
    scanlines = bytearray()
    for y in range(size):
        scanlines.append(0)  # no filter
        row = mask[y]
        for x in range(size):
            if row[x]:
                scanlines.extend(b"\x00\x00\x00\xff")  # opaque black
            else:
                scanlines.extend(b"\x00\x00\x00\x00")  # transparent
    return bytes(scanlines)


def png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path: Path, mask: list[list[int]]) -> None:
    size = len(mask)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(
        ">IIBBBBB",
        size,       # width
        size,       # height
        8,          # bit depth
        6,          # color type: RGBA
        0, 0, 0,    # compression, filter, interlace (all default)
    )
    idat = zlib.compress(mask_to_rgba_bytes(mask), 9)
    blob = sig + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", idat) + png_chunk(b"IEND", b"")
    path.write_bytes(blob)


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    for size, filename in [(16, "menuIconTemplate.png"), (32, "menuIconTemplate@2x.png")]:
        mask = bubble_mask(size)
        write_png(ASSETS / filename, mask)
        filled = sum(sum(row) for row in mask)
        print(f"wrote {filename}: {size}x{size}, {filled} filled pixels")


if __name__ == "__main__":
    main()
