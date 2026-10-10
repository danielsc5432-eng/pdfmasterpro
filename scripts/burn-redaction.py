#!/usr/bin/env python3
import sys
from PIL import Image, ImageDraw

if len(sys.argv) != 9:
    raise SystemExit("usage: burn-redaction.py input output x y width height page_height dpi")
source, target = sys.argv[1], sys.argv[2]
x, y, width, height, page_height, dpi = map(float, sys.argv[3:])
scale = dpi / 72.0
image = Image.open(source).convert("RGB")
left = max(0, int(x * scale))
top = max(0, int((page_height - y - height) * scale))
right = min(image.width, int((x + width) * scale))
bottom = min(image.height, int((page_height - y) * scale))
if right <= left or bottom <= top:
    raise SystemExit("redaction rectangle is outside the page")
ImageDraw.Draw(image).rectangle((left, top, right, bottom), fill=(0, 0, 0))
image.save(target, format="PNG")
