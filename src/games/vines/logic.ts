import type { Mode } from '../../engine/dda';
import type { SeededRNG } from '../../engine/SeededRNG';
import type { VineLevelConfig, VineMechanic } from '../../engine/levelTables';

/** Edge bits. Rotating a tile clockwise shifts N -> E -> S -> W. */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
const DIRS = [N, E, S, W] as const;
const DC = [0, 1, 0, -1];
const DR = [-1, 0, 1, 0];
const opposite = (d: number) => (d === N ? S : d === E ? W : d === S ? N : E);

export type CellKind = 'empty' | 'thorn' | 'tile' | 'spring' | 'bud';

/** A level row after mode rules and DDA. */
export interface VineRules {
  cols: number;
  rows: number;
  buds: number;
  puzzles: number;
  moveSlack: number | null;
  wiltMs: number | null;
  mechanics: VineMechanic[];
  /** Share of leftover cells that get a loose decoy tile. */
  decoyDensity: number;
  hearts: boolean;
  /** Toybox: an idle hint pulses a wrong tile. */
  hints: boolean;
}

export interface VinePuzzle {
  cols: number;
  rows: number;
  kind: CellKind[];
  /** Current edge mask per cell (0 for empty/thorn). */
  mask: number[];
  /** Reference solution mask (0 for cells outside the solution network). */
  solution: number[];
  /** Spring/bud colour (0 gold, 1 blue); -1 elsewhere. */
  color: number[];
  locked: boolean[];
  /** Linked partner cell, or -1. */
  link: number[];
  springs: number[];
  buds: number[];
  /** Tiles stay misty until sap reaches them or a neighbour. */
  fog: boolean;
  /** Rotations the reference solution needs (sum of minimum turns per group). */
  par: number;
  signature: string;
}

const has = (r: { mechanics: VineMechanic[] }, m: VineMechanic) => r.mechanics.includes(m);

export function rotateMask(m: number, times = 1): number {
  let out = m;
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) out = ((out << 1) | (out >> 3)) & 15;
  return out;
}

export function vineRules(cfg: VineLevelConfig, mode: Mode, psr: number): VineRules {
  let mechanics = [...cfg.mechanics];
  let cols = cfg.cols;
  let rows = cfg.rows;
  let buds = cfg.buds;
  let moveSlack = cfg.moveSlack;
  let wiltMs = cfg.wiltMs;

  if (mode === 'TOYBOX') {
    cols = Math.min(5, cols);
    rows = Math.min(5, rows);
    buds = Math.min(3, buds);
    mechanics = mechanics.filter((m) => m !== 'moves' && m !== 'fog' && m !== 'twins' && m !== 'wilt');
  } else if (mode === 'SANCTUARY') {
    mechanics = mechanics.filter((m) => m !== 'moves' && m !== 'wilt');
  }
  if (!mechanics.includes('moves')) moveSlack = null;
  if (!mechanics.includes('wilt')) wiltMs = null;
  if (mechanics.includes('twins')) buds = Math.max(2, buds);

  let decoyDensity = mechanics.includes('decoys') ? 0.55 : 0;
  if (psr >= 75) {
    if (moveSlack !== null) moveSlack = Math.max(2, moveSlack - 1);
    if (decoyDensity) decoyDensity = 0.7;
  } else if (psr <= 35) {
    if (moveSlack !== null) moveSlack += 3;
    if (wiltMs !== null) wiltMs = Math.round(wiltMs * 1.25);
    if (decoyDensity) decoyDensity = 0.35;
  }

  return { cols, rows, buds, puzzles: cfg.puzzles, moveSlack, wiltMs, mechanics, decoyDensity, hearts: mode === 'ARCADE', hints: mode === 'TOYBOX' };
}

function neighbour(cols: number, rows: number, cell: number, dirIdx: number): number {
  const c = (cell % cols) + DC[dirIdx];
  const r = Math.floor(cell / cols) + DR[dirIdx];
  if (c < 0 || r < 0 || c >= cols || r >= rows) return -1;
  return r * cols + c;
}

/** Cells whose current masks connect back to each spring. -1 none, 0/1 a colour, 2 both colours met. */
export function flow(p: VinePuzzle): number[] {
  const out = new Array<number>(p.kind.length).fill(-1);
  p.springs.forEach((spring, colour) => {
    const seen = new Set<number>([spring]);
    const queue = [spring];
    while (queue.length) {
      const cell = queue.shift() as number;
      out[cell] = out[cell] === -1 || out[cell] === colour ? colour : 2;
      for (let d = 0; d < 4; d++) {
        if (!(p.mask[cell] & DIRS[d])) continue;
        const nb = neighbour(p.cols, p.rows, cell, d);
        if (nb < 0 || seen.has(nb) || !(p.mask[nb] & opposite(DIRS[d]))) continue;
        seen.add(nb);
        queue.push(nb);
      }
    }
  });
  return out;
}

