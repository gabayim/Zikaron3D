import type { Mode } from '../../engine/dda';
import type { PrismLevelConfig, PrismMechanic } from '../../engine/levelTables';
import type { SeededRNG } from '../../engine/SeededRNG';

export type CrystalShape = 'diamond' | 'hex' | 'star' | 'drop' | 'crescent' | 'shard' | 'crown';

export interface CrystalDef {
  id: number;
  color: string;
  glow: string;
  midi: number;
  shape: CrystalShape;
}

/** Up to 7 distinct colour + shape + pentatonic chime crystals. */
export const CRYSTAL_DEFS: readonly CrystalDef[] = [
  { id: 0, color: '#5CEBFF', glow: '#9CF5FF', midi: 60, shape: 'diamond' },
  { id: 1, color: '#B48CFF', glow: '#DEC8FF', midi: 62, shape: 'hex' },
  { id: 2, color: '#FF7AC8', glow: '#FFC2E6', midi: 64, shape: 'star' },
  { id: 3, color: '#FFD166', glow: '#FFE9AD', midi: 67, shape: 'drop' },
  { id: 4, color: '#5CFFB0', glow: '#B8FFDC', midi: 69, shape: 'crescent' },
  { id: 5, color: '#5C9CFF', glow: '#B5D1FF', midi: 72, shape: 'shard' },
  { id: 6, color: '#FFA0E8', glow: '#FFD4F5', midi: 74, shape: 'crown' },
] as const;

export const MAX_CRYSTALS = CRYSTAL_DEFS.length;

export interface PrismRules {
  level: number;
  crystals: number;
  waves: number;
  startLength: number;
  cueStepMs: number;
  echoTimePerStepMs: number | null;
  mechanics: PrismMechanic[];
  hintAfterMs: number | null;
  canFail: boolean;
  hearts: boolean;
}

const has = (m: readonly PrismMechanic[], k: PrismMechanic) => m.includes(k);

export function prismRules(cfg: PrismLevelConfig, mode: Mode, psr: number): PrismRules {
  let crystals = cfg.crystals;
  let cueStepMs = cfg.cueStepMs;
  let echoTimePerStepMs = cfg.echoTimePerStepMs;
  let mechanics = [...cfg.mechanics];
  let hintAfterMs: number | null = null;
  let canFail = false;

  if (mode === 'TOYBOX') {
    crystals = Math.min(4, crystals);
    cueStepMs = Math.max(620, Math.round(cueStepMs * 1.25));
    mechanics = mechanics.filter((m) => m === 'grow' || m === 'double');
    echoTimePerStepMs = null;
    hintAfterMs = 3500;
  } else if (mode === 'SANCTUARY') {
    cueStepMs = Math.round(cueStepMs * 1.3);
    mechanics = mechanics.filter((m) => m !== 'ghost' && m !== 'swap' && m !== 'tempo');
    echoTimePerStepMs = null;
    hintAfterMs = 6000;
  } else {
    canFail = true;
  }

  if (psr >= 75) {
    cueStepMs = Math.max(260, Math.round(cueStepMs * 0.9));
    if (echoTimePerStepMs !== null) {
      echoTimePerStepMs = Math.max(1050, Math.round(echoTimePerStepMs * 0.9));
    }
  } else if (psr <= 35) {
    cueStepMs = Math.round(cueStepMs * 1.15);
    if (echoTimePerStepMs !== null) {
      echoTimePerStepMs = Math.round(echoTimePerStepMs * 1.2);
    }
    hintAfterMs = hintAfterMs ?? 4500;
  }

  return {
    level: cfg.level,
    crystals,
    waves: cfg.waves,
    startLength: cfg.startLength,
    cueStepMs,
    echoTimePerStepMs,
    mechanics,
    hintAfterMs,
    canFail,
    hearts: mode === 'ARCADE',
  };
}

export type StepKind = 'single' | 'double' | 'chord';

export interface PrismStep {
  kind: StepKind;
  /** Crystal IDs required for this step: [a] for single, [a, a] for double, [a, b] for twin chord. */
  crystals: number[];
}

export interface PrismWave {
  waveIndex: number;
  cueSteps: PrismStep[];
  expectedSteps: PrismStep[];
  mirror: boolean;
  ghost: boolean;
  rotateSteps: number;
  swapPair: [number, number] | null;
  cueStepMs: number;
  /** Echo time budget for the whole wave (null = untimed). */
  echoTimeMs: number | null;
  /** Mapping: slotOfCrystal[crystalId] = angular slot index (0..crystals-1) during the cue. */
  slotBeforeCue: number[];
  /** Mapping: slotAfterCue[crystalId] = angular slot index during the echo phase. */
  slotAfterCue: number[];
}

