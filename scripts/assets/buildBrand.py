#!/usr/bin/env python3
"""
Builds every brand asset for Zikaron3D from the real game art:

  assets/icon.png                   1024x1024 RGB  (App Store icon, no alpha)
  assets/splash-icon.png            1024x1024 RGBA (transparent mark)
  assets/favicon.png                48x48 RGBA
  assets/android-icon-foreground.png  512x512 RGBA (66% safe zone)
  assets/android-icon-background.png  512x512 RGB
  assets/android-icon-monochrome.png  512x512 RGBA (white silhouette)
  assets/brand/logo-dark.png        1600x420 RGBA (for dark backgrounds)
  assets/brand/logo-light.png       1600x420 RGBA (for light backgrounds)
  assets/brand/og-image.png         1200x630 RGB  (social/store share card)
  public-site/logo-dark.png, public-site/og-image.png, public-site/favicon.png

    python scripts/assets/buildBrand.py

The character comes from assets/raw/pip/master_a.png (transparent master), so the
icon is real game art, not a placeholder.
"""
from __future__ import annotations

import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = lambda *p: os.path.join(ROOT, "assets", *p)

INK = (18, 8, 51)
DEEP = (26, 11, 61)
VIOLET = (86, 33, 150)
MAGENTA = (236, 72, 153)
GOLD = (255, 211, 110)
SKY = (56, 189, 248)
WHITE = (255, 255, 255)

FONT_DIR = r"C:\Windows\Fonts"
DISPLAY_FONTS = ["BAUHS93.TTF", "ariblk.ttf", "seguibl.ttf"]
BODY_FONTS = ["seguibl.ttf", "segoeuib.ttf", "ariblk.ttf"]


def font(names, size):
    for name in names:
        path = os.path.join(FONT_DIR, name)
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def vertical_gradient(size, top, bottom):
    w, h = size
    ramp = np.linspace(0.0, 1.0, h)[:, None]
    arr = np.zeros((h, w, 3), dtype=np.float32)
    for c in range(3):
        arr[:, :, c] = top[c] + (bottom[c] - top[c]) * ramp
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def radial_glow(size, color, radius_scale=1.0, strength=1.0):
    """Transparent RGBA layer with a soft radial light in `color`."""
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w / 2.0, h / 2.0
    r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / (min(w, h) * 0.5 * radius_scale)
    falloff = np.clip(1.0 - r, 0.0, 1.0) ** 2.2 * strength
    alpha = (falloff * 255).astype(np.uint8)
    layer = np.zeros((h, w, 4), dtype=np.uint8)
    layer[:, :, 0], layer[:, :, 1], layer[:, :, 2] = color
    layer[:, :, 3] = alpha
    return Image.fromarray(layer, "RGBA")


def stars(size, count=70, seed=7):
    w, h = size
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    rng = random.Random(seed)
    for _ in range(count):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(1.2, 3.6) * (w / 1024.0)
        a = int(rng.uniform(35, 130))
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, a))
    return layer


def load_character():
    """Pip master with transparency, trimmed to its alpha bbox."""
    im = Image.open(A("raw", "pip", "master_a.png")).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    return im


def with_shadow(base, sprite, center, scale_h, shadow=(0, 0, 0, 110), blur=26, offset=(0, 26)):
    """Paste `sprite` scaled to `scale_h` px tall at `center`, with a soft shadow."""
    ratio = scale_h / sprite.height
    w, h = int(sprite.width * ratio), int(sprite.height * ratio)
    art = sprite.resize((w, h), Image.LANCZOS)
    shadow_layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    silhouette = Image.new("RGBA", (w, h), shadow[:3] + (0,))
    silhouette.putalpha(art.getchannel("A").point(lambda v: int(v * shadow[3] / 255)))
    shadow_layer.paste(silhouette, (int(center[0] - w / 2 + offset[0]), int(center[1] - h / 2 + offset[1])), silhouette)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(blur))
    out = base.convert("RGBA")
    out.alpha_composite(shadow_layer)
    out.alpha_composite(art, (int(center[0] - w / 2), int(center[1] - h / 2)))
    return out



