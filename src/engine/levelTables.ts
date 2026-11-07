// ─────────────────────────────────────────────────────────────
// Zikaron3D — 30-Level Difficulty Progression Tables
// ─────────────────────────────────────────────────────────────

// ─── CRITTER BURROWS ─────────────────────────────────────────

export type BurrowsMechanic =
  | 'decoy'
  | 'shuffle'
  | 'shadow'
  | 'triple'
  | 'rotation'
  | 'fog'
  | 'speed';

export interface BurrowsLevelConfig {
  level: number;
  pairs: number;
  previewMs: number;
  hideDelayMs: number;
  timeLimitMs: number | null;
  decoyCount: number;
  mechanics: BurrowsMechanic[];
  stardustReward: number;
  firstClearBonus: number;
}

export const BURROWS_LEVELS: BurrowsLevelConfig[] = [
  { level: 1, pairs: 3, previewMs: 3000, hideDelayMs: 1500, timeLimitMs: null, decoyCount: 0, mechanics: [], stardustReward: 5, firstClearBonus: 15 },
  { level: 2, pairs: 3, previewMs: 2800, hideDelayMs: 1400, timeLimitMs: null, decoyCount: 0, mechanics: [], stardustReward: 5, firstClearBonus: 15 },
  { level: 3, pairs: 3, previewMs: 2500, hideDelayMs: 1300, timeLimitMs: null, decoyCount: 0, mechanics: [], stardustReward: 6, firstClearBonus: 18 },
  { level: 4, pairs: 4, previewMs: 2400, hideDelayMs: 1200, timeLimitMs: null, decoyCount: 0, mechanics: [], stardustReward: 7, firstClearBonus: 21 },
  { level: 5, pairs: 4, previewMs: 2200, hideDelayMs: 1100, timeLimitMs: null, decoyCount: 0, mechanics: [], stardustReward: 8, firstClearBonus: 24 },
  { level: 6, pairs: 4, previewMs: 2000, hideDelayMs: 1000, timeLimitMs: 45000, decoyCount: 0, mechanics: [], stardustReward: 10, firstClearBonus: 30 },
  { level: 7, pairs: 5, previewMs: 1900, hideDelayMs: 1000, timeLimitMs: 42000, decoyCount: 0, mechanics: [], stardustReward: 12, firstClearBonus: 36 },
  { level: 8, pairs: 5, previewMs: 1800, hideDelayMs: 900, timeLimitMs: 40000, decoyCount: 1, mechanics: ['decoy'], stardustReward: 14, firstClearBonus: 42 },
  { level: 9, pairs: 5, previewMs: 1700, hideDelayMs: 850, timeLimitMs: 38000, decoyCount: 1, mechanics: ['decoy'], stardustReward: 16, firstClearBonus: 48 },
  { level: 10, pairs: 6, previewMs: 1600, hideDelayMs: 800, timeLimitMs: 36000, decoyCount: 0, mechanics: [], stardustReward: 20, firstClearBonus: 60 },
  { level: 11, pairs: 6, previewMs: 1500, hideDelayMs: 750, timeLimitMs: 34000, decoyCount: 0, mechanics: ['shuffle'], stardustReward: 22, firstClearBonus: 66 },
  { level: 12, pairs: 6, previewMs: 1400, hideDelayMs: 700, timeLimitMs: 32000, decoyCount: 1, mechanics: ['shuffle', 'decoy'], stardustReward: 24, firstClearBonus: 72 },
  { level: 13, pairs: 7, previewMs: 1300, hideDelayMs: 700, timeLimitMs: 30000, decoyCount: 0, mechanics: ['shuffle'], stardustReward: 26, firstClearBonus: 78 },
  { level: 14, pairs: 7, previewMs: 1200, hideDelayMs: 650, timeLimitMs: 28000, decoyCount: 2, mechanics: ['decoy'], stardustReward: 28, firstClearBonus: 84 },
  { level: 15, pairs: 7, previewMs: 1100, hideDelayMs: 600, timeLimitMs: 26000, decoyCount: 2, mechanics: ['shuffle', 'decoy'], stardustReward: 30, firstClearBonus: 90 },
  { level: 16, pairs: 8, previewMs: 1100, hideDelayMs: 600, timeLimitMs: 28000, decoyCount: 0, mechanics: ['shadow'], stardustReward: 35, firstClearBonus: 105 },
  { level: 17, pairs: 8, previewMs: 1000, hideDelayMs: 550, timeLimitMs: 26000, decoyCount: 0, mechanics: ['shadow', 'shuffle'], stardustReward: 38, firstClearBonus: 114 },
  { level: 18, pairs: 8, previewMs: 1000, hideDelayMs: 500, timeLimitMs: 25000, decoyCount: 2, mechanics: ['shadow', 'decoy'], stardustReward: 40, firstClearBonus: 120 },
  { level: 19, pairs: 9, previewMs: 950, hideDelayMs: 500, timeLimitMs: 26000, decoyCount: 0, mechanics: ['triple'], stardustReward: 45, firstClearBonus: 135 },
  { level: 20, pairs: 9, previewMs: 900, hideDelayMs: 450, timeLimitMs: 24000, decoyCount: 0, mechanics: ['triple', 'shuffle'], stardustReward: 48, firstClearBonus: 144 },
  { level: 21, pairs: 9, previewMs: 850, hideDelayMs: 450, timeLimitMs: 22000, decoyCount: 0, mechanics: ['triple', 'shadow'], stardustReward: 50, firstClearBonus: 150 },
  { level: 22, pairs: 10, previewMs: 800, hideDelayMs: 400, timeLimitMs: 24000, decoyCount: 0, mechanics: ['rotation'], stardustReward: 55, firstClearBonus: 165 },
  { level: 23, pairs: 10, previewMs: 750, hideDelayMs: 400, timeLimitMs: 22000, decoyCount: 0, mechanics: ['rotation', 'shadow'], stardustReward: 58, firstClearBonus: 174 },
  { level: 24, pairs: 10, previewMs: 700, hideDelayMs: 350, timeLimitMs: 20000, decoyCount: 0, mechanics: ['rotation', 'triple'], stardustReward: 60, firstClearBonus: 180 },
  { level: 25, pairs: 11, previewMs: 700, hideDelayMs: 350, timeLimitMs: 22000, decoyCount: 0, mechanics: ['fog'], stardustReward: 65, firstClearBonus: 195 },
  { level: 26, pairs: 11, previewMs: 650, hideDelayMs: 300, timeLimitMs: 20000, decoyCount: 0, mechanics: ['fog', 'rotation'], stardustReward: 68, firstClearBonus: 204 },
  { level: 27, pairs: 12, previewMs: 600, hideDelayMs: 300, timeLimitMs: 22000, decoyCount: 0, mechanics: ['shuffle', 'shadow', 'rotation'], stardustReward: 70, firstClearBonus: 210 },
  { level: 28, pairs: 12, previewMs: 550, hideDelayMs: 250, timeLimitMs: 20000, decoyCount: 0, mechanics: ['shuffle', 'shadow', 'rotation', 'speed'], stardustReward: 75, firstClearBonus: 225 },
  { level: 29, pairs: 12, previewMs: 500, hideDelayMs: 250, timeLimitMs: 18000, decoyCount: 3, mechanics: ['shuffle', 'shadow', 'rotation', 'speed', 'decoy'], stardustReward: 80, firstClearBonus: 240 },
  { level: 30, pairs: 12, previewMs: 450, hideDelayMs: 200, timeLimitMs: 16000, decoyCount: 0, mechanics: ['shuffle', 'shadow', 'triple', 'rotation', 'fog', 'speed'], stardustReward: 100, firstClearBonus: 300 },
];

