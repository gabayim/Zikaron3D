import type { Mode } from '../../engine/dda';
import type { SeededRNG } from '../../engine/SeededRNG';
import type { PeakChannel, PeakLevelConfig, PeakMechanic } from '../../engine/levelTables';

export const PEAK_COUNT = 8;
export const TONE_COUNT = 8;
export const COLOR_COUNT = 6;
/** C-major pentatonic, one tone per sound value. */
export const TONES = [60, 62, 64, 67, 69, 72, 74, 76];
/** Share of scorable steps that are matches, per channel. */
const TARGET_SHARE = 0.3;
const LURE_CHANCE = 0.35;
const TEMPO_SQUEEZE = 0.17;
const DRIFT_PERIOD_MS = 40000;

const OPTIONS: Record<PeakChannel, number> = { pos: PEAK_COUNT, sound: TONE_COUNT, color: COLOR_COUNT };

/** A level row after mode rules and DDA. */
export interface PeakRules {
  level: number;
  n: number;
  channels: PeakChannel[];
  trials: number;
  stepMs: number;
  passScore: number;
  mechanics: PeakMechanic[];
  /** Steps that show echo ghosts of the last n stars (Infinity = whole round). */
  hintSteps: number;
  canFail: boolean;
  hearts: boolean;
}

const has = (r: { mechanics: PeakMechanic[] }, m: PeakMechanic) => r.mechanics.includes(m);

export function peakRules(cfg: PeakLevelConfig, mode: Mode, psr: number): PeakRules {
  let n = cfg.n;
  let channels = [...cfg.channels];
  let stepMs = cfg.stepMs;
  let mechanics = [...cfg.mechanics];
  let passScore = cfg.passScore;
  let hintSteps = cfg.n === 1 ? Infinity : 0;
  let canFail = false;

  if (mode === 'TOYBOX') {
    n = Math.min(2, n);
    const sound = cfg.level % 2 === 0 && cfg.channels.includes('sound');
    channels = [sound ? 'sound' : 'pos'];
    stepMs = Math.max(3000, stepMs * 1.2);
    mechanics = [];
    passScore *= 0.8;
    hintSteps = Infinity;
  } else if (mode === 'SANCTUARY') {
    stepMs *= 1.3;
    mechanics = mechanics.filter((m) => m !== 'tempo' && m !== 'flash');
    passScore *= 0.85;
    if (n <= 2) hintSteps = Infinity;
  } else {
    canFail = true;
  }

  if (psr >= 75) {
    stepMs = Math.max(1500, stepMs * 0.9);
  } else if (psr <= 35) {
    stepMs *= 1.15;
    hintSteps = Math.max(hintSteps, n * 3);
  }

  return {
    level: cfg.level,
    n,
    channels,
    trials: cfg.trials - cfg.n + n,
    stepMs: Math.round(stepMs),
    passScore,
    mechanics,
    hintSteps,
    canFail,
    hearts: mode === 'ARCADE',
  };
}

export interface PeakStep {
  t: number;
  dur: number;
  /** Values per channel; -1 when the channel is not in play. */
  pos: number;
  sound: number;
  color: number;
  /** How long the star stays visible. */
  showMs: number;
}

export interface PeakRound {
  rules: PeakRules;
  steps: PeakStep[];
  /** Per channel, per step: is this a match with n steps back. */
  targets: Record<PeakChannel, boolean[]>;
  /** Per channel, per step: a near-miss that matches n-1 or n+1 back. */
  lures: Record<PeakChannel, boolean[]>;
  /** Ring rotation in radians per ms (0 without drift). */
  drift: number;
  endMs: number;
  signature: string;
}

/** Exactly `count` target steps among the scorable ones, never 3 in a row. */
function pickTargets(rng: SeededRNG, trials: number, n: number, count: number): boolean[] {
  const out = new Array<boolean>(trials).fill(false);
  const idx = rng.shuffle(Array.from({ length: trials - n }, (_, i) => i + n));
  let placed = 0;
  for (const i of idx) {
    if (placed >= count) break;
    const run = (j: number) => j >= 0 && j < trials && (out[j] || j === i);
    if ((run(i - 2) && run(i - 1)) || (run(i - 1) && run(i + 1)) || (run(i + 1) && run(i + 2))) continue;
    out[i] = true;
    placed += 1;
  }
  return out;
}

function channelSequence(rng: SeededRNG, rules: PeakRules, options: number, targets: boolean[]) {
  const { n, trials } = rules;
  const lures = has(rules, 'lures');
  const v: number[] = [];
  const lure: boolean[] = [];
  for (let i = 0; i < trials; i++) {
    lure.push(false);
    if (i < n) {
      v.push(rng.nextInt(0, options - 1));
      continue;
    }
    const back = v[i - n];
    if (targets[i]) {
      v.push(back);
      continue;
    }
    if (lures && rng.next() < LURE_CHANCE) {
      const near = [i - n - 1, i - n + 1].filter((j) => j >= 0 && j < i && v[j] !== back);
      if (near.length) {
        v.push(v[rng.pick(near)]);
        lure[i] = true;
        continue;
      }
    }
    let x = rng.nextInt(0, options - 2);
    if (x >= back) x += 1;
    v.push(x);
  }
  return { v, lure };
}

export function targetCount(rules: PeakRules) {
  return Math.max(2, Math.round((rules.trials - rules.n) * TARGET_SHARE));
}

function stepDur(rules: PeakRules, i: number) {
  if (!has(rules, 'tempo')) return rules.stepMs;
  return Math.round(rules.stepMs * (1 - (TEMPO_SQUEEZE * i) / Math.max(1, rules.trials - 1)));
}

