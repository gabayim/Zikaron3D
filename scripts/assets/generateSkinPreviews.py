import json
import re
from pathlib import Path
from PIL import Image, ImageOps

SPRITES_DIR = Path("C:/WorkspacePrime/Zikaron3D/assets/sprites")
OUT_DIR = Path("C:/WorkspacePrime/Zikaron3D/assets/shop/skins")
OUT_DIR.mkdir(parents=True, exist_ok=True)

CATALOG_PATH = Path("C:/WorkspacePrime/Zikaron3D/src/data/shopCatalog.ts")

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def tint_image(base_img, primary_hex, secondary_hex, glow_hex):
    # base_img is RGBA
    r, g, b, a = base_img.split()
    gray = ImageOps.grayscale(base_img)
    
    p_rgb = hex_to_rgb(primary_hex)
    s_rgb = hex_to_rgb(secondary_hex)
    g_rgb = hex_to_rgb(glow_hex)
    
    colorized = ImageOps.colorize(gray, black=s_rgb, white=p_rgb, mid=g_rgb)
    blended = Image.blend(base_img.convert('RGB'), colorized.convert('RGB'), 0.70)
    blended.putalpha(a)
    return blended

# Parse SKIN_CATALOG from shopCatalog.ts
with open(CATALOG_PATH, "r", encoding="utf-8") as f:
    code = f.read()

# Pattern to extract skin defs:
# id: '...', creatureId: '...', ... primary: '...', secondary: '...', glow: '...'
skin_pattern = re.compile(
    r"id:\s*'([^']+)',\s*creatureId:\s*'([^']+)',.*?primary:\s*'([^']+)',\s*secondary:\s*'([^']+)',\s*glow:\s*'([^']+)'",
    re.DOTALL
)

skins = skin_pattern.findall(code)
print(f"Found {len(skins)} skins to generate!")

# Cache base idle frames for each creature
base_cache = {}

for skin_id, creature_id, prim, sec, glow in skins:
    out_file = OUT_DIR / f"{skin_id}.png"
    if out_file.exists() and out_file.stat().st_size > 500:
        continue

    if creature_id not in base_cache:
        manifest_file = SPRITES_DIR / creature_id / "manifest.json"
        idle_file = SPRITES_DIR / creature_id / "idle.webp"
        if not manifest_file.exists() or not idle_file.exists():
            print(f"[WARN] Missing sprite data for {creature_id}")
            continue
        
        with open(manifest_file, "r", encoding="utf-8") as mf:
            m = json.load(mf)
        
        idle_info = m["clips"]["idle"]
        cols = idle_info["cols"]
        rows = idle_info["rows"]
        w = idle_info["w"]
        h = idle_info["h"]
        
        atlas = Image.open(idle_file)
        # Choose frame 0 or frame 1
        frame = atlas.crop((0, 0, w, h))
        # Trim transparent borders if needed, or keep centered in 180x180 square
        bbox = frame.getbbox()
        if bbox:
            cropped = frame.crop(bbox)
            # Create a 200x200 canvas centered
            canvas = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
            # Fit cropped inside 180x180 preserving aspect ratio
            cropped.thumbnail((170, 170), Image.Resampling.LANCZOS)
            x_off = (200 - cropped.width) // 2
            y_off = (200 - cropped.height) // 2
            canvas.paste(cropped, (x_off, y_off), cropped)
            base_cache[creature_id] = canvas
        else:
            base_cache[creature_id] = frame

    base_frame = base_cache.get(creature_id)
    if not base_frame:
        continue

    tinted = tint_image(base_frame, prim, sec, glow)
    tinted.save(out_file)
    print(f"[SKIN] Saved {out_file.name}")

print("\nAll skin previews generated successfully!")