export function getBurrowsLevel(level: number): BurrowsLevelConfig {
  const index = Math.max(1, Math.min(30, level)) - 1;
  return BURROWS_LEVELS[index];
}

// ─── ORB MERGE ───────────────────────────────────────────────

export type OrbMechanic =
  | 'dropLimit'
  | 'frozen'
  | 'narrowBowl'
  | 'bomb'
  | 'dualTarget'
  | 'tripleTarget'
  | 'speed'
  | 'rainbow';

export interface OrbLevelConfig {
  level: number;
  targetTier: number;
  targetCount: number;
  maxDrops: number | null;
  bowlWidthPercent: number;
  mechanics: OrbMechanic[];
  frozenCount: number;
  stardustReward: number;
  firstClearBonus: number;
}

export const ORB_LEVELS: OrbLevelConfig[] = [
  { level: 1, targetTier: 1, targetCount: 1, maxDrops: null, bowlWidthPercent: 100, mechanics: [], frozenCount: 0, stardustReward: 5, firstClearBonus: 15 },
  { level: 2, targetTier: 2, targetCount: 1, maxDrops: null, bowlWidthPercent: 100, mechanics: [], frozenCount: 0, stardustReward: 6, firstClearBonus: 18 },
  { level: 3, targetTier: 3, targetCount: 1, maxDrops: null, bowlWidthPercent: 100, mechanics: [], frozenCount: 0, stardustReward: 7, firstClearBonus: 21 },
  { level: 4, targetTier: 4, targetCount: 1, maxDrops: 30, bowlWidthPercent: 100, mechanics: ['dropLimit'], frozenCount: 0, stardustReward: 10, firstClearBonus: 30 },
  { level: 5, targetTier: 5, targetCount: 1, maxDrops: 35, bowlWidthPercent: 100, mechanics: ['dropLimit'], frozenCount: 0, stardustReward: 12, firstClearBonus: 36 },
  { level: 6, targetTier: 5, targetCount: 1, maxDrops: 25, bowlWidthPercent: 100, mechanics: ['dropLimit'], frozenCount: 0, stardustReward: 15, firstClearBonus: 45 },
  { level: 7, targetTier: 6, targetCount: 1, maxDrops: 40, bowlWidthPercent: 100, mechanics: ['dropLimit'], frozenCount: 0, stardustReward: 18, firstClearBonus: 54 },
  { level: 8, targetTier: 6, targetCount: 1, maxDrops: 30, bowlWidthPercent: 100, mechanics: ['dropLimit', 'frozen'], frozenCount: 1, stardustReward: 20, firstClearBonus: 60 },
  { level: 9, targetTier: 7, targetCount: 1, maxDrops: 45, bowlWidthPercent: 100, mechanics: ['dropLimit'], frozenCount: 0, stardustReward: 22, firstClearBonus: 66 },
  { level: 10, targetTier: 7, targetCount: 1, maxDrops: 35, bowlWidthPercent: 100, mechanics: ['dropLimit', 'frozen'], frozenCount: 2, stardustReward: 25, firstClearBonus: 75 },
  { level: 11, targetTier: 7, targetCount: 1, maxDrops: 30, bowlWidthPercent: 90, mechanics: ['dropLimit', 'narrowBowl'], frozenCount: 0, stardustReward: 28, firstClearBonus: 84 },
  { level: 12, targetTier: 8, targetCount: 1, maxDrops: 50, bowlWidthPercent: 100, mechanics: ['dropLimit'], frozenCount: 0, stardustReward: 35, firstClearBonus: 105 },
  { level: 13, targetTier: 8, targetCount: 1, maxDrops: 40, bowlWidthPercent: 100, mechanics: ['dropLimit', 'frozen'], frozenCount: 2, stardustReward: 38, firstClearBonus: 114 },
  { level: 14, targetTier: 8, targetCount: 1, maxDrops: 35, bowlWidthPercent: 90, mechanics: ['dropLimit', 'narrowBowl', 'frozen'], frozenCount: 1, stardustReward: 40, firstClearBonus: 120 },
  { level: 15, targetTier: 8, targetCount: 1, maxDrops: 30, bowlWidthPercent: 90, mechanics: ['dropLimit', 'narrowBowl', 'bomb'], frozenCount: 0, stardustReward: 45, firstClearBonus: 135 },
  { level: 16, targetTier: 5, targetCount: 2, maxDrops: 40, bowlWidthPercent: 100, mechanics: ['dropLimit', 'dualTarget'], frozenCount: 0, stardustReward: 48, firstClearBonus: 144 },
  { level: 17, targetTier: 6, targetCount: 2, maxDrops: 45, bowlWidthPercent: 100, mechanics: ['dropLimit', 'dualTarget'], frozenCount: 0, stardustReward: 50, firstClearBonus: 150 },
  { level: 18, targetTier: 7, targetCount: 2, maxDrops: 50, bowlWidthPercent: 90, mechanics: ['dropLimit', 'dualTarget', 'narrowBowl'], frozenCount: 0, stardustReward: 55, firstClearBonus: 165 },
  { level: 19, targetTier: 8, targetCount: 2, maxDrops: 60, bowlWidthPercent: 100, mechanics: ['dropLimit', 'dualTarget'], frozenCount: 0, stardustReward: 60, firstClearBonus: 180 },
  { level: 20, targetTier: 8, targetCount: 1, maxDrops: 45, bowlWidthPercent: 80, mechanics: ['dropLimit', 'narrowBowl'], frozenCount: 0, stardustReward: 65, firstClearBonus: 195 },
  { level: 21, targetTier: 6, targetCount: 1, maxDrops: 20, bowlWidthPercent: 100, mechanics: ['dropLimit', 'speed'], frozenCount: 0, stardustReward: 55, firstClearBonus: 165 },
  { level: 22, targetTier: 7, targetCount: 1, maxDrops: 25, bowlWidthPercent: 100, mechanics: ['dropLimit', 'speed', 'frozen', 'bomb'], frozenCount: 2, stardustReward: 60, firstClearBonus: 180 },
  { level: 23, targetTier: 8, targetCount: 1, maxDrops: 30, bowlWidthPercent: 85, mechanics: ['dropLimit', 'narrowBowl', 'rainbow'], frozenCount: 0, stardustReward: 65, firstClearBonus: 195 },
  { level: 24, targetTier: 8, targetCount: 2, maxDrops: 50, bowlWidthPercent: 80, mechanics: ['dropLimit', 'dualTarget', 'narrowBowl', 'speed'], frozenCount: 0, stardustReward: 70, firstClearBonus: 210 },
  { level: 25, targetTier: 8, targetCount: 1, maxDrops: 25, bowlWidthPercent: 90, mechanics: ['dropLimit'], frozenCount: 0, stardustReward: 75, firstClearBonus: 225 },
  { level: 26, targetTier: 5, targetCount: 3, maxDrops: 40, bowlWidthPercent: 100, mechanics: ['dropLimit', 'tripleTarget', 'bomb'], frozenCount: 0, stardustReward: 78, firstClearBonus: 234 },
  { level: 27, targetTier: 7, targetCount: 2, maxDrops: 35, bowlWidthPercent: 80, mechanics: ['dropLimit', 'dualTarget', 'narrowBowl', 'speed', 'frozen'], frozenCount: 2, stardustReward: 80, firstClearBonus: 240 },
  { level: 28, targetTier: 8, targetCount: 2, maxDrops: 40, bowlWidthPercent: 75, mechanics: ['dropLimit', 'dualTarget', 'narrowBowl'], frozenCount: 0, stardustReward: 85, firstClearBonus: 255 },
  { level: 29, targetTier: 8, targetCount: 3, maxDrops: 70, bowlWidthPercent: 90, mechanics: ['dropLimit', 'tripleTarget', 'bomb', 'frozen', 'speed'], frozenCount: 2, stardustReward: 90, firstClearBonus: 270 },
  { level: 30, targetTier: 8, targetCount: 1, maxDrops: 50, bowlWidthPercent: 70, mechanics: ['dropLimit', 'narrowBowl', 'speed'], frozenCount: 0, stardustReward: 100, firstClearBonus: 300 },
];

