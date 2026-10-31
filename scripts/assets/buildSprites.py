#!/usr/bin/env python3
"""Chroma-keys PixVerse character clips into packed sprite atlases.

Usage: python3 scripts/assets/buildSprites.py <character> [--fps 12] [--max 320]
Reads   assets/raw/<character>/<clip>.mp4
Writes  assets/sprites/<character>/<clip>.webp + assets/sprites/<character>/manifest.json

Every character shares one logical frame (FIXED_CROP scaled to --max) so cast scale stays consistent.
Each clip atlas is trimmed to that clip's content; its cells are `w`x`h` placed at (`x`, `y`) in the
logical frame. The rect may extend past the frame when a pose leaves the shared crop.
"""
import argparse
import json
import math
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
LOOPING = {"idle"}
ALPHA_CUTOFF = 24
PAD = 6
MAX_TEXTURE = 4096
# All green masters place the character at the same size/position, so a shared crop keeps cast scale consistent.
FIXED_CROP = (96, 0, 864, 960)


def matte(img: Image.Image) -> Image.Image:
    """Green-screen matte via green dominance (g - max(r,b)).

    Characters whose own colour is strongly green will be eaten; generate those on another colour.
    """
    rgb = np.asarray(img.convert("RGB"), dtype=np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    other = np.maximum(r, b)
    # Green dominance in absolute terms: keys out dark shadows and washed-out light green patches alike.
    dom = g - other
    alpha_dom = np.clip(1.0 - (dom - 12.0) / (60.0 - 12.0), 0.0, 1.0)
    # The generated "green" drifts (washed or greyish) inside some clips, so also compare against the
    # background colour sampled from this frame's top/side borders; a pixel is background if either test says so.
    border = np.concatenate([rgb[:6].reshape(-1, 3), rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=-1))
    alpha_dist = np.clip((dist - 35.0) / (95.0 - 35.0), 0.0, 1.0)
    alpha = np.minimum(alpha_dom, alpha_dist)
    # The video model leaves a dark grey-green shadow rim around the subject. Drop dark, green-leaning
    # pixels, but only near the background, so genuinely dark details (eyes) are untouched.
    bg_mask = Image.fromarray(((alpha < 0.05) * 255).astype(np.uint8), "L")
    near_bg = np.asarray(bg_mask.filter(ImageFilter.MaxFilter(27))) > 0
    dark_green = (g >= np.maximum(r, b) - 3.0) & (np.maximum(np.maximum(r, g), b) < 125.0)
    alpha = np.where(near_bg & dark_green, 0.0, alpha)
    # Despill: clamp green to the other channels so edge pixels lose their green fringe.
    g2 = np.minimum(g, other + 6.0)
    out = np.dstack([r, g2, b, alpha * 255.0]).astype(np.uint8)
    res = Image.fromarray(out, "RGBA")
    # Pull the matte in by ~1px and soften slightly to kill the remaining halo.
    a_ch = res.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    res.putalpha(a_ch)
    return res


def extract(clip: Path, out: Path, fps: int) -> list[Path]:
    out.mkdir(parents=True)
    raw = out / "raw"
    raw.mkdir()
    subprocess.run(["ffmpeg", "-v", "error", "-i", str(clip), "-vf", f"fps={fps}", str(raw / "%04d.png")], check=True)
    paths = []
    for f in sorted(raw.glob("*.png")):
        dst = out / f.name
        matte(Image.open(f)).save(dst)
        paths.append(dst)
    return paths


def alpha_bbox(img: Image.Image):
    # Opening drops single-pixel specks so they do not inflate the trim box.
    mask = img.getchannel("A").point(lambda a: 255 if a > ALPHA_CUTOFF else 0)
    return mask.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5)).getbbox()


def pack(n: int, cw: int, ch: int) -> tuple[int, int]:
    """Columns/rows with the smallest atlas area that fits MAX_TEXTURE wide."""
    best = None
    for cols in range(1, min(n, MAX_TEXTURE // cw) + 1):
        rows = math.ceil(n / cols)
        if rows * ch > MAX_TEXTURE:
            continue
        area = cols * cw * rows * ch
        if best is None or area < best[0]:
            best = (area, cols, rows)
    assert best, f"{n} frames of {cw}x{ch} do not fit a {MAX_TEXTURE}px atlas"
    return best[1], best[2]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("character")
    ap.add_argument("--fps", type=int, default=12)
    ap.add_argument("--max", type=int, default=320)
    args = ap.parse_args()

    raw = ROOT / "assets/raw" / args.character
    dst = ROOT / "assets/sprites" / args.character
    dst.mkdir(parents=True, exist_ok=True)
    clips = sorted(raw.glob("*.mp4"))
    tmp = Path(tempfile.mkdtemp())

    cx0, cy0, cx1, cy1 = FIXED_CROP
    scale = min(1.0, args.max / max(cx1 - cx0, cy1 - cy0))
    fw, fh = round((cx1 - cx0) * scale), round((cy1 - cy0) * scale)
    manifest = {
        "character": args.character,
        "frameWidth": fw,
        "frameHeight": fh,
        "fps": args.fps,
        "clips": {},
    }

    for clip in clips:
        name = clip.stem
        paths = extract(clip, tmp / name, args.fps)
        box = None
        edge_hits = 0
        for f in paths:
            with Image.open(f) as img:
                b = alpha_bbox(img)
                w, h = img.size
            if not b:
                continue
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
            # Bottom edge is expected for "pop" (rises from below); only flag sides/top.
            if b[0] <= 2 or b[1] <= 2 or b[2] >= w - 2:
                edge_hits += 1
        if edge_hits:
            print(f"WARNING {args.character}/{name}: {edge_hits}/{len(paths)} frames touch the video edge (zoom or out of frame?)")
        assert box, f"{args.character}/{name}: no visible pixels"

        # Snap the trim box to whole logical pixels so cells line up exactly with the frame grid.
        lx0 = math.floor((max(0, box[0] - PAD) - cx0) * scale)
        ly0 = math.floor((max(0, box[1] - PAD) - cy0) * scale)
        lx1 = math.ceil((min(w, box[2] + PAD) - cx0) * scale)
        ly1 = math.ceil((min(h, box[3] + PAD) - cy0) * scale)
        cw, ch = lx1 - lx0, ly1 - ly0
        src = (cx0 + lx0 / scale, cy0 + ly0 / scale, cx0 + lx1 / scale, cy0 + ly1 / scale)

        cols, rows = pack(len(paths), cw, ch)
        atlas = Image.new("RGBA", (cols * cw, rows * ch), (0, 0, 0, 0))
        for i, p in enumerate(paths):
            with Image.open(p) as img:
                cell = img.resize((cw, ch), Image.LANCZOS, box=src)
            atlas.paste(cell, ((i % cols) * cw, (i // cols) * ch))
        atlas.save(dst / f"{name}.webp", "WEBP", quality=88, method=6)
        manifest["clips"][name] = {
            "frames": len(paths),
            "cols": cols,
            "rows": rows,
            "loop": name in LOOPING,
            "x": lx0,
            "y": ly0,
            "w": cw,
            "h": ch,
        }
        mb = atlas.size[0] * atlas.size[1] * 4 / 1e6
        print(f"{name}: {len(paths)} frames, cell {cw}x{ch} at ({lx0},{ly0}), {cols}x{rows}, {atlas.size} ~{mb:.1f}MB decoded")

    (dst / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    shutil.rmtree(tmp)
    print(f"logical frame {fw}x{fh}, crop {FIXED_CROP}")


if __name__ == "__main__":
    main()
