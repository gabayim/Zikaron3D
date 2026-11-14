#!/usr/bin/env python3
"""
Generates realistic, high-fidelity in-game screen captures for Zikaron3D
and places them in assets/store/screenshots/source/ so buildScreenshots.py
can assemble the final, compliant App Store Connect screenshot package.
"""
from __future__ import annotations

import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE_DIR = os.path.join(ROOT, "assets", "store", "screenshots", "source")
os.makedirs(SOURCE_DIR, exist_ok=True)

A = lambda *p: os.path.join(ROOT, "assets", *p)

FONT_DIRS = [
    "/System/Library/Fonts/Supplemental",
    "/System/Library/Fonts",
    "/Library/Fonts",
    r"C:\Windows\Fonts",
]

def get_font(names, size):
    for d in FONT_DIRS:
        for name in names:
            path = os.path.join(d, name)
            if os.path.exists(path):
                try:
                    return ImageFont.truetype(path, size)
                except OSError:
                    continue
    return ImageFont.load_default()

def bold_font(size):
    return get_font(["Arial Rounded Bold.ttf", "Arial Black.ttf", "seguibl.ttf", "HelveticaNeue.ttc"], size)

def med_font(size):
    return get_font(["Arial Bold.ttf", "segoeuib.ttf", "HelveticaNeue.ttc"], size)

def reg_font(size):
    return get_font(["Arial.ttf", "segoeui.ttf", "Helvetica.ttc"], size)

def load_world_bg(world_name: str, width: int, height: int, dim: float = 0.85) -> Image.Image:
    path = A("worlds", world_name, "still.webp")
    if not os.path.exists(path):
        bg = Image.new("RGBA", (width, height), (26, 15, 61, 255))
        return bg
    img = Image.open(path).convert("RGBA")
    scale = max(width / img.width, height / img.height)
    img = img.resize((int(img.width * scale) + 1, int(img.height * scale) + 1), Image.LANCZOS)
    left = (img.width - width) // 2
    top = (img.height - height) // 2
    cropped = img.crop((left, top, left + width, top + height))
    
    # Apply soft veil to increase contrast for UI elements
    veil = Image.new("RGBA", (width, height), (15, 10, 35, int(255 * (1.0 - dim))))
    return Image.alpha_composite(cropped, veil)

def draw_top_bar(canvas: ImageDraw.ImageDraw, w: int, mode: str = "ARCADE", crystals: int = 1250, shields: int = 5):
    # Mode Pill (Top Left)
    f_pill = bold_font(32)
    mode_color = (244, 114, 182) if mode == "TOYBOX" else (251, 191, 36)
    canvas.rounded_rectangle((48, 80, 230, 142), radius=31, fill=(26, 15, 61, 220), outline=mode_color, width=3)
    # Circle icon in pill
    canvas.ellipse((58, 90, 100, 132), fill=mode_color)
    canvas.text((115, 93), mode, font=f_pill, fill=(255, 255, 255))

    # Counters (Top Right)
    f_cnt = bold_font(34)
    # Shield counter
    canvas.rounded_rectangle((w - 380, 80, w - 210, 142), radius=31, fill=(26, 15, 61, 220), outline=(56, 189, 248), width=2)
    canvas.ellipse((w - 370, 91, w - 330, 131), fill=(56, 189, 248))
    canvas.text((w - 315, 93), f"x{shields}", font=f_cnt, fill=(255, 255, 255))

    # Crystals counter
    canvas.rounded_rectangle((w - 190, 80, w - 48, 142), radius=31, fill=(26, 15, 61, 220), outline=(255, 211, 110), width=2)
    canvas.ellipse((w - 180, 91, w - 140, 131), fill=(255, 211, 110))
    canvas.text((w - 128, 93), f"{crystals}", font=f_cnt, fill=(255, 255, 255))