def vignette(img, strength=0.55):
    size = img.size
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).ellipse(
        (-size[0] * 0.12, -size[1] * 0.12, size[0] * 1.12, size[1] * 1.12), fill=255
    )
    mask = mask.filter(ImageFilter.GaussianBlur(min(size) * 0.07))
    edge = Image.eval(mask, lambda v: int((255 - v) * strength))
    dark = Image.new("RGBA", size, (6, 2, 20, 255))
    dark.putalpha(edge)
    out = img.convert("RGBA")
    out.alpha_composite(dark)
    return out


def brand_background(size, glow_strength=0.55):
    bg = vertical_gradient(size, (44, 20, 92), (12, 6, 34)).convert("RGBA")
    bg.alpha_composite(radial_glow(size, MAGENTA, radius_scale=1.35, strength=glow_strength))
    bg.alpha_composite(radial_glow(size, SKY, radius_scale=1.95, strength=0.22))
    bg.alpha_composite(stars(size, count=70, seed=11))
    return bg


def build_icon(size=1024):
    bg = brand_background((size, size))
    bg.alpha_composite(radial_glow((size, size), GOLD, radius_scale=0.85, strength=0.30))
    art = with_shadow(
        bg,
        load_character(),
        (size * 0.5, size * 0.545),
        size * 0.70,
        shadow=(0, 0, 0, 150),
        blur=int(size * 0.032),
        offset=(0, int(size * 0.028)),
    )
    return vignette(art, 0.5).convert("RGB")


def build_splash(size=1024):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(radial_glow((size, size), MAGENTA, radius_scale=0.95, strength=0.30))
    return with_shadow(
        canvas,
        load_character(),
        (size * 0.5, size * 0.5),
        size * 0.62,
        shadow=(0, 0, 0, 90),
        blur=int(size * 0.03),
        offset=(0, int(size * 0.02)),
    )


def build_adaptive():
    size = 512
    safe = 0.66  # Android adaptive-icon safe zone
    foreground = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    foreground = with_shadow(
        foreground,
        load_character(),
        (size * 0.5, size * 0.52),
        size * safe * 0.86,
        shadow=(0, 0, 0, 120),
        blur=10,
        offset=(0, 8),
    )
    background = brand_background((size, size), glow_strength=0.5).convert("RGB")

    mono = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    char = load_character()
    ratio = (size * safe * 0.86) / char.height
    w, h = int(char.width * ratio), int(char.height * ratio)
    sil = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    sil.putalpha(char.resize((w, h), Image.LANCZOS).getchannel("A"))
    mono.alpha_composite(sil, (int(size * 0.5 - w / 2), int(size * 0.52 - h / 2)))
    return foreground, background, mono


def gradient_text(text, font_obj, top_color, bottom_color, stroke=0, stroke_color=INK):
    probe = ImageDraw.Draw(Image.new("L", (8, 8)))
    box = probe.textbbox((0, 0), text, font=font_obj, stroke_width=stroke)
    w, h = max(1, box[2] - box[0] + stroke * 2), max(1, box[3] - box[1] + stroke * 2)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    if stroke:
        ImageDraw.Draw(layer).text(
            (-box[0] + stroke, -box[1] + stroke), text, font=font_obj, fill=stroke_color, stroke_width=stroke, stroke_fill=stroke_color
        )
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).text((-box[0] + stroke, -box[1] + stroke), text, font=font_obj, fill=255)
    fill = vertical_gradient((w, h), top_color, bottom_color).convert("RGBA")
    fill.putalpha(mask)
    layer.alpha_composite(fill)
    return layer


def tracked_text(draw, xy, text, font_obj, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font_obj, fill=fill)
        x += draw.textlength(ch, font=font_obj) + tracking


