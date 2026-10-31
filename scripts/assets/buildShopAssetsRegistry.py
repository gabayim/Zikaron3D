import os
from pathlib import Path

OUT_FILE = Path("C:/WorkspacePrime/Zikaron3D/src/data/shopAssets.ts")
SKINS_DIR = Path("C:/WorkspacePrime/Zikaron3D/assets/shop/skins")
ITEMS_DIR = Path("C:/WorkspacePrime/Zikaron3D/assets/shop/items")

ACCESSORY_IDS = [
    "hat_crown", "hat_tophat", "hat_pirate", "hat_flowercrown", "hat_viking",
    "trail_rainbow", "trail_sparkle", "trail_fire", "trail_snow", "trail_star",
    "aura_goldenglow", "aura_icecrystals", "aura_hearts", "aura_fireflies", "aura_storm",
    "expr_sunglasses", "expr_blush", "expr_sleepy", "expr_hearteyes", "expr_starry",
]

PACK_IDS = [
    "pack_pouch", "pack_chest", "pack_vault", "pack_starter", "pack_shield"
]

lines = [
    "// AUTO-GENERATED SHOP ASSET REGISTRY",
    "// Contains static requires for all PixVerse 3D item artifacts and character skin portraits",
    "",
    "export const ACCESSORY_ASSETS: Record<string, number> = {",
]

for acc in ACCESSORY_IDS:
    lines.append(f"  '{acc}': require('../../assets/shop/items/{acc}.png'),")

lines.append("};")
lines.append("")
lines.append("export const PACK_ASSETS: Record<string, number> = {")
for pack in PACK_IDS:
    lines.append(f"  '{pack}': require('../../assets/shop/items/{pack}.png'),")
lines.append("};")
lines.append("")

# Skins
skin_files = sorted([f.stem for f in SKINS_DIR.glob("*.png")])
lines.append("export const SKIN_ASSETS: Record<string, number> = {")
for s in skin_files:
    lines.append(f"  '{s}': require('../../assets/shop/skins/{s}.png'),")
lines.append("};")
lines.append("")

lines.append("""export function getAccessoryImage(id: string): number | undefined {
  return ACCESSORY_ASSETS[id];
}

export function getSkinImage(id: string): number | undefined {
  return SKIN_ASSETS[id];
}

export function getPackImage(id: string): number | undefined {
  return PACK_ASSETS[id];
}
""")

OUT_FILE.write_text("\n".join(lines), encoding="utf-8")
print(f"Generated {OUT_FILE} with {len(ACCESSORY_IDS)} accessories, {len(PACK_IDS)} packs, and {len(skin_files)} skins!")
