import { create } from 'zustand';
import { createSafeKV, type SafeKV } from '../storage/kv';
import type { AccessorySlot } from '../data/shopCatalog';
import type { CreatureId } from './profile';

const kv: SafeKV = createSafeKV('zikaron3d-inventory');

function parseArray(raw: string | undefined): string[] {
  try {
    return JSON.parse(raw ?? '[]');
  } catch {
    return [];
  }
}

function parseEquippedSkins(raw: string | undefined): Record<string, string> {
  try {
    return JSON.parse(raw ?? '{}');
  } catch {
    return {};
  }
}

function parseEquippedAccessories(
  raw: string | undefined,
): Record<AccessorySlot, string | null> {
  const fallback: Record<AccessorySlot, string | null> = {
    hat: null,
    trail: null,
    aura: null,
    expression: null,
  };
  try {
    return { ...fallback, ...JSON.parse(raw ?? '{}') };
  } catch {
    return fallback;
  }
}

export interface InventoryState {
  ownedSkins: string[];
  ownedAccessories: string[];
  equippedSkins: Record<string, string>;
  equippedAccessories: Record<AccessorySlot, string | null>;

  addSkin: (skinId: string) => void;
  addAccessory: (accessoryId: string) => void;
  ownsSkin: (skinId: string) => boolean;
  ownsAccessory: (accessoryId: string) => boolean;

  equipSkin: (creatureId: CreatureId, skinId: string) => void;
  unequipSkin: (creatureId: CreatureId) => void;
  getEquippedSkin: (creatureId: CreatureId) => string | undefined;

  equipAccessory: (slot: AccessorySlot, accessoryId: string) => void;
  unequipAccessory: (slot: AccessorySlot) => void;
  getEquippedAccessory: (slot: AccessorySlot) => string | null;

  mergeFromCloud: (data: {
    ownedSkins: string[];
    ownedAccessories: string[];
  }) => void;
}

export const useInventory = create<InventoryState>((set, get) => ({
  ownedSkins: parseArray(kv.getString('ownedSkins')),
  ownedAccessories: parseArray(kv.getString('ownedAccessories')),
  equippedSkins: parseEquippedSkins(kv.getString('equippedSkins')),
  equippedAccessories: parseEquippedAccessories(kv.getString('equippedAccessories')),

  addSkin: (skinId: string) => {
    const list = get().ownedSkins;
    if (list.includes(skinId)) return;
    const next = [...list, skinId];
    kv.set('ownedSkins', JSON.stringify(next));
    set({ ownedSkins: next });
  },

  addAccessory: (accessoryId: string) => {
    const list = get().ownedAccessories;
    if (list.includes(accessoryId)) return;
    const next = [...list, accessoryId];
    kv.set('ownedAccessories', JSON.stringify(next));
    set({ ownedAccessories: next });
  },

  ownsSkin: (skinId: string) => get().ownedSkins.includes(skinId),
  ownsAccessory: (accessoryId: string) => get().ownedAccessories.includes(accessoryId),

  equipSkin: (creatureId: CreatureId, skinId: string) => {
    const next = { ...get().equippedSkins, [creatureId]: skinId };
    kv.set('equippedSkins', JSON.stringify(next));
    set({ equippedSkins: next });
  },

  unequipSkin: (creatureId: CreatureId) => {
    const next = { ...get().equippedSkins };
    delete next[creatureId];
    kv.set('equippedSkins', JSON.stringify(next));
    set({ equippedSkins: next });
  },

  getEquippedSkin: (creatureId: CreatureId) => get().equippedSkins[creatureId],

  equipAccessory: (slot: AccessorySlot, accessoryId: string) => {
    const next = { ...get().equippedAccessories, [slot]: accessoryId };
    kv.set('equippedAccessories', JSON.stringify(next));
    set({ equippedAccessories: next });
  },

  unequipAccessory: (slot: AccessorySlot) => {
    const next = { ...get().equippedAccessories, [slot]: null };
    kv.set('equippedAccessories', JSON.stringify(next));
    set({ equippedAccessories: next });
  },

  getEquippedAccessory: (slot: AccessorySlot) => get().equippedAccessories[slot] ?? null,

  mergeFromCloud: (data) => {
    const nextSkins = Array.from(new Set([...get().ownedSkins, ...(data.ownedSkins || [])]));
    const nextAccessories = Array.from(
      new Set([...get().ownedAccessories, ...(data.ownedAccessories || [])]),
    );

    kv.set('ownedSkins', JSON.stringify(nextSkins));
    kv.set('ownedAccessories', JSON.stringify(nextAccessories));

    set({ ownedSkins: nextSkins, ownedAccessories: nextAccessories });
  },
}));
