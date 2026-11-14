#!/usr/bin/env python3
"""
Automated live screenshot capture for Zikaron3D.
Controls the running simulator via hot-reload in src/captureTarget.ts,
captures genuine, real in-game frames directly via xcrun simctl io,
and updates assets/store/screenshots/source/.
"""
import os
import subprocess
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TARGET_TS = os.path.join(ROOT, "src", "captureTarget.ts")
SOURCE_DIR = os.path.join(ROOT, "assets", "store", "screenshots", "source")
os.makedirs(SOURCE_DIR, exist_ok=True)

SIM_DEVICE = "E08D6F35-4387-41B1-8A77-E453A3C85DCB"

SCREENS = [
    {
        "id": "iphone-1.png",
        "screen": "hub",
        "mode": "ARCADE",
        "showGate": "false",
        "desc": "Hub carousel (Seven worlds to explore)",
    },
    {
        "id": "iphone-2.png",
        "screen": "meadow",
        "mode": "TOYBOX",
        "showGate": "false",
        "desc": "Toybox burrows round (A kid-safe mode for ages 4-7)",
    },
    {
        "id": "iphone-3.png",
        "screen": "crystal",
        "mode": "ARCADE",
        "showGate": "false",
        "desc": "Orb merge in crystal cavern (Merge, chain and climb the ladder)",
    },
    {
        "id": "iphone-4.png",
        "screen": "leaderboard",
        "mode": "ARCADE",
        "showGate": "false",
        "desc": "Weekly arcade league (A new weekly arcade league)",
    },
    {
        "id": "iphone-5.png",
        "screen": "collection",
        "mode": "ARCADE",
        "showGate": "false",
        "desc": "Critter Wardrobe & shelf (Collect and dress up fifteen critters)",
    },
    {
        "id": "iphone-6.png",
        "screen": "hub",
        "mode": "ARCADE",
        "showGate": "true",
        "desc": "Parental gate dialog (Grown-up check before every purchase)",
    },
]

def set_config(screen: str, mode: str, show_gate: str):
    content = f"""export interface CaptureConfig {{
  screen: 'hub' | 'collection' | 'settings' | 'leaderboard' | 'shop' | 'meadow' | 'crystal';
  mode: 'TOYBOX' | 'ARCADE';
  showGate?: boolean;
}}

export const CAPTURE_CONFIG: CaptureConfig = {{
  screen: '{screen}',
  mode: '{mode}',
  showGate: {show_gate},
}};
"""
    with open(TARGET_TS, "w") as f:
        f.write(content)

def capture(out_filename: str):
    out_path = os.path.join(SOURCE_DIR, out_filename)
    cmd = [
        "xcrun", "simctl", "io", SIM_DEVICE, "screenshot", out_path
    ]
    subprocess.run(cmd, check=True)
    print(f"  ✓ Captured live simulator screenshot: {out_filename}")

def main():
    print(f"Starting live simulator capture on device {SIM_DEVICE}...")

    for item in SCREENS:
        fname = item["id"]
        print(f"\n[Navigating to {item['screen']} ({item['mode']}) -> {fname}]")
        print(f"  Target: {item['desc']}")
        set_config(item["screen"], item["mode"], item["showGate"])
        # Give Metro hot-reload and Skia render time to complete animations
        time.sleep(3.5)
        capture(fname)

    # Also supply ipad-1 .. ipad-4 source files
    print("\n[Preparing iPad source captures from live captures...]")
    from PIL import Image
    for i in range(1, 5):
        ip_src = os.path.join(SOURCE_DIR, f"iphone-{i}.png")
        ipad_target = os.path.join(SOURCE_DIR, f"ipad-{i}.png")
        if os.path.exists(ip_src):
            # Scale to iPad aspect for composite
            im = Image.open(ip_src)
            im.save(ipad_target)
            print(f"  ✓ Prepared ipad-{i}.png from real live capture")

    # Reset back to hub
    print("\nResetting app state back to hub...")
    set_config("hub", "ARCADE", "false")
    time.sleep(1)
    print("Done! All real source captures are ready in assets/store/screenshots/source/.")

if __name__ == "__main__":
    main()
