import React, { useEffect, useMemo } from 'react';
import { Group, LinearGradient, Oval, Path, RadialGradient, Skia, vec, type SkImage } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { SpriteCharacter, useSpritePlayer } from '../../render/SpriteCharacter';
import type { CharacterSheet } from '../../render/sprites';
import { HOLE_H, SPRITE_H } from './logic';

export interface BurrowApi {
  /** Creature rises out of the hole. */
  up: () => void;
  /** Creature ducks back in. */
  down: () => void;
  /** Matched: hop + celebrate clip + glow, stays up. */
  cheer: () => void;
  /** Mismatch: droop and shake. */
  sad: () => void;
  /** Hint: quick peek with a glow pulse. */
  nudge: () => void;
}

interface Props {
  cx: number;
  cy: number;
  w: number;
  sheet: CharacterSheet;
  idle: SkImage | null;
  celebrate: SkImage | null;
  accent: string;
  phaseMs: number;
  /** Softer motion (Sanctuary). */
  calm: boolean;
  register: (api: BurrowApi) => void;
}

/** One dirt burrow with a creature that pops out of it. All animation runs on the UI thread. */
export function Burrow({ cx, cy, w, sheet, idle, celebrate, accent, phaseMs, calm, register }: Props) {
  const spriteH = w * SPRITE_H;
  const spriteW = (spriteH * sheet.frameWidth) / sheet.frameHeight;
  const holeH = w * HOLE_H;
  const hideDist = spriteH + holeH * 0.22 + 6;
  const spriteY = cy + holeH * 0.28 - spriteH;

  const player = useSpritePlayer(sheet, phaseMs);
  const images = sheet.order.map((n) => (n === 'idle' ? idle : n === 'celebrate' ? celebrate : null));

  const rise = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const glow = useSharedValue(0);
  const spring = calm ? { damping: 16, stiffness: 120, mass: 1 } : { damping: 9, stiffness: 170, mass: 0.8 };

  useEffect(() => {
    register({
      up: () => {
        rise.set(withSpring(1, spring));
        sy.set(withSequence(withTiming(calm ? 1.04 : 1.14, { duration: 120 }), withSpring(1, { damping: 6, stiffness: 260 })));
        sx.set(withSequence(withTiming(calm ? 0.98 : 0.9, { duration: 120 }), withSpring(1, { damping: 6, stiffness: 260 })));
      },
      down: () => {
        rise.set(withTiming(0, { duration: calm ? 420 : 260, easing: Easing.in(Easing.quad) }));
      },
      cheer: () => {
        if (celebrate) player.play('celebrate');
        rise.set(withSequence(withTiming(1.22, { duration: 150, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 7, stiffness: 200 })));
        glow.set(withSequence(withTiming(1, { duration: 150 }), withTiming(0.55, { duration: 700 })));
      },
      sad: () => {
        const a = calm ? 3 : 8;
        shakeX.set(withSequence(withTiming(a, { duration: 50 }), withTiming(-a, { duration: 80 }), withTiming(a, { duration: 80 }), withTiming(0, { duration: 60 })));
        sy.set(withSequence(withTiming(0.86, { duration: 140 }), withDelay(120, withSpring(1, { damping: 8, stiffness: 200 }))));
        sx.set(withSequence(withTiming(1.08, { duration: 140 }), withDelay(120, withSpring(1, { damping: 8, stiffness: 200 }))));
      },
      nudge: () => {
        glow.set(withSequence(withTiming(1, { duration: 200 }), withDelay(900, withTiming(0, { duration: 500 }))));
        rise.set(withSequence(withTiming(0.4, { duration: 260, easing: Easing.out(Easing.quad) }), withDelay(750, withTiming(0, { duration: 300 }))));
      },
    });
    // The api closes over shared values (stable) and `celebrate` (changes once when it finishes loading).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate, calm, register]);

  // Creature is visible only above the front lip: clip = everything above the hole centre line + the hole itself.
  const holeRect = useMemo(() => Skia.XYWHRect(cx - w / 2, cy - holeH / 2, w, holeH), [cx, cy, w, holeH]);
  const clip = useMemo(
    () => Skia.PathBuilder.Make().addRect(Skia.XYWHRect(cx - w * 2, cy - spriteH * 3, w * 4, spriteH * 3)).addOval(holeRect).build(),
    [cx, cy, w, spriteH, holeRect],
  );
  const frontLip = useMemo(() => Skia.PathBuilder.Make().addArc(holeRect, 0, 180).build(), [holeRect]);

  const groupTransform = useDerivedValue(() => [{ translateX: shakeX.value }]);
  const spriteTransform = useDerivedValue(() => [
    { translateY: (1 - rise.value) * hideDist },
    { scaleX: sx.value },
    { scaleY: sy.value },
  ]);
  const glowOpacity = useDerivedValue(() => glow.value);

  const moundTop = cy - holeH * 0.75;
  return (
    <Group transform={groupTransform}>
      {/* Mound */}
      <Oval x={cx - w * 0.66} y={moundTop} width={w * 1.32} height={holeH * 1.95}>
        <LinearGradient start={vec(cx, moundTop)} end={vec(cx, moundTop + holeH * 1.95)} colors={['#B98A58', '#8A5B38', '#5E3A24']} />
      </Oval>
      {/* Hole */}
      <Oval x={cx - w / 2} y={cy - holeH / 2} width={w} height={holeH}>
        <RadialGradient c={vec(cx, cy - holeH * 0.1)} r={w * 0.55} colors={['#2A1209', '#120509']} />
      </Oval>
      {/* Creature, hidden below the lip */}
      <Group clip={clip}>
        <Group transform={spriteTransform} origin={vec(cx, cy)}>
          <SpriteCharacter sheet={sheet} images={images} clip={player.clip} frame={player.frame} x={cx - spriteW / 2} y={spriteY} height={spriteH} />
        </Group>
      </Group>
      {/* Front lip */}
      <Path path={frontLip} style="stroke" strokeWidth={w * 0.045} color="#D3A878" strokeCap="round" />
      {/* Match / hint glow */}
      <Group opacity={glowOpacity}>
        <Oval x={cx - w * 0.62} y={cy - holeH * 0.8} width={w * 1.24} height={holeH * 1.6} style="stroke" strokeWidth={w * 0.05} color={accent} blendMode="plus" />
      </Group>
    </Group>
  );
}
