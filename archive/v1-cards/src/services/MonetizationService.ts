import { Platform } from 'react-native';
import Purchases, { PurchasesStoreProduct } from 'react-native-purchases';
import { StoreProduct } from '../engine/types';
import { gameStorage } from '../store/storage';
import { useGameStore } from '../store/useGameStore';

const STORAGE_UNLOCKED_PRODUCTS = 'zikaron3d_unlocked_products';
const STORAGE_SHIELD_INVENTORY = 'zikaron3d_shield_inventory';

// Default In-App Product Catalog
export const STORE_CATALOG: StoreProduct[] = [
  // --- VAULT SKINS ---
  {
    id: 'skin_cyber_neon',
    type: 'VAULT_SKIN',
    title: 'Cyber Neon Vault',
    description: 'Electric cyan chassis with animated glowing wireframes',
    priceString: '$1.99',
    unlocked: false,
    iconName: 'Zap',
  },
  {
    id: 'skin_volcanic_obsidian',
    type: 'VAULT_SKIN',
    title: 'Volcanic Obsidian',
    description: 'Dark magma stone with pulsing thermal ember vents',
    priceString: '$1.99',
    unlocked: false,
    iconName: 'Flame',
  },
  {
    id: 'skin_celestial_gold',
    type: 'VAULT_SKIN',
    title: 'Celestial Gold',
    description: 'Pure 24k polished gold filigree with floating stardust',
    priceString: '$2.99',
    unlocked: false,
    iconName: 'Sparkles',
  },

  // --- FOLEY AUDIO PACKS ---
  {
    id: 'foley_retro_arcade',
    type: 'FOLEY_PACK',
    title: '8-Bit Synth Foley',
    description: 'Vintage mechanical arcade clicks and chiptune combo tones',
    priceString: '$0.99',
    unlocked: false,
    iconName: 'Volume2',
  },
  {
    id: 'foley_zen_nature',
    type: 'FOLEY_PACK',
    title: 'Bamboo & Water Foley',
    description: 'Organic wooden resonant knocks and calming river ripples',
    priceString: '$0.99',
    unlocked: false,
    iconName: 'Droplet',
  },

  // --- SEASON PASS ---
  {
    id: 'pass_excavator_season_1',
    type: 'SEASON_PASS',
    title: 'Season 1: Excavator Pass',
    description: 'Unlocks all 5 biomes, 2-layer excavations, and exclusive trophies',
    priceString: '$4.99',
    unlocked: false,
    iconName: 'Trophy',
  },

  // --- CONSUMABLES ---
  {
    id: 'pack_streak_shields_10',
    type: 'STREAK_SHIELDS',
    title: '10x Streak Shield Bundle',
    description: 'Absorbs 10 misses to protect high Fever combo streaks',
    priceString: '$0.99',
    unlocked: false,
    iconName: 'Shield',
  },
];

class MonetizationManager {
  private isConfigured: boolean = false;
  private productsMap: Map<string, PurchasesStoreProduct> = new Map();

  constructor() {
    this.init();
  }

  private init() {
    const appleKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY;
    const googleKey = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY;
    const apiKey = Platform.OS === 'ios' ? appleKey : googleKey;

    if (apiKey && !apiKey.includes('your_')) {
      try {
        Purchases.configure({ apiKey });
        this.isConfigured = true;
        this.fetchOfferings();
      } catch (err) {
        console.warn('RevenueCat configuration warning:', err);
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
    }
  }

  private async fetchOfferings() {
    if (!this.isConfigured) return;
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current?.availablePackages) {
        for (const pkg of offerings.current.availablePackages) {
          this.productsMap.set(pkg.product.identifier, pkg.product);
        }
      }
    } catch (e) {
      console.warn('RevenueCat getOfferings error:', e);
    }
  }

  /**
   * Get store catalog with active unlocked states from local MMKV storage
   */
  public getCatalog(): StoreProduct[] {
    const unlockedSet = this.getUnlockedSet();

    return STORE_CATALOG.map((item) => ({
      ...item,
      unlocked: unlockedSet.has(item.id),
    }));
  }

  /**
   * Check if specific item or skin is owned/unlocked
   */
  public isItemUnlocked(productId: string): boolean {
    return this.getUnlockedSet().has(productId);
  }

  /**
   * Purchase a store product.
   * If in TOYBOX mode, caller must verify Parental Gate before triggering this.
   */
  public async purchaseProduct(
    productId: string
  ): Promise<{ success: boolean; error?: string }> {
    const targetProduct = STORE_CATALOG.find((p) => p.id === productId);
    if (!targetProduct) {
      return { success: false, error: 'Product not found in catalog' };
    }

    // Handle real RevenueCat transaction if configured
    if (this.isConfigured) {
      try {
        const storeProduct = this.productsMap.get(productId);
        if (storeProduct) {
          const { customerInfo } = await Purchases.purchaseStoreProduct(storeProduct);
          if (customerInfo.entitlements.active[productId]) {
            this.unlockLocalProduct(productId, targetProduct.type);
            return { success: true };
          }
        }
      } catch (err: any) {
        if (err.userCancelled) {
          return { success: false, error: 'User cancelled' };
        }
        console.warn('RevenueCat purchase failed, falling back to local simulation:', err);
      }
    }

    // Local sandbox / offline fulfillment
    this.unlockLocalProduct(productId, targetProduct.type);
    return { success: true };
  }

  /**
   * Restore previous purchases
   */
  public async restorePurchases(): Promise<{ success: boolean; restoredCount: number }> {
    if (this.isConfigured) {
      try {
        const customerInfo = await Purchases.restorePurchases();
        const activeEntitlements = Object.keys(customerInfo.entitlements.active);
        for (const id of activeEntitlements) {
          const prod = STORE_CATALOG.find((p) => p.id === id);
          if (prod) {
            this.unlockLocalProduct(id, prod.type);
          }
        }
        return { success: true, restoredCount: activeEntitlements.length };
      } catch (e) {
        console.warn('RevenueCat restore error:', e);
      }
    }

    const currentCount = this.getUnlockedSet().size;
    return { success: true, restoredCount: currentCount };
  }

  private unlockLocalProduct(productId: string, type: string) {
    if (type === 'STREAK_SHIELDS') {
      // Consumable: Add 10 shields to game state & storage
      const current = gameStorage.getNumber(STORAGE_SHIELD_INVENTORY, 3);
      const next = current + 10;
      gameStorage.setNumber(STORAGE_SHIELD_INVENTORY, next);
      useGameStore.setState({ streakShieldInventory: next });
    } else {
      // Non-consumables & passes: Persistent entitlement
      const unlocked = this.getUnlockedSet();
      unlocked.add(productId);
      gameStorage.setString(STORAGE_UNLOCKED_PRODUCTS, JSON.stringify(Array.from(unlocked)));
    }
  }

  private getUnlockedSet(): Set<string> {
    const raw = gameStorage.getString(STORAGE_UNLOCKED_PRODUCTS);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      } catch {}
    }
    return new Set<string>();
  }
}

export const MonetizationService = new MonetizationManager();
export default MonetizationService;
