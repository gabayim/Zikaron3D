#!/usr/bin/env python3
"""
buildRealScreenshots.py
Builds professional, high-converting App Store screenshots for Zikaron3D using
the real in-game screenshots captured by the user.

Outputs:
  assets/store/screenshots/final/iphone-1.png ... iphone-5.png  (1320 x 2868)
  assets/store/screenshots/final/ipad-1.png   ... ipad-5.png    (2064 x 2752)
"""

import math
import os
import sys
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FINAL_DIR = os.path.join(ROOT, "assets", "store", "screenshots", "final")
os.makedirs(FINAL_DIR, exist_ok=True)

A = lambda *p: os.path.join(ROOT, "assets", *p)

FONT_DIRS = [
    "/System/Library/Fonts/Supplemental",
    "/System/Library/Fonts",
    "/Library/Fonts",
]

def get_font(names, size):
    for d in FONT_DIRS:
        for name in names:
            p = os.path.join(d, name)
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, size)
                except OSError:
                    continue
    return ImageFont.load_default()

def bold_font(size):
    return get_font(["Arial Rounded Bold.ttf", "Arial Black.ttf", "HelveticaNeue-Bold.otf", "HelveticaNeue.ttc"], size)

def med_font(size):
    return get_font(["Arial Rounded Bold.ttf", "Arial Bold.ttf", "HelveticaNeue-Medium.otf"], size)

def draw_star(draw, cx, cy, r_outer, r_inner, fill):
    points = []
    for i in range(10):
        r = r_outer if i % 2 == 0 else r_inner
        angle = i * math.pi / 5 - math.pi / 2
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    draw.polygon(points, fill=fill)

CARDS_CONFIG = [
    {
        "id": "meadow",
        "path": "/Users/erezg/.gemini/antigravity/brain/7c1c396a-d6ed-4359-9ec2-d4a6d6a71f39/.user_uploaded/media_1794074126791_2a9640ff.png",
        "crop": (23, 14, 297, 608),
        "badge": "16 ANIMATED COMPANIONS",
        "title": "MEET THE CRITTERS",
        "subtitle": "Pop & match adorable 3D critters across lush meadows",
        "accent": (251, 191, 36),     # Gold/Amber
        "tint": (245, 158, 11),
    },
    {
        "id": "candy",
        "path": "/Users/erezg/.gemini/antigravity/brain/7c1c396a-d6ed-4359-9ec2-d4a6d6a71f39/.user_uploaded/media_1794074126775_af644891.png",
        "crop": (18, 16, 312, 654),
        "badge": "RELAXING ZEN ARCADE",
        "title": "CATCH FALLING STARS",
        "subtitle": "Glide across pastel rainbows in dreamy candy skies",
        "accent": (244, 114, 182),    # Pastel Pink
        "tint": (236, 72, 153),
    },
    {
        "id": "circuit",
        "path": "/Users/erezg/.gemini/antigravity/brain/7c1c396a-d6ed-4359-9ec2-d4a6d6a71f39/.user_uploaded/media_1794074126770_a831425e.png",
        "crop": (20, 15, 314, 653),
        "badge": "FAST-PACED RHYTHM ARCADE",
        "title": "FEEL THE RHYTHM",
        "subtitle": "Tap the cosmic beat & test your reaction speed",
        "accent": (56, 189, 248),     # Electric Cyan
        "tint": (14, 165, 233),
    },
    {
        "id": "grove",
        "path": "/Users/erezg/.gemini/antigravity/brain/7c1c396a-d6ed-4359-9ec2-d4a6d6a71f39/.user_uploaded/media_1794074126787_50011365.png",
        "crop": (26, 17, 320, 655),
        "badge": "TACTILE LOGIC FLOW",
        "title": "FLOW & BLOSSOM",
        "subtitle": "Guide glowing circuit energy to bloom rare flowers",
        "accent": (52, 211, 153),     # Emerald Green
        "tint": (16, 185, 129),
    },
    {
        "id": "summit",
        "path": "/Users/erezg/.gemini/antigravity/brain/7c1c396a-d6ed-4359-9ec2-d4a6d6a71f39/.user_uploaded/media_1794074126781_5ae3ae68.png",
        "crop": (18, 13, 312, 651),
        "badge": "HARMONIC CELESTIAL MEMORY",
        "title": "ECHO THE MELODY",
        "subtitle": "Follow ancient harmonic echoes beneath the aurora",
        "accent": (192, 132, 252),    # Mystic Violet
        "tint": (168, 85, 247),
    },
]