export function getOrbLevel(level: number): OrbLevelConfig {
  const index = Math.max(1, Math.min(30, level)) - 1;
  return ORB_LEVELS[index];
}

// ─── STAR CATCHER ────────────────────────────────────────────

export type StarMechanic =
  | 'gold'
  | 'linePattern'
  | 'arcPattern'
  | 'staircasePattern'
  | 'wind'
  | 'invisible'
  | 'rain'
  | 'shrink'
  | 'dark'
  | 'mirror'
  | 'split'
  | 'bossWave';

export interface StarLevelConfig {
  level: number;
  starsToCollect: number;
  fallSpeed: number;
  spawnInterval: number;
  hazardPercent: number;
  lives: number;
  mechanics: StarMechanic[];
  stardustReward: number;
  firstClearBonus: number;
}

export const STAR_LEVELS: StarLevelConfig[] = [
  { level: 1, starsToCollect: 10, fallSpeed: 0.3, spawnInterval: 1.4, hazardPercent: 0, lives: 5, mechanics: [], stardustReward: 5, firstClearBonus: 15 },
  { level: 2, starsToCollect: 12, fallSpeed: 0.32, spawnInterval: 1.35, hazardPercent: 0, lives: 5, mechanics: [], stardustReward: 6, firstClearBonus: 18 },
  { level: 3, starsToCollect: 15, fallSpeed: 0.34, spawnInterval: 1.3, hazardPercent: 5, lives: 5, mechanics: [], stardustReward: 7, firstClearBonus: 21 },
  { level: 4, starsToCollect: 18, fallSpeed: 0.36, spawnInterval: 1.25, hazardPercent: 8, lives: 4, mechanics: [], stardustReward: 8, firstClearBonus: 24 },
  { level: 5, starsToCollect: 20, fallSpeed: 0.38, spawnInterval: 1.2, hazardPercent: 10, lives: 4, mechanics: ['gold'], stardustReward: 10, firstClearBonus: 30 },
  { level: 6, starsToCollect: 22, fallSpeed: 0.4, spawnInterval: 1.15, hazardPercent: 12, lives: 4, mechanics: ['gold', 'linePattern'], stardustReward: 12, firstClearBonus: 36 },
  { level: 7, starsToCollect: 25, fallSpeed: 0.42, spawnInterval: 1.1, hazardPercent: 15, lives: 4, mechanics: ['gold', 'arcPattern'], stardustReward: 14, firstClearBonus: 42 },
  { level: 8, starsToCollect: 28, fallSpeed: 0.44, spawnInterval: 1.05, hazardPercent: 15, lives: 3, mechanics: ['gold', 'staircasePattern'], stardustReward: 16, firstClearBonus: 48 },
  { level: 9, starsToCollect: 30, fallSpeed: 0.46, spawnInterval: 1.0, hazardPercent: 18, lives: 3, mechanics: ['gold', 'linePattern', 'arcPattern', 'staircasePattern'], stardustReward: 18, firstClearBonus: 54 },
  { level: 10, starsToCollect: 32, fallSpeed: 0.48, spawnInterval: 0.95, hazardPercent: 20, lives: 3, mechanics: ['gold', 'bossWave'], stardustReward: 25, firstClearBonus: 75 },
  { level: 11, starsToCollect: 35, fallSpeed: 0.5, spawnInterval: 0.9, hazardPercent: 22, lives: 3, mechanics: ['gold', 'wind'], stardustReward: 28, firstClearBonus: 84 },
  { level: 12, starsToCollect: 38, fallSpeed: 0.52, spawnInterval: 0.88, hazardPercent: 24, lives: 3, mechanics: ['gold', 'wind', 'linePattern'], stardustReward: 30, firstClearBonus: 90 },
  { level: 13, starsToCollect: 40, fallSpeed: 0.54, spawnInterval: 0.85, hazardPercent: 26, lives: 3, mechanics: ['gold', 'invisible'], stardustReward: 35, firstClearBonus: 105 },
  { level: 14, starsToCollect: 42, fallSpeed: 0.56, spawnInterval: 0.82, hazardPercent: 28, lives: 3, mechanics: ['gold', 'invisible', 'wind'], stardustReward: 38, firstClearBonus: 114 },
  { level: 15, starsToCollect: 45, fallSpeed: 0.58, spawnInterval: 0.8, hazardPercent: 30, lives: 3, mechanics: ['gold', 'bossWave', 'wind'], stardustReward: 40, firstClearBonus: 120 },
  { level: 16, starsToCollect: 48, fallSpeed: 0.6, spawnInterval: 0.78, hazardPercent: 30, lives: 3, mechanics: ['gold', 'rain'], stardustReward: 42, firstClearBonus: 126 },
  { level: 17, starsToCollect: 50, fallSpeed: 0.62, spawnInterval: 0.75, hazardPercent: 32, lives: 3, mechanics: ['gold', 'rain', 'wind'], stardustReward: 45, firstClearBonus: 135 },
  { level: 18, starsToCollect: 52, fallSpeed: 0.64, spawnInterval: 0.72, hazardPercent: 34, lives: 3, mechanics: ['gold', 'shrink'], stardustReward: 48, firstClearBonus: 144 },
  { level: 19, starsToCollect: 55, fallSpeed: 0.66, spawnInterval: 0.7, hazardPercent: 35, lives: 2, mechanics: ['gold', 'shrink', 'rain'], stardustReward: 50, firstClearBonus: 150 },
  { level: 20, starsToCollect: 58, fallSpeed: 0.68, spawnInterval: 0.68, hazardPercent: 36, lives: 2, mechanics: ['gold', 'bossWave', 'shrink'], stardustReward: 55, firstClearBonus: 165 },
  { level: 21, starsToCollect: 60, fallSpeed: 0.7, spawnInterval: 0.65, hazardPercent: 38, lives: 2, mechanics: ['gold', 'dark'], stardustReward: 58, firstClearBonus: 174 },
  { level: 22, starsToCollect: 62, fallSpeed: 0.72, spawnInterval: 0.62, hazardPercent: 40, lives: 2, mechanics: ['gold', 'dark', 'wind'], stardustReward: 60, firstClearBonus: 180 },
  { level: 23, starsToCollect: 65, fallSpeed: 0.74, spawnInterval: 0.6, hazardPercent: 42, lives: 2, mechanics: ['gold', 'mirror'], stardustReward: 65, firstClearBonus: 195 },
  { level: 24, starsToCollect: 68, fallSpeed: 0.76, spawnInterval: 0.58, hazardPercent: 44, lives: 2, mechanics: ['gold', 'mirror', 'dark'], stardustReward: 68, firstClearBonus: 204 },
  { level: 25, starsToCollect: 70, fallSpeed: 0.78, spawnInterval: 0.56, hazardPercent: 45, lives: 2, mechanics: ['gold', 'bossWave', 'mirror'], stardustReward: 70, firstClearBonus: 210 },
  { level: 26, starsToCollect: 72, fallSpeed: 0.8, spawnInterval: 0.54, hazardPercent: 46, lives: 2, mechanics: ['gold', 'split'], stardustReward: 75, firstClearBonus: 225 },
  { level: 27, starsToCollect: 75, fallSpeed: 0.82, spawnInterval: 0.52, hazardPercent: 48, lives: 1, mechanics: ['gold', 'split', 'mirror'], stardustReward: 80, firstClearBonus: 240 },
  { level: 28, starsToCollect: 78, fallSpeed: 0.84, spawnInterval: 0.5, hazardPercent: 48, lives: 1, mechanics: ['gold', 'rain', 'shrink', 'wind'], stardustReward: 85, firstClearBonus: 255 },
  { level: 29, starsToCollect: 80, fallSpeed: 0.86, spawnInterval: 0.48, hazardPercent: 50, lives: 1, mechanics: ['gold', 'rain', 'shrink', 'wind', 'dark', 'mirror', 'split'], stardustReward: 90, firstClearBonus: 270 },
  { level: 30, starsToCollect: 100, fallSpeed: 0.9, spawnInterval: 0.45, hazardPercent: 50, lives: 1, mechanics: ['gold', 'rain', 'shrink', 'wind', 'dark', 'mirror', 'split', 'bossWave'], stardustReward: 100, firstClearBonus: 300 },
];