export interface PrismLevelData {
  rules: PrismRules;
  waves: PrismWave[];
  signature: string;
}

function pickCrystal(rng: SeededRNG, count: number, avoid?: number): number {
  if (count <= 1) return 0;
  let c = rng.nextInt(0, count - 1);
  if (avoid !== undefined && c === avoid) {
    c = (c + 1 + rng.nextInt(0, count - 2)) % count;
  }
  return c;
}

function makeStep(rng: SeededRNG, rules: PrismRules, prevCrystal: number | undefined, allowSpecial: boolean): PrismStep {
  const canDouble = allowSpecial && has(rules.mechanics, 'double');
  const canChord = allowSpecial && has(rules.mechanics, 'chord') && rules.crystals >= 3;

  const roll = rng.next();
  if (canChord && roll < 0.24) {
    const a = pickCrystal(rng, rules.crystals, prevCrystal);
    const b = pickCrystal(rng, rules.crystals, a);
    return { kind: 'chord', crystals: [a, b] };
  }
  if (canDouble && roll < (canChord ? 0.44 : 0.28)) {
    const a = pickCrystal(rng, rules.crystals, prevCrystal);
    return { kind: 'double', crystals: [a, a] };
  }
  const a = pickCrystal(rng, rules.crystals, prevCrystal);
  return { kind: 'single', crystals: [a] };
}

function lastCrystalOf(steps: readonly PrismStep[]): number | undefined {
  if (steps.length === 0) return undefined;
  const last = steps[steps.length - 1];
  return last.crystals[last.crystals.length - 1];
}

function computeSlotsAfter(
  crystals: number,
  slotBefore: readonly number[],
  rotateSteps: number,
  swapPair: readonly [number, number] | null,
): number[] {
  const next = slotBefore.map((slot) => (slot + rotateSteps) % crystals);
  if (swapPair) {
    const [a, b] = swapPair;
    const sa = next[a];
    next[a] = next[b];
    next[b] = sa;
  }
  return next;
}

/** Builds all cumulative waves for a Prism Chorus level. */
export function buildPrismLevel(rng: SeededRNG, rules: PrismRules, prevSignature?: string): PrismLevelData {
  for (let attempt = 0; attempt < 16; attempt++) {
    const waves: PrismWave[] = [];
    let currentSteps: PrismStep[] = [];
    let currentSlots = Array.from({ length: rules.crystals }, (_, i) => i);

    const grow = has(rules.mechanics, 'grow');
    const useMirror = has(rules.mechanics, 'mirror');
    const useGhost = has(rules.mechanics, 'ghost');
    const useRotate = has(rules.mechanics, 'rotate');
    const useSwap = has(rules.mechanics, 'swap');
    const useTempo = has(rules.mechanics, 'tempo');

    for (let w = 0; w < rules.waves; w++) {
      if (w === 0 || !grow) {
        currentSteps = [];
        const len = grow ? rules.startLength : rules.startLength + w;
        for (let i = 0; i < len; i++) {
          currentSteps.push(makeStep(rng, rules, lastCrystalOf(currentSteps), i > 0));
        }
      } else {
        const addCount = rules.waves <= 3 && rules.level >= 8 ? 2 : 1;
        const nextSteps = [...currentSteps];
        for (let i = 0; i < addCount; i++) {
          nextSteps.push(makeStep(rng, rules, lastCrystalOf(nextSteps), true));
        }
        currentSteps = nextSteps;
      }

      const cueSteps = currentSteps.map((s) => ({ kind: s.kind, crystals: [...s.crystals] }));
      // Mirror starts on the final wave (and mid-late waves on longer levels), never wave 0.
      const mirror =
        useMirror &&
        w > 0 &&
        (w === rules.waves - 1 || (rules.waves >= 4 && w === Math.floor(rules.waves / 2) && rules.level >= 17));
      const expectedSteps = mirror
        ? [...cueSteps].reverse().map((s) => ({ kind: s.kind, crystals: [...s.crystals] }))
        : cueSteps.map((s) => ({ kind: s.kind, crystals: [...s.crystals] }));

      const rotateSteps = useRotate && w > 0 ? 1 : 0;
      let swapPair: [number, number] | null = null;
      if (useSwap && w > 0 && rules.crystals >= 3) {
        const a = rng.nextInt(0, rules.crystals - 1);
        const b = pickCrystal(rng, rules.crystals, a);
        swapPair = [a, b];
      }

      const slotBeforeCue = [...currentSlots];
      const slotAfterCue = computeSlotsAfter(rules.crystals, slotBeforeCue, rotateSteps, swapPair);
      currentSlots = [...slotAfterCue];

      const tempoFactor = useTempo ? Math.max(0.7, 1 - w * 0.08) : 1;
      const cueStepMs = Math.max(240, Math.round(rules.cueStepMs * tempoFactor));
      const totalTaps = expectedSteps.reduce((acc, s) => acc + s.crystals.length, 0);
      const echoTimeMs =
        rules.echoTimePerStepMs !== null
          ? Math.max(2400, Math.round((rules.echoTimePerStepMs * totalTaps + 900) * tempoFactor))
          : null;

      waves.push({
        waveIndex: w,
        cueSteps,
        expectedSteps,
        mirror,
        ghost: useGhost && w > 0,
        rotateSteps,
        swapPair,
        cueStepMs,
        echoTimeMs,
        slotBeforeCue,
        slotAfterCue,
      });
    }

    const signature = waves.map((w) => w.cueSteps.map((s) => s.crystals.join('+')).join(',')).join('|');
    if (signature !== prevSignature || attempt === 15) {
      return { rules, waves, signature };
    }
  }
  throw new Error('unreachable');
}

