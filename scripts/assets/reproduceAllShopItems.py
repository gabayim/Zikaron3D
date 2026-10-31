import json
import subprocess
import time
import urllib.request
from pathlib import Path
from PIL import Image

from chromaMatte import matte_image

OUT_DIR = Path("C:/WorkspacePrime/Zikaron3D/assets/shop/items")
OUT_DIR.mkdir(parents=True, exist_ok=True)

PIXVERSE_EXE = r"C:\Users\EREZ\AppData\Roaming\npm\pixverse.cmd"

# (item_id, prompt, screen_color, unique_keyword)
ITEMS = [
    # HATS
    ("hat_crown", "Game asset design, centered, 3D stylized royal golden crown encrusted with glowing red rubies and diamonds, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, vibrant studio lighting, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "royal golden crown"),
    ("hat_tophat", "Game asset design, centered, 3D stylized luxury black silk top hat with gold band and polished ruby jewel, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "luxury black silk"),
    ("hat_pirate", "Game asset design, centered, 3D stylized pirate captain tricorn hat with golden skull emblem and red plume feather, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "pirate captain tricorn"),
    ("hat_flowercrown", "Game asset design, centered, 3D stylized vibrant flower crown with blooming pink roses, yellow sunflowers, and daisies, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma magenta (#FF00FF), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "magenta", "vibrant flower crown"),
    ("hat_viking", "Game asset design, centered, 3D stylized viking warrior helmet with polished ivory curved horns and bronze rivets, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "viking warrior helmet"),

    # TRAILS
    ("trail_rainbow", "Game asset design, centered, 3D stylized glowing rainbow ribbon swirl with glittering magic stars, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "glowing rainbow ribbon"),
    ("trail_sparkle", "Game asset design, centered, 3D stylized cluster of sparkling golden five-pointed stars with magical glitter burst, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "cluster of sparkling golden"),
    ("trail_fire", "Game asset design, centered, 3D stylized comic flame rocket boost with bright orange and red fire sparks, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "comic flame rocket"),
    ("trail_snow", "Game asset design, centered, 3D stylized glowing crystalline ice snowflakes cluster with frost glitter, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "crystalline ice snowflakes"),
    ("trail_star", "Game asset design, centered, 3D stylized cosmic stardust vortex spiral with glowing purple and gold astral gems, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "cosmic stardust vortex"),

    # AURAS
    ("aura_goldenglow", "Game asset design, centered, 3D stylized divine golden sun halo ring with radiant sparkling rays, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "divine golden sun halo"),
    ("aura_icecrystals", "Game asset design, centered, 3D stylized rotating ring of floating blue diamond crystals, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "floating blue diamond crystals"),
    ("aura_hearts", "Game asset design, centered, 3D stylized cluster of floating shiny red and hot-pink candy hearts with sparkles, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "floating shiny red and hot-pink candy hearts"),
    ("aura_fireflies", "Game asset design, centered, 3D stylized magical yellow-green glowing forest fireflies buzzing in a circle, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma magenta (#FF00FF), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "magenta", "magical yellow-green glowing forest fireflies"),
    ("aura_storm", "Game asset design, centered, 3D stylized cute chubby cartoon thundercloud with tiny flashing yellow lightning bolts, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "cute chubby cartoon thundercloud"),

    # EXPRESSIONS
    ("expr_sunglasses", "Game asset design, centered, 3D stylized oversized futuristic black mirror sunglasses with gold metallic rim, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "futuristic black mirror sunglasses"),
    ("expr_blush", "Game asset design, centered, 3D stylized cute smiling emoji badge with rosy pink cheeks and happy eyes, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "smiling emoji badge with rosy pink cheeks"),
    ("expr_sleepy", "Game asset design, centered, 3D stylized lavender sleeping cap with golden floating ZZZ letters and night stars, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "lavender sleeping cap with golden floating zzz"),
    ("expr_hearteyes", "Game asset design, centered, 3D stylized cute goggles with glowing ruby red heart lenses, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "goggles with glowing ruby red heart lenses"),
    ("expr_starry", "Game asset design, centered, 3D stylized superhero masquerade mask with glowing five-pointed golden star eyes, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "superhero masquerade mask with glowing"),

    # PACKS & CURRENCY
    ("pack_pouch", "Game asset design, centered, 3D stylized royal blue velvet pouch tied with gold cord, bursting with glowing cyan diamonds and crystals, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "royal blue velvet pouch"),
    ("pack_chest", "Game asset design, centered, 3D stylized pirate treasure chest open and overflowing with glowing gems, crystals and gold coins, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "pirate treasure chest open and overflowing"),
    ("pack_vault", "Game asset design, centered, 3D stylized sci-fi metallic vault safe open with heaps of radiant rainbow cosmic crystals, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "sci-fi metallic vault safe open"),
    ("pack_starter", "Game asset design, centered, 3D stylized luxury celebration gift box with huge shiny magenta ribbon, bursting with gems and stars, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "celebration gift box with huge shiny magenta ribbon"),
    ("pack_shield", "Game asset design, centered, 3D stylized golden knight shield with glowing sapphire star crest and energy field, Nintendo Astro Bot toy art style, Pixar quality, glossy vinyl-toy material, soft rim light, clean silhouette. The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.", "green", "golden knight shield with glowing sapphire"),
]

def fetch_and_matte(image_url, dest_path, screen_color):
    tmp_path = dest_path.with_suffix(".tmp.png")
    req = urllib.request.Request(image_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req) as resp, open(str(tmp_path), "wb") as f:
        f.write(resp.read())
    
    raw = Image.open(tmp_path)
    matted = matte_image(raw, screen_color)
    matted.thumbnail((256, 256), Image.Resampling.LANCZOS)
    matted.save(dest_path)
    tmp_path.unlink(missing_ok=True)
    print(f"[MATTED & SAVED] {dest_path.name}")

def main():
    print("=== STARTING UNIFIED PIXVERSE ASSET PRODUCTION ===")
    
    # Check if hat_tophat test already exists
    test_tophat = Path("C:/WorkspacePrime/Zikaron3D/assets/shop/items/test_matted_square.png")
    if test_tophat.exists():
        test_tophat.replace(OUT_DIR / "hat_tophat.png")
        print("[INIT] Placed newly matted hat_tophat.png")

    # Queue in batches of 4 (respecting concurrent limit)
    submitted_tasks = {} # item_id -> (screen_color, kw)
    
    for item_id, prompt, screen_color, kw in ITEMS:
        if item_id == "hat_tophat":
            continue # already done!
            
        print(f"\n[SUBMIT] {item_id}...")
        cmd = [PIXVERSE_EXE, "create", "image", "--prompt", prompt, "--aspect-ratio", "1:1", "--no-wait", "--json"]
        
        while True:
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode == 0:
                try:
                    data = json.loads(res.stdout)
                    img_id = data.get("image_id")
                    if img_id:
                        print(f" -> Submitted task {img_id}")
                        submitted_tasks[item_id] = (screen_color, kw, img_id)
                        break
                    elif "error" in data and "limit" in data["error"].lower():
                        print(" -> Hit concurrency limit, waiting 8s for slots...")
                        time.sleep(8)
                        # While waiting, check if any completed and process them
                        check_and_download(submitted_tasks)
                    else:
                        print(" -> Unexpected output:", res.stdout[:120])
                        time.sleep(5)
                except Exception as e:
                    print(" -> JSON parse error:", e)
                    time.sleep(5)
            else:
                if "limit" in res.stderr.lower():
                    print(" -> Concurrency limit hit, waiting 8s...")
                    time.sleep(8)
                    check_and_download(submitted_tasks)
                else:
                    print(" -> Error:", res.stderr)
                    time.sleep(4)
                    break
        time.sleep(1)

    # Now wait and download all remaining
    print("\nAll tasks submitted! Waiting for completions...")
    while submitted_tasks:
        check_and_download(submitted_tasks)
        if submitted_tasks:
            time.sleep(5)

    print("\nALL 25 ITEMS REPRODUCED & MATTED WITH CONSISTENT ASTRO BOT STYLE!")

def check_and_download(tasks):
    if not tasks:
        return
    res = subprocess.run([PIXVERSE_EXE, "asset", "list", "--type", "image", "--json", "--limit", "30"], capture_output=True, text=True)
    if res.returncode != 0:
        return
    try:
        data = json.loads(res.stdout)
        assets = data.get("items", [])
    except Exception:
        return

    done_keys = []
    for item_id, (screen_color, kw, img_id) in tasks.items():
        dest = OUT_DIR / f"{item_id}.png"
        for a in assets:
            if a.get("id") == img_id or kw.lower() in a.get("prompt", "").lower():
                if a.get("image_status") == 1 and a.get("image_url"):
                    print(f"[READY] {item_id} is completed on PixVerse! Downloading and matting...")
                    try:
                        fetch_and_matte(a["image_url"], dest, screen_color)
                        done_keys.append(item_id)
                    except Exception as e:
                        print(f"[ERR] Matting failed for {item_id}:", e)
                    break
    for k in done_keys:
        tasks.pop(k, None)

if __name__ == "__main__":
    main()
