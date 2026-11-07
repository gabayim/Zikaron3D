import type { Mode } from '../../engine/dda';
import type { SeededRNG } from '../../engine/SeededRNG';
import type { ShellLevelConfig, ShellMechanic } from '../../engine/levelTables';

export type Content = 'pearl' | 'urchin' | 'empty';

export type Move =
  | { kind: 'swap'; a: number; b: number; t0: number; dur: number; lift: 1 | -1; fake: boolean }
  | { kind: 'rotate'; dir: 1 | -1; t0: number; dur: number };

export interface InkWindow {
  t0: number;
  dur: number;
}

/** A level row after mode rules and DDA have been applied. */
export interface ShellRules {
  clams: number;
  pearls: number;
  swaps: number;
  swapMs: number;
  previewMs: number;
  rounds: number;
  pickTimeMs: number | null;
  mechanics: ShellMechanic[];
  /** Arcade only: wrong picks cost a heart and three lost hearts restart the level. */
  hearts: boolean;
  /** Toybox/Sanctuary: the right clam glows after a miss. */
  hintAfterMiss: boolean;
}

export interface ShellRound {
  clams: number;
  cols: number;
  rows: number;
  /** Contents per clam id. Clam `i` starts in slot `i`. */
  contents: Content[];
  moves: Move[];
  inks: InkWindow[];
  /** Shuffle length in ms (after the preview). */
  duration: number;
  /** Clam id in each slot once the shuffle is over. */
  finalClamAt: number[];
  /** Stable fingerprint used to refuse back-to-back identical rounds. */
  signature: string;
}

export interface ClamPose {
  /** Position in slot units: column, row. */
  x: number;
  y: number;
  /** -1..1: positive passes in front (draw larger), negative passes behind. */
  lift: number;
}

const has = (r: { mechanics: ShellMechanic[] }, m: ShellMechanic) => r.mechanics.includes(m);
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));

export function shellRules(cfg: ShellLevelConfig, mode: Mode, psr: number): ShellRules {
  let mechanics = [...cfg.mechanics];
  let clams = cfg.clams;
  let swapMs = cfg.swapMs;
  let swaps = cfg.swaps;
  let previewMs = cfg.previewMs;
  let pickTimeMs = cfg.pickTimeMs;

  if (mode === 'TOYBOX') {
    clams = Math.min(4, clams);
    mechanics = mechanics.filter((m) => m !== 'ink' && m !== 'urchin' && m !== 'twoRows' && m !== 'speed');
    swapMs *= 1.35;
    previewMs *= 1.4;
    pickTimeMs = null;
  } else if (mode === 'SANCTUARY') {
    mechanics = mechanics.filter((m) => m !== 'ink' && m !== 'speed');
    swapMs *= 1.5;
    previewMs *= 1.3;
    pickTimeMs = null;
  }
  if (!mechanics.includes('twoRows')) clams = Math.min(clams, 5);
  else clams = 6;

  if (psr >= 75) {
    swapMs *= 0.9;
    swaps += 1;
  } else if (psr <= 35) {
    swapMs *= 1.15;
    swaps = Math.max(3, swaps - 1);
  }

  const pearls = mechanics.includes('double') ? Math.min(cfg.pearls, 2) : 1;
  if (pearls < 2) mechanics = mechanics.filter((m) => m !== 'double');

  return {
    clams,
    pearls,
    swaps,
    swapMs: Math.round(swapMs),
    previewMs: Math.round(previewMs),
    rounds: cfg.rounds,
    pickTimeMs,
    mechanics,
    hearts: mode === 'ARCADE',
    hintAfterMiss: mode !== 'ARCADE',
  };
}

/** Slot -> grid cell. Two rows use a 3x2 grid, otherwise a single row. */
export function slotCell(round: Pick<ShellRound, 'cols'>, slot: number): { x: number; y: number } {
  return { x: slot % round.cols, y: Math.floor(slot / round.cols) };
}

/** Order slots travel in during a `rotate` move (a ring around the grid). */
function ringOrder(clams: number, rows: number, cols: number): number[] {
  if (rows === 1) return Array.from({ length: clams }, (_, i) => i);
  const top = Array.from({ length: cols }, (_, i) => i);
  const bottom = Array.from({ length: cols }, (_, i) => cols + (cols - 1 - i));
  return [...top, ...bottom];
}