export function getStarLevel(level: number): StarLevelConfig {
  const index = Math.max(1, Math.min(30, level)) - 1;
  return STAR_LEVELS[index];
}

// ─── SHELL SHUFFLE (World 4, ages 7-9) ───────────────────────

export type ShellMechanic =
  | 'double'
  | 'fakeout'
  | 'ink'
  | 'current'
  | 'twoRows'
  | 'urchin'
  | 'speed';

export interface ShellLevelConfig {
  level: number;
  clams: number;
  pearls: number;
  swaps: number;
  swapMs: number;
  previewMs: number;
  rounds: number;
  pickTimeMs: number | null;
  mechanics: ShellMechanic[];
  stardustReward: number;
  firstClearBonus: number;
}

export const SHELL_LEVELS: ShellLevelConfig[] = [
  { level: 1, clams: 3, pearls: 1, swaps: 4, swapMs: 700, previewMs: 1500, rounds: 3, pickTimeMs: null, mechanics: [], stardustReward: 6, firstClearBonus: 18 },
  { level: 2, clams: 3, pearls: 1, swaps: 6, swapMs: 520, previewMs: 1100, rounds: 3, pickTimeMs: null, mechanics: [], stardustReward: 7, firstClearBonus: 21 },
  { level: 3, clams: 4, pearls: 1, swaps: 6, swapMs: 520, previewMs: 1100, rounds: 3, pickTimeMs: null, mechanics: [], stardustReward: 8, firstClearBonus: 24 },
  { level: 4, clams: 4, pearls: 2, swaps: 6, swapMs: 520, previewMs: 1300, rounds: 3, pickTimeMs: null, mechanics: ['double'], stardustReward: 9, firstClearBonus: 27 },
  { level: 5, clams: 4, pearls: 1, swaps: 9, swapMs: 440, previewMs: 1000, rounds: 4, pickTimeMs: 6000, mechanics: ['fakeout'], stardustReward: 11, firstClearBonus: 33 },
  { level: 6, clams: 5, pearls: 1, swaps: 8, swapMs: 460, previewMs: 1000, rounds: 4, pickTimeMs: 6000, mechanics: [], stardustReward: 13, firstClearBonus: 39 },
  { level: 7, clams: 5, pearls: 2, swaps: 8, swapMs: 450, previewMs: 1100, rounds: 4, pickTimeMs: 6500, mechanics: ['double', 'fakeout'], stardustReward: 15, firstClearBonus: 45 },
  { level: 8, clams: 5, pearls: 1, swaps: 10, swapMs: 420, previewMs: 900, rounds: 4, pickTimeMs: 5500, mechanics: ['ink'], stardustReward: 17, firstClearBonus: 51 },
  { level: 9, clams: 5, pearls: 1, swaps: 10, swapMs: 410, previewMs: 900, rounds: 4, pickTimeMs: 5500, mechanics: ['current'], stardustReward: 19, firstClearBonus: 57 },
  { level: 10, clams: 5, pearls: 2, swaps: 11, swapMs: 400, previewMs: 950, rounds: 5, pickTimeMs: 6000, mechanics: ['double', 'ink', 'fakeout'], stardustReward: 24, firstClearBonus: 72 },
  { level: 11, clams: 5, pearls: 1, swaps: 11, swapMs: 390, previewMs: 850, rounds: 5, pickTimeMs: 5000, mechanics: ['current', 'fakeout'], stardustReward: 26, firstClearBonus: 78 },
  { level: 12, clams: 6, pearls: 1, swaps: 11, swapMs: 400, previewMs: 900, rounds: 5, pickTimeMs: 5500, mechanics: ['twoRows'], stardustReward: 28, firstClearBonus: 84 },
  { level: 13, clams: 6, pearls: 1, swaps: 12, swapMs: 380, previewMs: 850, rounds: 5, pickTimeMs: 5000, mechanics: ['twoRows', 'fakeout'], stardustReward: 30, firstClearBonus: 90 },
  { level: 14, clams: 5, pearls: 1, swaps: 12, swapMs: 370, previewMs: 800, rounds: 5, pickTimeMs: 4800, mechanics: ['urchin'], stardustReward: 32, firstClearBonus: 96 },
  { level: 15, clams: 5, pearls: 2, swaps: 12, swapMs: 370, previewMs: 900, rounds: 5, pickTimeMs: 5200, mechanics: ['urchin', 'double', 'current'], stardustReward: 36, firstClearBonus: 108 },
  { level: 16, clams: 6, pearls: 1, swaps: 13, swapMs: 360, previewMs: 800, rounds: 5, pickTimeMs: 4800, mechanics: ['twoRows', 'ink'], stardustReward: 38, firstClearBonus: 114 },
  { level: 17, clams: 5, pearls: 1, swaps: 14, swapMs: 340, previewMs: 750, rounds: 5, pickTimeMs: 4600, mechanics: ['speed'], stardustReward: 40, firstClearBonus: 120 },
  { level: 18, clams: 6, pearls: 2, swaps: 13, swapMs: 350, previewMs: 850, rounds: 5, pickTimeMs: 5000, mechanics: ['twoRows', 'double', 'fakeout'], stardustReward: 44, firstClearBonus: 132 },
  { level: 19, clams: 5, pearls: 1, swaps: 14, swapMs: 330, previewMs: 750, rounds: 5, pickTimeMs: 4500, mechanics: ['speed', 'urchin', 'current'], stardustReward: 46, firstClearBonus: 138 },
  { level: 20, clams: 6, pearls: 2, swaps: 14, swapMs: 330, previewMs: 800, rounds: 5, pickTimeMs: 5000, mechanics: ['twoRows', 'double', 'ink', 'urchin'], stardustReward: 50, firstClearBonus: 150 },
  { level: 21, clams: 5, pearls: 1, swaps: 15, swapMs: 310, previewMs: 720, rounds: 5, pickTimeMs: 4400, mechanics: ['speed', 'fakeout', 'ink'], stardustReward: 52, firstClearBonus: 156 },
  { level: 22, clams: 6, pearls: 1, swaps: 15, swapMs: 310, previewMs: 720, rounds: 5, pickTimeMs: 4400, mechanics: ['twoRows', 'current', 'urchin'], stardustReward: 55, firstClearBonus: 165 },
  { level: 23, clams: 6, pearls: 2, swaps: 16, swapMs: 300, previewMs: 800, rounds: 5, pickTimeMs: 4800, mechanics: ['speed', 'double', 'twoRows'], stardustReward: 58, firstClearBonus: 174 },
  { level: 24, clams: 5, pearls: 1, swaps: 17, swapMs: 290, previewMs: 700, rounds: 6, pickTimeMs: 4200, mechanics: ['speed', 'fakeout', 'current', 'ink'], stardustReward: 60, firstClearBonus: 180 },
  { level: 25, clams: 6, pearls: 1, swaps: 17, swapMs: 280, previewMs: 700, rounds: 6, pickTimeMs: 4200, mechanics: ['twoRows', 'urchin', 'fakeout', 'ink'], stardustReward: 65, firstClearBonus: 195 },
  { level: 26, clams: 6, pearls: 2, swaps: 18, swapMs: 270, previewMs: 750, rounds: 6, pickTimeMs: 4500, mechanics: ['speed', 'double', 'current', 'urchin'], stardustReward: 68, firstClearBonus: 204 },
  { level: 27, clams: 6, pearls: 1, swaps: 19, swapMs: 260, previewMs: 680, rounds: 6, pickTimeMs: 4000, mechanics: ['speed', 'twoRows', 'fakeout', 'ink', 'urchin'], stardustReward: 72, firstClearBonus: 216 },
  { level: 28, clams: 6, pearls: 2, swaps: 20, swapMs: 250, previewMs: 700, rounds: 6, pickTimeMs: 4300, mechanics: ['speed', 'twoRows', 'double', 'current', 'fakeout'], stardustReward: 78, firstClearBonus: 234 },
  { level: 29, clams: 6, pearls: 2, swaps: 21, swapMs: 235, previewMs: 680, rounds: 6, pickTimeMs: 4200, mechanics: ['speed', 'twoRows', 'double', 'ink', 'urchin', 'fakeout'], stardustReward: 85, firstClearBonus: 255 },
  { level: 30, clams: 6, pearls: 2, swaps: 22, swapMs: 220, previewMs: 650, rounds: 6, pickTimeMs: 4000, mechanics: ['double', 'fakeout', 'ink', 'current', 'twoRows', 'urchin', 'speed'], stardustReward: 100, firstClearBonus: 300 },
];

