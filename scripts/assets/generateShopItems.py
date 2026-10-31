import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path

OUT_DIR = Path("C:/WorkspacePrime/Zikaron3D/assets/shop/items")
OUT_DIR.mkdir(parents=True, exist_ok=True)

ITEMS = [
    # HATS
    ("hat_tophat", "3D stylized toy dapper black silk top hat with satin ribbon, Nintendo Astro Bot art style, isolated studio lighting, crisp game icon"),
    ("hat_pirate", "3D stylized toy pirate captain tricorn hat with gold skull emblem and red feather, Nintendo Astro Bot art style, game icon"),
    ("hat_flowercrown", "3D stylized toy flower crown with colorful blooming roses and daisies, Nintendo Astro Bot art style, vibrant cute game icon"),
    ("hat_viking", "3D stylized toy viking warrior helmet with curved horns, polished bronze and steel, Nintendo Astro Bot art style, cute game icon"),

    # TRAILS
    ("trail_rainbow", "3D stylized toy sparkling rainbow ribbon swirl trail with magical stars, Nintendo Astro Bot art style, isolated game icon"),
    ("trail_sparkle", "3D stylized toy glittering golden star cluster, magic sparkles trail, Nintendo Astro Bot art style, game icon"),
    ("trail_fire", "3D stylized toy comic flame boost trail, bright orange and red fire sparks, Nintendo Astro Bot art style, game icon"),
    ("trail_snow", "3D stylized toy glowing crystalline snowflakes, ice crystals trail, Nintendo Astro Bot art style, game icon"),
    ("trail_star", "3D stylized toy glowing cosmic stardust galaxy spiral trail, purple and gold stars, Nintendo Astro Bot art style, game icon"),

    # AURAS
    ("aura_goldenglow", "3D stylized toy heavenly golden radiance orb aura with halo rays and glitter, Nintendo Astro Bot art style, game icon"),
    ("aura_icecrystals", "3D stylized toy rotating blue glowing diamond crystals barrier shield aura, Nintendo Astro Bot art style, game icon"),
    ("aura_hearts", "3D stylized toy shiny floating pink and red glossy hearts love aura, Nintendo Astro Bot art style, game icon"),
    ("aura_fireflies", "3D stylized toy glowing lime green magical fireflies and nature orbs aura, Nintendo Astro Bot art style, game icon"),
    ("aura_storm", "3D stylized toy cute cartoon mini storm cloud with tiny yellow lightning bolts, Nintendo Astro Bot art style, game icon"),

    # EXPRESSIONS
    ("expr_sunglasses", "3D stylized toy oversized cool black sunglasses with glossy reflection, Nintendo Astro Bot art style, game icon"),
    ("expr_blush", "3D stylized toy cute smiling face badge with glowing rosy pink cheeks, Nintendo Astro Bot art style, game icon"),
    ("expr_sleepy", "3D stylized toy sleeping nightcap with golden ZZZ floating sleep bubbles, Nintendo Astro Bot art style, game icon"),
    ("expr_hearteyes", "3D stylized toy cartoon goggles with glowing red heart lenses, Nintendo Astro Bot art style, game icon"),
    ("expr_starry", "3D stylized toy cute mask with glowing golden five-pointed star eyes, Nintendo Astro Bot art style, game icon"),

    # PACKS
    ("pack_pouch", "3D stylized toy cute blue drawstring pouch bursting with glowing cyan diamonds and crystals, Nintendo Astro Bot art style, game icon"),
    ("pack_chest", "3D stylized toy treasure chest overflowing with glowing purple and blue gemstones and crystals, Nintendo Astro Bot art style, game icon"),
    ("pack_vault", "3D stylized toy sci-fi vault safe bursting with rainbow cosmic crystals and diamonds, Nintendo Astro Bot art style, game icon"),
    ("pack_starter", "3D stylized toy colorful celebration gift box with big ribbon, crystals and star burst, Nintendo Astro Bot art style, game icon"),
    ("pack_shield", "3D stylized toy golden energy shield with glowing star crest, Nintendo Astro Bot art style, game icon"),
]

PIXVERSE_EXE = r"C:\Users\EREZ\AppData\Roaming\npm\pixverse.cmd"

def generate_item(item_id, prompt):
    dest_path = OUT_DIR / f"{item_id}.png"
    if dest_path.exists() and dest_path.stat().st_size > 1000:
        print(f"[SKIP] {item_id} already exists")
        return

    print(f"\n[GEN] Generating {item_id}...")
    cmd = [
        PIXVERSE_EXE, "create", "image",
        "--prompt", prompt,
        "--aspect-ratio", "1:1",
        "--json"
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(res.stdout.strip())
        img_url = data.get("image_url")
        if not img_url:
            print(f"[ERR] No image_url in output: {res.stdout}")
            return
        
        print(f"[DOWN] Downloading from {img_url} -> {dest_path.name}")
        urllib.request.urlretrieve(img_url, str(dest_path))
        print(f"[DONE] {item_id} saved successfully ({dest_path.stat().st_size} bytes)")
    except Exception as e:
        print(f"[FAIL] {item_id}: {e}")

if __name__ == "__main__":
    for item_id, prompt in ITEMS:
        generate_item(item_id, prompt)
        time.sleep(1)