function pairKey(a: number, b: number) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function pickPair(rng: SeededRNG, clams: number, cols: number, rows: number, near: boolean, lastKey: string | null): [number, number] {
  for (let tries = 0; tries < 40; tries++) {
    const a = rng.nextInt(0, clams - 1);
    let b = rng.nextInt(0, clams - 2);
    if (b >= a) b += 1;
    if (near && rows === 1 && Math.abs(a - b) > 2) continue;
    if (pairKey(a, b) === lastKey) continue;
    return [a, b];
  }
  const a = lastKey === '0-1' ? 1 : 0;
  return [a, a + 1];
}

/**
 * Builds one round: what hides where, and the timed list of moves. Never repeats the
 * same pair twice in a row and refuses to reproduce `prevSignature`.
 */
export function buildRound(rng: SeededRNG, rules: ShellRules, prevSignature?: string): ShellRound {
  let round = generate(rng, rules);
  for (let tries = 0; tries < 8 && round.signature === prevSignature; tries++) round = generate(rng, rules);
  return round;
}

function generate(rng: SeededRNG, rules: ShellRules): ShellRound {
  const twoRows = has(rules, 'twoRows');
  const clams = rules.clams;
  const rows = twoRows ? 2 : 1;
  const cols = twoRows ? Math.ceil(clams / 2) : clams;
  const ring = ringOrder(clams, rows, cols);

  const contents: Content[] = Array.from({ length: clams }, () => 'empty' as Content);
  const ids = rng.shuffle(Array.from({ length: clams }, (_, i) => i));
  for (let i = 0; i < rules.pearls; i++) contents[ids[i]] = 'pearl';
  if (has(rules, 'urchin')) contents[ids[rules.pearls]] = 'urchin';

  // slot -> clam id
  const clamAt = Array.from({ length: clams }, (_, i) => i);
  const moves: Move[] = [];
  const sig: string[] = [];
  let t = 0;
  let lastKey: string | null = null;
  let sinceRotate = 0;
  const speed = has(rules, 'speed');
  const near = !has(rules, 'speed') && !twoRows && clams <= 4;
  let burst = 0;

  for (let i = 0; i < rules.swaps; i++) {
    if (speed && burst === 0 && i > 1 && rng.nextBool(0.22)) burst = rng.nextInt(3, 4);
    const fast = burst > 0;
    if (burst > 0) burst -= 1;
    const dur = Math.round(rules.swapMs * (fast ? 0.55 : 1));
    const gap = Math.round(dur * (fast ? 0.05 : 0.18));

    if (has(rules, 'current') && sinceRotate >= 2 && rng.nextBool(0.3)) {
      const dir: 1 | -1 = rng.nextBool() ? 1 : -1;
      moves.push({ kind: 'rotate', dir, t0: t, dur: Math.round(dur * 1.3) });
      const prev = [...clamAt];
      for (let k = 0; k < ring.length; k++) {
        const to = ring[(k + dir + ring.length) % ring.length];
        clamAt[to] = prev[ring[k]];
      }
      sig.push(`r${dir}`);
      t += Math.round(dur * 1.3) + gap;
      sinceRotate = 0;
      lastKey = null;
      continue;
    }
    sinceRotate += 1;

    const [a, b] = pickPair(rng, clams, cols, rows, near, lastKey);
    const fake = has(rules, 'fakeout') && i > 0 && rng.nextBool(0.25);
    const lift: 1 | -1 = rng.nextBool() ? 1 : -1;
    moves.push({ kind: 'swap', a, b, t0: t, dur, lift, fake });
    if (!fake) [clamAt[a], clamAt[b]] = [clamAt[b], clamAt[a]];
    sig.push(`${pairKey(a, b)}${fake ? 'f' : ''}`);
    lastKey = pairKey(a, b);
    t += dur + gap;
  }

  const duration = t;
  const inks: InkWindow[] = [];
  if (has(rules, 'ink') && duration > 0) {
    const dur = Math.round(Math.min(1400, duration * 0.3));
    inks.push({ t0: Math.round(duration * (0.25 + rng.next() * 0.35)), dur });
  }

  return {
    clams,
    cols,
    rows,
    contents,
    moves,
    inks,
    duration,
    finalClamAt: clamAt,
    signature: `${ids.slice(0, rules.pearls + 1).join(',')}|${sig.join(' ')}`,
  };
}

