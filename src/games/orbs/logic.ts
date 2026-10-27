import type { Mode } from '../../engine/dda';
import type { SeededRNG } from '../../engine/SeededRNG';

/** Evolution ladder: two identical creatures merge into the next. Index = tier. */
export const TIERS = ['bloop', 'fuzz', 'nutty', 'zap', 'grumble', 'frost', 'ember', 'dusk', 'pip'] as const;
export const TOP_TIER = TIERS.length - 1;

const BASE_RADII = [20, 25, 31, 38, 47, 58, 71, 87, 106];

/** Physics radius per tier for a screen width (design width 390). */
export function radiiFor(W: number): number[] {
  const k = W / 390;
  return BASE_RADII.map((r) => r * k);
}

/** Sprite height as a multiple of the physics radius (the frame has transparent margins). */
export const SPRITE_PER_RADIUS = 2.45;

const SPAWN_WEIGHTS = [50, 30, 20];

/**
 * Next creature to drop. When the player is struggling (low skill / easy mode) it is often a tier already in play,
 * so a merge is always one drop away.
 */
export function pickNext(rng: SeededRNG, present: readonly number[], psr: number, mode: Mode): number {
  const base = mode === 'TOYBOX' ? 0.4 : mode === 'SANCTUARY' ? 0.3 : 0.12;
  const mercy = base + Math.max(0, (50 - psr) / 100);
  const candidates = present.filter((t) => t < SPAWN_WEIGHTS.length + 1);
  if (candidates.length > 0 && rng.next() < mercy) return rng.pick(candidates);
  const total = SPAWN_WEIGHTS.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let t = 0; t < SPAWN_WEIGHTS.length; t++) {
    roll -= SPAWN_WEIGHTS[t];
    if (roll <= 0) return t;
  }
  return 0;
}