def draw_bottom_nav(canvas: ImageDraw.ImageDraw, w: int, h: int, active_tab: int = 0):
    nav_h = 180
    y_nav = h - nav_h - 40
    canvas.rounded_rectangle((36, y_nav, w - 36, y_nav + nav_h), radius=48, fill=(20, 10, 48, 230), outline=(255, 255, 255, 40), width=2)
    
    tabs = ["WORLDS", "COLLECTION", "LEAGUE", "SHOP"]
    tab_w = (w - 72) / len(tabs)
    f_tab = bold_font(26)
    
    for i, title in enumerate(tabs):
        cx = 36 + i * tab_w + tab_w / 2
        cy = y_nav + 90
        is_active = (i == active_tab)
        color = (255, 211, 110) if is_active else (148, 163, 184)
        
        # Indicator circle
        if is_active:
            canvas.rounded_rectangle((cx - 60, cy - 65, cx + 60, cy + 50), radius=28, fill=(255, 211, 110, 40))
        canvas.ellipse((cx - 24, cy - 42, cx + 24, cy + 6), fill=color)
        canvas.text((cx - canvas.textlength(title, font=f_tab) / 2, cy + 18), title, font=f_tab, fill=color)

# ==========================================
# SCREEN 1: HUB CAROUSEL (Seven worlds to explore)
# ==========================================
def render_screen_1(w=1290, h=2796) -> Image.Image:
    img = load_world_bg("meadow", w, h, dim=0.88)
    draw = ImageDraw.Draw(img)
    draw_top_bar(draw, w, mode="ARCADE", crystals=1250, shields=5)

    # World Title & Card
    f_title = bold_font(76)
    f_sub = med_font(34)
    cx = w // 2
    
    draw.text((cx - draw.textlength("MEADOW", font=f_title)/2, 340), "MEADOW", font=f_title, fill=(255, 255, 255))
    draw.text((cx - draw.textlength("World 1 • Burrows & Peeks", font=f_sub)/2, 440), "World 1 • Burrows & Peeks", font=f_sub, fill=(255, 211, 110))

    # Main Hero Character (Pip) on floating island podium
    podium_y = 1380
    draw.ellipse((cx - 360, podium_y + 160, cx + 360, podium_y + 340), fill=(26, 12, 60, 200), outline=(255, 211, 110, 120), width=6)
    draw.ellipse((cx - 320, podium_y + 190, cx + 320, podium_y + 310), fill=(236, 72, 153, 50))
    
    pip_path = A("raw", "pip", "master_a.png")
    if os.path.exists(pip_path):
        pip = Image.open(pip_path).convert("RGBA")
        pip_w = 640
        pip_h = int(pip_w * pip.height / pip.width)
        pip = pip.resize((pip_w, pip_h), Image.LANCZOS)
        img.alpha_composite(pip, (cx - pip_w // 2, podium_y - pip_h + 230))

    # Flanking carousel arrows
    draw.ellipse((60, podium_y - 20, 160, podium_y + 80), fill=(20, 10, 48, 200), outline=(255, 255, 255, 80), width=3)
    draw.polygon([(120, podium_y + 10), (95, podium_y + 30), (120, podium_y + 50)], fill=(255, 255, 255))
    draw.ellipse((w - 160, podium_y - 20, w - 60, podium_y + 80), fill=(20, 10, 48, 200), outline=(255, 255, 255, 80), width=3)
    draw.polygon([(w - 120, podium_y + 10), (w - 95, podium_y + 30), (w - 120, podium_y + 50)], fill=(255, 255, 255))

    # Level Path Dots (Level 1, 2, 3 stars, 4 active)
    path_y = 1920
    for idx, (lx, stars, active) in enumerate([(cx - 260, 3, False), (cx - 90, 3, False), (cx + 80, 2, False), (cx + 250, 0, True)]):
        node_color = (255, 211, 110) if active else (56, 189, 248)
        draw.ellipse((lx - 50, path_y - 50, lx + 50, path_y + 50), fill=(20, 10, 48, 240), outline=node_color, width=5)
        f_num = bold_font(42)
        draw.text((lx - draw.textlength(str(idx + 1), font=f_num)/2, path_y - 26), str(idx + 1), font=f_num, fill=(255, 255, 255))
        # Little stars above
        for s in range(3):
            sx = lx - 24 + s * 24
            sy = path_y - 75
            star_fill = (255, 211, 110) if s < stars else (80, 70, 100)
            draw.ellipse((sx - 8, sy - 8, sx + 8, sy + 8), fill=star_fill)

    # Big Play Button
    btn_y = 2160
    draw.rounded_rectangle((cx - 280, btn_y, cx + 280, btn_y + 130), radius=65, fill=(236, 72, 153), outline=(255, 211, 110), width=4)
    f_btn = bold_font(52)
    draw.text((cx - draw.textlength("PLAY WORLD", font=f_btn)/2, btn_y + 34), "PLAY WORLD", font=f_btn, fill=(255, 255, 255))

    draw_bottom_nav(draw, w, h, active_tab=0)
    return img

# ==========================================
# SCREEN 2: TOYBOX BURROWS (A kid-safe mode for ages 4-7)
# ==========================================
def render_screen_2(w=1290, h=2796) -> Image.Image:
    img = load_world_bg("candy", w, h, dim=0.92)
    draw = ImageDraw.Draw(img)
    draw_top_bar(draw, w, mode="TOYBOX", crystals=600, shields=0)

    cx = w // 2
    f_title = bold_font(54)
    f_sub = med_font(36)
    draw.text((cx - draw.textlength("MATCH THE CRITTERS", font=f_title)/2, 280), "MATCH THE CRITTERS", font=f_title, fill=(255, 255, 255))
    draw.text((cx - draw.textlength("Gentle memory play • No timers", font=f_sub)/2, 360), "Gentle memory play • No timers", font=f_sub, fill=(255, 211, 110))

    # 3x3 Burrows Grid Card
    grid_top = 540
    grid_w = w - 160
    draw.rounded_rectangle((80, grid_top, w - 80, grid_top + 1320), radius=56, fill=(35, 18, 70, 220), outline=(244, 114, 182, 120), width=4)

    # Burrows mounds & critters peeking
    critter_skins = [
        ("pip_classic.png", True), ("bloop_classic.png", True), ("nutty_classic.png", False),
        ("ember_ruby.png", False), ("frost_classic.png", True), ("moss_classic.png", False),
        ("bolt_classic.png", False), ("luna_classic.png", True), ("coral_classic.png", False)
    ]
    
    row_h = 390
    col_w = (grid_w - 60) / 3

    for idx, (skin_file, peeking) in enumerate(critter_skins):
        r = idx // 3
        c = idx % 3
        bx = 110 + c * col_w + col_w / 2
        by = grid_top + 80 + r * row_h + 100

        # Burrow mound hole
        draw.ellipse((bx - 140, by + 40, bx + 140, by + 120), fill=(18, 8, 40, 250), outline=(120, 60, 160), width=4)

        if peeking:
            skin_p = A("shop", "skins", skin_file)
            if os.path.exists(skin_p):
                c_img = Image.open(skin_p).convert("RGBA")
                sz = 210
                c_img = c_img.resize((sz, sz), Image.LANCZOS)
                img.alpha_composite(c_img, (int(bx - sz/2), int(by - sz + 85)))
                # Cute match sparkle
                draw.ellipse((bx + 60, by - 110, bx + 95, by - 75), fill=(255, 211, 110))
        else:
            # Grass / mound lid
            draw.ellipse((bx - 110, by + 50, bx + 110, by + 105), fill=(40, 22, 75, 220))
            f_q = bold_font(48)
            draw.text((bx - 14, by + 52), "?", font=f_q, fill=(180, 150, 220))

    # Friendly hint bubble at bottom
    hb_y = 2020
    draw.rounded_rectangle((cx - 380, hb_y, cx + 380, hb_y + 110), radius=55, fill=(244, 114, 182), outline=(255, 255, 255), width=3)
    f_hint = bold_font(38)
    draw.text((cx - draw.textlength("You found 2 pairs! Keep going!", font=f_hint)/2, hb_y + 32), "You found 2 pairs! Keep going!", font=f_hint, fill=(255, 255, 255))

    draw_bottom_nav(draw, w, h, active_tab=0)
    return img

# ==========================================
# SCREEN 3: ORB MERGE (Merge, chain and climb the ladder)
# ==========================================
def render_screen_3(w=1290, h=2796) -> Image.Image:
    img = load_world_bg("crystal", w, h, dim=0.88)
    draw = ImageDraw.Draw(img)
    draw_top_bar(draw, w, mode="ARCADE", crystals=1840, shields=4)

    cx = w // 2
    f_score = bold_font(72)
    f_combo = bold_font(38)
    draw.text((cx - draw.textlength("18,450", font=f_score)/2, 270), "18,450", font=f_score, fill=(255, 255, 255))

    # Combo streak badge
    draw.rounded_rectangle((cx - 160, 365, cx + 160, 425), radius=30, fill=(236, 72, 153), outline=(255, 211, 110), width=2)
    draw.text((cx - draw.textlength("x5 COMBO!", font=f_combo)/2, 375), "x5 COMBO!", font=f_combo, fill=(255, 255, 255))

    # Dropper guide at top
    draw.line([(cx, 460), (cx, 750)], fill=(56, 189, 248, 160), width=4)
    # Next ready orb (Bloop)
    draw.ellipse((cx - 65, 470, cx + 65, 600), fill=(56, 189, 248, 230), outline=(255, 255, 255), width=4)
    bloop_p = A("shop", "skins", "bloop_classic.png")
    if os.path.exists(bloop_p):
        bl = Image.open(bloop_p).convert("RGBA").resize((110, 110), Image.LANCZOS)
        img.alpha_composite(bl, (cx - 55, 480))

    # Crystal Jar Container
    jar_top = 740
    jar_bot = 2240
    jar_w = w - 160
    draw.rounded_rectangle((80, jar_top, w - 80, jar_bot), radius=64, fill=(18, 10, 45, 190), outline=(139, 92, 246), width=5)

    # Packed bouncy orbs inside the jar
    orbs = [
        # (x_offset, y_offset, radius, skin, color)
        (-240, 320, 100, "fuzz_classic.png", (168, 85, 247)),
        (-50, 340, 130, "frost_blizzard.png", (56, 189, 248)),
        (220, 330, 115, "nutty_bronze.png", (245, 158, 11)),
        (-260, 90, 140, "moss_classic.png", (34, 197, 94)),
        (180, 80, 160, "nova_supernova.png", (239, 68, 68)),
        (0, -140, 200, "pip_chrome.png", (236, 72, 153)),
    ]

    base_y = jar_bot - 240
    for ox, oy, r, skin, col in orbs:
        ox_c = cx + ox
        oy_c = base_y - oy
        # Glowing orb bubble
        draw.ellipse((ox_c - r, oy_c - r, ox_c + r, oy_c + r), fill=(*col, 210), outline=(255, 255, 255, 200), width=4)
        # Inner critter face
        sk_path = A("shop", "skins", skin)
        if os.path.exists(sk_path):
            crit = Image.open(sk_path).convert("RGBA").resize((int(r * 1.3), int(r * 1.3)), Image.LANCZOS)
            img.alpha_composite(crit, (int(ox_c - r * 0.65), int(oy_c - r * 0.65)))

    # Pop Merge Sparkle effect on the giant center Pip orb
    draw.ellipse((cx - 240, base_y - 380, cx + 240, base_y + 100), outline=(255, 211, 110, 180), width=6)
    f_pts = bold_font(44)
    draw.text((cx + 120, base_y - 280), "+1,200", font=f_pts, fill=(255, 211, 110))

    draw_bottom_nav(draw, w, h, active_tab=0)
    return img

# ==========================================
# SCREEN 4: WEEKLY LEAGUE (A new weekly arcade league)
# ==========================================
def render_screen_4(w=1290, h=2796) -> Image.Image:
    img = load_world_bg("circuit", w, h, dim=0.88)
    draw = ImageDraw.Draw(img)
    draw_top_bar(draw, w, mode="ARCADE", crystals=2400, shields=6)

    cx = w // 2
    f_title = bold_font(60)
    f_sub = med_font(34)
    draw.text((cx - draw.textlength("WEEKLY ARCADE LEAGUE", font=f_title)/2, 280), "WEEKLY ARCADE LEAGUE", font=f_title, fill=(255, 255, 255))
    draw.text((cx - draw.textlength("Tier: Gold Division • Resets in 2d 14h", font=f_sub)/2, 360), "Tier: Gold Division • Resets in 2d 14h", font=f_sub, fill=(255, 211, 110))

    # Big Card Container
    card_top = 460
    card_h = 1680
    draw.rounded_rectangle((70, card_top, w - 70, card_top + card_h), radius=56, fill=(20, 10, 48, 235), outline=(56, 189, 248, 80), width=3)

    # Leaderboard Rows
    players = [
        (1, "CosmicPip", "nova_supernova.png", 84200, (255, 211, 110), False),
        (2, "ThunderBolt", "bolt_plasma.png", 74100, (226, 232, 240), False),
        (3, "CoralKnight", "coral_pearl.png", 63950, (249, 115, 22), False),
        (4, "YOU", "pip_classic.png", 59400, (56, 189, 248), True),
        (5, "MoonWhisper", "luna_celestial.png", 46200, (168, 85, 247), False),
        (6, "EmberBlaze", "ember_ruby.png", 39800, (239, 68, 68), False),
        (7, "BloopWave", "bloop_crystal.png", 31200, (148, 163, 184), False),
    ]

    row_y = card_top + 60
    row_h = 220
    f_rank = bold_font(48)
    f_name = bold_font(40)
    f_scr = bold_font(42)

    for rank, name, skin, score, color, is_me in players:
        # Highlight card for player
        if is_me:
            draw.rounded_rectangle((90, row_y, w - 90, row_y + row_h - 20), radius=36, fill=(56, 189, 248, 45), outline=(56, 189, 248), width=3)
        else:
            draw.rounded_rectangle((90, row_y, w - 90, row_y + row_h - 20), radius=36, fill=(255, 255, 255, 10))

        # Medal / Rank
        draw.text((130, row_y + 60), f"#{rank}", font=f_rank, fill=color)

        # Avatar circle
        av_x = 280
        av_y = row_y + 100
        draw.ellipse((av_x - 55, av_y - 55, av_x + 55, av_y + 55), fill=(26, 15, 61), outline=color, width=3)
        sk_path = A("shop", "skins", skin)
        if os.path.exists(sk_path):
            av = Image.open(sk_path).convert("RGBA").resize((95, 95), Image.LANCZOS)
            img.alpha_composite(av, (av_x - 47, av_y - 47))

        # Name
        draw.text((370, row_y + 50), name, font=f_name, fill=(255, 255, 255))
        
        # Progress score bar
        bar_w = int((w - 560) * (score / 85000))
        draw.rounded_rectangle((370, row_y + 115, 370 + (w - 560), row_y + 135), radius=10, fill=(255, 255, 255, 20))
        draw.rounded_rectangle((370, row_y + 115, 370 + bar_w, row_y + 135), radius=10, fill=color)

        # Score text
        draw.text((w - 290, row_y + 70), f"{score:,}", font=f_scr, fill=color)

        row_y += row_h

    # Streak Shield Reminder Badge
    sh_y = 2190
    draw.rounded_rectangle((cx - 360, sh_y, cx + 360, sh_y + 90), radius=45, fill=(26, 15, 61, 220), outline=(255, 211, 110), width=2)
    f_sh = bold_font(32)
    draw.text((cx - draw.textlength("Streak Shield Active: Next loss is protected!", font=f_sh)/2, sh_y + 26), "Streak Shield Active: Next loss is protected!", font=f_sh, fill=(255, 211, 110))

    draw_bottom_nav(draw, w, h, active_tab=2)
    return img

# ==========================================
# SCREEN 5: COLLECTION SHELF (Collect and dress up fifteen critters)
# ==========================================
def render_screen_5(w=1290, h=2796) -> Image.Image:
    img = load_world_bg("grove", w, h, dim=0.88)
    draw = ImageDraw.Draw(img)
    draw_top_bar(draw, w, mode="ARCADE", crystals=3100, shields=5)

    cx = w // 2
    f_title = bold_font(60)
    f_sub = med_font(34)
    draw.text((cx - draw.textlength("CRITTER WARDROBE", font=f_title)/2, 280), "CRITTER WARDROBE", font=f_title, fill=(255, 255, 255))
    draw.text((cx - draw.textlength("15 Animated Critters • Skins & Hats", font=f_sub)/2, 360), "15 Animated Critters • Skins & Hats", font=f_sub, fill=(255, 211, 110))

    # Top Hero Stage: Pip Snow with Crown
    stage_y = 470
    draw.rounded_rectangle((90, stage_y, w - 90, stage_y + 820), radius=56, fill=(20, 10, 48, 220), outline=(236, 72, 153, 100), width=3)
    
    # Showcase Pedestal
    draw.ellipse((cx - 240, stage_y + 540, cx + 240, stage_y + 680), fill=(35, 18, 70), outline=(255, 211, 110), width=4)
    
    # Pip Snow render
    pip_snow = A("shop", "skins", "pip_snow.png")
    if os.path.exists(pip_snow):
        p_img = Image.open(pip_snow).convert("RGBA").resize((380, 380), Image.LANCZOS)
        img.alpha_composite(p_img, (cx - 190, stage_y + 190))

    # Name and Equipping Tags
    f_crit_name = bold_font(48)
    draw.text((cx - draw.textlength("Pip (Snow Blizzard)", font=f_crit_name)/2, stage_y + 60), "Pip (Snow Blizzard)", font=f_crit_name, fill=(255, 255, 255))
    
    # Tabs: Skins, Hats, Trails
    f_tab = bold_font(30)
    for idx, (t_name, active) in enumerate([("SKINS", True), ("HATS", False), ("AURAS", False), ("TRAILS", False)]):
        tx = 160 + idx * 260
        t_col = (236, 72, 153) if active else (50, 30, 90)
        draw.rounded_rectangle((tx, stage_y + 710, tx + 220, stage_y + 780), radius=35, fill=t_col)
        draw.text((tx + 110 - draw.textlength(t_name, font=f_tab)/2, stage_y + 725), t_name, font=f_tab, fill=(255, 255, 255))

    # Bottom Critter Shelf Grid (3x2)
    shelf_y = 1340
    draw.rounded_rectangle((90, shelf_y, w - 90, shelf_y + 880), radius=56, fill=(18, 8, 40, 230), outline=(255, 255, 255, 30), width=2)

    shelf_skins = [
        ("pip_classic.png", "Pip", True), ("bloop_crystal.png", "Bloop", False), ("bolt_plasma.png", "Bolt", False),
        ("ember_ruby.png", "Ember", False), ("frost_blizzard.png", "Frost", False), ("nova_supernova.png", "Nova", False)
    ]

    for idx, (sk, name, is_sel) in enumerate(shelf_skins):
        r = idx // 3
        c = idx % 3
        sx = 130 + c * 350
        sy = shelf_y + 50 + r * 390
        
        # Shelf slot
        border_col = (255, 211, 110) if is_sel else (60, 40, 100)
        draw.rounded_rectangle((sx, sy, sx + 320, sy + 340), radius=40, fill=(30, 15, 65, 240), outline=border_col, width=4 if is_sel else 2)

        sk_p = A("shop", "skins", sk)
        if os.path.exists(sk_p):
            cr = Image.open(sk_p).convert("RGBA").resize((190, 190), Image.LANCZOS)
            img.alpha_composite(cr, (sx + 65, sy + 40))

        f_sl = bold_font(32)
        draw.text((sx + 160 - draw.textlength(name, font=f_sl)/2, sy + 265), name, font=f_sl, fill=(255, 255, 255))

    draw_bottom_nav(draw, w, h, active_tab=1)
    return img

# ==========================================
# SCREEN 6: PARENTAL GATE (Grown-up check before every purchase)
# ==========================================
def render_screen_6(w=1290, h=2796) -> Image.Image:
    # Deep sea world background heavily dimmed & blurred for modal focus
    img = load_world_bg("deep_sea", w, h, dim=0.35)
    img = img.filter(ImageFilter.GaussianBlur(14))
    draw = ImageDraw.Draw(img)

    # Modal Card
    cx = w // 2
    cy = h // 2
    card_w = 980
    card_h = 1320
    x0 = cx - card_w // 2
    y0 = cy - card_h // 2 - 60

    # Modal shadow & background
    draw.rounded_rectangle((x0 - 4, y0 - 4, x0 + card_w + 4, y0 + card_h + 4), radius=64, fill=(10, 5, 25, 255))
    draw.rounded_rectangle((x0, y0, x0 + card_w, y0 + card_h), radius=60, fill=(26, 15, 61), outline=(255, 211, 110), width=5)

    # Icon / Shield Header
    draw.ellipse((cx - 60, y0 + 70, cx + 60, y0 + 190), fill=(255, 211, 110, 50), outline=(255, 211, 110), width=4)
    f_sh = bold_font(60)
    draw.text((cx - 24, y0 + 95), "🛡", font=f_sh, fill=(255, 211, 110))

    f_title = bold_font(52)
    f_sub = med_font(32)
    draw.text((cx - draw.textlength("GROWN-UP CHECK", font=f_title)/2, y0 + 230), "GROWN-UP CHECK", font=f_title, fill=(255, 255, 255))
    draw.text((cx - draw.textlength("Please solve to access purchases", font=f_sub)/2, y0 + 310), "Please solve to access purchases", font=f_sub, fill=(255, 211, 110))

    # Math equation blocks: [ 1 ] [ 8 ] [ × ] [ 4 ]
    eq_y = y0 + 410
    tokens = ["1", "8", "×", "4"]
    f_tok = bold_font(64)
    start_x = cx - 220
    for i, tok in enumerate(tokens):
        bx = start_x + i * 115
        draw.rounded_rectangle((bx, eq_y, bx + 95, eq_y + 115), radius=24, fill=(255, 255, 255, 25), outline=(255, 255, 255, 60), width=3)
        draw.text((bx + 48 - draw.textlength(tok, font=f_tok)/2, eq_y + 20), tok, font=f_tok, fill=(255, 233, 168))

    # Choices Grid (2x2)
    grid_y = y0 + 600
    choices = [
        (64, False),
        (72, True),   # Highlighted correct answer
        (80, False),
        (58, False)
    ]
    f_ch = bold_font(64)
    for idx, (num, is_correct) in enumerate(choices):
        r = idx // 2
        c = idx % 2
        bx = x0 + 90 + c * 420
        by = grid_y + r * 190
        fill_col = (236, 72, 153) if is_correct else (255, 143, 208, 40)
        out_col = (255, 211, 110) if is_correct else (255, 255, 255, 40)
        draw.rounded_rectangle((bx, by, bx + 380, by + 140), radius=36, fill=fill_col, outline=out_col, width=4)
        draw.text((bx + 190 - draw.textlength(str(num), font=f_ch)/2, by + 32), str(num), font=f_ch, fill=(255, 255, 255))

    # Safe Kids & Privacy Reassurance Badge
    badge_y = y0 + 1040
    f_badge = bold_font(30)
    draw.text((cx - draw.textlength("🔒 100% Kid Safe • No Ads • No Tracking", font=f_badge)/2, badge_y), "🔒 100% Kid Safe • No Ads • No Tracking", font=f_badge, fill=(148, 163, 184))
    
    # Cancel / Close handle
    draw.rounded_rectangle((cx - 60, y0 + card_h - 70, cx + 60, y0 + card_h - 60), radius=5, fill=(255, 255, 255, 120))

    return img

def main():
    print("Generating realistic source screenshots...")
    # iPhone renders (1290 x 2796)
    renders = [
        ("iphone-1.png", render_screen_1),
        ("iphone-2.png", render_screen_2),
        ("iphone-3.png", render_screen_3),
        ("iphone-4.png", render_screen_4),
        ("iphone-5.png", render_screen_5),
        ("iphone-6.png", render_screen_6),
    ]

    for filename, fn in renders:
        print(f"  Rendering {filename}...")
        img = fn(1290, 2796)
        path = os.path.join(SOURCE_DIR, filename)
        img.save(path, "PNG", optimize=True)

    # iPad renders (2064 x 2752)
    ipad_renders = [
        ("ipad-1.png", render_screen_1),
        ("ipad-2.png", render_screen_2),
        ("ipad-3.png", render_screen_3),
        ("ipad-4.png", render_screen_4),
    ]
    for filename, fn in ipad_renders:
        print(f"  Rendering {filename} (iPad)...")
        img = fn(2064, 2752)
        path = os.path.join(SOURCE_DIR, filename)
        img.save(path, "PNG", optimize=True)

    print("All source captures generated in assets/store/screenshots/source/!")

if __name__ == "__main__":
    main()
