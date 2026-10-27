import React from 'react';
import { Atlas, FilterMode, MipmapMode, Skia, useImage, type SkImage } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { CharacterSheet, ClipName } from './sprites';

/**
 * Loads every clip atlas of a character, indexed by `sheet.order`.
 * The clip count of a sheet never changes, so the hook count is stable across renders.
 */
export function useCharacterImages(sheet: CharacterSheet): (SkImage | null)[] {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return sheet.order.map((name) => useImage(sheet.sources[name]));
}

/**
 * Like `useCharacterImages` but only decodes the clips in `wanted` (others stay null).
 * Keeps memory low: every decoded atlas costs ~17MB. `wanted` must be stable across renders.
 */
export function useClipImages(sheet: CharacterSheet, wanted: readonly string[]): (SkImage | null)[] {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return sheet.order.map((name) => useImage(wanted.includes(name) ? sheet.sources[name] : null));
}

/**
 * Drives clip playback on the UI thread. Non-looping clips fall back to the idle loop (clip index 0)
 * when they finish.
 */
export function useSpritePlayer(sheet: CharacterSheet, startOffsetMs = 0, staticPose = false) {
  const clip = useSharedValue(0);
  const clipStart = useSharedValue(-1);
  const frame = useSharedValue(0);
  // Desyncs identical idle loops; consumed on first frame only.
  const offset = useSharedValue(startOffsetMs);
  const meta = sheet.order.map((n) => sheet.clips[n]);
  const fps = sheet.fps;

  useFrameCallback((info) => {
    if (staticPose) return;
    const now = info.timestamp;
    if (clipStart.value < 0) {
      clipStart.value = now - offset.value;
      offset.value = 0;
    }
    const m = meta[clip.value];
    let f = Math.floor(((now - clipStart.value) * fps) / 1000);
    if (m.loop) {
      f %= m.frames;
    } else if (f >= m.frames) {
      clip.value = 0;
      clipStart.value = now;
      f = 0;
    }
    frame.value = f;
  });

  const play = (name: ClipName) => {
    clip.set(sheet.order.indexOf(name));
    clipStart.set(-1);
  };
  const current = (): ClipName => sheet.order[clip.get()];

  return { clip, frame, play, current };
}

interface Props {
  sheet: CharacterSheet;
  images: (SkImage | null)[];
  clip: SharedValue<number>;
  frame: SharedValue<number>;
  x: number;
  y: number;
  height: number;
}

export function SpriteCharacter({ sheet, images, clip, frame, x, y, height }: Props) {
  const meta = sheet.order.map((n) => sheet.clips[n]);
  const scale = height / sheet.frameHeight;

  // A clip whose atlas is still decoding falls back to idle, so its cell geometry must follow too.
  const active = useDerivedValue(() => (images[clip.value] ? clip.value : 0));
  const image = useDerivedValue(() => images[active.value] ?? null);
  const sprites = useDerivedValue(() => {
    const m = meta[active.value];
    const f = Math.min(frame.value, m.frames - 1);
    return [Skia.XYWHRect((f % m.cols) * m.w, Math.floor(f / m.cols) * m.h, m.w, m.h)];
  });
  const transforms = useDerivedValue(() => {
    const m = meta[active.value];
    return [Skia.RSXform(scale, 0, x + m.x * scale, y + m.y * scale)];
  });

  return <Atlas image={image} sprites={sprites} transforms={transforms} sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.None }} />;
}
