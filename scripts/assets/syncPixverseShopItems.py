import json
import subprocess
import time
import urllib.request
from pathlib import Path
from PIL import Image

OUT_DIR = Path("C:/WorkspacePrime/Zikaron3D/assets/shop/items")
OUT_DIR.mkdir(parents=True, exist_ok=True)

PIXVERSE_EXE = r"C:\Users\EREZ\AppData\Roaming\npm\pixverse.cmd"

# Mapping: item_id -> (prompt, keyword_in_prompt)
ITEMS_CONFIG = {
    # HATS
    "hat_crown": ("3D stylized toy golden crown with rubies, Nintendo Astro Bot art style, vibrant studio lighting, isolated transparent PNG or white background, icon", "golden crown"),
    "hat_tophat": ("3D stylized toy dapper black silk top hat with satin ribbon, Nintendo Astro Bot art style, isolated studio lighting, crisp game icon", "black silk top hat"),
    "hat_pirate": ("3D stylized toy pirate captain tricorn hat with gold skull emblem and red feather, Nintendo Astro Bot art style, game icon", "pirate captain"),
    "hat_flowercrown": ("3D stylized toy flower crown with colorful blooming roses and daisies, Nintendo Astro Bot art style, vibrant cute game icon", "flower crown"),
    "hat_viking": ("3D stylized toy viking warrior helmet with curved horns, polished bronze and steel, Nintendo Astro Bot art style, cute game icon", "viking warrior"),

    # TRAILS
    "trail_rainbow": ("3D stylized toy sparkling rainbow ribbon swirl trail with magical stars, Nintendo Astro Bot art style, isolated game icon", "rainbow ribbon"),
    "trail_sparkle": ("3D stylized toy glittering golden star cluster, magic sparkles trail, Nintendo Astro Bot art style, game icon", "golden star cluster"),
    "trail_fire": ("3D stylized toy comic flame boost trail, bright orange and red fire sparks, Nintendo Astro Bot art style, game icon", "flame boost"),
    "trail_snow": ("3D stylized toy glowing crystalline snowflakes, ice crystals trail, Nintendo Astro Bot art style, game icon", "snowflakes"),
    "trail_star": ("3D stylized toy glowing cosmic stardust galaxy spiral trail, purple and gold stars, Nintendo Astro Bot art style, game icon", "stardust galaxy"),

    # AURAS
    "aura_goldenglow": ("3D stylized toy heavenly golden radiance orb aura with halo rays and glitter, Nintendo Astro Bot art style, game icon", "golden radiance"),
    "aura_icecrystals": ("3D stylized toy rotating blue glowing diamond crystals barrier shield aura, Nintendo Astro Bot art style, game icon", "diamond crystals"),
    "aura_hearts": ("3D stylized toy shiny floating pink and red glossy hearts love aura, Nintendo Astro Bot art style, game icon", "glossy hearts"),
    "aura_fireflies": ("3D stylized toy glowing lime green magical fireflies and nature orbs aura, Nintendo Astro Bot art style, game icon", "fireflies"),
    "aura_storm": ("3D stylized toy cute cartoon mini storm cloud with tiny yellow lightning bolts, Nintendo Astro Bot art style, game icon", "storm cloud"),

    # EXPRESSIONS
    "expr_sunglasses": ("3D stylized toy oversized cool black sunglasses with glossy reflection, Nintendo Astro Bot art style, game icon", "sunglasses"),
    "expr_blush": ("3D stylized toy cute smiling face badge with glowing rosy pink cheeks, Nintendo Astro Bot art style, game icon", "rosy pink cheeks"),
    "expr_sleepy": ("3D stylized toy sleeping nightcap with golden ZZZ floating sleep bubbles, Nintendo Astro Bot art style, game icon", "nightcap"),
    "expr_hearteyes": ("3D stylized toy cartoon goggles with glowing red heart lenses, Nintendo Astro Bot art style, game icon", "heart lenses"),
    "expr_starry": ("3D stylized toy cute mask with glowing golden five-pointed star eyes, Nintendo Astro Bot art style, game icon", "star eyes"),

    # PACKS & CURRENCY
    "pack_pouch": ("3D stylized toy cute blue drawstring pouch bursting with glowing cyan diamonds and crystals, Nintendo Astro Bot art style, game icon", "pouch"),
    "pack_chest": ("3D stylized toy treasure chest overflowing with glowing purple and blue gemstones and crystals, Nintendo Astro Bot art style, game icon", "treasure chest"),
    "pack_vault": ("3D stylized toy sci-fi vault safe bursting with rainbow cosmic crystals and diamonds, Nintendo Astro Bot art style, game icon", "vault safe"),
    "pack_starter": ("3D stylized toy colorful celebration gift box with big ribbon, crystals and star burst, Nintendo Astro Bot art style, game icon", "gift box"),
    "pack_shield": ("3D stylized toy golden energy shield with glowing star crest, Nintendo Astro Bot art style, game icon", "energy shield"),
}

def get_recent_assets():
    res = subprocess.run([PIXVERSE_EXE, "asset", "list", "--type", "image", "--json", "--limit", "40"], capture_output=True, text=True)
    if res.returncode != 0:
        print("[ERR] Could not list assets:", res.stderr)
        return []
    try:
        data = json.loads(res.stdout)
        return data.get("items", [])
    except Exception as e:
        print("[ERR] JSON parse error:", e)
        return []

def download_and_crop(url, dest_path):
    temp_path = dest_path.with_suffix(".tmp.png")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req) as resp, open(str(temp_path), "wb") as f:
        f.write(resp.read())
    # Optimize to 256x256 WebP or clean PNG
    img = Image.open(temp_path)
    img.thumbnail((256, 256), Image.Resampling.LANCZOS)
    img.save(dest_path)
    temp_path.unlink(missing_ok=True)
    print(f"[SAVED] {dest_path.name} ({dest_path.stat().st_size} bytes)")

def sync():
    assets = get_recent_assets()
    
    # Check what we already have or can download
    for item_id, (prompt, kw) in ITEMS_CONFIG.items():
        dest = OUT_DIR / f"{item_id}.png"
        if dest.exists() and dest.stat().st_size > 1000:
            continue
        
        # Search among assets
        found = False
        for a in assets:
            p = a.get("prompt", "").lower()
            if kw.lower() in p and a.get("image_url") and a.get("image_status") == 1:
                print(f"[FOUND] {item_id} in existing assets!")
                download_and_crop(a["image_url"], dest)
                found = True
                break

    # Find remaining missing items
    missing = [k for k in ITEMS_CONFIG if not (OUT_DIR / f"{k}.png").exists()]
    print(f"\nRemaining missing items: {len(missing)}: {missing}")

    # Generate missing items using pixverse create image
    for item_id in missing:
        prompt, _ = ITEMS_CONFIG[item_id]
        print(f"\n[GEN] Generating {item_id}...")
        cmd = [PIXVERSE_EXE, "create", "image", "--prompt", prompt, "--aspect-ratio", "1:1", "--json"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            try:
                d = json.loads(res.stdout.strip())
                url = d.get("image_url")
                if url:
                    download_and_crop(url, OUT_DIR / f"{item_id}.png")
                else:
                    print(f"[WAIT] {item_id} returned without url: {res.stdout[:100]}")
            except Exception as e:
                print(f"[ERR] {e}")
        else:
            print(f"[ERR] Failed {item_id}: {res.stderr}")
        time.sleep(1)

if __name__ == "__main__":
    sync()