export function isSolved(p: VinePuzzle, f = flow(p)): boolean {
  if (f.some((c) => c === 2)) return false;
  return p.buds.every((b) => f[b] === p.color[b]);
}

export function rotatable(p: VinePuzzle, cell: number): boolean {
  return (p.kind[cell] === 'tile' || p.kind[cell] === 'bud') && !p.locked[cell];
}

/** Fog: a tile is hidden until sap reaches it or a neighbour. Springs and buds always show. */
export function fogged(p: VinePuzzle, f: number[], cell: number): boolean {
  if (f[cell] !== -1 || p.kind[cell] === 'spring' || p.kind[cell] === 'bud') return false;
  for (let d = 0; d < 4; d++) {
    const nb = neighbour(p.cols, p.rows, cell, d);
    if (nb >= 0 && f[nb] !== -1) return false;
  }
  return true;
}

/** Rotates a tile (and its linked partner) a quarter turn clockwise. Returns the rotated cells. */
export function rotate(p: VinePuzzle, cell: number): number[] {
  if (!rotatable(p, cell)) return [];
  const cells = p.link[cell] >= 0 ? [cell, p.link[cell]] : [cell];
  for (const c of cells) p.mask[c] = rotateMask(p.mask[c]);
  return cells;
}

/** Minimum clockwise turns that bring every member of a group to its solution mask, or -1. */
function minTurns(mask: number[], solution: number[], group: number[]): number {
  for (let t = 0; t < 4; t++) if (group.every((c) => rotateMask(mask[c], t) === solution[c])) return t;
  return -1;
}

/** Rotation groups: single tiles, or a linked pair counted once. */
export function groups(p: VinePuzzle): number[][] {
  const out: number[][] = [];
  const done = new Set<number>();
  for (let c = 0; c < p.kind.length; c++) {
    if (!rotatable(p, c) || done.has(c)) continue;
    const g = p.link[c] >= 0 ? [c, p.link[c]] : [c];
    g.forEach((x) => done.add(x));
    out.push(g);
  }
  return out;
}

/** Reference-solution turns still needed from the current state. */
export function parOf(p: VinePuzzle): number {
  let sum = 0;
  for (const g of groups(p)) {
    if (g.every((c) => p.solution[c] === 0)) continue;
    sum += Math.max(0, minTurns(p.mask, p.solution, g));
  }
  return sum;
}

/** A tile worth nudging: wrong, visible, and next to the sap if possible. */
export function hintCell(p: VinePuzzle): number {
  const f = flow(p);
  let fallback = -1;
  for (const g of groups(p)) {
    const c = g[0];
    if (p.solution[c] === 0 || p.mask[c] === p.solution[c]) continue;
    if (p.fog && fogged(p, f, c)) continue;
    const touching = [0, 1, 2, 3].some((d) => {
      const nb = neighbour(p.cols, p.rows, c, d);
      return nb >= 0 && f[nb] !== -1;
    });
    if (touching) return c;
    if (fallback < 0) fallback = c;
  }
  return fallback;
}

/**
 * Builds a solvable puzzle: random spanning tree(s) from the spring(s), buds on far leaves, pruned to
 * spring-to-bud paths, optional decoys/locks/links, then scrambled. Refuses to reproduce `prevSignature`.
 */
export function buildPuzzle(rng: SeededRNG, rules: VineRules, prevSignature?: string): VinePuzzle {
  for (let tries = 0; tries < 40; tries++) {
    const p = generate(rng, rules);
    if (p && p.signature !== prevSignature) return p;
  }
  // Extremely unlikely: fall back to a plain layout without thorns or twins.
  const plain = { ...rules, mechanics: rules.mechanics.filter((m) => m !== 'thorns' && m !== 'twins'), buds: Math.min(rules.buds, 2) };
  for (;;) {
    const p = generate(rng, plain);
    if (p) return p;
  }
}

