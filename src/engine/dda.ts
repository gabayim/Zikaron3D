export type Mode = 'TOYBOX' | 'ARCADE' | 'SANCTUARY';

/**
 * Rolling skill rating (0-100) shared by every game. Games report simple outcomes
 * (hit/miss + how long the player took) and read back difficulty and assist signals.
 */
export class SkillTracker {
  psr = 50;
  hitStreak = 0;
  missStreak = 0;
  private recent: boolean[] = [];

  record(hit: boolean, decisionMs: number) {
    this.recent.push(hit);
    if (this.recent.length > 10) this.recent.shift();

    let delta: number;
    if (hit) {
      this.hitStreak += 1;
      this.missStreak = 0;
      delta = 3.5 + (decisionMs < 1200 ? 2.5 : decisionMs < 2500 ? 1 : 0) + (this.hitStreak >= 4 ? 2.5 : this.hitStreak >= 2 ? 1 : 0);
    } else {
      this.missStreak += 1;
      this.hitStreak = 0;
      delta = -3 - (decisionMs > 4000 ? 1.5 : 0) - (this.missStreak >= 3 ? 2 : 0);
    }
    const winRate = (this.recent.filter(Boolean).length / this.recent.length) * 100;
    const next = this.psr + delta * 0.7 + (winRate - this.psr) * 0.1;
    this.psr = Math.max(0, Math.min(100, Math.round(next * 10) / 10));
  }

  /** True when the player looks stuck and a gentle hint is appropriate. */
  needsAssist(mode: Mode): boolean {
    if (mode === 'TOYBOX') return this.missStreak >= 2;
    if (mode === 'SANCTUARY') return this.missStreak >= 3;
    return this.missStreak >= 4 && this.psr < 30;
  }
}

export interface BurrowsDifficulty {
  pairs: number;
  /** How long every creature stays visible at round start. */
  previewMs: number;
  /** How long a mismatched pair stays visible before hiding. */
  hideDelayMs: number;
  /** Arcade only. Null = untimed. */
  timeLimitMs: number | null;
  /** Idle time before a hint pulse. Null = never. */
  hintAfterMs: number | null;
}

const PAIRS_BY_LEVEL = [3, 3, 4, 4, 5, 5, 6];

export function burrowsDifficulty(level: number, psr: number, mode: Mode): BurrowsDifficulty {
  let pairs = PAIRS_BY_LEVEL[Math.min(level, PAIRS_BY_LEVEL.length - 1)];
  if (psr >= 75) pairs += 1;
  else if (psr <= 30) pairs -= 1;
  const cap = mode === 'ARCADE' ? 6 : 4;
  pairs = Math.max(3, Math.min(cap, pairs));

  const struggling = psr < 35 ? 1.3 : 1;
  if (mode === 'TOYBOX') {
    return { pairs, previewMs: (2200 + 300 * pairs) * struggling, hideDelayMs: 1400, timeLimitMs: null, hintAfterMs: 5000 };
  }
  if (mode === 'SANCTUARY') {
    return { pairs, previewMs: (2600 + 300 * pairs) * struggling, hideDelayMs: 1800, timeLimitMs: null, hintAfterMs: 9000 };
  }
  return { pairs, previewMs: (1100 + 200 * pairs) * struggling, hideDelayMs: 800, timeLimitMs: 12000 + pairs * 7000, hintAfterMs: null };
}
