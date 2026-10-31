from PIL import Image, ImageOps, ImageEnhance
import re
from pathlib import Path

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
    
    # Colorize: black -> secondary, mid/white -> primary/glow
    colorized = ImageOps.colorize(gray, black=s_rgb, white=p_rgb, mid=g_rgb)
    colorized.putalpha(a)
    
    # Blend slightly with original base_img to preserve eye highlights and facial features
    blended = Image.blend(base_img.convert('RGB'), colorized.convert('RGB'), 0.72)
    blended.putalpha(a)
    return blended

# Test with pip_snow and pip_sunset
base_pip = Image.open('C:/WorkspacePrime/Zikaron3D/assets/shop/previews/pip_idle_frame0.png')
snow_pip = tint_image(base_pip, '#E2E8F0', '#94A3B8', '#F8FAFC')
snow_pip.save('C:/WorkspacePrime/Zikaron3D/assets/shop/previews/pip_snow_test.png')

sunset_pip = tint_image(base_pip, '#F43F5E', '#FB7185', '#FDA4AF')
sunset_pip.save('C:/WorkspacePrime/Zikaron3D/assets/shop/previews/pip_sunset_test.png')
print("Successfully generated test skin previews!")
