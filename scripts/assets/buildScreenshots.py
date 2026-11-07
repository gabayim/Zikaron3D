#!/usr/bin/env python3
"""
Builds App Store screenshots for Zikaron3D.

  python scripts/assets/buildScreenshots.py --templates
      Branded frames with an empty device area (exact Apple sizes) so the design
      can be reviewed before real captures exist.

  python scripts/assets/buildScreenshots.py
      Composites REAL screenshots from assets/store/screenshots/source/ into the
      frames and writes assets/store/screenshots/final/.

Source files (any PNG size, portrait):
  iphone-1.png ... iphone-6.png     captured on a 6.9" iPhone
  ipad-1.png   ... ipad-4.png       captured on a 13" iPad

Apple rejects invented gameplay (guideline 2.3), so these frames only decorate
real device captures.
"""
from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "assets", "store", "screenshots")
A = lambda *p: os.path.join(ROOT, "assets", *p)

GOLD = (255, 211, 110)
WHITE = (255, 255, 255)
FONT_DIR = r"C:\Windows\Fonts"

CAPTIONS = [
    ("iphone", "Seven worlds\nto explore", "meadow"),
    ("iphone", "A kid-safe mode\nfor ages 4-7", "candy"),
    ("iphone", "Merge, chain and\nclimb the ladder", "crystal"),
    ("iphone", "A new weekly\narcade league", "circuit"),
    ("iphone", "Collect and dress up\nfifteen critters", "grove"),
    ("iphone", "Grown-up check\nbefore every purchase", "deep_sea"),
    ("ipad", "Seven worlds\nto explore", "meadow"),
    ("ipad", "A kid-safe mode\nfor ages 4-7", "candy"),
    ("ipad", "Merge, chain and\nclimb the ladder", "crystal"),
    ("ipad", "A new weekly\narcade league", "circuit"),
]

SIZES = {"iphone": (1320, 2868), "ipad": (2064, 2752)}


def font(names, size):
    for name in names:
        path = os.path.join(FONT_DIR, name)
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def headline(size):
    return font(["segoeuibl.ttf", "ariblk.ttf", "seguibl.ttf"], size)


def backdrop(world, size):
    W, H = size
    still = Image.open(A("worlds", world, "still.webp")).convert("RGB")
    scale = max(W / still.width, H / still.height)
    still = still.resize((int(still.width * scale) + 1, int(still.height * scale) + 1), Image.LANCZOS)
    left = (still.width - W) // 2
    top = int((still.height - H) * 0.35)
    card = still.crop((left, top, left + W, top + H)).convert("RGB")

    arr = np.asarray(card).astype(np.float32)
    veil = np.array([18, 8, 52], dtype=np.float32)
    arr = arr * 0.55 + veil * 0.45
    card = Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGB").convert("RGBA")

    yy, xx = np.mgrid[0:H, 0:W]
    glow = np.clip(
        1.0 - np.sqrt(((xx - W * 0.5) / (W * 0.9)) ** 2 + ((yy - H * 0.35) / (H * 0.9)) ** 2), 0, 1
    ) ** 2
    tint = Image.new("RGBA", size, (236, 72, 153, 255))
    tint.putalpha(Image.fromarray((glow * 90).astype(np.uint8), "L"))
    card.alpha_composite(tint)
    return card


def draw_caption(card, device, caption):
    W, _ = card.size
    f = headline(112 if device == "iphone" else 148)
    draw = ImageDraw.Draw(card)
    y = 150 if device == "iphone" else 170
    for line in caption.split("\n"):
        x = (W - draw.textlength(line, font=f)) / 2
        draw.text((x, y + 6), line, font=f, fill=(0, 0, 0, 120))
        draw.text((x, y), line, font=f, fill=WHITE)
        y += int(f.size * 1.16)
    return card


def screen_rect(device, size):
    W, H = size
    if device == "iphone":
        sw = int(W * 0.742)
        sh = int(sw * 2796 / 1290)
    else:
        sw = int(W * 0.727)
        sh = int(sw * 2752 / 2064)
    return ((W - sw) // 2, H - sh - 8, sw, sh)


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, img.size[0] - 1, img.size[1] - 1), radius=radius, fill=255
    )
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def place_screen(card, device, shot_path):
    x, y, w, h = screen_rect(device, card.size)
    radius = int(w * 0.085)
    if shot_path and os.path.exists(shot_path):
        shot = Image.open(shot_path).convert("RGBA")
        scale = max(w / shot.width, h / shot.height)
        shot = shot.resize((int(shot.width * scale) + 1, int(shot.height * scale) + 1), Image.LANCZOS)
        left = (shot.width - w) // 2
        screen = rounded(shot.crop((left, 0, left + w, h)), radius)
    else:
        screen = Image.new("RGBA", (w, h), (24, 12, 54, 210))
        d = ImageDraw.Draw(screen)
        d.rounded_rectangle((6, 6, w - 7, h - 7), radius=radius, outline=(255, 211, 110, 190), width=5)
        f = font(["seguibl.ttf"], int(w * 0.045))
        yy = h // 2 - int(w * 0.05)
        for line in ("DROP THE REAL", "SCREENSHOT HERE"):
            d.text(((w - d.textlength(line, font=f)) / 2, yy), line, font=f, fill=(255, 211, 110, 230))
            yy += int(f.size * 1.3)
        screen = rounded(screen, radius)

    # shadow: a rounded sprite pasted at an offset, blurred on the full canvas
    shadow_layer = Image.new("RGBA", card.size, (0, 0, 0, 0))
    shadow_layer.paste(rounded(Image.new("RGBA", (w, h), (0, 0, 0, 175)), radius), (x, y + 12))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(26))
    card.alpha_composite(shadow_layer)
    card.alpha_composite(screen, (x, y))
    ImageDraw.Draw(card).rounded_rectangle(
        (x, y, x + w - 1, y + h - 1), radius=radius, outline=(255, 255, 255, 40), width=4
    )
    return card


def build(device, caption, world, shot=None):
    card = backdrop(world, SIZES[device])
    card = draw_caption(card, device, caption)
    card = place_screen(card, device, shot)
    return card.convert("RGB")


def main():
    templates = "--templates" in sys.argv
    source = os.path.join(OUT, "source")
    target = os.path.join(OUT, "templates" if templates else "final")
    os.makedirs(target, exist_ok=True)
    os.makedirs(source, exist_ok=True)

    made = 0
    for index, (device, caption, world) in enumerate(CAPTIONS, start=1):
        number = index if device == "iphone" else index - 6
        shot = None if templates else os.path.join(source, f"{device}-{number}.png")
        if not templates and not os.path.exists(shot):
            print(f"  skip {device}-{number}.png (no capture in source/)")
            continue
        card = build(device, caption, world, shot)
        name = f"{device}-{number}.png"
        card.save(os.path.join(target, name), "PNG", optimize=True)
        print(f"  wrote {'templates' if templates else 'final'}/{name}  {card.size[0]}x{card.size[1]}")
        made += 1

    print(f"{made} image(s) written to {os.path.relpath(target, ROOT)}")
    if not templates and made == 0:
        print("\nNo captures found. Put real screenshots in assets/store/screenshots/source/ first,")
        print("or run with --templates to review the frame design.")


if __name__ == "__main__":
    main()

