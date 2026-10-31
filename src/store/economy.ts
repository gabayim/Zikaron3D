import type { useAchievements as useAchievementsType } from './achievements';
import { create } from 'zustand';
import { createSafeKV, type SafeKV } from '../storage/kv';

const kv: SafeKV = createSafeKV('zikaron3d-economy');

export interface EconomyState {
  stardust: number;
  crystals: number;
  lifetimeStardust: number;
  lifetimeCrystals: number;

  earnStardust: (amount: number) => void;
  spendStardust: (amount: number) => boolean;
  earnCrystals: (amount: number, fromGameplay?: boolean) => void;
  spendCrystals: (amount: number) => boolean;
  canAffordStardust: (amount: number) => boolean;
  canAffordCrystals: (amount: number) => boolean;
  mergeFromCloud: (data: {
    stardust: number;
    crystals: number;
    lifetimeStardust: number;
    lifetimeCrystals: number;
  }) => void;
}

export const useEconomy = create<EconomyState>((set, get) => ({
  stardust: kv.getNumber('stardust') ?? 0,
  crystals: kv.getNumber('crystals') ?? 0,
  lifetimeStardust: kv.getNumber('lifetimeStardust') ?? 0,
  lifetimeCrystals: kv.getNumber('lifetimeCrystals') ?? 0,

  earnStardust: (amount: number) => {
    if (amount <= 0) return;
    const current = get().stardust;
    const lifetime = get().lifetimeStardust;
    const nextStardust = current + amount;
    const nextLifetime = lifetime + amount;
    kv.set('stardust', nextStardust);
    kv.set('lifetimeStardust', nextLifetime);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const achievements = require('./achievements').useAchievements as typeof useAchievementsType;
    achievements.getState().setMetricMax('lifetime_stardust', nextLifetime);
    set({ stardust: nextStardust, lifetimeStardust: nextLifetime });
  },

  spendStardust: (amount: number) => {
    if (amount <= 0) return false;
    const current = get().stardust;
    if (current < amount) return false;
    const nextStardust = current - amount;
    kv.set('stardust', nextStardust);
    set({ stardust: nextStardust });
    return true;
  },

  earnCrystals: (amount: number, fromGameplay = false) => {
    if (amount <= 0) return;
    const current = get().crystals;
    const lifetime = get().lifetimeCrystals;
    const nextCrystals = current + amount;
    const nextLifetime = fromGameplay ? lifetime + amount : lifetime;
    kv.set('crystals', nextCrystals);
    if (fromGameplay) {
      kv.set('lifetimeCrystals', nextLifetime);
    }
    set({ crystals: nextCrystals, lifetimeCrystals: nextLifetime });
  },

  spendCrystals: (amount: number) => {
    if (amount <= 0) return false;
    const current = get().crystals;
    if (current < amount) return false;
    const nextCrystals = current - amount;
    kv.set('crystals', nextCrystals);
    set({ crystals: nextCrystals });
    return true;
  },

  canAffordStardust: (amount: number) => get().stardust >= amount,
  canAffordCrystals: (amount: number) => get().crystals >= amount,

  mergeFromCloud: (data) => {
    const nextStardust = Math.max(get().stardust, data.stardust || 0);
    const nextCrystals = Math.max(get().crystals, data.crystals || 0);
    const nextLifeDust = Math.max(get().lifetimeStardust, data.lifetimeStardust || 0);
    const nextLifeCrystals = Math.max(get().lifetimeCrystals, data.lifetimeCrystals || 0);

    kv.set('stardust', nextStardust);
    kv.set('crystals', nextCrystals);
    kv.set('lifetimeStardust', nextLifeDust);
    kv.set('lifetimeCrystals', nextLifeCrystals);

    set({
      stardust: nextStardust,
      crystals: nextCrystals,
      lifetimeStardust: nextLifeDust,
      lifetimeCrystals: nextLifeCrystals,
    });
  },
}));
