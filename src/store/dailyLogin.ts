import { useAchievements } from './achievements';
import { create } from 'zustand';
import { createSafeKV, type SafeKV } from '../storage/kv';
import { useEconomy } from './economy';
import { useProfile } from './profile';
import { useInventory } from './inventory';

const kv: SafeKV = createSafeKV('zikaron3d-daily-login');

export interface StreakReward {
  day: number;
  stardust: number;
  crystals: number;
  shields: number;
  accessoryId?: string;
}

export const STREAK_REWARDS: StreakReward[] = [
  { day: 1, stardust: 10, crystals: 0, shields: 0 },
  { day: 2, stardust: 15, crystals: 0, shields: 0 },
  { day: 3, stardust: 20, crystals: 0, shields: 0 },
  { day: 4, stardust: 25, crystals: 0, shields: 0 },
  { day: 5, stardust: 30, crystals: 0, shields: 1 },
  { day: 6, stardust: 40, crystals: 0, shields: 0 },
  { day: 7, stardust: 50, crystals: 5, shields: 1, accessoryId: 'hat_flowercrown' },
];

function getUtcToday(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(
    now.getUTCDate(),
  ).padStart(2, '0')}`;
}

function getYesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

export interface DailyLoginState {
  streak: number;
  lastLoginDate: string;
  hasClaimedToday: boolean;
  modalVisible: boolean;
  currentReward: StreakReward | null;

  checkLogin: () => void;
  claimReward: () => void;
  dismissModal: () => void;
}

export const useDailyLogin = create<DailyLoginState>((set, get) => ({
  streak: kv.getNumber('streak') ?? 0,
  lastLoginDate: kv.getString('lastLoginDate') ?? '',
  hasClaimedToday: false,
  modalVisible: false,
  currentReward: null,

  checkLogin: () => {
    const today = getUtcToday();
    const yesterday = getYesterday();
    const lastDate = get().lastLoginDate;

    // Already checked and claimed today
    if (lastDate === today) {
      set({ hasClaimedToday: true });
      return;
    }

    let nextStreak = 1;
    if (lastDate === yesterday) {
      // Continuing consecutive streak
      nextStreak = (get().streak % 7) + 1;
    }

    const reward = STREAK_REWARDS[nextStreak - 1];

    set({
      streak: nextStreak,
      hasClaimedToday: false,
      modalVisible: true,
      currentReward: reward,
    });
  },

  claimReward: () => {
    const reward = get().currentReward;
    if (!reward || get().hasClaimedToday) return;

    const today = getUtcToday();

    // Grant currency
    if (reward.stardust > 0) {
      useEconomy.getState().earnStardust(reward.stardust);
    }
    if (reward.crystals > 0) {
      useEconomy.getState().earnCrystals(reward.crystals, true);
    }
    if (reward.shields > 0) {
      useProfile.getState().addShields(reward.shields);
    }
    if (reward.accessoryId) {
      useInventory.getState().addAccessory(reward.accessoryId);
    }

    kv.set('streak', get().streak);
    useAchievements.getState().setMetricMax('daily_streak', get().streak);
    kv.set('lastLoginDate', today);

    set({
      hasClaimedToday: true,
      modalVisible: false,
      lastLoginDate: today,
    });
  },

  dismissModal: () => {
    set({ modalVisible: false });
  },
}));
