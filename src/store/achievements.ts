import { create } from 'zustand';
import { createSafeKV, type SafeKV } from '../storage/kv';
import { useEconomy } from './economy';
import { useInventory } from './inventory';

const kv: SafeKV = createSafeKV('zikaron3d-achievements');

export type AchievementCategory =
  | 'burrows'
  | 'orbs'
  | 'stars'
  | 'collection'
  | 'general';

export type RewardType = 'stardust' | 'crystals' | 'accessory';

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  name: string;
  description: string;
  metric: string;
  target: number;
  rewardType: RewardType;
  rewardAmount: number;
  rewardItemId?: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // CRITTER BURROWS
  {
    id: 'burrows_novice',
    category: 'burrows',
    name: 'Burrows Novice',
    description: 'Reach Level 5 in Critter Burrows',
    metric: 'burrows_level',
    target: 5,
    rewardType: 'stardust',
    rewardAmount: 50,
  },
  {
    id: 'burrows_expert',
    category: 'burrows',
    name: 'Burrows Expert',
    description: 'Reach Level 15 in Critter Burrows',
    metric: 'burrows_level',
    target: 15,
    rewardType: 'crystals',
    rewardAmount: 15,
  },
  {
    id: 'burrows_master',
    category: 'burrows',
    name: 'Burrows Master',
    description: 'Reach Level 25 in Critter Burrows',
    metric: 'burrows_level',
    target: 25,
    rewardType: 'crystals',
    rewardAmount: 30,
  },
  {
    id: 'burrows_grandmaster',
    category: 'burrows',
    name: 'Memory Sovereign',
    description: 'Clear Level 30 in Critter Burrows',
    metric: 'burrows_level',
    target: 30,
    rewardType: 'accessory',
    rewardAmount: 0,
    rewardItemId: 'hat_crown',
  },

  // ORB MERGE
  {
    id: 'orbs_novice',
    category: 'orbs',
    name: 'First Fusion',
    description: 'Merge up to Grumble tier',
    metric: 'orb_tier',
    target: 4,
    rewardType: 'stardust',
    rewardAmount: 50,
  },
  {
    id: 'orbs_expert',
    category: 'orbs',
    name: 'Deep Fusion',
    description: 'Merge up to Dusk tier',
    metric: 'orb_tier',
    target: 7,
    rewardType: 'crystals',
    rewardAmount: 15,
  },
  {
    id: 'orbs_pip',
    category: 'orbs',
    name: 'Pip Ascended',
    description: 'Merge the ultimate top-tier Pip',
    metric: 'orb_tier',
    target: 8,
    rewardType: 'crystals',
    rewardAmount: 35,
  },
  {
    id: 'orbs_grandmaster',
    category: 'orbs',
    name: 'Gravity Sovereign',
    description: 'Complete Level 30 in Orb Merge',
    metric: 'orbs_level',
    target: 30,
    rewardType: 'accessory',
    rewardAmount: 0,
    rewardItemId: 'trail_star',
  },

  // STAR CATCHER
  {
    id: 'stars_novice',
    category: 'stars',
    name: 'Star Seeker',
    description: 'Catch 50 stars in Star Catcher',
    metric: 'stars_caught',
    target: 50,
    rewardType: 'stardust',
    rewardAmount: 60,
  },
  {
    id: 'stars_fever',
    category: 'stars',
    name: 'Fever Fever',
    description: 'Enter Fever Mode 5 times',
    metric: 'fever_count',
    target: 5,
    rewardType: 'crystals',
    rewardAmount: 15,
  },
  {
    id: 'stars_expert',
    category: 'stars',
    name: 'Meteor Runner',
    description: 'Catch 250 stars lifetime',
    metric: 'stars_caught',
    target: 250,
    rewardType: 'crystals',
    rewardAmount: 25,
  },
  {
    id: 'stars_grandmaster',
    category: 'stars',
    name: 'Cosmic Sovereign',
    description: 'Survive Level 30 in Star Catcher',
    metric: 'stars_level',
    target: 30,
    rewardType: 'accessory',
    rewardAmount: 0,
    rewardItemId: 'trail_rainbow',
  },

  // COLLECTION & DISCOVERY
  {
    id: 'col_starter',
    category: 'collection',
    name: 'Cast Assembled',
    description: 'Discover 3 creatures',
    metric: 'creatures_discovered',
    target: 3,
    rewardType: 'stardust',
    rewardAmount: 100,
  },
  {
    id: 'col_full',
    category: 'collection',
    name: 'Living Toybox',
    description: 'Discover all 9 creature species',
    metric: 'creatures_discovered',
    target: 9,
    rewardType: 'crystals',
    rewardAmount: 50,
  },

  // GENERAL & STREAKS
  {
    id: 'streak_3',
    category: 'general',
    name: 'Daily Rhythm',
    description: 'Maintain a 3-day login streak',
    metric: 'daily_streak',
    target: 3,
    rewardType: 'stardust',
    rewardAmount: 100,
  },
  {
    id: 'streak_7',
    category: 'general',
    name: 'Loyal Companion',
    description: 'Complete a full 7-day login streak',
    metric: 'daily_streak',
    target: 7,
    rewardType: 'crystals',
    rewardAmount: 25,
  },
  {
    id: 'stardust_500',
    category: 'general',
    name: 'Stardust Hoarder',
    description: 'Earn 500 lifetime Stardust',
    metric: 'lifetime_stardust',
    target: 500,
    rewardType: 'crystals',
    rewardAmount: 20,
  },
  {
    id: 'grand_champion',
    category: 'general',
    name: 'Grand Champion',
    description: 'Unlock Golden Radiance aura',
    metric: 'lifetime_stardust',
    target: 1500,
    rewardType: 'accessory',
    rewardAmount: 0,
    rewardItemId: 'aura_goldenglow',
  },
];

