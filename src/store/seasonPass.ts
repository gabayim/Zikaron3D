import { create } from 'zustand';
import { createSafeKV, type SafeKV } from '../storage/kv';
import { useEconomy } from './economy';
import { useInventory } from './inventory';
import { useProfile } from './profile';

const kv: SafeKV = createSafeKV('zikaron3d-season-pass');

export interface SeasonTierReward {
  tier: number;
  xpRequired: number;
  freeReward: {
    stardust?: number;
    crystals?: number;
    shields?: number;
    itemId?: string;
    itemType?: 'skin' | 'accessory';
    label: string;
  };
  premiumReward: {
    stardust?: number;
    crystals?: number;
    shields?: number;
    itemId?: string;
    itemType?: 'skin' | 'accessory';
    label: string;
  };
}

export const XP_PER_TIER = 120;
export const TOTAL_TIERS = 30;

// 30 Tiers with generous progressive rewards
export const SEASON_TIERS: SeasonTierReward[] = Array.from({ length: TOTAL_TIERS }, (_, i) => {
  const tier = i + 1;
  const xpRequired = tier * XP_PER_TIER;

  // Free track
  let freeReward: SeasonTierReward['freeReward'];
  if (tier === 30) {
    freeReward = { crystals: 100, label: '100 Crystals' };
  } else if (tier === 15) {
    freeReward = { itemId: 'hat_party', itemType: 'accessory', label: 'Party Hat' };
  } else if (tier % 5 === 0) {
    freeReward = { crystals: 25, label: '25 Crystals' };
  } else if (tier % 2 === 0) {
    freeReward = { shields: 3, label: '3 Shields' };
  } else {
    freeReward = { stardust: 150 + tier * 10, label: `${150 + tier * 10} Stardust` };
  }

  // Premium Adventure Pass track
  let premiumReward: SeasonTierReward['premiumReward'];
  if (tier === 30) {
    premiumReward = {
      itemId: 'aura_goldenglow',
      itemType: 'accessory',
      crystals: 250,
      label: 'Golden Radiance Aura + 250 Crystals',
    };
  } else if (tier === 20) {
    premiumReward = {
      itemId: 'trail_rainbow',
      itemType: 'accessory',
      label: 'Rainbow Star Trail',
    };
  } else if (tier === 10) {
    premiumReward = {
      itemId: 'hat_crown',
      itemType: 'accessory',
      label: 'Imperial Gold Crown',
    };
  } else if (tier % 3 === 0) {
    premiumReward = { crystals: 50, label: '50 Crystals' };
  } else {
    premiumReward = { stardust: 400 + tier * 25, label: `${400 + tier * 25} Stardust` };
  }

  return {
    tier,
    xpRequired,
    freeReward,
    premiumReward,
  };
});

function parseArray(raw: string | undefined): number[] {
  try {
    return JSON.parse(raw ?? '[]');
  } catch {
    return [];
  }
}

export interface SeasonPassState {
  seasonId: string;
  seasonName: string;
  seasonXp: number;
  hasAdventurePass: boolean;
  claimedFree: number[];
  claimedPremium: number[];

  currentTier: () => number;
  xpInCurrentTier: () => number;
  progressPercent: () => number;

  addSeasonXp: (amount: number) => void;
  upgradeToAdventurePass: () => boolean;
  claimReward: (tier: number, track: 'free' | 'premium') => boolean;
}

export const useSeasonPass = create<SeasonPassState>((set, get) => ({
  seasonId: 'season_1',
  seasonName: 'Starlight Odyssey',
  seasonXp: kv.getNumber('seasonXp') ?? 0,
  hasAdventurePass: kv.getBoolean('hasAdventurePass') ?? false,
  claimedFree: parseArray(kv.getString('claimedFree')),
  claimedPremium: parseArray(kv.getString('claimedPremium')),

  currentTier: () => {
    const xp = get().seasonXp;
    const tier = Math.floor(xp / XP_PER_TIER) + 1;
    return Math.min(TOTAL_TIERS, Math.max(1, tier));
  },

  xpInCurrentTier: () => {
    const xp = get().seasonXp;
    return xp % XP_PER_TIER;
  },

  progressPercent: () => {
    const xp = get().seasonXp;
    return Math.min(1, (xp % XP_PER_TIER) / XP_PER_TIER);
  },

  addSeasonXp: (amount: number) => {
    const current = get().seasonXp;
    const next = current + Math.max(0, amount);
    kv.set('seasonXp', next);
    set({ seasonXp: next });
  },

  upgradeToAdventurePass: () => {
    if (get().hasAdventurePass) return true;
    const economy = useEconomy.getState();
    const PASS_COST_CRYSTALS = 250;

    if (economy.spendCrystals(PASS_COST_CRYSTALS)) {
      kv.set('hasAdventurePass', true);
      set({ hasAdventurePass: true });
      return true;
    }
    return false;
  },

  claimReward: (tier: number, track: 'free' | 'premium') => {
    const state = get();
    const currentTier = state.currentTier();

    if (tier > currentTier) return false;

    if (track === 'free') {
      if (state.claimedFree.includes(tier)) return false;
      const tierDef = SEASON_TIERS[tier - 1];
      if (!tierDef) return false;

      // Grant rewards
      const { stardust, crystals, shields, itemId, itemType } = tierDef.freeReward;
      if (stardust) useEconomy.getState().earnStardust(stardust);
      if (crystals) useEconomy.getState().earnCrystals(crystals, true);
      if (shields) useProfile.getState().addShields(shields);
      if (itemId) {
        if (itemType === 'skin') useInventory.getState().addSkin(itemId);
        else useInventory.getState().addAccessory(itemId);
      }

      const nextClaimed = [...state.claimedFree, tier];
      kv.set('claimedFree', JSON.stringify(nextClaimed));
      set({ claimedFree: nextClaimed });
      return true;
    }

    if (track === 'premium') {
      if (!state.hasAdventurePass) return false;
      if (state.claimedPremium.includes(tier)) return false;
      const tierDef = SEASON_TIERS[tier - 1];
      if (!tierDef) return false;

      // Grant rewards
      const { stardust, crystals, shields, itemId, itemType } = tierDef.premiumReward;
      if (stardust) useEconomy.getState().earnStardust(stardust);
      if (crystals) useEconomy.getState().earnCrystals(crystals, true);
      if (shields) useProfile.getState().addShields(shields);
      if (itemId) {
        if (itemType === 'skin') useInventory.getState().addSkin(itemId);
        else useInventory.getState().addAccessory(itemId);
      }

      const nextClaimed = [...state.claimedPremium, tier];
      kv.set('claimedPremium', JSON.stringify(nextClaimed));
      set({ claimedPremium: nextClaimed });
      return true;
    }

    return false;
  },
}));
