import { SeededRNG } from '../../../engine/SeededRNG';
import { getPrismLevel } from '../../../engine/levelTables';
import { buildPrismLevel, prismRules, PrismWaveRunner } from '../logic';
import type { Mode } from '../../../engine/dda';

describe('Prism Chorus logic', () => {
  it('generates valid solvable waves across all 30 levels and 3 modes', () => {
    const modes: Mode[] = ['TOYBOX', 'ARCADE', 'SANCTUARY'];
    const rng = new SeededRNG('prism-jest-seed');
    let prevSig: string | undefined;

    for (const mode of modes) {
      for (let lvl = 1; lvl <= 30; lvl++) {
        const rules = prismRules(getPrismLevel(lvl), mode, 50);
        const data = buildPrismLevel(rng, rules, prevSig);
        expect(data.signature).not.toBe(prevSig);
        prevSig = data.signature;

        if (mode === 'TOYBOX') {
          expect(rules.crystals).toBeLessThanOrEqual(4);
          expect(rules.canFail).toBe(false);
        }

        let charge = 0;
        let fever = false;
        let combo = 0;
        let now = 1000;

        for (const w of data.waves) {
          const sortedBefore = [...w.slotBeforeCue].sort((a, b) => a - b);
          const sortedAfter = [...w.slotAfterCue].sort((a, b) => a - b);
          const expectedSlots = Array.from({ length: rules.crystals }, (_, i) => i);
          expect(sortedBefore).toEqual(expectedSlots);
          expect(sortedAfter).toEqual(expectedSlots);

          const runner: PrismWaveRunner = new PrismWaveRunner(w, charge, fever, combo, now);
          while (!runner.waveComplete) {
            const next = runner.peekRemaining()[0];
            now += 350;
            const out = runner.tap(next, now);
            expect(out.hit).toBe(true);
          }
          expect(runner.waveComplete).toBe(true);
          charge = runner.charge;
          fever = runner.fever;
          combo = runner.combo;
        }
      }
    }
  });

  it('reverses steps on mirror waves and resets charge/combo on mistakes', () => {
    const rng = new SeededRNG('prism-mirror-seed');
    const rules = prismRules(getPrismLevel(12), 'ARCADE', 50);
    const data = buildPrismLevel(rng, rules);
    const mirrorWave = data.waves.find((w) => w.mirror);
    expect(mirrorWave).toBeDefined();
    if (!mirrorWave) return;

    expect(mirrorWave.expectedSteps).toEqual([...mirrorWave.cueSteps].reverse());

    const runner = new PrismWaveRunner(mirrorWave, 0.8, false, 6, 1000);
    const wrongCrystal = (mirrorWave.expectedSteps[0].crystals[0] + 1) % rules.crystals;
    const miss = runner.tap(wrongCrystal, 1200);
    expect(miss.hit).toBe(false);
    expect(miss.charge).toBe(0);
    expect(miss.combo).toBe(0);
    expect(miss.fever).toBe(false);
  });
});
