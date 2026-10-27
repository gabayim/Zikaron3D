#!/usr/bin/env bash
# Generates masters + animation clips for every critter in cast.tsv via the PixVerse CLI.
# Idempotent: skips anything already on disk. Max 3 concurrent PixVerse jobs.
# Usage: scripts/assets/generateCast.sh [masters|clips|all] [name ...]
set -uo pipefail
cd "$(dirname "$0")/../.."
STAGE=${1:-all}; shift || true
ONLY=("$@")

STYLE="Stylized premium 3D render in the style of Astro Bot and Nintendo first-party games, Pixar quality, glossy vinyl-toy material, soft rim light, subsurface glow, clean silhouette. Same art style, proportions and cuteness level as the reference creature (Pip)."
LOCK="Locked static camera, no camera movement, no zoom, no push-in. Wide shot: the character stays the same small size in the frame the whole time and never moves closer to the camera. The background is a perfectly flat solid pure chroma green (#00FF00) the entire time, no shadows on it, no other objects, no hands, no people. The character always stays fully inside the frame. Premium glossy vinyl-toy 3D animation, smooth Pixar-quality motion."
REF=assets/raw/pip/master_a.png

want() { [ ${#ONLY[@]} -eq 0 ] && return 0; for n in "${ONLY[@]}"; do [ "$n" = "$1" ] && return 0; done; return 1; }

master() {
  local name=$1 desc=$2 dir=assets/raw/$1
  mkdir -p "$dir"
  [ -s "$dir/green.png" ] && return
  # Generate directly on flat chroma green: the "transparent background" mode leaves a dark aura that
  # image-to-video turns into a dark outline around the character.
  local res
  res=$(pixverse create image --model gpt-image-2.5-flare --background opaque --aspect-ratio 1:1 --quality 1080p \
    --image "$REF" --json --prompt "Game character design, full body, front three-quarter view, centered. A NEW small adorable creature named ${name^}: $desc. $STYLE The background is a perfectly flat solid pure chroma green (#00FF00), completely uniform, with no shadow, no glow, no gradient, no ground, no text.") || { echo "master $name failed: $res" >&2; return; }
  local url; url=$(jq -r '.items[0].image_url // .image_url // empty' <<<"$res")
  [ -n "$url" ] || { echo "master $name: no url: $res" >&2; return; }
  curl -sL -o "$dir/master.png" "$url"
  .venv-assets/bin/python scripts/assets/cleanMaster.py "$dir/master.png" "$dir/green.png" && echo "master $name ok"
}

clip() {
  local name=$1 action=$2 mode=$3 dur=$4 prompt=$5 dir=assets/raw/$1
  [ -s "$dir/green.png" ] && [ ! -s "$dir/$action.mp4" ] || return
  local res url
  if [ "$mode" = loop ]; then
    res=$(pixverse create transition --model v6 --images "$dir/green.png" "$dir/green.png" --quality 720p --duration "$dur" --no-audio --json --prompt "$prompt $LOCK")
  else
    res=$(pixverse create video --model v6 --image "$dir/green.png" --quality 720p --aspect-ratio 1:1 --duration "$dur" --no-audio --no-multi-shot --json --prompt "$prompt $LOCK")
  fi || { echo "clip $name/$action failed: $res" >&2; return; }
  url=$(jq -r '.items[0].video_url // .video_url // empty' <<<"$res")
  [ -n "$url" ] && curl -sL -o "$dir/$action.mp4" "$url" && echo "clip $name/$action ok"
}

CLIPS=(
  "idle|loop|4|The cute round creature idles happily: gentle breathing bounce with soft squash and stretch, blinks once, sways slightly."
  "pop|video|3|The cute round creature pops up from below with a springy bounce, lands with squash and stretch, looks around with a big happy smile."
  "celebrate|video|4|The cute round creature celebrates wildly: jumps up with a big joyful spin in the air, lands and cheers with a huge smile."
  "sad|video|4|The cute round creature gets sad: droops down, eyes look down, shakes its head slowly, then perks back up with a small hopeful smile."
)

# Run at most 3 jobs at a time (PixVerse concurrency limit).
throttle() { while [ "$(jobs -rp | wc -l)" -ge 3 ]; do wait -n; done; }

run_stage_masters() {
  while IFS=$'\t' read -r name desc; do
    want "$name" || continue
    throttle
    master "$name" "$desc" &
  done < scripts/assets/cast.tsv
  wait
}

run_stage_clips() {
  while IFS=$'\t' read -r name _; do
    want "$name" || continue
    for c in "${CLIPS[@]}"; do
      IFS='|' read -r action mode dur prompt <<<"$c"
      throttle
      clip "$name" "$action" "$mode" "$dur" "$prompt" &
    done
  done < scripts/assets/cast.tsv
  wait
}

if [ "$STAGE" = masters ] || [ "$STAGE" = all ]; then run_stage_masters; fi
if [ "$STAGE" = clips ] || [ "$STAGE" = all ]; then run_stage_clips; fi
echo "cast generation finished"
