import { useAchievements } from './achievements';
import { create } from 'zustand';
import { createSafeKV, type SafeKV } from '../storage/kv';
import type { Mode } from '../engine/dda';
import type { WorldId } from '../worlds';
import { weekKey } from '../engine/daily';

const kv: SafeKV = createSafeKV('zikaron3d-profile');

export const MODES: Mode[] = ['TOYBOX', 'ARCADE', 'SANCTUARY'];
export const CREATURE_IDS = [
  'pip',
  'bloop',
  'fuzz',
  'nutty',
  'zap',
  'grumble',
  'frost',
  'ember',
  'dusk',
  'coral',
  'moss',
  'bolt',
  'luna',
  'nova',
  'titan',
] as const;
export type CreatureId = (typeof CREATURE_IDS)[number];
export const GAME_IDS = ['burrows', 'orbs', 'stars', 'shells', 'vines', 'beats', 'peaks'] as const;
export type GameId = (typeof GAME_IDS)[number];
const isGameId = (g: string): g is GameId => GAME_IDS.includes(g as GameId);

interface ProfileState {
  mode: Mode;
  /** Lifetime XP. The hub derives a level ring from this value. */
  xp: number;
  /** Creatures added to the animated toy shelf. Pip is the default companion. */
  collection: CreatureId[];
  /** UTC date key for the currently active daily challenge. */
  dailyKey: string;
  /** Game IDs completed for the current UTC day. */
  dailyCompleted: GameId[];
  /** Highest round reached in Critter Burrows (0-based). */
  burrowsLevel: number;
  setBurrowsLevel: (level: number) => void;
  /** Highest level reached in Orb Merge (0-based). */
  orbLevel: number;
  setOrbLevel: (level: number) => void;
  /** Highest creature tier ever merged in Orb Merge (0-based). */
  orbBest: number;
  setOrbBest: (tier: number) => void;
  /** Highest level reached in Star Catcher (0-based). */
  starLevel: number;
  setStarLevel: (level: number) => void;
  /** Most stars caught in a single Star Catcher run. */
  starBest: number;
  setStarBest: (n: number) => void;
  /** Highest level reached in Shell Shuffle (0-based). */
  shellsLevel: number;
  setShellsLevel: (level: number) => void;
  /** Highest level reached in Vine Flow (0-based). */
  vinesLevel: number;
  setVinesLevel: (level: number) => void;
  /** Highest level reached in Beat Circuit (0-based). */
  beatsLevel: number;
  setBeatsLevel: (level: number) => void;
  /** Highest level reached in Echo Peaks (0-based). */
  peaksLevel: number;
  setPeaksLevel: (level: number) => void;
  awardXp: (amount: number) => void;
  unlockCreature: (id: CreatureId) => boolean;
  completeDaily: (game: GameId) => boolean;
  setMode: (mode: Mode) => void;
  cycleMode: () => Mode;
  /** Worlds unlocked by the player via Stardust/Crystals (Meadow is always free). */
  unlockedWorlds: WorldId[];
  unlockWorld: (id: WorldId) => void;
  isWorldUnlocked: (id: WorldId) => boolean;
  /** Worlds whose unlock celebration has already played. */
  celebratedWorlds: WorldId[];
  markWorldCelebrated: (id: WorldId) => void;
  /** Streak shields (Arcade). One absorbs a hazard hit or a streak break. */
  shields: number;
  addShields: (n: number) => void;
  spendShield: () => boolean;
  /** Arcade XP earned this UTC week; the leaderboard score. */
  weekKey: string;
  weeklyScore: number;
  /** Merges a cloud snapshot into local state (never loses progress). */
  mergeRemote: (remote: RemoteProfile) => void;
}

/** Fields synced with the cloud. Merge rule: max for numbers, union for sets. */
export interface RemoteProfile {
  xp: number;
  collection: string[];
  burrowsLevel: number;
  orbLevel?: number;
  orbBest: number;
  starLevel?: number;
  starBest: number;
  shellsLevel?: number;
  vinesLevel?: number;
  beatsLevel?: number;
  peaksLevel?: number;
  shields: number;
  unlockedWorlds?: string[];
  celebratedWorlds: string[];
  dailyKey: string;
  dailyCompleted: string[];
  weekKey: string;
  weeklyScore: number;
}

