#!/usr/bin/env bash
# Generates the Phase 0 character clips for Pip via the PixVerse CLI.
# Output: assets/raw/pip/<action>.json (task result) and <action>.mp4
set -euo pipefail
cd "$(dirname "$0")/../../assets/raw/pip"

SRC=green_a.png
LOCK="Locked static camera, no camera movement, no zoom. The background is a perfectly flat solid pure chroma green (#00FF00) the entire time, no shadows on it, no other objects. The character always stays fully inside the frame. Premium glossy vinyl-toy 3D animation, smooth Pixar-quality motion."

gen_video() {
  local name=$1 dur=$2 prompt=$3
  [ -s "$name.mp4" ] && return
  pixverse create video --model v6 --image "$SRC" --quality 720p --aspect-ratio 1:1 \
    --duration "$dur" --no-audio --no-multi-shot --json --prompt "$prompt $LOCK" > "$name.json"
}

gen_loop() {
  local name=$1 dur=$2 prompt=$3
  [ -s "$name.mp4" ] && return
  pixverse create transition --model v6 --images "$SRC" "$SRC" --quality 720p \
    --duration "$dur" --no-audio --json --prompt "$prompt $LOCK" > "$name.json"
}

gen_loop  idle      4 "The cute round creature idles happily: gentle breathing bounce with soft squash and stretch, blinks once, sways slightly, its golden antenna orb pulses with light." &
gen_video hop       3 "The cute round creature does a joyful little hop straight up and lands with a bouncy squash and stretch, then settles back to its starting pose." &
gen_video celebrate 4 "The cute round creature celebrates wildly: jumps up with both stubby arms raised, does a full spin in the air, lands, cheers with a huge smile, antenna orb flashes bright." &
gen_video sad       4 "The cute round creature gets sad: droops down, eyes look down, shakes its head slowly, then perks back up with a small hopeful smile." &
gen_video surprised 3 "The cute round creature alone gets startled: eyes go wide, it wobbles like jelly, then giggles happily. Only the creature is visible, no hands, no people." &
gen_video wave      4 "The cute round creature looks at the viewer and waves one stubby arm hello with a big friendly smile, then returns to its pose." &
wait

for f in *.json; do
  url=$(jq -r '.items[0].video_url // .video_url // empty' "$f")
  [ -n "$url" ] && curl -sL -o "${f%.json}.mp4" "$url"
done
ls -la
