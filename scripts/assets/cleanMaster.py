#!/usr/bin/env python3
"""Normalises a character master generated on flat chroma green.

Mattes the character (shared matte from buildSprites), crops to its bounding box, scales it to a fixed size and
re-composites it centred on pure green, so every character has the same scale for video generation and for the
shared sprite crop.

Usage: cleanMaster.py <master.png> <green.png> [--size 680]
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from buildSprites import matte  # noqa: E402

CANVAS = 1024


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("master")
    ap.add_argument("green")
    ap.add_argument("--size", type=int, default=680)
    args = ap.parse_args()

    src = Image.open(args.master).convert("RGB")
    cut = matte(src)
    bbox = cut.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
    if not bbox:
        raise SystemExit("no character found in master")
    cut = cut.crop(bbox)
    scale = args.size / max(cut.size)
    cut = cut.resize((round(cut.width * scale), round(cut.height * scale)), Image.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 255, 0, 255))
    x = (CANVAS - cut.width) // 2
    y = (CANVAS - cut.height) // 2 + 40
    canvas.alpha_composite(cut, (x, y))
    canvas.convert("RGB").save(args.green)


if __name__ == "__main__":
    main()
