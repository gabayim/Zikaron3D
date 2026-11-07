import type { Mode } from '../../engine/dda';
import type { SeededRNG } from '../../engine/SeededRNG';
import type { BeatLevelConfig, BeatMechanic } from '../../engine/levelTables';
import type { Melody } from './melodies';

/** Beats of count-in before the first note. */
export const COUNT_IN = 4;
/** How many beats a pulse is visible before it reaches its pad. */
export const TRAVEL_BEATS = 2.5;
const MIN_SAME_LANE_MS = 170;
const MIN_ANY_MS = 110;
const SWITCH_MS = 600;

/** A level row after mode rules and DDA. */
export interface BeatRules {
  lanes: number;
  bpm: number;
  beats: number;
  passAccuracy: number;
  mechanics: BeatMechanic[];
  perfectMs: number;
  goodMs: number;
  /** Arcade: an empty battery fails the song. */
  canFail: boolean;
  hearts: boolean;
  /** Battery never drops below this (Toybox/Sanctuary keep a floor so the song always finishes). */
  batteryFloor: number;
  /** End tempo / start tempo. */
  tempoRamp: number;
  /** DDA: every other off-beat note is played by Bolt instead. */
  thinEighths: boolean;
}

export interface ChartNote {
  id: number;
  /** Ms from song start (count-in included). */
  t: number;
  lane: number;
  midi: number;
  /** Hold release time in ms, or 0 for a tap. */
  holdEnd: number;
  /** Played by Bolt, not by the player. */
  auto: boolean;
  /** Echo call: Bolt plays it and its lane flashes. */
  call: boolean;
  /** Fades out halfway down the trace. */
  ghost: boolean;
  /** Echo response: only appears late in its travel. */
  late: boolean;
}

export interface LaneSwitch {
  t: number;
  a: number;
  b: number;
  dur: number;
}

export interface Chart {
  melodyId: string;
  rules: BeatRules;
  notes: ChartNote[];
  switches: LaneSwitch[];
  /** Ms of every beat, count-in included (for the beat bed and Bolt's dance). */
  beatTimes: number[];
  endMs: number;
  /** Playable judgements (taps + hold tails). */
  total: number;
  signature: string;
}

const has = (r: { mechanics: BeatMechanic[] }, m: BeatMechanic) => r.mechanics.includes(m);

export function beatRules(cfg: BeatLevelConfig, mode: Mode, psr: number): BeatRules {
  let mechanics = [...cfg.mechanics];
  let lanes = cfg.lanes;
  let bpm = cfg.bpm;
  let perfectMs = 70;
  let goodMs = 140;
  let canFail = false;
  let batteryFloor = 0.1;
  let passAccuracy = cfg.passAccuracy;

  if (mode === 'TOYBOX') {
    passAccuracy *= 0.75;
    lanes = Math.min(3, lanes);
    bpm = Math.min(95, bpm);
    mechanics = mechanics.filter((m) => m !== 'ghost' && m !== 'switch' && m !== 'tempo' && m !== 'echo' && m !== 'eighths' && m !== 'offbeat');
    perfectMs = 110;
    goodMs = 230;
  } else if (mode === 'SANCTUARY') {
    passAccuracy *= 0.75;
    bpm = Math.round(bpm * 0.8);
    mechanics = mechanics.filter((m) => m !== 'ghost' && m !== 'tempo');
    perfectMs = 90;
    goodMs = 190;
  } else {
    canFail = true;
    batteryFloor = 0;
  }

  let thinEighths = false;
  if (psr >= 75) {
    bpm += 8;
  } else if (psr <= 35) {
    bpm -= 10;
    perfectMs = Math.round(perfectMs * 1.15);
    goodMs = Math.round(goodMs * 1.15);
    thinEighths = true;
  }
  // A pulse overlaps its pad for about a quarter beat either side, so a tap is never rejected while it looks on the pad.
  const beatMs = 60000 / bpm;
  goodMs = Math.max(goodMs, Math.round(beatMs * 0.25));
  perfectMs = Math.max(perfectMs, Math.round(beatMs * 0.11));

  return {
    lanes,
    bpm,
    beats: cfg.bars * 4,
    passAccuracy,
    mechanics,
    perfectMs,
    goodMs,
    canFail,
    hearts: mode === 'ARCADE',
    batteryFloor,
    tempoRamp: mechanics.includes('tempo') ? 1.15 : 1,
    thinEighths,
  };
}

/** Ms at a beat (count-in included), with a linear tempo ramp across the whole song. */
export function beatToMs(rules: BeatRules, beat: number): number {
  const spb = 60000 / rules.bpm;
  const total = rules.beats + COUNT_IN;
  const k = rules.tempoRamp - 1;
  if (Math.abs(k) < 1e-6) return spb * beat;
  return ((spb * total) / k) * Math.log(1 + (k * beat) / total);
}

