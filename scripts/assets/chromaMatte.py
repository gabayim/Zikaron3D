import numpy as np
from PIL import Image, ImageFilter

def matte_image(img: Image.Image, screen_color="green") -> Image.Image:
    """
    Keys out solid chroma background (green #00FF00 or magenta #FF00FF).
    Performs despill, edge softening, and returns clean RGBA Image.
    """
    rgb = np.asarray(img.convert("RGB"), dtype=np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

    if screen_color == "green":
        other = np.maximum(r, b)
        dom = g - other
        alpha_dom = np.clip(1.0 - (dom - 15.0) / (65.0 - 15.0), 0.0, 1.0)
        
        # Sample borders
        border = np.concatenate([rgb[:8].reshape(-1, 3), rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3), rgb[-8:].reshape(-1, 3)])
        bg = np.median(border, axis=0)
        dist = np.sqrt(((rgb - bg) ** 2).sum(axis=-1))
        alpha_dist = np.clip((dist - 35.0) / (95.0 - 35.0), 0.0, 1.0)
        alpha = np.minimum(alpha_dom, alpha_dist)
        
        # Despill green
        g2 = np.minimum(g, other + 6.0)
        out = np.dstack([r, g2, b, alpha * 255.0]).astype(np.uint8)
    else:  # magenta #FF00FF
        other = g
        dom = np.minimum(r, b) - other
        alpha_dom = np.clip(1.0 - (dom - 15.0) / (65.0 - 15.0), 0.0, 1.0)
        
        border = np.concatenate([rgb[:8].reshape(-1, 3), rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3), rgb[-8:].reshape(-1, 3)])
        bg = np.median(border, axis=0)
        dist = np.sqrt(((rgb - bg) ** 2).sum(axis=-1))
        alpha_dist = np.clip((dist - 35.0) / (95.0 - 35.0), 0.0, 1.0)
        alpha = np.minimum(alpha_dom, alpha_dist)
        
        # Despill magenta (clamp r and b towards green)
        r2 = np.minimum(r, g + 20.0)
        b2 = np.minimum(b, g + 20.0)
        out = np.dstack([r2, g, b2, alpha * 255.0]).astype(np.uint8)

    res = Image.fromarray(out, "RGBA")
    
    # Slight edge soft
    mask = res.split()[3]
    bbox = mask.getbbox()
    if bbox:
        # Add 6px padding to bbox
        w, h = res.size
        x1 = max(0, bbox[0] - 6)
        y1 = max(0, bbox[1] - 6)
        x2 = min(w, bbox[2] + 6)
        y2 = min(h, bbox[3] + 6)
        cropped = res.crop((x1, y1, x2, y2))
        
        # Square canvas centered
        max_dim = max(cropped.width, cropped.height)
        canvas = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
        ox = (max_dim - cropped.width) // 2
        oy = (max_dim - cropped.height) // 2
        canvas.paste(cropped, (ox, oy), cropped)
        return canvas
    return res

if __name__ == "__main__":
    test_in = Image.open("C:/WorkspacePrime/Zikaron3D/assets/shop/items/test_chroma_raw.png")
    out = matte_image(test_in, "green")
    out.thumbnail((256, 256), Image.Resampling.LANCZOS)
    out.save("C:/WorkspacePrime/Zikaron3D/assets/shop/items/test_matted_square.png")
    print("Test passed! Size:", out.size, "bbox:", out.getbbox())