const storedMode = kv?.getString('mode') as Mode | undefined;
const todayKey = () => new Date().toISOString().slice(0, 10);
const parseCollection = (): CreatureId[] => {
  try {
    const stored = JSON.parse(kv?.getString('collection') ?? '[]') as string[];
    return stored.filter((id): id is CreatureId => CREATURE_IDS.includes(id as CreatureId));
  } catch {
    return [];
  }
};
const storedCollection = parseCollection();
const dailyKey = kv?.getString('dailyKey') ?? todayKey();
const parseDaily = (): GameId[] => {
  if (dailyKey !== todayKey()) return [];
  try {
    const stored = JSON.parse(kv?.getString('dailyCompleted') ?? '[]') as string[];
    return stored.filter(isGameId);
  } catch {
    return [];
  }
};
const storedDaily = parseDaily();
const WORLD_IDS: WorldId[] = ['meadow', 'crystal', 'candy', 'deep_sea', 'grove', 'circuit', 'summit'];
const parseCelebrated = (): WorldId[] => {
  try {
    const stored = JSON.parse(kv?.getString('celebratedWorlds') ?? '[]') as string[];
    return stored.filter((id): id is WorldId => WORLD_IDS.includes(id as WorldId));
  } catch {
    return [];
  }
};
const parseUnlockedWorlds = (): WorldId[] => {
  try {
    const stored = JSON.parse(kv?.getString('unlockedWorlds') ?? '[]') as string[];
    const valid = stored.filter((id): id is WorldId => WORLD_IDS.includes(id as WorldId));
    return Array.from(new Set<WorldId>(['meadow', ...valid, ...parseCelebrated()]));
  } catch {
    return Array.from(new Set<WorldId>(['meadow', ...parseCelebrated()]));
  }
};
const MAX_SHIELDS = 30;

