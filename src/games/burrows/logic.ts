import type { SeededRNG } from '../../engine/SeededRNG';
import { CAST_COLOR } from '../../render/castColors';

/** Distinct colour AND silhouette per creature (accessibility). Pip is the mascot, not a burrow resident. */
export const SPECIES_POOL = [
  'bloop',
  'bolt',
  'coral',
  'dusk',
  'ember',
  'frost',
  'fuzz',
  'grumble',
  'luna',
  'moss',
  'nova',
  'nutty',
  'titan',
  'zap',
] as const;

export const SPECIES_COLOR = CAST_COLOR;

export interface Round {
  id: number;
  /** Distinct species used this round. */
  species: string[];
  /** Species per burrow, row-major. Every species appears exactly twice (or thrice if triple). */
  board: string[];
  isTriple?: boolean;
  decoyCount?: number;
}

export interface MakeRoundOptions {
  isTriple?: boolean;
  decoyCount?: number;
}

export function makeRound(
  rng: SeededRNG,
  id: number,
  pairs: number,
  options?: MakeRoundOptions,
): Round {
  const isTriple = options?.isTriple ?? false;
  const decoyCount = options?.decoyCount ?? 0;
  const species = rng.sample(SPECIES_POOL, pairs);

  const copies: string[] = isTriple
    ? [...species, ...species, ...species]
    : [...species, ...species];

  for (let i = 0; i < decoyCount; i++) {
    copies.push('decoy');
  }

  const board = rng.shuffle(copies);
  return { id, species, board, isTriple, decoyCount };
}

/** Burrow count per row for a board of n burrows. */
export function layoutRows(n: number): number[] {
  if (n <= 6) return [3, 3];
  if (n <= 8) return [4, 4];
  if (n <= 9) return [3, 3, 3];
  if (n <= 10) return [3, 4, 3];
  if (n <= 12) return [4, 4, 4];
  if (n <= 14) return [4, 3, 4, 3];
  if (n <= 15) return [5, 5, 5];
  if (n <= 16) return [4, 4, 4, 4];
  if (n <= 18) return [5, 4, 5, 4];
  if (n <= 20) return [5, 5, 5, 5];
  if (n <= 24) return [6, 6, 6, 6];

  // Dynamic fallback for any board size
  const cols = Math.min(5, Math.ceil(Math.sqrt(n)));
  const rowsCount = Math.ceil(n / cols);
  const rows: number[] = [];
  let remaining = n;
  for (let r = 0; r < rowsCount; r++) {
    const take = Math.min(cols, Math.ceil(remaining / (rowsCount - r)));
    rows.push(take);
    remaining -= take;
  }
  return rows;
}

export interface BurrowSlot {
  cx: number;
  cy: number;
}

export interface BoardLayout {
  slots: BurrowSlot[];
  /** Burrow width. Everything else scales from it. */
  w: number;
}

/** Sprite height as a multiple of burrow width. */
export const SPRITE_H = 1.19;
/** Hole height as a multiple of burrow width. */
export const HOLE_H = 0.34;

export function computeLayout(n: number, W: number, top: number, bottom: number): BoardLayout {
  const rows = layoutRows(n);
  const R = rows.length;
  const C = Math.max(...rows);
  const colW = W / C;
  const availH = bottom - top;
  const k = 1.05;
  const w = Math.min(colW * 0.8, availH / ((R - 1) * k + SPRITE_H + HOLE_H));
  const rowH = R > 1 ? Math.min(w * 1.3, (availH - (SPRITE_H + HOLE_H) * w) / (R - 1)) : 0;
  const blockH = (R - 1) * rowH + (SPRITE_H + HOLE_H) * w;
  const y0 = top + (availH - blockH) / 2 + SPRITE_H * w;

  const slots: BurrowSlot[] = [];
  rows.forEach((count, r) => {
    for (let c = 0; c < count; c++) {
      slots.push({ cx: W / 2 + (c - (count - 1) / 2) * colW, cy: y0 + r * rowH });
    }
  });
  return { slots, w };
}

export function hitTest(layout: BoardLayout, x: number, y: number): number {
  const { slots, w } = layout;
  let best = -1;
  let bestDist = Infinity;
  slots.forEach((s, i) => {
    const dx = Math.abs(x - s.cx);
    const inY = y > s.cy - SPRITE_H * w * 0.9 && y < s.cy + HOLE_H * w * 0.9;
    if (dx < w * 0.62 && inY) {
      const d = dx + Math.abs(y - (s.cy - SPRITE_H * w * 0.3));
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
  });
  return best;
}
