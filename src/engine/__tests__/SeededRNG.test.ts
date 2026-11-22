import { SeededRNG } from '../SeededRNG';

describe('SeededRNG Engine', () => {
  it('generates consistent deterministic sequence with a fixed seed', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);

    const values1 = [rng1.next(), rng1.next(), rng1.next(), rng1.next()];
    const values2 = [rng2.next(), rng2.next(), rng2.next(), rng2.next()];

    expect(values1).toEqual(values2);
  });

  it('generates numbers within the [0, 1) range', () => {
    const rng = new SeededRNG('test_seed');
    for (let i = 0; i < 50; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('computes consistent FNV-1a hash for string seeds', () => {
    const seedA1 = SeededRNG.stringToSeed('2026-11-22');
    const seedA2 = SeededRNG.stringToSeed('2026-11-22');
    const seedB = SeededRNG.stringToSeed('2026-11-23');

    expect(seedA1).toBe(seedA2);
    expect(seedA1).not.toBe(seedB);
    expect(seedA1).toBeGreaterThan(0);
  });

  it('creates stable daily challenge RNG from date strings', () => {
    const daily1 = SeededRNG.fromDaily('2026-10-31');
    const daily2 = SeededRNG.fromDaily('2026-10-31');

    expect(daily1.next()).toBe(daily2.next());
  });
});