export function getShellLevel(level: number): ShellLevelConfig {
  const index = Math.max(1, Math.min(30, level)) - 1;
  return SHELL_LEVELS[index];
}

// ─── VINE FLOW (World 5, ages 9-11) ──────────────────────────

export type VineMechanic =
  | 'decoys'
  | 'locked'
  | 'thorns'
  | 'moves'
  | 'linked'
  | 'fog'
  | 'twins'
  | 'wilt';

export interface VineLevelConfig {
  level: number;
  cols: number;
  rows: number;
  buds: number;
  puzzles: number;
  /** Arcade rotation budget above par. Null = unlimited. */
  moveSlack: number | null;
  /** Arcade: time before the buds wilt. Null = untimed. */
  wiltMs: number | null;
  mechanics: VineMechanic[];
  stardustReward: number;
  firstClearBonus: number;
}

export const VINE_LEVELS: VineLevelConfig[] = [
  { level: 1, cols: 4, rows: 4, buds: 1, puzzles: 2, moveSlack: null, wiltMs: null, mechanics: [], stardustReward: 7, firstClearBonus: 21 },
  { level: 2, cols: 4, rows: 4, buds: 2, puzzles: 2, moveSlack: null, wiltMs: null, mechanics: [], stardustReward: 8, firstClearBonus: 24 },
  { level: 3, cols: 5, rows: 5, buds: 2, puzzles: 2, moveSlack: null, wiltMs: null, mechanics: ['decoys'], stardustReward: 9, firstClearBonus: 27 },
  { level: 4, cols: 5, rows: 5, buds: 3, puzzles: 2, moveSlack: null, wiltMs: null, mechanics: ['decoys', 'locked'], stardustReward: 10, firstClearBonus: 30 },
  { level: 5, cols: 5, rows: 5, buds: 3, puzzles: 2, moveSlack: null, wiltMs: null, mechanics: ['decoys', 'thorns'], stardustReward: 12, firstClearBonus: 36 },
  { level: 6, cols: 5, rows: 6, buds: 3, puzzles: 2, moveSlack: null, wiltMs: null, mechanics: ['decoys', 'locked', 'thorns'], stardustReward: 14, firstClearBonus: 42 },
  { level: 7, cols: 5, rows: 6, buds: 3, puzzles: 2, moveSlack: 8, wiltMs: null, mechanics: ['moves', 'decoys'], stardustReward: 16, firstClearBonus: 48 },
  { level: 8, cols: 6, rows: 6, buds: 4, puzzles: 2, moveSlack: 8, wiltMs: null, mechanics: ['moves', 'thorns', 'decoys'], stardustReward: 18, firstClearBonus: 54 },
  { level: 9, cols: 6, rows: 6, buds: 3, puzzles: 2, moveSlack: 8, wiltMs: null, mechanics: ['linked', 'decoys'], stardustReward: 20, firstClearBonus: 60 },
  { level: 10, cols: 6, rows: 6, buds: 4, puzzles: 3, moveSlack: 7, wiltMs: null, mechanics: ['linked', 'moves', 'locked'], stardustReward: 25, firstClearBonus: 75 },
  { level: 11, cols: 6, rows: 6, buds: 4, puzzles: 3, moveSlack: 7, wiltMs: null, mechanics: ['linked', 'thorns', 'decoys', 'moves'], stardustReward: 27, firstClearBonus: 81 },
  { level: 12, cols: 6, rows: 6, buds: 3, puzzles: 2, moveSlack: null, wiltMs: null, mechanics: ['fog', 'decoys'], stardustReward: 29, firstClearBonus: 87 },
  { level: 13, cols: 6, rows: 6, buds: 4, puzzles: 3, moveSlack: 7, wiltMs: null, mechanics: ['fog', 'moves', 'thorns'], stardustReward: 31, firstClearBonus: 93 },
  { level: 14, cols: 6, rows: 7, buds: 4, puzzles: 3, moveSlack: 6, wiltMs: null, mechanics: ['fog', 'linked', 'decoys'], stardustReward: 34, firstClearBonus: 102 },
  { level: 15, cols: 6, rows: 6, buds: 4, puzzles: 2, moveSlack: null, wiltMs: null, mechanics: ['twins'], stardustReward: 38, firstClearBonus: 114 },
  { level: 16, cols: 6, rows: 7, buds: 4, puzzles: 3, moveSlack: 7, wiltMs: null, mechanics: ['twins', 'moves', 'decoys'], stardustReward: 40, firstClearBonus: 120 },
  { level: 17, cols: 6, rows: 7, buds: 5, puzzles: 3, moveSlack: 6, wiltMs: null, mechanics: ['twins', 'thorns', 'locked', 'moves'], stardustReward: 42, firstClearBonus: 126 },
  { level: 18, cols: 6, rows: 7, buds: 4, puzzles: 2, moveSlack: null, wiltMs: 60000, mechanics: ['wilt', 'decoys'], stardustReward: 46, firstClearBonus: 138 },
  { level: 19, cols: 7, rows: 7, buds: 5, puzzles: 3, moveSlack: null, wiltMs: 55000, mechanics: ['wilt', 'thorns', 'linked'], stardustReward: 48, firstClearBonus: 144 },
  { level: 20, cols: 7, rows: 7, buds: 5, puzzles: 3, moveSlack: 6, wiltMs: null, mechanics: ['twins', 'fog', 'moves'], stardustReward: 52, firstClearBonus: 156 },
  { level: 21, cols: 7, rows: 7, buds: 5, puzzles: 3, moveSlack: null, wiltMs: 50000, mechanics: ['wilt', 'twins', 'decoys'], stardustReward: 54, firstClearBonus: 162 },
  { level: 22, cols: 7, rows: 7, buds: 5, puzzles: 3, moveSlack: 5, wiltMs: null, mechanics: ['linked', 'fog', 'moves', 'thorns'], stardustReward: 57, firstClearBonus: 171 },
  { level: 23, cols: 7, rows: 7, buds: 5, puzzles: 3, moveSlack: null, wiltMs: 50000, mechanics: ['wilt', 'fog', 'locked', 'decoys'], stardustReward: 60, firstClearBonus: 180 },
  { level: 24, cols: 7, rows: 7, buds: 6, puzzles: 3, moveSlack: 5, wiltMs: null, mechanics: ['twins', 'linked', 'moves', 'decoys'], stardustReward: 62, firstClearBonus: 186 },
  { level: 25, cols: 7, rows: 7, buds: 6, puzzles: 3, moveSlack: null, wiltMs: 48000, mechanics: ['wilt', 'twins', 'thorns'], stardustReward: 67, firstClearBonus: 201 },
  { level: 26, cols: 7, rows: 7, buds: 6, puzzles: 3, moveSlack: 4, wiltMs: null, mechanics: ['fog', 'linked', 'moves', 'thorns', 'decoys'], stardustReward: 70, firstClearBonus: 210 },
  { level: 27, cols: 7, rows: 7, buds: 6, puzzles: 3, moveSlack: null, wiltMs: 45000, mechanics: ['wilt', 'twins', 'fog', 'decoys'], stardustReward: 74, firstClearBonus: 222 },
  { level: 28, cols: 7, rows: 7, buds: 6, puzzles: 3, moveSlack: 4, wiltMs: null, mechanics: ['twins', 'linked', 'moves', 'thorns', 'locked'], stardustReward: 80, firstClearBonus: 240 },
  { level: 29, cols: 7, rows: 7, buds: 6, puzzles: 3, moveSlack: 4, wiltMs: 42000, mechanics: ['wilt', 'moves', 'twins', 'fog', 'linked', 'decoys'], stardustReward: 87, firstClearBonus: 261 },
  { level: 30, cols: 7, rows: 7, buds: 6, puzzles: 3, moveSlack: 3, wiltMs: 40000, mechanics: ['decoys', 'locked', 'thorns', 'moves', 'linked', 'fog', 'twins', 'wilt'], stardustReward: 100, firstClearBonus: 300 },
];

