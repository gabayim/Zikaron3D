import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { useProfile } from '../store/profile';

let configured = false;

/** Call once at app start. No-op without RevenueCat keys. */
export function initMonetization(): void {
  if (configured) return;
  const appleKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY;
  const googleKey = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY;
  const apiKey = Platform.OS === 'ios' ? appleKey : googleKey;
  if (!apiKey || apiKey.includes('your_')) return;
  try {
    Purchases.configure({ apiKey });
    configured = true;
  } catch (err) {
    console.warn('[monetization] configure failed', err);
  }
}

export async function restorePurchases(): Promise<{ ok: boolean; restored: number }> {
  if (!configured) {
    return { ok: true, restored: 0 };
  }
  try {
    const info = await Purchases.restorePurchases();
    const restored = Object.keys(info.entitlements.active).length;
    return { ok: true, restored };
  } catch (err) {
    console.warn('[monetization] restore failed', err);
    return { ok: false, restored: 0 };
  }
}

export const SHIELD_PRODUCT_ID = 'shield_pack_10';
export const SHIELD_PACK_SIZE = 10;

export type PurchaseResult = 'ok' | 'cancelled' | 'unavailable' | 'error';

/** Consumable: +10 streak shields. Call only behind the parental gate. */
export async function buyShieldPack(): Promise<PurchaseResult> {
  if (!configured) {
    // No store keys: grant in development so the loop can be tested, otherwise unavailable.
    if (__DEV__) {
      useProfile.getState().addShields(SHIELD_PACK_SIZE);
      return 'ok';
    }
    return 'unavailable';
  }
  try {
    const [product] = await Purchases.getProducts([SHIELD_PRODUCT_ID]);
    if (!product) return 'unavailable';
    await Purchases.purchaseStoreProduct(product);
    useProfile.getState().addShields(SHIELD_PACK_SIZE);
    return 'ok';
  } catch (err) {
    if ((err as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    console.warn('[monetization] shield purchase failed', err);
    return 'error';
  }
}