def render_device_screen(cfg, target_w, target_h, corner_r):
    # 1. Load crop
    im_src = Image.open(cfg["path"]).convert("RGBA")
    crop = im_src.crop(cfg["crop"])
    
    # 2. Multi-stage enhancement: color pop + crisp sharpness
    enh = ImageEnhance.Color(crop).enhance(1.08)
    enh = ImageEnhance.Contrast(enh).enhance(1.05)
    screen_resized = enh.resize((target_w, target_h), Image.LANCZOS)
    screen_resized = screen_resized.filter(ImageFilter.UnsharpMask(radius=2, percent=125, threshold=3))
    
    # 3. Mask rounded corners
    mask = Image.new("L", (target_w, target_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, target_w - 1, target_h - 1), radius=corner_r, fill=255)
    screen_comp = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    screen_comp.paste(screen_resized, (0, 0), mask)
    return screen_comp

def build_card(cfg, is_ipad=False):
    W, H = (2064, 2752) if is_ipad else (1320, 2868)
    card = Image.new("RGBA", (W, H), (10, 6, 25, 255))
    
    # 1. Thematic World Background
    bg_path = A("worlds", cfg["id"], "still.webp")
    if os.path.exists(bg_path):
        still = Image.open(bg_path).convert("RGB")
        scale = max(W / still.width, H / still.height)
        nw, nh = int(still.width * scale) + 1, int(still.height * scale) + 1
        still = still.resize((nw, nh), Image.LANCZOS)
        left = (nw - W) // 2
        top = int((nh - H) * 0.3)
        bg = still.crop((left, top, left + W, top + H))
        bg = bg.filter(ImageFilter.GaussianBlur(24 if is_ipad else 22))
        
        # Atmospheric Darkening Veil
        arr = np.asarray(bg).astype(np.float32) * 0.36 + np.array([12, 8, 28], dtype=np.float32) * 0.64
        bg = Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGB").convert("RGBA")
        card.alpha_composite(bg)
        
    # 2. Ambient Radial Glow
    yy, xx = np.mgrid[0:H, 0:W]
    cx = W * 0.5
    cy = H * (0.60 if is_ipad else 0.58)
    glow_rx = W * 0.85
    glow_ry = H * (0.50 if is_ipad else 0.55)
    glow = np.clip(1.0 - np.sqrt(((xx - cx) / glow_rx) ** 2 + ((yy - cy) / glow_ry) ** 2), 0, 1) ** 2
    tint = Image.new("RGBA", (W, H), (*cfg["accent"], 255))
    tint.putalpha(Image.fromarray((glow * 80).astype(np.uint8), "L"))
    card.alpha_composite(tint)
    
    d = ImageDraw.Draw(card)
    
    # 3. Typography & Header Elements
    accent_rgb = cfg["accent"]
    
    # Badge Pill
    pill_text = cfg["badge"]
    f_pill = bold_font(42 if is_ipad else 32)
    tw = d.textlength(pill_text, font=f_pill)
    star_spacing = 38 if is_ipad else 28
    pw = int(tw + star_spacing * 2 + (80 if is_ipad else 64))
    ph = 76 if is_ipad else 62
    px = (W - pw) // 2
    py = 140 if is_ipad else 135
    
    # Pill background
    d.rounded_rectangle(
        (px, py, px + pw, py + ph),
        radius=ph // 2,
        fill=(28, 16, 54, 230),
        outline=(*accent_rgb, 220),
        width=3,
    )
    
    # Left & Right Stars inside Pill
    star_r_out = 13 if is_ipad else 10
    star_r_in = 6 if is_ipad else 5
    star_y = py + ph // 2
    draw_star(d, px + 28 if is_ipad else px + 22, star_y, star_r_out, star_r_in, accent_rgb)
    draw_star(d, px + pw - (28 if is_ipad else 22), star_y, star_r_out, star_r_in, accent_rgb)
    
    # Pill text
    text_x = (W - tw) // 2
    text_y = py + (16 if is_ipad else 14)
    d.text((text_x, text_y), pill_text, font=f_pill, fill=(255, 235, 170))
    
    # Main Headline
    f_title = bold_font(110 if is_ipad else 84)
    title_text = cfg["title"]
    tw_title = d.textlength(title_text, font=f_title)
    tx = (W - tw_title) // 2
    ty = 250 if is_ipad else 230
    d.text((tx, ty + 5), title_text, font=f_title, fill=(0, 0, 0, 180)) # deep drop shadow
    d.text((tx, ty), title_text, font=f_title, fill=(255, 255, 255))
    
    # Subtitle
    f_sub = med_font(52 if is_ipad else 42)
    sub_text = cfg["subtitle"]
    tw_sub = d.textlength(sub_text, font=f_sub)
    sx = (W - tw_sub) // 2
    sy = 390 if is_ipad else 345
    d.text((sx, sy + 3), sub_text, font=f_sub, fill=(0, 0, 0, 160))
    d.text((sx, sy), sub_text, font=f_sub, fill=(215, 225, 235))
    
    # 4. Realistic Device Frame
    if is_ipad:
        # On iPad canvas, display the phone as a prominent centered flagship hero
        phone_w = 1140
        phone_h = int(phone_w * (2868 / 1320))
        phone_x = (W - phone_w) // 2
        phone_y = 520
        corner_r = 85
    else:
        # iPhone 6.9" Canvas
        phone_w = 980
        phone_h = int(phone_w * (2868 / 1320))
        phone_x = (W - phone_w) // 2
        phone_y = 475
        corner_r = 75
        
    screen_comp = render_device_screen(cfg, phone_w, phone_h, corner_r)
    
    # Phone Chassis Dimensions
    chassis_pad = 18 if is_ipad else 16
    cw = phone_w + chassis_pad * 2
    ch = phone_h + chassis_pad * 2
    cx_pos = phone_x - chassis_pad
    cy_pos = phone_y - chassis_pad
    cr_outer = corner_r + chassis_pad
    
    # Multi-stage Realistic Shadow
    shadow_passes = [
        (40 if is_ipad else 35, 70 if is_ipad else 60, 95),
        (22 if is_ipad else 18, 35 if is_ipad else 30, 115),
        (10 if is_ipad else 8, 15 if is_ipad else 12, 135),
    ]
    for offset, blur, alpha in shadow_passes:
        s_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        s_d = ImageDraw.Draw(s_layer)
        s_d.rounded_rectangle((cx_pos, cy_pos + offset, cx_pos + cw, cy_pos + ch + offset), radius=cr_outer, fill=(0, 0, 0, alpha))
        s_layer = s_layer.filter(ImageFilter.GaussianBlur(blur))
        card.alpha_composite(s_layer)
        
    # Chassis Body (Matte Space Titanium + Diamond Cut Rim)
    chassis = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    cd = ImageDraw.Draw(chassis)
    cd.rounded_rectangle((0, 0, cw - 1, ch - 1), radius=cr_outer, fill=(28, 28, 32, 255), outline=(75, 75, 85, 255), width=3)
    cd.rounded_rectangle((2, 2, cw - 3, ch - 3), radius=cr_outer - 2, outline=(140, 140, 155, 140), width=2)
    cd.rounded_rectangle((chassis_pad, chassis_pad, cw - chassis_pad - 1, ch - chassis_pad - 1), radius=corner_r, fill=(0, 0, 0, 255))
    card.alpha_composite(chassis, (cx_pos, cy_pos))
    
    # Paste Enhanced Gameplay Screen
    card.alpha_composite(screen_comp, (phone_x, phone_y))
    
    # Glass Sheen Highlight
    glass = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glass)
    gd.polygon([(0, 0), (phone_w // 2, 0), (0, phone_h // 2)], fill=(255, 255, 255, 10))
    glass = glass.filter(ImageFilter.GaussianBlur(8))
    card.alpha_composite(glass, (phone_x, phone_y))
    
    return card.convert("RGB")

def main():
    print("Building definitive, real App Store screenshots for Zikaron3D...")
    
    for idx, cfg in enumerate(CARDS_CONFIG, start=1):
        # 1. iPhone 6.9" (1320 x 2868)
        iphone_card = build_card(cfg, is_ipad=False)
        iphone_out = os.path.join(FINAL_DIR, f"iphone-{idx}.png")
        iphone_card.save(iphone_out, "PNG", optimize=True)
        print(f"  ✓ iphone-{idx}.png ({iphone_card.size[0]}x{iphone_card.size[1]}) -> {cfg['title']}")
        
        # 2. iPad 13" (2064 x 2752)
        ipad_card = build_card(cfg, is_ipad=True)
        ipad_out = os.path.join(FINAL_DIR, f"ipad-{idx}.png")
        ipad_card.save(ipad_out, "PNG", optimize=True)
        print(f"  ✓ ipad-{idx}.png ({ipad_card.size[0]}x{ipad_card.size[1]}) -> {cfg['title']}")
        
    print(f"\nAll 10 App Store screenshots successfully generated in {os.path.relpath(FINAL_DIR, ROOT)}!")

if __name__ == "__main__":
    main()