const isOffbeat = (beat: number) => Math.abs(beat - Math.round(beat)) > 1e-6;

/**
 * Turns a melody into a chart for these rules. Lanes follow the pitch contour of each 2-bar window;
 * anything unplayable (too close, off-beat without `eighths`, during a lane switch) is played by Bolt
 * so the tune stays whole. `fallback` supplies a fresh melody if this one would repeat the previous chart.
 */
export function buildChart(rng: SeededRNG, rules: BeatRules, melody: Melody, fallback: () => Melody, prevSignature?: string): Chart {
  for (let attempt = 0; attempt < 6; attempt++) {
    const chart = makeChart(rng, rules, melody);
    if (chart.signature !== prevSignature) return chart;
  }
  return makeChart(rng, rules, fallback());
}

interface Draft {
  beat: number;
  dur: number;
  midi: number;
  auto: boolean;
  call: boolean;
  late: boolean;
  chordOf: number;
}

function makeChart(rng: SeededRNG, rules: BeatRules, melody: Melody): Chart {
  // Loop the melody to the song length.
  const drafts: Draft[] = [];
  for (let rep = 0; drafts.length === 0 || rep * melody.beats < rules.beats; rep++) {
    for (const n of melody.notes) {
      const beat = n.beat + rep * melody.beats;
      if (beat >= rules.beats) break;
      drafts.push({ beat, dur: Math.min(n.dur, rules.beats - beat), midi: n.midi, auto: false, call: false, late: false, chordOf: -1 });
    }
    if (melody.beats <= 0) break;
  }

  // Syncopation: pull some on-beat notes half a beat early when the note before is long enough.
  if (has(rules, 'offbeat')) {
    for (let i = 1; i < drafts.length; i++) {
      const prev = drafts[i - 1];
      const d = drafts[i];
      if (!isOffbeat(d.beat) && d.beat % 4 !== 0 && prev.dur >= 1.5 && rng.nextBool(0.45)) {
        d.beat -= 0.5;
        d.dur += 0.5;
        prev.dur -= 0.5;
      }
    }
  }

  if (!has(rules, 'eighths') && !has(rules, 'offbeat')) {
    for (const d of drafts) if (isOffbeat(d.beat)) d.auto = true;
  } else if (rules.thinEighths) {
    let flip = false;
    for (const d of drafts) {
      if (!isOffbeat(d.beat)) continue;
      if (flip) d.auto = true;
      flip = !flip;
    }
  }

  // Echo: in each 4-bar block of the second half, Bolt calls the first 2 bars and you answer the same notes.
  if (has(rules, 'echo')) {
    const half = Math.floor(rules.beats / 32) * 16;
    for (let block = Math.max(16, half); block + 16 <= rules.beats; block += 16) {
      const call = drafts.filter((d) => d.beat >= block && d.beat < block + 8);
      const keep = drafts.filter((d) => !(d.beat >= block + 8 && d.beat < block + 16));
      for (const c of call) c.call = true;
      const answer = call.map((c) => ({ ...c, beat: c.beat + 8, call: false, late: true }));
      drafts.length = 0;
      drafts.push(...keep, ...answer);
      drafts.sort((x, y) => x.beat - y.beat);
    }
  }

  // Lanes from pitch contour per 8-beat window.
  const lanes = rules.lanes;
  const laneOf = new Array<number>(drafts.length).fill(0);
  for (let w = 0; w < rules.beats; w += 8) {
    const idx = drafts.map((d, i) => (d.beat >= w && d.beat < w + 8 ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) continue;
    const ps = idx.map((i) => drafts[i].midi);
    const lo = Math.min(...ps);
    const hi = Math.max(...ps);
    for (const i of idx) laneOf[i] = hi === lo ? Math.floor(lanes / 2) : Math.round(((drafts[i].midi - lo) / (hi - lo)) * (lanes - 1));
  }

  // Chords: a harmony a third below on downbeats.
  const pitchClasses = new Set(melody.notes.map((n) => n.midi % 12));
  const chordDrafts: { d: Draft; lane: number }[] = [];
  if (has(rules, 'chords')) {
    drafts.forEach((d, i) => {
      if (d.auto || d.call || d.beat % 4 !== 0 || d.dur < 1 || d.beat < 4) return;
      let third = [3, 4].map((s) => d.midi - s).find((m) => pitchClasses.has(m % 12)) ?? d.midi - 5;
      if (third < 57) third += 12;
      const lane = laneOf[i] >= Math.floor(lanes / 2) ? Math.max(0, laneOf[i] - 2) : Math.min(lanes - 1, laneOf[i] + 2);
      if (lane === laneOf[i]) return;
      chordDrafts.push({ d: { ...d, midi: third, chordOf: i }, lane });
    });
  }

  // Lane switches.
  const switches: LaneSwitch[] = [];
  if (has(rules, 'switch') && lanes >= 3) {
    for (let b = 12; b + 4 <= rules.beats; b += 8) {
      const a = rng.nextInt(0, lanes - 1);
      let c = rng.nextInt(0, lanes - 2);
      if (c >= a) c += 1;
      switches.push({ t: beatToMs(rules, b + COUNT_IN), a, b: c, dur: SWITCH_MS });
    }
  }

  const all = [
    ...drafts.map((d, i) => ({ d, lane: laneOf[i] })),
    ...chordDrafts,
  ].sort((x, y) => x.d.beat - y.d.beat || Number(x.d.chordOf >= 0) - Number(y.d.chordOf >= 0) || x.lane - y.lane);

  const notes: ChartNote[] = [];
  const holds = has(rules, 'holds');
  const ghosts = has(rules, 'ghost');
  const lastOnLane = new Array<number>(lanes).fill(-Infinity);
  const holdUntil = new Array<number>(lanes).fill(-Infinity);
  let lastAny = -Infinity;
  let lastAnyBeat = -1;
  let playable = 0;
  for (const { d, lane } of all) {
    const t = beatToMs(rules, d.beat + COUNT_IN);
    let auto = d.auto || d.call;
    if (!auto) {
      const sameBeat = Math.abs(d.beat - lastAnyBeat) < 1e-6;
      const sliding = switches.some((s) => (s.a === lane || s.b === lane) && t >= s.t - 150 && t <= s.t + s.dur + 150);
      if (t - lastOnLane[lane] < MIN_SAME_LANE_MS || t < holdUntil[lane] + 120 || (!sameBeat && t - lastAny < MIN_ANY_MS) || sliding) auto = true;
      if (d.chordOf >= 0 && !sameBeat) auto = true;
    }
    let holdEnd = 0;
    if (!auto && holds && d.dur >= 1.5 && d.chordOf < 0) {
      holdEnd = beatToMs(rules, d.beat + d.dur * 0.75 + COUNT_IN);
      holdUntil[lane] = holdEnd;
    }
    if (!auto) {
      lastOnLane[lane] = t;
      lastAny = t;
      lastAnyBeat = d.beat;
      playable += 1;
    }
    notes.push({
      id: notes.length,
      t,
      lane,
      midi: d.midi,
      holdEnd,
      auto,
      call: d.call,
      ghost: !auto && ghosts && playable > 4 && rng.nextBool(0.6),
      late: !auto && d.late,
    });
  }

  // A chord whose melody note became auto falls back to Bolt too, so chords are always 2 or 1 pads.
  for (const n of notes) {
    if (n.auto) continue;
    const together = notes.filter((m) => !m.auto && Math.abs(m.t - n.t) < 1);
    if (together.length > 2) for (const m of together.slice(2)) m.auto = true;
  }

  const beatTimes: number[] = [];
  for (let b = 0; b <= rules.beats + COUNT_IN; b++) beatTimes.push(beatToMs(rules, b));
  const endMs = beatToMs(rules, rules.beats + COUNT_IN) + 400;
  const total = notes.reduce((s, n) => s + (n.auto ? 0 : n.holdEnd ? 2 : 1), 0);
  const signature = `${melody.id}|${rules.bpm}|${rules.lanes}|${notes
    .filter((n) => !n.auto)
    .map((n) => n.lane)
    .join('')}`;
  return { melodyId: melody.id, rules, notes, switches, beatTimes, endMs, total, signature };
}

/** Visual slot (fractional during a slide) of a logical lane at time t. */
export function laneSlot(chart: Chart, lane: number, t: number): number {
  const order = Array.from({ length: chart.rules.lanes }, (_, i) => i);
  for (const s of chart.switches) {
    if (t < s.t) break;
    const ia = order.indexOf(s.a);
    const ib = order.indexOf(s.b);
    const done = t >= s.t + s.dur;
    if (done) {
      order[ia] = s.b;
      order[ib] = s.a;
      continue;
    }
    const u = (t - s.t) / s.dur;
    const e = u * u * (3 - 2 * u);
    const slot = order.indexOf(lane);
    if (lane === s.a) return ia + (ib - ia) * e;
    if (lane === s.b) return ib + (ia - ib) * e;
    return slot;
  }
  return order.indexOf(lane);
}

/** Logical lane under a visual slot at time t (nearest pad). */
export function laneAtSlot(chart: Chart, slot: number, t: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let l = 0; l < chart.rules.lanes; l++) {
    const d = Math.abs(laneSlot(chart, l, t) - slot);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

/** Follows the player's mean timing error so device touch/audio latency is absorbed. */
export class OffsetTracker {
  offset = 0;
  private readonly limit: number;

  constructor(limit = 80) {
    this.limit = limit;
  }

  record(errMs: number) {
    const next = this.offset + (errMs - this.offset) * 0.15;
    this.offset = Math.max(-this.limit, Math.min(this.limit, next));
  }
}

export type Judgement = 'perfect' | 'good' | 'miss';

export interface JudgeEvent {
  kind: Judgement;
  note: ChartNote;
  /** True for a hold tail rather than a head. */
  tail: boolean;
  err: number;
}

export const BATTERY_START = 0.7;
export const BATTERY_MISS = 0.12;
export const BATTERY_HIT = 0.045;
export const BATTERY_PERFECT = 0.055;

/** Judges one play-through of a chart. Times are ms from song start. */
export class BeatRun {
  readonly chart: Chart;
  readonly tracker: OffsetTracker;
  state: Uint8Array;
  /** Holds currently pressed, by note id. */
  holding = new Set<number>();
  perfect = 0;
  good = 0;
  miss = 0;
  combo = 0;
  bestCombo = 0;
  battery = BATTERY_START;
  failed = false;

  constructor(chart: Chart, tracker: OffsetTracker) {
    this.chart = chart;
    this.tracker = tracker;
    // 0 pending, 1 head hit, 2 done, 3 missed.
    this.state = new Uint8Array(chart.notes.length);
  }

  private hit(kind: 'perfect' | 'good') {
    if (kind === 'perfect') this.perfect += 1;
    else this.good += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.battery = Math.min(1, this.battery + (kind === 'perfect' ? BATTERY_PERFECT : BATTERY_HIT));
  }

  private missed() {
    this.miss += 1;
    this.combo = 0;
    const r = this.chart.rules;
    this.battery = Math.max(r.batteryFloor, this.battery - BATTERY_MISS);
    if (r.canFail && this.battery <= 0) this.failed = true;
  }

  /** A press on a logical lane. Returns null for a stray tap. */
  press(lane: number, t: number): JudgeEvent | null {
    const { goodMs, perfectMs } = this.chart.rules;
    const off = this.tracker.offset;
    let best = -1;
    let bestErr = Infinity;
    for (const n of this.chart.notes) {
      if (n.auto || n.lane !== lane || this.state[n.id] !== 0) continue;
      const err = t - (n.t + off);
      if (err < -goodMs) break;
      if (Math.abs(err) <= goodMs && Math.abs(err) < Math.abs(bestErr)) {
        best = n.id;
        bestErr = err;
      }
    }
    if (best < 0) return null;
    const note = this.chart.notes[best];
    const kind: Judgement = Math.abs(bestErr) <= perfectMs ? 'perfect' : 'good';
    this.tracker.record(t - note.t);
    this.hit(kind);
    if (note.holdEnd) {
      this.state[best] = 1;
      this.holding.add(best);
    } else this.state[best] = 2;
    return { kind, note, tail: false, err: bestErr };
  }

  /** A finger lifted from a lane: early release breaks the hold. */
  release(lane: number, t: number): JudgeEvent | null {
    for (const id of this.holding) {
      const n = this.chart.notes[id];
      if (n.lane !== lane) continue;
      this.holding.delete(id);
      this.state[id] = 2;
      if (t >= n.holdEnd - this.chart.rules.goodMs) {
        this.hit('good');
        return { kind: 'good', note: n, tail: true, err: t - n.holdEnd };
      }
      this.missed();
      return { kind: 'miss', note: n, tail: true, err: t - n.holdEnd };
    }
    return null;
  }

  /** Advances time: late notes become misses, finished holds complete. */
  update(t: number): JudgeEvent[] {
    const out: JudgeEvent[] = [];
    const { goodMs } = this.chart.rules;
    const off = this.tracker.offset;
    for (const n of this.chart.notes) {
      if (n.auto) continue;
      if (n.t - goodMs > t) break;
      const s = this.state[n.id];
      if (s === 0 && t > n.t + off + goodMs) {
        this.state[n.id] = 3;
        this.missed();
        out.push({ kind: 'miss', note: n, tail: false, err: goodMs });
        if (n.holdEnd) this.missed();
      } else if (s === 1 && t >= n.holdEnd) {
        this.state[n.id] = 2;
        this.holding.delete(n.id);
        this.hit('perfect');
        out.push({ kind: 'perfect', note: n, tail: true, err: 0 });
      }
    }
    return out;
  }

  get judged() {
    return this.perfect + this.good + this.miss;
  }

  get accuracy() {
    return this.chart.total ? (this.perfect + this.good) / this.chart.total : 1;
  }

  passed() {
    return !this.failed && this.accuracy >= this.chart.rules.passAccuracy;
  }
}