def build_logo(dark_bg=True):
    W, H = 1600, 420
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    char = load_character()
    target_h = 300
    ratio = target_h / char.height
    art = char.resize((int(char.width * ratio), target_h), Image.LANCZOS)
    canvas.alpha_composite(art, (60, int(H / 2 - target_h / 2) + 10))

    word = "ZIKARON3D"
    f_word = font(DISPLAY_FONTS, 172)
    top, bottom = (GOLD, MAGENTA) if dark_bg else ((90, 40, 160), (198, 60, 150))
    title = gradient_text(word, f_word, top, bottom, stroke=10, stroke_color=INK if dark_bg else (255, 255, 255))
    canvas.alpha_composite(title, (art.width + 96, 52))

    f_tag = font(BODY_FONTS, 46)
    tag_color = (201, 181, 255, 255) if dark_bg else (91, 75, 138, 255)
    tracked_text(ImageDraw.Draw(canvas), (art.width + 104, 268), "MEMORY  ARCADE", f_tag, tag_color, 9)
    return canvas


def build_og():
    W, H = 1200, 630
    still = Image.open(A("worlds", "candy", "still.webp")).convert("RGB")
    scale = max(W / still.width, H / still.height)
    still = still.resize((int(still.width * scale), int(still.height * scale)), Image.LANCZOS)
    left = (still.width - W) // 2
    top = (still.height - H) // 3
    card = still.crop((left, top, left + W, top + H)).convert("RGBA")

    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = shade.load()
    for x in range(W):
        a = int(215 * max(0.0, 1.0 - x / (W * 0.85)))
        for y in range(0, H):
            px[x, y] = (10, 4, 30, a)
    card.alpha_composite(shade)
    card.alpha_composite(vignette(card, 0.35))

    logo = build_logo(dark_bg=True).resize((760, 200), Image.LANCZOS)
    card.alpha_composite(logo, (70, 120))

    draw = ImageDraw.Draw(card)
    f_head = font(BODY_FONTS, 44)
    tracked_text(draw, (76, 350), "SEVEN WORLDS. SEVEN MEMORY GAMES.", f_head, (255, 240, 214, 255), 2)
    tracked_text(draw, (76, 404), "ONE KID-SAFE MODE.", f_head, (255, 240, 214, 255), 2)
    f_small = font(BODY_FONTS, 30)
    tracked_text(draw, (76, 500), "iPHONE  •  iPAD  •  NO ADS  •  PLAYS OFFLINE", f_small, (201, 181, 255, 255), 3)
    return card.convert("RGB")


def save(img, *path, **kwargs):
    full = os.path.join(ROOT, *path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    img.save(full, "PNG", optimize=True, **kwargs)
    print(f"  wrote {os.path.relpath(full, ROOT).replace(chr(92), '/')}  {img.size[0]}x{img.size[1]} {img.mode}")


def main():
    print("Zikaron3D brand assets")
    icon = build_icon(1024)
    save(icon, "assets", "icon.png")
    save(build_splash(1024), "assets", "splash-icon.png")
    fg, bg, mono = build_adaptive()
    save(fg, "assets", "android-icon-foreground.png")
    save(bg, "assets", "android-icon-background.png")
    save(mono, "assets", "android-icon-monochrome.png")
    save(icon.resize((48, 48), Image.LANCZOS), "assets", "favicon.png")
    save(icon.resize((64, 64), Image.LANCZOS), "public-site", "favicon.png")
    dark = build_logo(True)
    save(dark, "assets", "brand", "logo-dark.png")
    save(dark, "public-site", "logo-dark.png")
    save(build_logo(False), "assets", "brand", "logo-light.png")
    og = build_og()
    save(og, "assets", "brand", "og-image.png")
    save(og, "public-site", "og-image.png")
    print("done")


if __name__ == "__main__":
    main()
