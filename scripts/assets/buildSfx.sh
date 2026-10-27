#!/usr/bin/env bash
# Synthesizes the UI/gameplay sound effects with ffmpeg into assets/audio/sfx/*.m4a
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=assets/audio/sfx
mkdir -p "$OUT"

synth() {
  local name=$1 dur=$2 expr=$3
  ffmpeg -y -v error -f lavfi -i "aevalsrc='$expr':s=44100:d=$dur" \
    -af "afade=t=out:st=$(printf '%.3f' "$(echo "$dur - 0.03" | bc)"):d=0.03,alimiter=limit=0.9" \
    -c:a aac -b:a 128k "$OUT/$name.m4a"
}

# Bubbly tap pop: fast downward pitch sweep.
synth pop 0.16 "0.8*sin(2*PI*(900*t-2000*t*t))*exp(-22*t)"
# Springy hop: wobbling pitch.
synth boing 0.45 "0.6*sin(2*PI*(220+120*sin(2*PI*14*t)*exp(-5*t))*t*2)*exp(-6*t)"
# Celebration arpeggio (C-E-G-C) with soft bell decay.
synth chime 1.2 "0.35*(sin(2*PI*1046.5*t)*exp(-4*t)+gte(t,0.08)*sin(2*PI*1318.5*t)*exp(-4*(t-0.08))+gte(t,0.16)*sin(2*PI*1568*t)*exp(-4*(t-0.16))+gte(t,0.24)*sin(2*PI*2093*t)*exp(-3*(t-0.24)))"
# Sparkle shimmer: high notes with tremolo.
synth sparkle 0.7 "0.25*(sin(2*PI*2637*t)+gte(t,0.05)*sin(2*PI*3136*t)+gte(t,0.1)*sin(2*PI*3951*t))*exp(-6*t)*(0.6+0.4*sin(2*PI*30*t))"
# Sad descending wah.
synth sad 0.7 "0.5*sin(2*PI*(440-160*t/0.7)*t*(1+0.01*sin(2*PI*6*t)))*exp(-2.5*t)"
# Soft whoosh: filtered noise swell.
ffmpeg -y -v error -f lavfi -i "anoisesrc=d=0.5:c=pink:a=0.6" \
  -af "bandpass=f=900:w=600,afade=t=in:d=0.2,afade=t=out:st=0.2:d=0.3" -c:a aac -b:a 128k "$OUT/whoosh.m4a"
ls -la "$OUT"