/** Where every clam is at `t` ms into the shuffle (continuous, for drawing). */
export function posesAt(round: ShellRound, t: number): ClamPose[] {
  const { clams, cols, rows } = round;
  const ring = ringOrder(clams, rows, cols);
  const clamAt = Array.from({ length: clams }, (_, i) => i);
  const poses: ClamPose[] = Array.from({ length: clams }, (_, id) => ({ ...slotCell(round, id), lift: 0 }));

  for (const m of round.moves) {
    if (t < m.t0) break;
    const u = clamp01((t - m.t0) / m.dur);
    const done = u >= 1;
    if (m.kind === 'swap') {
      const ca = clamAt[m.a];
      const cb = clamAt[m.b];
      const pa = slotCell(round, m.a);
      const pb = slotCell(round, m.b);
      if (!done) {
        const e = m.fake ? 0.45 * Math.sin(Math.PI * u) : easeInOut(u);
        const arc = Math.sin(Math.PI * (m.fake ? Math.min(1, u * 1.6) : u));
        poses[ca] = { x: pa.x + (pb.x - pa.x) * e, y: pa.y + (pb.y - pa.y) * e - 0.28 * arc * m.lift, lift: arc * m.lift };
        poses[cb] = { x: pb.x + (pa.x - pb.x) * e, y: pb.y + (pa.y - pb.y) * e + 0.28 * arc * m.lift, lift: -arc * m.lift };
        return poses;
      }
      if (!m.fake) {
        clamAt[m.a] = cb;
        clamAt[m.b] = ca;
      }
    } else {
      const prev = [...clamAt];
      if (!done) {
        const e = easeInOut(u);
        for (let k = 0; k < ring.length; k++) {
          const id = prev[ring[k]];
          const from = slotCell(round, ring[k]);
          const to = slotCell(round, ring[(k + m.dir + ring.length) % ring.length]);
          const wrap = Math.abs(to.x - from.x) > 1.01;
          const arc = wrap ? Math.sin(Math.PI * e) : 0;
          poses[id] = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e - 0.9 * arc, lift: -arc };
        }
        return poses;
      }
      for (let k = 0; k < ring.length; k++) clamAt[ring[(k + m.dir + ring.length) % ring.length]] = prev[ring[k]];
    }
    for (let s = 0; s < clams; s++) poses[clamAt[s]] = { ...slotCell(round, s), lift: 0 };
  }
  return poses;
}

export function inkAt(round: ShellRound, t: number): number {
  for (const w of round.inks) {
    if (t < w.t0 || t > w.t0 + w.dur) continue;
    const u = (t - w.t0) / w.dur;
    return Math.min(1, Math.min(u, 1 - u) * 5);
  }
  return 0;
}

export type PickResult = { type: 'pearl'; done: boolean } | { type: 'urchin' } | { type: 'empty' } | { type: 'ignored' };

/** Tracks which clams were opened this round. */
export class ShellPicker {
  opened = new Set<number>();
  found = 0;
  private round: ShellRound;

  constructor(round: ShellRound) {
    this.round = round;
  }

  /** Resolve a tap on a slot after the shuffle. */
  pick(slot: number): PickResult {
    const id = this.round.finalClamAt[slot];
    if (id === undefined || this.opened.has(id)) return { type: 'ignored' };
    this.opened.add(id);
    const c = this.round.contents[id];
    if (c === 'pearl') {
      this.found += 1;
      return { type: 'pearl', done: this.found >= this.round.contents.filter((x) => x === 'pearl').length };
    }
    return c === 'urchin' ? { type: 'urchin' } : { type: 'empty' };
  }

  /** Slots still hiding a pearl (for the hint glow and the reveal). */
  pearlSlots(): number[] {
    const out: number[] = [];
    this.round.finalClamAt.forEach((id, slot) => {
      if (this.round.contents[id] === 'pearl' && !this.opened.has(id)) out.push(slot);
    });
    return out;
  }
}