function generate(rng: SeededRNG, rules: VineRules): VinePuzzle | null {
  const { cols, rows } = rules;
  const n = cols * rows;
  const twins = has(rules, 'twins');
  const kind: CellKind[] = new Array<CellKind>(n).fill('empty');

  const springs = [rng.nextInt(0, rows - 1) * cols];
  if (twins) springs.push(rng.nextInt(0, rows - 1) * cols + cols - 1);

  if (has(rules, 'thorns')) {
    const count = Math.round(n * 0.12);
    for (const c of rng.sample([...Array(n).keys()].filter((c) => !springs.includes(c)), count)) kind[c] = 'thorn';
  }

  // Randomized Prim, one tree per spring, grown in turns over free cells.
  const owner = new Array<number>(n).fill(-1);
  const parent = new Array<number>(n).fill(-1);
  const depth = new Array<number>(n).fill(0);
  const frontier: [number, number, number][][] = springs.map(() => []);
  const push = (colour: number, from: number) => {
    for (let d = 0; d < 4; d++) {
      const nb = neighbour(cols, rows, from, d);
      if (nb >= 0 && owner[nb] === -1 && kind[nb] !== 'thorn') frontier[colour].push([from, nb, d]);
    }
  };
  springs.forEach((s, colour) => {
    owner[s] = colour;
    push(colour, s);
  });
  let grew = true;
  while (grew) {
    grew = false;
    for (let colour = 0; colour < springs.length; colour++) {
      const fr = frontier[colour];
      while (fr.length) {
        const i = rng.nextInt(0, fr.length - 1);
        const [from, to] = fr[i];
        fr.splice(i, 1);
        if (owner[to] !== -1) continue;
        owner[to] = colour;
        parent[to] = from;
        depth[to] = depth[from] + 1;
        push(colour, to);
        grew = true;
        break;
      }
    }
  }

  // Buds on far leaves, split between colours.
  const childCount = new Array<number>(n).fill(0);
  for (let c = 0; c < n; c++) if (parent[c] >= 0) childCount[parent[c]] += 1;
  const color = new Array<number>(n).fill(-1);
  const buds: number[] = [];
  for (let colour = 0; colour < springs.length; colour++) {
    const want = twins ? (colour === 0 ? Math.ceil(rules.buds / 2) : Math.floor(rules.buds / 2)) : rules.buds;
    const leaves = [...Array(n).keys()]
      .filter((c) => owner[c] === colour && childCount[c] === 0 && depth[c] >= 2)
      .sort((a, b) => depth[b] - depth[a]);
    if (leaves.length < want) return null;
    const pool = leaves.slice(0, Math.max(want, Math.ceil(leaves.length * 0.6)));
    for (const b of rng.sample(pool, want)) {
      buds.push(b);
      color[b] = colour;
    }
  }
  springs.forEach((s, colour) => (color[s] = colour));

  // Keep only spring-to-bud paths.
  const solution = new Array<number>(n).fill(0);
  for (const b of buds) {
    let c = b;
    while (parent[c] >= 0) {
      const pa = parent[c];
      const d = [0, 1, 2, 3].find((k) => neighbour(cols, rows, pa, k) === c) as number;
      solution[pa] |= DIRS[d];
      solution[c] |= opposite(DIRS[d]);
      c = pa;
    }
  }
  for (let c = 0; c < n; c++) {
    if (kind[c] === 'thorn') continue;
    if (springs.includes(c)) kind[c] = 'spring';
    else if (color[c] >= 0) kind[c] = 'bud';
    else if (solution[c]) kind[c] = 'tile';
  }

  // Decoys: loose tiles on leftover cells (they never touch the solution network in its solved state).
  const mask = [...solution];
  if (rules.decoyDensity > 0) {
    const shapes = [N, N | S, N | E, N | E | S];
    for (let c = 0; c < n; c++) {
      if (kind[c] !== 'empty' || !rng.nextBool(rules.decoyDensity)) continue;
      kind[c] = 'tile';
      mask[c] = rotateMask(rng.pick(shapes), rng.nextInt(0, 3));
    }
  }

  const solutionTiles = [...Array(n).keys()].filter((c) => kind[c] === 'tile' && solution[c]);
  const locked = new Array<boolean>(n).fill(false);
  springs.forEach((s) => (locked[s] = true));
  if (has(rules, 'locked')) {
    for (const c of rng.sample(solutionTiles, Math.max(1, Math.round(solutionTiles.length * 0.2)))) locked[c] = true;
  }

  const link = new Array<number>(n).fill(-1);
  if (has(rules, 'linked')) {
    const candidates = rng.shuffle(solutionTiles.filter((c) => !locked[c] && solution[c] !== 15));
    const pairs = Math.min(3, Math.max(1, Math.round(solutionTiles.length / 8)), Math.floor(candidates.length / 2));
    for (let i = 0; i < pairs; i++) {
      const a = candidates[i * 2];
      const b = candidates[i * 2 + 1];
      link[a] = b;
      link[b] = a;
    }
  }

  const p: VinePuzzle = { cols, rows, kind, mask, solution, color, locked, link, springs, buds, fog: has(rules, 'fog'), par: 0, signature: '' };

  // Scramble every rotation group by the same amount so linked pairs stay solvable.
  const counted = groups(p).filter((g) => g.some((c) => solution[c]));
  const minPar = Math.max(2, Math.round(counted.length * 0.55));
  for (let attempt = 0; attempt < 30; attempt++) {
    for (const g of groups(p)) {
      const k = rng.nextInt(0, 3);
      for (const c of g) p.mask[c] = rotateMask(solution[c] || p.mask[c], k);
    }
    p.par = parOf(p);
    if (p.par >= minPar && !isSolved(p)) break;
  }
  if (isSolved(p) || p.par === 0) return null;

  p.signature = `${cols}x${rows}|${springs.join(',')}|${buds.join(',')}|${solution.join('')}`;
  return p;
}

/** Snapshot of the scrambled masks so an Arcade move-out can reset the same puzzle. */
export function snapshotMasks(p: VinePuzzle): number[] {
  return [...p.mask];
}
