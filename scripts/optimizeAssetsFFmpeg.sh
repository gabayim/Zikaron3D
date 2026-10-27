#!/usr/bin/env bash
# ==============================================================================
# Zikaron3D - Asset Optimization Pipeline
# Extracts Frame 0 to a tiny WebP (~25KB) for instant card flips
# and compresses PixVerse MP4s to optimized HEVC H.265 (.mp4) with faststart
# for seamless expo-video cutscene playback.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CARDS_DIR="$PROJECT_ROOT/assets/cards"
MANIFEST_FILE="$CARDS_DIR/manifest.json"

echo "======================================================"
echo "  Zikaron3D - Living Card Video & Frame-0 Optimizer"
echo "  Directory: $CARDS_DIR"
echo "======================================================"

if ! command -v ffmpeg &> /dev/null; then
  echo "Error: ffmpeg is not installed or not in PATH."
  echo "Please install ffmpeg (e.g. brew install ffmpeg)"
  exit 1
fi

if [ ! -d "$CARDS_DIR" ]; then
  echo "Error: Directory $CARDS_DIR does not exist."
  exit 1
fi

shopt -s nullglob
MP4_FILES=("$CARDS_DIR"/*.mp4)

if [ ${#MP4_FILES[@]} -eq 0 ]; then
  echo "No MP4 files found in $CARDS_DIR"
  exit 0
fi

echo ""
echo "Processing ${#MP4_FILES[@]} card assets..."
echo ""

for file in "${MP4_FILES[@]}"; do
  filename="$(basename "$file")"
  
  # Skip already optimized files
  if [[ "$filename" == *"_optimized.mp4"* ]]; then
    continue
  fi

  card_id="${filename%.mp4}"
  frame0_webp="$CARDS_DIR/${card_id}_frame0.webp"
  optimized_mp4="$CARDS_DIR/${card_id}_optimized.mp4"

  echo "━━━ Card: [$card_id] ━━━"

  # 1. Extract Frame 0 as lightweight WebP (~25KB) for instant card flips
  echo -n "  • Extracting Frame 0 -> ${card_id}_frame0.webp ... "
  ffmpeg -y -hide_banner -loglevel error \
    -ss 00:00:00.000 \
    -i "$file" \
    -vframes 1 \
    -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" \
    -f image2pipe \
    -vcodec png - \
    | cwebp -q 80 -quiet -o "$frame0_webp" -- -

  frame0_size=$(ls -lh "$frame0_webp" | awk '{print $5}')
  echo "✓ ($frame0_size)"

  # 2. Compress to optimized HEVC (H.265) for iOS/macOS hardware acceleration
  # -tag:v hvc1 is mandatory for Apple AVPlayer / expo-video playback
  # -movflags +faststart moves moov atom to beginning of file for instant playback
  echo -n "  • Compressing HEVC -> ${card_id}_optimized.mp4 ... "
  ffmpeg -y -hide_banner -loglevel error \
    -i "$file" \
    -c:v libx265 \
    -tag:v hvc1 \
    -crf 26 \
    -preset medium \
    -c:a aac \
    -b:a 96k \
    -movflags +faststart \
    "$optimized_mp4"

  orig_size=$(ls -lh "$file" | awk '{print $5}')
  opt_size=$(ls -lh "$optimized_mp4" | awk '{print $5}')
  echo "✓ ($orig_size -> $opt_size)"
done

# 3. Update manifest.json with frame0 and optimized paths
echo ""
echo "Updating $MANIFEST_FILE..."

node - << 'EOF'
const fs = require('fs');
const path = require('path');

const manifestPath = path.resolve('assets/cards/manifest.json');
const cardsDir = path.resolve('assets/cards');

if (!fs.existsSync(manifestPath)) {
  fs.writeFileSync(manifestPath, JSON.stringify({}, null, 2));
}

let manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
} catch (e) {
  manifest = {};
}

const files = fs.readdirSync(cardsDir);
const baseCardIds = new Set();

files.forEach(f => {
  if (f.endsWith('.mp4') && !f.endsWith('_optimized.mp4')) {
    baseCardIds.add(f.replace('.mp4', ''));
  }
});

baseCardIds.forEach(id => {
  const frame0Path = `assets/cards/${id}_frame0.webp`;
  const optPath = `assets/cards/${id}_optimized.mp4`;
  const origPath = `assets/cards/${id}.mp4`;

  if (!manifest[id]) {
    manifest[id] = {
      id,
      name: id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      file: origPath
    };
  }

  if (fs.existsSync(path.resolve(frame0Path))) {
    manifest[id].frame0 = frame0Path;
  }
  if (fs.existsSync(path.resolve(optPath))) {
    manifest[id].optimized = optPath;
  }
});

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('✓ manifest.json successfully updated with frame0 and optimized asset paths.');
EOF

echo ""
echo "======================================================"
echo "  Asset Optimization Complete!"
echo "======================================================"