export interface TapOutcome {
  hit: boolean;
  crystalId: number;
  stepComplete: boolean;
  waveComplete: boolean;
  feverActivated: boolean;
  charge: number;
  fever: boolean;
  combo: number;
  expectedNext: number[];
}

/** Stateful runner for a single wave's echo phase + persistent charge/combo across waves. */
export class PrismWaveRunner {
  readonly wave: PrismWave;
  stepIdx = 0;
  remaining: number[] = [];
  mistakes = 0;
  combo: number;
  charge: number;
  fever: boolean;
  lastTapAt: number;
  waveComplete = false;

  constructor(wave: PrismWave, startCharge = 0, startFever = false, startCombo = 0, startTimeMs = 0) {
    this.wave = wave;
    this.charge = startCharge;
    this.fever = startFever;
    this.combo = startCombo;
    this.lastTapAt = startTimeMs;
    if (wave.expectedSteps.length > 0) {
      this.remaining = [...wave.expectedSteps[0].crystals];
    } else {
      this.waveComplete = true;
    }
  }

  /** Expected crystal IDs for the active step (used by hints & bots). */
  peekRemaining(): readonly number[] {
    return this.remaining;
  }

  tap(crystalId: number, nowMs: number): TapOutcome {
    if (this.waveComplete) {
      return {
        hit: false,
        crystalId,
        stepComplete: false,
        waveComplete: true,
        feverActivated: false,
        charge: this.charge,
        fever: this.fever,
        combo: this.combo,
        expectedNext: [],
      };
    }

    const idx = this.remaining.indexOf(crystalId);
    if (idx < 0) {
      this.mistakes += 1;
      this.combo = 0;
      this.charge = 0;
      this.fever = false;
      return {
        hit: false,
        crystalId,
        stepComplete: false,
        waveComplete: false,
        feverActivated: false,
        charge: 0,
        fever: false,
        combo: 0,
        expectedNext: [...this.remaining],
      };
    }

    this.remaining.splice(idx, 1);
    const dt = Math.max(0, nowMs - this.lastTapAt);
    this.lastTapAt = nowMs;
    const speedGain = dt <= 650 ? 0.17 : dt <= 1150 ? 0.13 : 0.09;
    const prevFever = this.fever;
    this.charge = Math.min(1, this.charge + speedGain);
    if (this.charge >= 1) this.fever = true;
    this.combo += 1;

    const stepComplete = this.remaining.length === 0;
    if (stepComplete) {
      this.stepIdx += 1;
      if (this.stepIdx >= this.wave.expectedSteps.length) {
        this.waveComplete = true;
      } else {
        this.remaining = [...this.wave.expectedSteps[this.stepIdx].crystals];
      }
    }

    return {
      hit: true,
      crystalId,
      stepComplete,
      waveComplete: this.waveComplete,
      feverActivated: !prevFever && this.fever,
      charge: this.charge,
      fever: this.fever,
      combo: this.combo,
      expectedNext: [...this.remaining],
    };
  }
}