export function buildRound(rng: SeededRNG, rules: PeakRules, prevSignature?: string): PeakRound {
  for (let attempt = 0; ; attempt++) {
    const round = makeRound(rng, rules);
    if (round.signature !== prevSignature || attempt >= 6) return round;
  }
}

function makeRound(rng: SeededRNG, rules: PeakRules): PeakRound {
  const empty = () => new Array<boolean>(rules.trials).fill(false);
  const targets: Record<PeakChannel, boolean[]> = { pos: empty(), sound: empty(), color: empty() };
  const lures: Record<PeakChannel, boolean[]> = { pos: empty(), sound: empty(), color: empty() };
  const values: Record<PeakChannel, number[]> = {
    pos: new Array<number>(rules.trials).fill(-1),
    sound: new Array<number>(rules.trials).fill(-1),
    color: new Array<number>(rules.trials).fill(-1),
  };
  const count = targetCount(rules);
  for (const ch of rules.channels) {
    targets[ch] = pickTargets(rng, rules.trials, rules.n, count);
    const seq = channelSequence(rng, rules, OPTIONS[ch], targets[ch]);
    values[ch] = seq.v;
    lures[ch] = seq.lure;
  }
  const steps: PeakStep[] = [];
  let t = 0;
  for (let i = 0; i < rules.trials; i++) {
    const dur = stepDur(rules, i);
    const showMs = has(rules, 'flash') ? Math.max(450, Math.round(dur * 0.3)) : Math.round(dur * 0.75);
    steps.push({ t, dur, pos: values.pos[i], sound: values.sound[i], color: values.color[i], showMs });
    t += dur;
  }
  const drift = has(rules, 'drift') ? ((rng.nextBool() ? 1 : -1) * Math.PI * 2) / DRIFT_PERIOD_MS : 0;
  const signature = rules.channels.map((ch) => values[ch].join('.')).join('|');
  return { rules, steps, targets, lures, drift, endMs: t, signature };
}

export type PeakJudgement = 'hit' | 'false' | 'miss';

export interface PeakEvent {
  kind: PeakJudgement;
  channel: PeakChannel;
  step: number;
}

export const BATTERY_START = 0.7;
export const BATTERY_MISS = 0.1;
export const BATTERY_FALSE = 0.08;
export const BATTERY_HIT = 0.06;

/** Judges one play-through of a round. Times are ms from round start. */
export class PeakRun {
  readonly round: PeakRound;
  /** Per channel, per step: tapped. */
  tapped: Record<PeakChannel, boolean[]>;
  hits: Record<PeakChannel, number> = { pos: 0, sound: 0, color: 0 };
  falses: Record<PeakChannel, number> = { pos: 0, sound: 0, color: 0 };
  misses = 0;
  streak = 0;
  bestStreak = 0;
  battery = BATTERY_START;
  failed = false;
  /** Steps whose window has closed and been judged. */
  resolved = 0;

  constructor(round: PeakRound) {
    this.round = round;
    const empty = () => new Array<boolean>(round.rules.trials).fill(false);
    this.tapped = { pos: empty(), sound: empty(), color: empty() };
  }

  /** The step whose response window contains t, or -1. */
  stepAt(t: number): number {
    const steps = this.round.steps;
    if (t < 0 || t >= this.round.endMs) return -1;
    let lo = 0;
    let hi = steps.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (steps[mid].t <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private drain(amount: number) {
    this.battery = Math.max(0, this.battery - amount);
    if (this.round.rules.canFail && this.battery <= 0) this.failed = true;
  }

  /** A tap on a channel button. Returns null when the tap can't be judged. */
  tap(channel: PeakChannel, t: number): PeakEvent | null {
    if (!this.round.rules.channels.includes(channel)) return null;
    const i = this.stepAt(t);
    if (i < this.round.rules.n || this.tapped[channel][i]) return null;
    this.tapped[channel][i] = true;
    if (this.round.targets[channel][i]) {
      this.hits[channel] += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.battery = Math.min(1, this.battery + BATTERY_HIT);
      return { kind: 'hit', channel, step: i };
    }
    this.falses[channel] += 1;
    this.streak = 0;
    this.drain(BATTERY_FALSE);
    return { kind: 'false', channel, step: i };
  }

  /** Closes finished steps: untapped matches become misses. */
  update(t: number): PeakEvent[] {
    const out: PeakEvent[] = [];
    const steps = this.round.steps;
    while (this.resolved < steps.length && t >= steps[this.resolved].t + steps[this.resolved].dur) {
      const i = this.resolved;
      for (const ch of this.round.rules.channels) {
        if (this.round.targets[ch][i] && !this.tapped[ch][i]) {
          this.misses += 1;
          this.streak = 0;
          this.drain(BATTERY_MISS);
          out.push({ kind: 'miss', channel: ch, step: i });
        }
      }
      this.resolved += 1;
    }
    return out;
  }

  get done() {
    return this.resolved >= this.round.steps.length;
  }

  /** Mean over channels of hit rate minus false-alarm rate, clamped to 0..1. */
  get score() {
    const { channels, trials, n } = this.round.rules;
    let sum = 0;
    for (const ch of channels) {
      const targets = this.round.targets[ch].filter(Boolean).length;
      const others = trials - n - targets;
      const hitRate = targets ? this.hits[ch] / targets : 1;
      const falseRate = others ? this.falses[ch] / others : 0;
      sum += Math.max(0, hitRate - falseRate);
    }
    return Math.min(1, sum / channels.length);
  }

  /** No miss and no false alarm on any channel. */
  get flawless() {
    const { channels } = this.round.rules;
    return this.misses === 0 && channels.every((ch) => this.falses[ch] === 0);
  }

  passed() {
    return !this.failed && this.score >= this.round.rules.passScore;
  }
}