export const useProfile = create<ProfileState>((set, get) => ({
  mode: storedMode && MODES.includes(storedMode) ? storedMode : 'TOYBOX',
  xp: kv?.getNumber('xp') ?? 0,
  collection: Array.from(new Set<CreatureId>(['pip', ...storedCollection])),
  dailyKey,
  dailyCompleted: storedDaily,
  awardXp: (amount) => {
    if (amount <= 0) return;
    const rounded = Math.round(amount);
    const xp = get().xp + rounded;
    kv?.set('xp', xp);
    const wk = weekKey();
    const current = get().weekKey === wk ? get().weeklyScore : 0;
    const weeklyScore = get().mode === 'ARCADE' ? current + rounded : current;
    kv?.set('weekKey', wk);
    kv?.set('weeklyScore', weeklyScore);
    set({ xp, weekKey: wk, weeklyScore });
  },
  unlockCreature: (id) => {
    if (get().collection.includes(id)) return false;
    const collection = [...get().collection, id];
    kv?.set('collection', JSON.stringify(collection));
    useAchievements.getState().setMetricMax('creatures_discovered', collection.length);
    set({ collection });
    return true;
  },
  completeDaily: (game) => {
    const today = todayKey();
    const active = get().dailyKey === today ? get().dailyCompleted : [];
    if (active.includes(game)) return false;
    const dailyCompleted = [...active, game];
    kv?.set('dailyKey', today);
    kv?.set('dailyCompleted', JSON.stringify(dailyCompleted));
    const shields = Math.min(MAX_SHIELDS, get().shields + 1);
    kv?.set('shields', shields);
    set({ dailyKey: today, dailyCompleted, shields });
    return true;
  },
  burrowsLevel: kv?.getNumber('burrowsLevel') ?? 0,
  setMode: (mode) => {
    kv?.set('mode', mode);
    set({ mode });
  },
  cycleMode: () => {
    const next = MODES[(MODES.indexOf(get().mode) + 1) % MODES.length];
    kv?.set('mode', next);
    set({ mode: next });
    return next;
  },
  setBurrowsLevel: (burrowsLevel) => {
    kv?.set('burrowsLevel', burrowsLevel);
    set({ burrowsLevel });
  },
  orbLevel: kv?.getNumber('orbLevel') ?? 0,
  setOrbLevel: (orbLevel) => {
    if (orbLevel <= get().orbLevel) return;
    kv?.set('orbLevel', orbLevel);
    set({ orbLevel });
  },
  orbBest: kv?.getNumber('orbBest') ?? 0,
  setOrbBest: (orbBest) => {
    if (orbBest <= get().orbBest) return;
    kv?.set('orbBest', orbBest);
    set({ orbBest });
  },
  starLevel: kv?.getNumber('starLevel') ?? 0,
  setStarLevel: (starLevel) => {
    if (starLevel <= get().starLevel) return;
    kv?.set('starLevel', starLevel);
    set({ starLevel });
  },
  weekKey: kv?.getString('weekKey') ?? weekKey(),
  weeklyScore: kv?.getString('weekKey') === weekKey() ? (kv?.getNumber('weeklyScore') ?? 0) : 0,
  mergeRemote: (r) => {
    const st = get();
    const xp = Math.max(st.xp, r.xp);
    const collection = Array.from(new Set<CreatureId>([...st.collection, ...r.collection.filter((id): id is CreatureId => CREATURE_IDS.includes(id as CreatureId))]));
    const burrowsLevel = Math.max(st.burrowsLevel, r.burrowsLevel);
    const orbLevel = Math.max(st.orbLevel, r.orbLevel ?? 0);
    const orbBest = Math.max(st.orbBest, r.orbBest);
    const starLevel = Math.max(st.starLevel, r.starLevel ?? 0);
    const starBest = Math.max(st.starBest, r.starBest);
    const shellsLevel = Math.max(st.shellsLevel, r.shellsLevel ?? 0);
    const vinesLevel = Math.max(st.vinesLevel, r.vinesLevel ?? 0);
    const beatsLevel = Math.max(st.beatsLevel, r.beatsLevel ?? 0);
    const peaksLevel = Math.max(st.peaksLevel, r.peaksLevel ?? 0);
    const shields = Math.min(MAX_SHIELDS, Math.max(st.shields, r.shields));
    const celebratedWorlds = Array.from(new Set<WorldId>([...st.celebratedWorlds, ...r.celebratedWorlds.filter((id): id is WorldId => WORLD_IDS.includes(id as WorldId))]));
    const unlockedWorlds = Array.from(new Set<WorldId>([...st.unlockedWorlds, ...(r.unlockedWorlds?.filter((id): id is WorldId => WORLD_IDS.includes(id as WorldId)) ?? [])]));
    const today = todayKey();
    const localDaily = st.dailyKey === today ? st.dailyCompleted : [];
    const remoteDaily = r.dailyKey === today ? r.dailyCompleted.filter(isGameId) : [];
    const dailyCompleted = Array.from(new Set<GameId>([...localDaily, ...remoteDaily]));
    const wk = weekKey();
    const weeklyScore = Math.max(st.weekKey === wk ? st.weeklyScore : 0, r.weekKey === wk ? r.weeklyScore : 0);
    kv?.set('xp', xp);
    kv?.set('collection', JSON.stringify(collection));
    kv?.set('burrowsLevel', burrowsLevel);
    kv?.set('orbLevel', orbLevel);
    kv?.set('orbBest', orbBest);
    kv?.set('starLevel', starLevel);
    kv?.set('starBest', starBest);
    kv?.set('shellsLevel', shellsLevel);
    kv?.set('vinesLevel', vinesLevel);
    kv?.set('beatsLevel', beatsLevel);
    kv?.set('peaksLevel', peaksLevel);
    kv?.set('shields', shields);
    kv?.set('celebratedWorlds', JSON.stringify(celebratedWorlds));
    kv?.set('unlockedWorlds', JSON.stringify(unlockedWorlds));
    kv?.set('dailyKey', today);
    kv?.set('dailyCompleted', JSON.stringify(dailyCompleted));
    kv?.set('weekKey', wk);
    kv?.set('weeklyScore', weeklyScore);
    set({ xp, collection, burrowsLevel, orbLevel, orbBest, starLevel, starBest, shellsLevel, vinesLevel, beatsLevel, peaksLevel, shields, celebratedWorlds, unlockedWorlds, dailyKey: today, dailyCompleted, weekKey: wk, weeklyScore });
  },
  unlockedWorlds: parseUnlockedWorlds(),
  unlockWorld: (id) => {
    if (get().unlockedWorlds.includes(id)) return;
    const unlockedWorlds = Array.from(new Set<WorldId>([...get().unlockedWorlds, id]));
    kv?.set('unlockedWorlds', JSON.stringify(unlockedWorlds));
    set({ unlockedWorlds });
  },
  isWorldUnlocked: (id) => {
    return get().unlockedWorlds.includes(id);
  },
  celebratedWorlds: Array.from(new Set<WorldId>(['meadow', ...parseCelebrated()])),
  markWorldCelebrated: (id) => {
    if (get().celebratedWorlds.includes(id)) return;
    const celebratedWorlds = [...get().celebratedWorlds, id];
    kv?.set('celebratedWorlds', JSON.stringify(celebratedWorlds));
    set({ celebratedWorlds });
  },
  shields: kv?.getNumber('shields') ?? 3,
  addShields: (n) => {
    const shields = Math.max(0, Math.min(MAX_SHIELDS, get().shields + n));
    kv?.set('shields', shields);
    set({ shields });
  },
  spendShield: () => {
    if (get().shields <= 0) return false;
    const shields = get().shields - 1;
    kv?.set('shields', shields);
    set({ shields });
    return true;
  },
  starBest: kv?.getNumber('starBest') ?? 0,
  setStarBest: (starBest) => {
    if (starBest <= get().starBest) return;
    kv?.set('starBest', starBest);
    set({ starBest });
  },
  shellsLevel: kv?.getNumber('shellsLevel') ?? 0,
  setShellsLevel: (shellsLevel) => {
    if (shellsLevel <= get().shellsLevel) return;
    kv?.set('shellsLevel', shellsLevel);
    set({ shellsLevel });
  },
  vinesLevel: kv?.getNumber('vinesLevel') ?? 0,
  setVinesLevel: (vinesLevel) => {
    if (vinesLevel <= get().vinesLevel) return;
    kv?.set('vinesLevel', vinesLevel);
    set({ vinesLevel });
  },
  beatsLevel: kv?.getNumber('beatsLevel') ?? 0,
  setBeatsLevel: (beatsLevel) => {
    if (beatsLevel <= get().beatsLevel) return;
    kv?.set('beatsLevel', beatsLevel);
    set({ beatsLevel });
  },
  peaksLevel: kv?.getNumber('peaksLevel') ?? 0,
  setPeaksLevel: (peaksLevel) => {
    if (peaksLevel <= get().peaksLevel) return;
    kv?.set('peaksLevel', peaksLevel);
    set({ peaksLevel });
  },
}));

/** Levels cleared in a game (0-based; the next playable level is this + 1). */
export function getGameLevel(game: GameId): number {
  const s = useProfile.getState();
  switch (game) {
    case 'burrows':
      return s.burrowsLevel || 0;
    case 'orbs':
      return s.orbLevel || 0;
    case 'stars':
      return s.starLevel || 0;
    case 'shells':
      return s.shellsLevel || 0;
    case 'vines':
      return s.vinesLevel || 0;
    case 'beats':
      return s.beatsLevel || 0;
    case 'peaks':
      return s.peaksLevel || 0;
  }
}

export function setGameLevel(game: GameId, level: number): void {
  const s = useProfile.getState();
  switch (game) {
    case 'burrows':
      return s.setBurrowsLevel(level);
    case 'orbs':
      return s.setOrbLevel(level);
    case 'stars':
      return s.setStarLevel(level);
    case 'shells':
      return s.setShellsLevel(level);
    case 'vines':
      return s.setVinesLevel(level);
    case 'beats':
      return s.setBeatsLevel(level);
    case 'peaks':
      return s.setPeaksLevel(level);
  }
}