export function getVineLevel(level: number): VineLevelConfig {
  const index = Math.max(1, Math.min(30, level)) - 1;
  return VINE_LEVELS[index];
}

// ─── BEAT CIRCUIT (World 6, ages 11-13) ──────────────────────

export type BeatMechanic =
  | 'eighths'
  | 'holds'
  | 'chords'
  | 'offbeat'
  | 'echo'
  | 'ghost'
  | 'switch'
  | 'tempo';

export interface BeatLevelConfig {
  level: number;
  lanes: number;
  bpm: number;
  /** Song length in 4/4 bars. */
  bars: number;
  /** Share of notes (0..1) that must be hit to clear the level. */
  passAccuracy: number;
  mechanics: BeatMechanic[];
  stardustReward: number;
  firstClearBonus: number;
}

export const BEAT_LEVELS: BeatLevelConfig[] = [
  { level: 1, lanes: 3, bpm: 80, bars: 8, passAccuracy: 0.6, mechanics: [], stardustReward: 7, firstClearBonus: 21 },
  { level: 2, lanes: 3, bpm: 90, bars: 8, passAccuracy: 0.6, mechanics: ['eighths'], stardustReward: 8, firstClearBonus: 24 },
  { level: 3, lanes: 4, bpm: 92, bars: 8, passAccuracy: 0.6, mechanics: ['eighths'], stardustReward: 9, firstClearBonus: 27 },
  { level: 4, lanes: 4, bpm: 95, bars: 10, passAccuracy: 0.6, mechanics: ['eighths', 'holds'], stardustReward: 10, firstClearBonus: 30 },
  { level: 5, lanes: 4, bpm: 98, bars: 10, passAccuracy: 0.6, mechanics: ['eighths', 'chords'], stardustReward: 12, firstClearBonus: 36 },
  { level: 6, lanes: 4, bpm: 100, bars: 10, passAccuracy: 0.65, mechanics: ['eighths', 'offbeat'], stardustReward: 14, firstClearBonus: 42 },
  { level: 7, lanes: 4, bpm: 104, bars: 10, passAccuracy: 0.65, mechanics: ['eighths', 'holds', 'chords'], stardustReward: 16, firstClearBonus: 48 },
  { level: 8, lanes: 4, bpm: 100, bars: 10, passAccuracy: 0.65, mechanics: ['echo', 'eighths'], stardustReward: 18, firstClearBonus: 54 },
  { level: 9, lanes: 4, bpm: 106, bars: 10, passAccuracy: 0.65, mechanics: ['echo', 'holds', 'offbeat', 'eighths'], stardustReward: 20, firstClearBonus: 60 },
  { level: 10, lanes: 5, bpm: 108, bars: 12, passAccuracy: 0.65, mechanics: ['eighths', 'chords'], stardustReward: 25, firstClearBonus: 75 },
  { level: 11, lanes: 5, bpm: 112, bars: 12, passAccuracy: 0.65, mechanics: ['eighths', 'holds', 'offbeat'], stardustReward: 27, firstClearBonus: 81 },
  { level: 12, lanes: 5, bpm: 108, bars: 12, passAccuracy: 0.65, mechanics: ['ghost', 'eighths'], stardustReward: 29, firstClearBonus: 87 },
  { level: 13, lanes: 5, bpm: 114, bars: 12, passAccuracy: 0.7, mechanics: ['ghost', 'holds', 'chords', 'eighths'], stardustReward: 31, firstClearBonus: 93 },
  { level: 14, lanes: 5, bpm: 112, bars: 12, passAccuracy: 0.7, mechanics: ['switch', 'eighths'], stardustReward: 34, firstClearBonus: 102 },
  { level: 15, lanes: 5, bpm: 118, bars: 12, passAccuracy: 0.7, mechanics: ['switch', 'offbeat', 'holds', 'eighths'], stardustReward: 38, firstClearBonus: 114 },
  { level: 16, lanes: 5, bpm: 118, bars: 12, passAccuracy: 0.7, mechanics: ['echo', 'ghost', 'eighths'], stardustReward: 40, firstClearBonus: 120 },
  { level: 17, lanes: 5, bpm: 112, bars: 12, passAccuracy: 0.7, mechanics: ['tempo', 'eighths'], stardustReward: 42, firstClearBonus: 126 },
  { level: 18, lanes: 5, bpm: 120, bars: 12, passAccuracy: 0.7, mechanics: ['tempo', 'chords', 'holds', 'eighths'], stardustReward: 46, firstClearBonus: 138 },
  { level: 19, lanes: 5, bpm: 124, bars: 12, passAccuracy: 0.7, mechanics: ['switch', 'ghost', 'offbeat', 'eighths'], stardustReward: 48, firstClearBonus: 144 },
  { level: 20, lanes: 5, bpm: 130, bars: 14, passAccuracy: 0.7, mechanics: ['eighths', 'chords', 'holds', 'offbeat'], stardustReward: 52, firstClearBonus: 156 },
  { level: 21, lanes: 5, bpm: 132, bars: 14, passAccuracy: 0.75, mechanics: ['tempo', 'switch', 'eighths'], stardustReward: 54, firstClearBonus: 162 },
  { level: 22, lanes: 5, bpm: 134, bars: 14, passAccuracy: 0.75, mechanics: ['echo', 'ghost', 'chords', 'eighths'], stardustReward: 57, firstClearBonus: 171 },
  { level: 23, lanes: 5, bpm: 136, bars: 14, passAccuracy: 0.75, mechanics: ['holds', 'offbeat', 'switch', 'chords', 'eighths'], stardustReward: 60, firstClearBonus: 180 },
  { level: 24, lanes: 5, bpm: 138, bars: 14, passAccuracy: 0.75, mechanics: ['tempo', 'ghost', 'holds', 'eighths'], stardustReward: 62, firstClearBonus: 186 },
  { level: 25, lanes: 5, bpm: 140, bars: 16, passAccuracy: 0.75, mechanics: ['echo', 'switch', 'chords', 'offbeat', 'eighths'], stardustReward: 67, firstClearBonus: 201 },
  { level: 26, lanes: 5, bpm: 142, bars: 16, passAccuracy: 0.75, mechanics: ['ghost', 'tempo', 'holds', 'chords', 'eighths'], stardustReward: 70, firstClearBonus: 210 },
  { level: 27, lanes: 5, bpm: 144, bars: 16, passAccuracy: 0.8, mechanics: ['switch', 'ghost', 'offbeat', 'echo', 'eighths'], stardustReward: 74, firstClearBonus: 222 },
  { level: 28, lanes: 5, bpm: 146, bars: 16, passAccuracy: 0.8, mechanics: ['tempo', 'switch', 'chords', 'holds', 'offbeat', 'eighths'], stardustReward: 80, firstClearBonus: 240 },
  { level: 29, lanes: 5, bpm: 148, bars: 16, passAccuracy: 0.8, mechanics: ['ghost', 'tempo', 'echo', 'chords', 'holds', 'eighths'], stardustReward: 87, firstClearBonus: 261 },
  { level: 30, lanes: 5, bpm: 150, bars: 16, passAccuracy: 0.8, mechanics: ['eighths', 'holds', 'chords', 'offbeat', 'echo', 'ghost', 'switch', 'tempo'], stardustReward: 100, firstClearBonus: 300 },
];

