#!/usr/bin/env python3
"""Generates masters and animation clips for new Zikaron3D characters via PixVerse CLI.

Usage:
  python scripts/assets/generateNewCharacters.py master <character_id>
  python scripts/assets/generateNewCharacters.py clips <character_id>
  python scripts/assets/generateNewCharacters.py all <character_id>
  python scripts/assets/generateNewCharacters.py list
"""
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


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

ROOT = Path(__file__).resolve().parent.parent.parent
RAW_DIR = ROOT / "assets" / "raw"
REF_IMAGE = RAW_DIR / "pip" / "master_a.png"

STYLE = (
    "Stylized premium 3D render in the style of Astro Bot and Nintendo first-party games, "
    "Pixar quality, glossy vinyl-toy material, soft rim light, subsurface glow, clean silhouette. "
    "Same art style, proportions and cuteness level as the reference creature (Pip)."
)

LOCK = (
    "Locked static camera, no camera movement, no zoom, no push-in. Wide shot: the character stays "
    "the same small size in the frame the whole time and never moves closer to the camera. The background "
    "is a perfectly flat solid pure chroma green (#00FF00) the entire time, no shadows on it, no other "
    "objects, no hands, no people. The character always stays fully inside the frame. "
    "Premium glossy vinyl-toy 3D animation, smooth Pixar-quality motion."
)

NEW_CHARACTERS = {
    "coral": {
        "name": "Coral",
        "rarity": "epic",
        "desc": (
            "deep-sea pink (#FF7F9F), adorable small round bubbly translucent sea creature, "
            "tiny curled tail, soft pearl belly, big round glossy aqua eyes"
        ),
        "idle_prompt": "The cute bubbly creature idles happily: gentle breathing bounce with soft squash and stretch, tiny bubble pop, sways gently.",
        "hop_prompt": "The cute bubbly creature does an excited buoyant little hop straight up and lands with a bouncy squash and stretch.",
        "celebrate_prompt": "The cute bubbly creature cheers with joy: spins in the air with bubbles sparkling around it, lands with a huge happy smile.",
        "sad_prompt": "The cute bubbly creature droops softly, looks down, gentle sigh, then perks back up with a sweet hopeful smile.",
    },
    "moss": {
        "name": "Moss",
        "rarity": "epic",
        "desc": (
            "forest spirit green (#7FBF5F), cute chubby round moss-puff body with tiny sprouting leaves "
            "and blooming daisy flower on top, big sparkly gold eyes"
        ),
        "idle_prompt": "The cute moss creature idles peacefully: gentle breathing bounce, blinks softly, tiny flower on head sways in a breeze.",
        "hop_prompt": "The cute moss creature does a bouncy little jump, lands softly with squash and stretch, leaves flutter.",
        "celebrate_prompt": "The cute moss creature celebrates excitedly: leaps up with a full 360 spin, tiny petals burst with light, cheers happily.",
        "sad_prompt": "The cute moss creature droops down, flower wilts slightly, then perks right back up fresh and happy.",
    },
    "bolt": {
        "name": "Bolt",
        "rarity": "epic",
        "desc": (
            "electric amber (#FFB833), cute round retro-robot body with two glowing antenna bulbs, "
            "metallic yellow finish, big friendly glossy digital eyes"
        ),
        "idle_prompt": "The cute round robot idles cheerfully: gentle hover bobbing, antenna bulbs pulse with soft amber light, blinks digitally.",
        "hop_prompt": "The cute round robot does a joyful rocket hop with a tiny spark burst below, lands with bouncy spring.",
        "celebrate_prompt": "The cute robot celebrates: spins in the air, antenna bulbs flash bright like mini fireworks, cheers with happy electronic expression.",
        "sad_prompt": "The cute robot powers down slightly, antenna dims, head tilts, then beeps back to life with a bright smile.",
    },
    "luna": {
        "name": "Luna",
        "rarity": "epic",
        "desc": (
            "celestial lavender (#C7A8FF), dreamy plump moth/fairy creature with small glowing translucent "
            "wings on its back, big glossy violet eyes with star sparkle"
        ),
        "idle_prompt": "The cute fairy moth creature idles dreamily: soft flutter hover, translucent wings shimmer, gentle breathing bounce.",
        "hop_prompt": "The cute fairy creature flutters up in a graceful little hop and glides softly back down to its spot.",
        "celebrate_prompt": "The cute fairy creature celebrates: twirls in a magical airborne loop, wings emit sparkling stardust trail, cheers with big smile.",
        "sad_prompt": "The cute fairy creature folds its wings forward gently, looks down, then opens wings wide with a bright hopeful smile.",
    },
    "nova": {
        "name": "Nova",
        "rarity": "legendary",
        "desc": (
            "cosmic prismatic entity, glowing crystal star core inside a translucent pastel galaxy sphere, "
            "soft iridescent halo, big luminous celestial eyes"
        ),
        "idle_prompt": "The cute cosmic creature idles with gentle celestial pulse: internal star core radiates soft rainbow colors, slow dreamy hover.",
        "hop_prompt": "The cute cosmic creature bounces up with a flash of star particles, hovering with squash and stretch.",
        "celebrate_prompt": "The cute cosmic creature celebrates: floats up and unleashes a miniature supernova particle burst, rainbow halo glows bright.",
        "sad_prompt": "The cute cosmic creature dims slightly to a soft blue glow, curls in, then radiates back into brilliant full spectrum.",
    },
    "titan": {
        "name": "Titan",
        "rarity": "legendary",
        "desc": (
            "ancient golden golem (#D4AF37), miniature chubby stone-armor body with glowing runic carvings, "
            "polished gold crown horn, big warm amber eyes"
        ),
        "idle_prompt": "The cute miniature golem idles firmly: slow heavy breathing bounce, golden runes pulse warmly, blinks with a warm smile.",
        "hop_prompt": "The cute golem jumps with surprising springiness, lands with a solid cute stomp and settles happily.",
        "celebrate_prompt": "The cute golem celebrates with both arms raised in victory, golden crown horn gleams, runes shine brilliant gold.",
        "sad_prompt": "The cute golem slumps its stone shoulders, looks down, then clenches fists and perks back up determined.",
    },
}


