#!/usr/bin/env python3
"""Generates still backgrounds and music tracks for new Zikaron3D worlds via PixVerse CLI.

Usage:
  python scripts/assets/generateWorlds.py stills
  python scripts/assets/generateWorlds.py music
  python scripts/assets/generateWorlds.py all
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
WORLDS_DIR = ROOT / "assets" / "worlds"
MUSIC_DIR = ROOT / "assets" / "audio" / "music"
PIXVERSE_BIN = os.environ.get("PIXVERSE_BIN", r"C:\Users\EREZ\AppData\Roaming\npm\pixverse.cmd")

STYLE = (
    "Stylized premium 3D mobile game environment, Astro Bot and Nintendo first-party quality, "
    "clean vibrant aesthetic, Pixar lighting, soft rim light, vertical portrait orientation, "
    "no characters, no text, no UI, wide panoramic view."
)

NEW_WORLDS = {
    "deep_sea": {
        "name": "Deep Sea",
        "accent": "#FF7F9F",
        "accent2": "#48CAE4",
        "residents": ["coral"],
        "unlockLevel": 7,
        "image_prompt": (
            "Enchanting deep sea coral reef ocean floor, glowing bioluminescent coral plants, "
            "soft floating bubbles, turquoise and deep magenta marine lighting, gentle light rays underwater. "
            f"{STYLE}"
        ),
        "music_prompt": (
            "Dreamy calm underwater ambient game soundtrack, bubbly synth plucks, harp, "
            "soothing warm pads, loopable, gentle peaceful rhythm, high quality Nintendo style."
        ),
    },
    "grove": {
        "name": "Enchanted Grove",
        "accent": "#7FBF5F",
        "accent2": "#F4A261",
        "residents": ["moss"],
        "unlockLevel": 10,
        "image_prompt": (
            "Enchanted fairy moss grove, giant round lush green moss rocks, magical tiny blooming flowers, "
            "warm golden sunlight filtering through leaves, floating glowing forest spores. "
            f"{STYLE}"
        ),
        "music_prompt": (
            "Cheerful whimsical forest acoustic game soundtrack, acoustic guitar, marimba, flute, "
            "warm uplifting melody, Nintendo Animal Crossing style, loopable."
        ),
    },
    "circuit": {
        "name": "Neon Circuit",
        "accent": "#FFB833",
        "accent2": "#00F0FF",
        "residents": ["bolt"],
        "unlockLevel": 15,
        "image_prompt": (
            "Friendly futuristic circuit playground, glowing amber and cyan glass towers, "
            "soft neon pathways, clean smooth cyber toy aesthetic, starry digital horizon. "
            f"{STYLE}"
        ),
        "music_prompt": (
            "Upbeat retro-future chiptune synth game soundtrack, playful electronic beat, "
            "warm synthesizer arpeggios, bouncy bass, Astro Bot style, loopable."
        ),
    },
    "summit": {
        "name": "Starlight Summit",
        "accent": "#C7A8FF",
        "accent2": "#FFD700",
        "residents": ["luna", "nova", "titan"],
        "unlockLevel": 20,
        "image_prompt": (
            "Dreamy starlight mountain summit floating in clouds, glowing pastel amethyst crystals, "
            "aurora borealis night sky with golden stars, mystical celestial landscape. "
            f"{STYLE}"
        ),
        "music_prompt": (
            "Celestial dreamy orchestral game soundtrack, twinkling celesta, warm lush strings, "
            "soft choir pad, peaceful magical bedtime lullaby feel, loopable."
        ),
    },
}


def download_file(url: str, out_path: Path):
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        )
        with urllib.request.urlopen(req) as resp, open(out_path, "wb") as f:
            f.write(resp.read())
    except Exception as e:
        print(f"urllib download failed: {e}. Falling back to curl...")
        subprocess.run(["curl.exe", "-sL", "-o", str(out_path), url], check=True)


def run_pixverse(cmd_args: list[str]) -> dict:
    full_cmd = [PIXVERSE_BIN] + cmd_args + ["--json"]
    cmd_str = subprocess.list2cmdline(full_cmd)
    print(f"-> Running: {' '.join(full_cmd[:4])} ...")
    try:
        res = subprocess.run(cmd_str, capture_output=True, text=True, check=True, shell=True)
        return json.loads(res.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Pixverse error (stderr): {e.stderr}", file=sys.stderr)
        print(f"Pixverse error (stdout): {e.stdout}", file=sys.stderr)
        raise


def generate_world_still(world_id: str):
    data = NEW_WORLDS[world_id]
    w_dir = WORLDS_DIR / world_id
    w_dir.mkdir(parents=True, exist_ok=True)
    out_webp = w_dir / "still.webp"
    raw_png = w_dir / "raw.png"

    if out_webp.exists():
        print(f"Still for {world_id} already exists: {out_webp}")
        return

    print(f"Generating still background for {world_id} ...")
    args = [
        "create", "image",
        "--model", "gpt-image-2.5-flare",
        "--aspect-ratio", "9:16",
        "--quality", "1080p",
        "--prompt", data["image_prompt"],
    ]

    out = run_pixverse(args)
    image_url = None
    if "items" in out and len(out["items"]) > 0:
        image_url = out["items"][0].get("image_url")
    if not image_url:
        image_url = out.get("image_url")

    if not image_url:
        raise RuntimeError(f"No image_url returned: {out}")

    print(f"Downloading raw image to {raw_png} ...")
    download_file(image_url, raw_png)

    print(f"Converting to WebP {out_webp} (1080x1920) ...")
    with Image.open(raw_png) as img:
        img_resized = img.resize((1080, 1920), Image.LANCZOS)
        img_resized.save(out_webp, "WEBP", quality=88, method=6)

    print(f"World still for {world_id} created successfully!")


def generate_world_music(world_id: str):
    data = NEW_WORLDS[world_id]
    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    out_m4a = MUSIC_DIR / f"{world_id}.m4a"
    raw_mp3 = MUSIC_DIR / f"{world_id}_raw.mp3"

    if out_m4a.exists():
        print(f"Music for {world_id} already exists: {out_m4a}")
        return

    print(f"Generating music for {world_id} ...")
    args = [
        "create", "music",
        "--model", "music-2.6",
        "--instrumental",
        "--prompt", data["music_prompt"],
    ]

    out = run_pixverse(args)
    audio_url = None
    if "items" in out and len(out["items"]) > 0:
        audio_url = out["items"][0].get("audio_url") or out["items"][0].get("music_url")
    if not audio_url:
        audio_url = out.get("audio_url") or out.get("music_url")

    if not audio_url:
        raise RuntimeError(f"No audio_url returned: {out}")

    print(f"Downloading audio to {raw_mp3} ...")
    download_file(audio_url, raw_mp3)

    print(f"Encoding to AAC {out_m4a} ...")
    subprocess.run([
        "ffmpeg", "-y", "-i", str(raw_mp3),
        "-c:a", "aac", "-b:a", "128k",
        str(out_m4a)
    ], check=True)

    if raw_mp3.exists():
        raw_mp3.unlink()

    print(f"World music for {world_id} created successfully!")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["stills", "music", "all"])
    parser.add_argument("world_id", nargs="?", default="all")
    args = parser.parse_args()

    targets = list(NEW_WORLDS.keys()) if args.world_id == "all" else [args.world_id]

    for wid in targets:
        if args.action in ["stills", "all"]:
            generate_world_still(wid)
        if args.action in ["music", "all"]:
            generate_world_music(wid)

    print("\nAll world generation steps completed!")


if __name__ == "__main__":
    main()
