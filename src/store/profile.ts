import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import type { Mode } from '../engine/dda';
import type { WorldId } from '../worlds';
import { weekKey } from '../engine/daily';

let kv: ReturnType<typeof createMMKV> | null = null;
try {
  kv = createMMKV({ id: 'zikaron3d-profile' });
} catch {
  kv = null;
}

export const MODES: Mode[] = ['TOYBOX', 'ARCADE', 'SANCTUARY'];
export const CREATURE_IDS = ['pip', 'bloop', 'fuzz', 'nutty', 'zap', 'grumble', 'frost', 'ember', 'dusk'] as const;
export type CreatureId = (typeof CREATURE_IDS)[number];
export type GameId = 'burrows' | 'orbs' | 'stars';

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
  awardXp: (amount: number) => void;
  unlockCreature: (id: CreatureId) => boolean;
  completeDaily: (game: GameId) => boolean;
  setMode: (mode: Mode) => void;
  cycleMode: () => Mode;
  setBurrowsLevel: (level: number) => void;
  /** Highest creature tier ever merged in Orb Merge (0-based). */
  orbBest: number;
  setOrbBest: (tier: number) => void;
  /** Most stars caught in a single Star Catcher run. */
  starBest: number;
  setStarBest: (n: number) => void;
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
  orbBest: number;
  starBest: number;
  shields: number;
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
    return stored.filter((game): game is GameId => game === 'burrows' || game === 'orbs' || game === 'stars');
  } catch {
    return [];
  }
};
const storedDaily = parseDaily();
const WORLD_IDS: WorldId[] = ['meadow', 'crystal', 'candy'];
const parseCelebrated = (): WorldId[] => {
  try {
    const stored = JSON.parse(kv?.getString('celebratedWorlds') ?? '[]') as string[];
    return stored.filter((id): id is WorldId => WORLD_IDS.includes(id as WorldId));
  } catch {
    return [];
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
  orbBest: kv?.getNumber('orbBest') ?? 0,
  setOrbBest: (orbBest) => {
    if (orbBest <= get().orbBest) return;
    kv?.set('orbBest', orbBest);
    set({ orbBest });
  },
  weekKey: kv?.getString('weekKey') ?? weekKey(),
  weeklyScore: kv?.getString('weekKey') === weekKey() ? (kv?.getNumber('weeklyScore') ?? 0) : 0,
  mergeRemote: (r) => {
    const st = get();
    const xp = Math.max(st.xp, r.xp);
    const collection = Array.from(new Set<CreatureId>([...st.collection, ...r.collection.filter((id): id is CreatureId => CREATURE_IDS.includes(id as CreatureId))]));
    const burrowsLevel = Math.max(st.burrowsLevel, r.burrowsLevel);
    const orbBest = Math.max(st.orbBest, r.orbBest);
    const starBest = Math.max(st.starBest, r.starBest);
    const shields = Math.min(MAX_SHIELDS, Math.max(st.shields, r.shields));
    const celebratedWorlds = Array.from(new Set<WorldId>([...st.celebratedWorlds, ...r.celebratedWorlds.filter((id): id is WorldId => WORLD_IDS.includes(id as WorldId))]));
    const today = todayKey();
    const localDaily = st.dailyKey === today ? st.dailyCompleted : [];
    const remoteDaily = r.dailyKey === today ? r.dailyCompleted.filter((g): g is GameId => g === 'burrows' || g === 'orbs' || g === 'stars') : [];
    const dailyCompleted = Array.from(new Set<GameId>([...localDaily, ...remoteDaily]));
    const wk = weekKey();
    const weeklyScore = Math.max(st.weekKey === wk ? st.weeklyScore : 0, r.weekKey === wk ? r.weeklyScore : 0);
    kv?.set('xp', xp);
    kv?.set('collection', JSON.stringify(collection));
    kv?.set('burrowsLevel', burrowsLevel);
    kv?.set('orbBest', orbBest);
    kv?.set('starBest', starBest);
    kv?.set('shields', shields);
    kv?.set('celebratedWorlds', JSON.stringify(celebratedWorlds));
    kv?.set('dailyKey', today);
    kv?.set('dailyCompleted', JSON.stringify(dailyCompleted));
    kv?.set('weekKey', wk);
    kv?.set('weeklyScore', weeklyScore);
    set({ xp, collection, burrowsLevel, orbBest, starBest, shields, celebratedWorlds, dailyKey: today, dailyCompleted, weekKey: wk, weeklyScore });
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
}));
