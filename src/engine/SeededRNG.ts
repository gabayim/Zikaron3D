/**
 * Deterministic 32-bit Mulberry32 PRNG
 * Guarantees identical shuffles across platforms for Ghost PvP and Daily Challenges.
 */

export class SeededRNG {
  private state: number;
  private readonly initialSeed: number;

  constructor(seed: number | string = Date.now()) {
    const numericSeed =
      typeof seed === 'string' ? SeededRNG.stringToSeed(seed) : seed;
    // Ensure 32-bit unsigned integer non-zero seed
    this.initialSeed = (numericSeed >>> 0) || 1;
    this.state = this.initialSeed;
  }

  /**
   * Hashes an arbitrary string (e.g. "2026-10-24" or "room_ghost_99") to a 32-bit uint seed.
   * Uses FNV-1a 32-bit hash algorithm.
   */
  public static stringToSeed(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) || 1;
  }

  /**
   * Creates a SeededRNG seeded by the current calendar day (YYYY-MM-DD in UTC).
   */
  public static fromDaily(dateStr?: string): SeededRNG {
    const key = dateStr ?? new Date().toISOString().slice(0, 10);
    return new SeededRNG(`daily_${key}`);
  }

  /**
   * Mulberry32 generator step.
   * Returns a pseudo-random floating-point number in [0, 1).
   */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a random integer between min and max (both inclusive).
   */
  public nextInt(min: number, max: number): number {
    if (min > max) {
      const temp = min;
      min = max;
      max = temp;
    }
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Returns a boolean with the specified probability of being true (default 0.5).
   */
  public nextBool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Implements a deterministic Fisher-Yates shuffle.
   * Returns a newly allocated array without mutating the input array.
   */
  public shuffle<T>(array: readonly T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }

  /**
   * Selects a single random item from an array.
   */
  public pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    const index = this.nextInt(0, array.length - 1);
    return array[index];
  }

  /**
   * Samples N distinct items from an array without replacement.
   */
  public sample<T>(array: readonly T[], count: number): T[] {
    const n = Math.min(count, array.length);
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, n);
  }

  /**
   * Creates an independent child SeededRNG branched deterministically from the current state.
   */
  public fork(): SeededRNG {
    return new SeededRNG(Math.floor(this.next() * 0xffffffff));
  }

  public getInitialSeed(): number {
    return this.initialSeed;
  }

  public getCurrentState(): number {
    return this.state;
  }
}
