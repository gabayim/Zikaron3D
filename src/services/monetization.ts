import { Platform } from 'react-native';
import Purchases, { PURCHASE_TYPE, type PurchasesStoreProduct } from 'react-native-purchases';
import { createSafeKV, type SafeKV } from '../storage/kv';
import { useEconomy } from '../store/economy';
import { useInventory } from '../store/inventory';
import { useProfile } from '../store/profile';
import { supabase } from './supabase';

const kv: SafeKV = createSafeKV('zikaron3d-purchases');
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

/** App Store product ids. Create the same ids in App Store Connect and RevenueCat. */
export const PRODUCT_IDS = ['crystals_100', 'crystals_500', 'crystals_1200', 'starter_pack', 'shield_pack_10'] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];

/** Rare skins included with the one-time starter pack. */
export const STARTER_SKINS = ['pip_chrome', 'bloop_crystal', 'fuzz_velvet'] as const;

const GRANTS: Record<ProductId, { crystals?: number; shields?: number; skins?: readonly string[] }> = {
  crystals_100: { crystals: 100 },
  crystals_500: { crystals: 500 },
  crystals_1200: { crystals: 1200 },
  starter_pack: { crystals: 500, skins: STARTER_SKINS },
  shield_pack_10: { shields: 10 },
};

let configured = false;
let products: PurchasesStoreProduct[] = [];

export function isStoreConfigured(): boolean {
  return configured;
}

function isProductId(id: string): id is ProductId {
  return (PRODUCT_IDS as readonly string[]).includes(id);
}

function applied(): Set<string> {
  try {
    const parsed = JSON.parse(kv.getString('applied') ?? '[]') as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function remember(transactionId: string) {
  const ids = applied();
  ids.add(transactionId);
  kv.set('applied', JSON.stringify([...ids]));
}

export function ownsStarterPack(): boolean {
  return kv.getBoolean('starter') === true;
}

/** Grants a verified purchase once per transaction id. Returns false when already applied. */
export function applyProduct(productId: ProductId, transactionId: string): boolean {
  if (!transactionId || applied().has(transactionId)) return false;
  const grant = GRANTS[productId];
  if (grant.crystals) useEconomy.getState().earnCrystals(grant.crystals, false);
  if (grant.shields) useProfile.getState().addShields(grant.shields);
  if (grant.skins) {
    for (const skin of grant.skins) useInventory.getState().addSkin(skin);
    kv.set('starter', true);
  }
  kv.set(`recent:${productId}`, Date.now());
  remember(transactionId);
  return true;
}

/**
 * RevenueCat public SDK keys start with `appl_` (iOS) or `goog_` (Android).
 * A secret key (`sk_`) grants server-side REST access to every subscriber and
 * must never be embedded in the app bundle - it is extractable from a shipped
 * IPA. The guard below makes that impossible by accident.
 */
function isSecretKey(key: string): boolean {
  return key.trim().startsWith('sk_');
}

function looksPublic(key: string, platform: string): boolean {
  return platform === 'ios' ? key.trim().startsWith('appl_') : key.trim().startsWith('goog_');
}

/** Call once at app start. No-op without RevenueCat keys. */
export function initMonetization(): void {
  if (configured) return;
  const appleKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY;
  const googleKey = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY;
  const apiKey = Platform.OS === 'ios' ? appleKey : googleKey;
  if (!apiKey || apiKey.includes('your_')) return;
  if (isSecretKey(apiKey)) {
    console.error(
      '[monetization] refusing to configure RevenueCat with a secret key (sk_...). ' +
        'Use the public app-specific key from RevenueCat > Project settings > API keys.',
    );
    return;
  }
  if (!looksPublic(apiKey, Platform.OS)) {
    console.warn(`[monetization] key does not look like a ${Platform.OS} public SDK key (appl_/goog_)`);
  }
  try {
    Purchases.configure({ apiKey });
    configured = true;
  } catch (err) {
    console.warn('[monetization] configure failed', err);
  }
}

/** Ties StoreKit receipts to the signed-in Supabase user so the ledger can restore them. */
export async function identifyPurchaser(userId: string): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logIn(userId);
  } catch (err) {
    console.warn('[monetization] logIn failed', err);
  }
}

/** Localized price strings from the App Store. Missing ids are not for sale. */
export async function loadProductPrices(): Promise<Partial<Record<ProductId, string>>> {
  if (!configured) return {};
  try {
    products = await Purchases.getProducts([...PRODUCT_IDS], PURCHASE_TYPE.INAPP);
    const prices: Partial<Record<ProductId, string>> = {};
    for (const product of products) {
      if (isProductId(product.identifier)) prices[product.identifier] = product.priceString;
    }
    return prices;
  } catch (err) {
    console.warn('[monetization] products failed', err);
    return {};
  }
}

export type PurchaseResult = 'ok' | 'cancelled' | 'unavailable' | 'error';

/** Charges through StoreKit, then grants. Nothing is granted if the charge does not finish. */
export async function buyPack(productId: ProductId): Promise<PurchaseResult> {
  if (productId === 'starter_pack' && ownsStarterPack()) return 'unavailable';
  if (!configured) return 'unavailable';
  try {
    let product = products.find((item) => item.identifier === productId);
    if (!product) {
      const [loaded] = await Purchases.getProducts([productId], PURCHASE_TYPE.INAPP);
      product = loaded;
    }
    if (!product) return 'unavailable';
    const result = await Purchases.purchaseStoreProduct(product);
    const transactionId = result.transaction?.transactionIdentifier || `${productId}:${Date.now()}`;
    applyProduct(productId, transactionId);
    return 'ok';
  } catch (err) {
    if ((err as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    console.warn('[monetization] purchase failed', err);
    return 'error';
  }
}

export async function buyShieldPack(): Promise<PurchaseResult> {
  return buyPack('shield_pack_10');
}

/**
 * Pulls the server purchase ledger (written by the RevenueCat webhook) and grants
 * anything this device has not applied yet. A recent local grant of the same product
 * is linked instead of granted twice when the store transaction id differs.
 */
export async function reconcilePurchases(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.from('purchases').select('transaction_id, product_id');
  if (error || !data) {
    if (error) console.warn('[monetization] ledger read failed', error.message);
    return 0;
  }
  let granted = 0;
  for (const row of data) {
    const transactionId = String(row.transaction_id ?? '');
    const productId = String(row.product_id ?? '');
    if (!transactionId || !isProductId(productId) || applied().has(transactionId)) continue;
    const recent = kv.getNumber(`recent:${productId}`) ?? 0;
    if (Date.now() - recent < RECENT_MS) {
      remember(transactionId);
      continue;
    }
    if (applyProduct(productId, transactionId)) granted += 1;
  }
  return granted;
}

export async function restorePurchases(): Promise<{ ok: boolean; restored: number }> {
  if (!configured) return { ok: false, restored: 0 };
  try {
    const info = await Purchases.restorePurchases();
    const fromLedger = await reconcilePurchases();
    return { ok: true, restored: fromLedger || Object.keys(info.entitlements.active).length };
  } catch (err) {
    console.warn('[monetization] restore failed', err);
    return { ok: false, restored: 0 };
  }
}