function parseObject(raw: string | undefined): Record<string, number> {
  try {
    return JSON.parse(raw ?? '{}');
  } catch {
    return {};
  }
}

function parseArray(raw: string | undefined): string[] {
  try {
    return JSON.parse(raw ?? '[]');
  } catch {
    return [];
  }
}

export interface AchievementState {
  metrics: Record<string, number>;
  claimed: string[];

  incrementMetric: (metric: string, delta?: number) => void;
  setMetricMax: (metric: string, value: number) => void;
  getMetric: (metric: string) => number;
  isUnlocked: (id: string) => boolean;
  isClaimed: (id: string) => boolean;
  claimAchievement: (id: string) => boolean;
}

export const useAchievements = create<AchievementState>((set, get) => ({
  metrics: parseObject(kv.getString('metrics')),
  claimed: parseArray(kv.getString('claimed')),

  incrementMetric: (metric: string, delta = 1) => {
    const current = get().metrics[metric] ?? 0;
    const next = current + delta;
    const updated = { ...get().metrics, [metric]: next };
    kv.set('metrics', JSON.stringify(updated));
    set({ metrics: updated });
  },

  setMetricMax: (metric: string, value: number) => {
    const current = get().metrics[metric] ?? 0;
    if (value <= current) return;
    const updated = { ...get().metrics, [metric]: value };
    kv.set('metrics', JSON.stringify(updated));
    set({ metrics: updated });
  },

  getMetric: (metric: string) => get().metrics[metric] ?? 0,

  isUnlocked: (id: string) => {
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return false;
    const current = get().metrics[def.metric] ?? 0;
    return current >= def.target;
  },

  isClaimed: (id: string) => get().claimed.includes(id),

  claimAchievement: (id: string) => {
    if (get().isClaimed(id)) return false;
    if (!get().isUnlocked(id)) return false;

    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return false;

    // Grant rewards
    if (def.rewardType === 'stardust' && def.rewardAmount > 0) {
      useEconomy.getState().earnStardust(def.rewardAmount);
    } else if (def.rewardType === 'crystals' && def.rewardAmount > 0) {
      useEconomy.getState().earnCrystals(def.rewardAmount, true);
    } else if (def.rewardType === 'accessory' && def.rewardItemId) {
      useInventory.getState().addAccessory(def.rewardItemId);
    }

    const nextClaimed = [...get().claimed, id];
    kv.set('claimed', JSON.stringify(nextClaimed));
    set({ claimed: nextClaimed });
    return true;
  },
}));