export function getBeatLevel(level: number): BeatLevelConfig {
  const index = Math.max(1, Math.min(30, level)) - 1;
  return BEAT_LEVELS[index];
}

// ─── ECHO PEAKS (World 7, teens/adults) ──────────────────────

export type PeakChannel = 'pos' | 'sound' | 'color';

export type PeakMechanic =
  | 'lures'
  | 'drift'
  | 'flash'
  | 'tempo';

export interface PeakLevelConfig {
  level: number;
  /** How many steps back a match refers to. */
  n: number;
  channels: PeakChannel[];
  /** Steps in a round, including the first n that can't match. */
  trials: number;
  stepMs: number;
  /** Score (0..1, hits minus false alarms over targets) needed to clear. */
  passScore: number;
  mechanics: PeakMechanic[];
  stardustReward: number;
  firstClearBonus: number;
}

const DUAL: PeakChannel[] = ['pos', 'sound'];
const TRIPLE: PeakChannel[] = ['pos', 'sound', 'color'];

export const PEAK_LEVELS: PeakLevelConfig[] = [
  { level: 1, n: 1, channels: ['pos'], trials: 21, stepMs: 3000, passScore: 0.5, mechanics: [], stardustReward: 7, firstClearBonus: 21 },
  { level: 2, n: 1, channels: ['sound'], trials: 21, stepMs: 2900, passScore: 0.5, mechanics: [], stardustReward: 8, firstClearBonus: 24 },
  { level: 3, n: 1, channels: DUAL, trials: 21, stepMs: 2900, passScore: 0.5, mechanics: [], stardustReward: 9, firstClearBonus: 27 },
  { level: 4, n: 2, channels: ['pos'], trials: 22, stepMs: 2900, passScore: 0.5, mechanics: [], stardustReward: 10, firstClearBonus: 30 },
  { level: 5, n: 2, channels: DUAL, trials: 22, stepMs: 2900, passScore: 0.5, mechanics: [], stardustReward: 12, firstClearBonus: 36 },
  { level: 6, n: 2, channels: DUAL, trials: 22, stepMs: 2500, passScore: 0.55, mechanics: [], stardustReward: 14, firstClearBonus: 42 },
  { level: 7, n: 2, channels: DUAL, trials: 22, stepMs: 2500, passScore: 0.55, mechanics: ['lures'], stardustReward: 16, firstClearBonus: 48 },
  { level: 8, n: 1, channels: TRIPLE, trials: 21, stepMs: 2600, passScore: 0.55, mechanics: [], stardustReward: 18, firstClearBonus: 54 },
  { level: 9, n: 2, channels: TRIPLE, trials: 22, stepMs: 2700, passScore: 0.55, mechanics: ['lures'], stardustReward: 20, firstClearBonus: 60 },
  { level: 10, n: 3, channels: DUAL, trials: 27, stepMs: 2800, passScore: 0.55, mechanics: [], stardustReward: 25, firstClearBonus: 75 },
  { level: 11, n: 3, channels: DUAL, trials: 27, stepMs: 2600, passScore: 0.55, mechanics: ['lures'], stardustReward: 27, firstClearBonus: 81 },
  { level: 12, n: 2, channels: DUAL, trials: 26, stepMs: 2600, passScore: 0.6, mechanics: ['drift'], stardustReward: 29, firstClearBonus: 87 },
  { level: 13, n: 3, channels: DUAL, trials: 27, stepMs: 2500, passScore: 0.6, mechanics: ['drift', 'lures'], stardustReward: 31, firstClearBonus: 93 },
  { level: 14, n: 2, channels: DUAL, trials: 26, stepMs: 2500, passScore: 0.6, mechanics: ['flash'], stardustReward: 34, firstClearBonus: 102 },
  { level: 15, n: 3, channels: DUAL, trials: 27, stepMs: 2400, passScore: 0.6, mechanics: ['flash', 'lures'], stardustReward: 38, firstClearBonus: 114 },
  { level: 16, n: 3, channels: TRIPLE, trials: 27, stepMs: 2800, passScore: 0.6, mechanics: [], stardustReward: 40, firstClearBonus: 120 },
  { level: 17, n: 3, channels: DUAL, trials: 27, stepMs: 2300, passScore: 0.6, mechanics: ['drift', 'flash'], stardustReward: 42, firstClearBonus: 126 },
  { level: 18, n: 2, channels: DUAL, trials: 26, stepMs: 2400, passScore: 0.6, mechanics: ['tempo'], stardustReward: 46, firstClearBonus: 138 },
  { level: 19, n: 3, channels: DUAL, trials: 27, stepMs: 2300, passScore: 0.65, mechanics: ['tempo', 'lures'], stardustReward: 48, firstClearBonus: 144 },
  { level: 20, n: 4, channels: DUAL, trials: 32, stepMs: 2800, passScore: 0.6, mechanics: [], stardustReward: 52, firstClearBonus: 156 },
  { level: 21, n: 3, channels: TRIPLE, trials: 31, stepMs: 2600, passScore: 0.65, mechanics: ['lures'], stardustReward: 54, firstClearBonus: 162 },
  { level: 22, n: 4, channels: DUAL, trials: 32, stepMs: 2600, passScore: 0.65, mechanics: ['lures'], stardustReward: 57, firstClearBonus: 171 },
  { level: 23, n: 3, channels: TRIPLE, trials: 31, stepMs: 2400, passScore: 0.65, mechanics: ['drift'], stardustReward: 60, firstClearBonus: 180 },
  { level: 24, n: 3, channels: TRIPLE, trials: 31, stepMs: 2300, passScore: 0.65, mechanics: ['lures', 'drift', 'flash', 'tempo'], stardustReward: 62, firstClearBonus: 186 },
  { level: 25, n: 4, channels: DUAL, trials: 32, stepMs: 2400, passScore: 0.65, mechanics: ['drift', 'flash'], stardustReward: 67, firstClearBonus: 201 },
  { level: 26, n: 4, channels: DUAL, trials: 32, stepMs: 2200, passScore: 0.7, mechanics: ['lures', 'tempo'], stardustReward: 70, firstClearBonus: 210 },
  { level: 27, n: 3, channels: TRIPLE, trials: 33, stepMs: 2100, passScore: 0.7, mechanics: ['lures', 'drift', 'flash', 'tempo'], stardustReward: 74, firstClearBonus: 222 },
  { level: 28, n: 4, channels: DUAL, trials: 34, stepMs: 1700, passScore: 0.7, mechanics: ['lures', 'drift', 'flash', 'tempo'], stardustReward: 80, firstClearBonus: 240 },
  { level: 29, n: 4, channels: TRIPLE, trials: 34, stepMs: 2200, passScore: 0.7, mechanics: ['lures', 'drift'], stardustReward: 87, firstClearBonus: 261 },
  { level: 30, n: 4, channels: TRIPLE, trials: 34, stepMs: 2000, passScore: 0.7, mechanics: ['lures', 'drift', 'flash', 'tempo'], stardustReward: 100, firstClearBonus: 300 },
];

export function getPeakLevel(level: number): PeakLevelConfig {
  const index = Math.max(1, Math.min(30, level)) - 1;
  return PEAK_LEVELS[index];
}