PIXVERSE_BIN = os.environ.get("PIXVERSE_BIN", r"C:\Users\EREZ\AppData\Roaming\npm\pixverse.cmd")

def run_pixverse(cmd_args: list[str], max_retries: int = 3) -> dict:
    full_cmd = [PIXVERSE_BIN] + cmd_args + ["--json"]
    cmd_str = subprocess.list2cmdline(full_cmd)
    print(f"-> Running: {' '.join(full_cmd[:4])} ...")
    for attempt in range(max_retries):
        try:
            res = subprocess.run(cmd_str, capture_output=True, text=True, check=True, shell=True)
            return json.loads(res.stdout)
        except subprocess.CalledProcessError as e:
            print(f"Attempt {attempt + 1}/{max_retries} failed: {e.stderr}", file=sys.stderr)
            if attempt < max_retries - 1:
                time.sleep(4)
            else:
                raise


def generate_master(char_id: str) -> Path:
    if char_id not in NEW_CHARACTERS:
        raise ValueError(f"Unknown character: {char_id}")
    data = NEW_CHARACTERS[char_id]
    char_dir = RAW_DIR / char_id
    char_dir.mkdir(parents=True, exist_ok=True)
    green_png = char_dir / "green.png"
    master_png = char_dir / "master.png"

    if green_png.exists():
        print(f"Master green image already exists for {char_id}: {green_png}")
        return green_png

    prompt = (
        f"Game character design, full body, front three-quarter view, centered. "
        f"A NEW small adorable creature named {data['name']}: {data['desc']}. "
        f"{STYLE} The background is a perfectly flat solid pure chroma green (#00FF00), "
        f"completely uniform, with no shadow, no glow, no gradient, no ground, no text."
    )

    args = [
        "create", "image",
        "--model", "gpt-image-2.5-flare",
        "--aspect-ratio", "1:1",
        "--quality", "1080p",
        "--image", str(REF_IMAGE),
        "--prompt", prompt,
    ]

    out = run_pixverse(args)
    image_url = None
    if "items" in out and len(out["items"]) > 0:
        image_url = out["items"][0].get("image_url")
    if not image_url:
        image_url = out.get("image_url")

    if not image_url:
        raise RuntimeError(f"No image_url in output: {out}")

    print(f"Downloading master to {master_png} ...")
    download_file(image_url, master_png)

    # Clean with cleanMaster.py
    clean_py = ROOT / "scripts" / "assets" / "cleanMaster.py"
    print(f"Normalizing chroma-green master with cleanMaster.py ...")
    subprocess.run([sys.executable, str(clean_py), str(master_png), str(green_png)], check=True)
    print(f"Master created successfully: {green_png}")
    return green_png


