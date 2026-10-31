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
