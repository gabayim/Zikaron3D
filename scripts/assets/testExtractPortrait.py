from PIL import Image
import json
from pathlib import Path

# Load PIP manifest or castRegistry
cast_reg_path = Path("C:/WorkspacePrime/Zikaron3D/src/render/castRegistry.ts")
# Let's inspect pip's idle atlas
img = Image.open("C:/WorkspacePrime/Zikaron3D/assets/sprites/pip/idle.webp")
print(f"PIP idle dimensions: {img.size}, mode: {img.mode}")

# Pip idle manifest in castRegistry:
# clips: {"idle": {"frames": 49, "cols": 7, "rows": 7, "loop": true, "x": 20, "y": 59, "w": 212, "h": 224}}
# frameWidth: 256, frameHeight: 320
# Let's crop frame 0: column 0, row 0 -> (0, 0, 256, 320)
frame0 = img.crop((0, 0, 256, 320))
OUT = Path("C:/WorkspacePrime/Zikaron3D/assets/shop/previews")
OUT.mkdir(parents=True, exist_ok=True)
frame0.save(OUT / "pip_sample.png")
print("Saved pip_sample.png")