def generate_clip(char_id: str, action: str, mode: str, duration: int, prompt_text: str) -> Path:
    char_dir = RAW_DIR / char_id
    green_png = char_dir / "green.png"
    if not green_png.exists():
        raise FileNotFoundError(f"Missing {green_png}, generate master first.")

    out_mp4 = char_dir / f"{action}.mp4"
    out_json = char_dir / f"{action}.json"

    if out_mp4.exists():
        print(f"Clip {char_id}/{action} already exists.")
        return out_mp4

    full_prompt = f"{prompt_text} {LOCK}"
    if mode == "loop":
        args = [
            "create", "transition",
            "--model", "v6",
            "--images", str(green_png), str(green_png),
            "--quality", "720p",
            "--duration", str(duration),
            "--no-audio",
            "--prompt", full_prompt,
        ]
    else:
        args = [
            "create", "video",
            "--model", "v6",
            "--image", str(green_png),
            "--quality", "720p",
            "--aspect-ratio", "1:1",
            "--duration", str(duration),
            "--no-audio",
            "--no-multi-shot",
            "--prompt", full_prompt,
        ]

    out = run_pixverse(args)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)

    video_url = None
    if "items" in out and len(out["items"]) > 0:
        video_url = out["items"][0].get("video_url")
    if not video_url:
        video_url = out.get("video_url")

    if not video_url:
        raise RuntimeError(f"No video_url for {action}: {out}")

    print(f"Downloading clip to {out_mp4} ...")
    download_file(video_url, out_mp4)
    print(f"Clip {action} created successfully.")
    return out_mp4


def generate_all_clips_for_char(char_id: str):
    data = NEW_CHARACTERS[char_id]
    clips = [
        ("idle", "loop", 4, data["idle_prompt"]),
        ("pop", "video", 3, f"The cute {data['name']} creature pops up from below with a springy bounce, lands with squash and stretch, looks around with a big happy smile."),
        ("celebrate", "video", 4, data["celebrate_prompt"]),
        ("sad", "video", 4, data["sad_prompt"]),
    ]

    for action, mode, dur, p in clips:
        generate_clip(char_id, action, mode, dur, p)


def build_sprites_for_char(char_id: str):
    build_py = ROOT / "scripts" / "assets" / "buildSprites.py"
    reg_py = ROOT / "scripts" / "assets" / "buildRegistry.py"
    print(f"Building sprite atlas for {char_id} ...")
    subprocess.run([sys.executable, str(build_py), char_id, "--max", "320"], check=True)
    print("Rebuilding cast registry ...")
    subprocess.run([sys.executable, str(reg_py)], check=True)


def main():
    parser = argparse.ArgumentParser(description="Generate new characters with PixVerse CLI")
    parser.add_argument("action", choices=["list", "master", "clips", "build", "all"])
    parser.add_argument("char_id", nargs="?", default="coral")
    args = parser.parse_args()

    if args.action == "list":
        print("Planned Characters:")
        for cid, info in NEW_CHARACTERS.items():
            print(f" - [{info['rarity'].upper()}] {cid}: {info['name']} -> {info['desc'][:60]}...")
        return

    cid = args.char_id
    if cid == "all":
        targets = list(NEW_CHARACTERS.keys())
    elif cid in NEW_CHARACTERS:
        targets = [cid]
    else:
        print(f"Error: Unknown character '{cid}'. Available: {list(NEW_CHARACTERS.keys())} or 'all'")
        sys.exit(1)

    for target in targets:
        if args.action in ["master", "all"]:
            generate_master(target)
        if args.action in ["clips", "all"]:
            generate_all_clips_for_char(target)
        if args.action in ["build", "all"]:
            build_sprites_for_char(target)

    print(f"\nDone with {cid}!")


if __name__ == "__main__":
    main()
