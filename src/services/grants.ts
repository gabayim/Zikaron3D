import { createSafeKV, type SafeKV } from '../storage/kv';
import { useEconomy } from '../store/economy';
import { useInventory } from '../store/inventory';
import { useProfile } from '../store/profile';
import { ensureSession, supabase } from './supabase';

const kv: SafeKV = createSafeKV('zikaron3d-grants');

export type GrantAssetType = 'skin' | 'accessory' | 'crystals' | 'stardust' | 'shields';

export interface GrantRow {
  id: number;
  user_id: string;
  source: 'coupon' | 'referral_referrer' | 'referral_referee';
  source_ref: string;
  asset_type: GrantAssetType;
  asset_id: string;
  amount: number;
  created_at: string;
}

export interface RedeemResult {
  ok: boolean;
  reason?: string;
  asset_type?: GrantAssetType;
  asset_id?: string;
  amount?: number;
}

function getAppliedIds(): Set<number> {
  try {
    const raw = kv.getString('applied_ids');
    const parsed = JSON.parse(raw ?? '[]') as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === 'number') : []);
  } catch {
    return new Set();
  }
}

function saveAppliedIds(ids: Set<number>): void {
  kv.set('applied_ids', JSON.stringify([...ids]));
}

/**
 * Applies a server grant row to the corresponding local player store.
 */
export function applyGrantLocally(grant: GrantRow): void {
  const { asset_type, asset_id, amount } = grant;
  switch (asset_type) {
    case 'skin':
      useInventory.getState().addSkin(asset_id);
      break;
    case 'accessory':
      useInventory.getState().addAccessory(asset_id);
      break;
    case 'crystals':
      useEconomy.getState().earnCrystals(amount, false);
      break;
    case 'stardust':
      useEconomy.getState().earnStardust(amount);
      break;
    case 'shields':
      useProfile.getState().addShields(amount);
      break;
  }
}

/**
 * Queries unseen rows from the cloud `grants` ledger and applies them to local inventory.
 * Returns newly applied rows (e.g. to trigger reward celebration UI).
 */
export async function reconcileGrants(): Promise<GrantRow[]> {
  const userId = await ensureSession();
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from('grants')
    .select('*')
    .eq('user_id', userId)
    .order('id', { ascending: true });

  if (error || !data) {
    if (__DEV__) console.warn('[grants] reconcile failed', error?.message);
    return [];
  }

  const applied = getAppliedIds();
  const newlyApplied: GrantRow[] = [];

  for (const rawRow of data) {
    const row = rawRow as GrantRow;
    if (applied.has(row.id)) continue;

    applyGrantLocally(row);
    applied.add(row.id);
    newlyApplied.push(row);
  }

  if (newlyApplied.length > 0) {
    saveAppliedIds(applied);
  }

  return newlyApplied;
}

/**
 * Redeems a promotional coupon code via the database RPC and reconciles grants.
 */
export async function redeemCoupon(code: string): Promise<RedeemResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return { ok: false, reason: 'invalid_code' };
  }

  const userId = await ensureSession();
  if (!supabase || !userId) {
    return { ok: false, reason: 'not_signed_in' };
  }

  const { data, error } = await supabase.rpc('redeem_coupon', { p_code: normalized });
  if (error || !data) {
    if (__DEV__) console.warn('[grants] redeem RPC error', error?.message);
    return { ok: false, reason: error?.message ?? 'network_error' };
  }

  const res = data as RedeemResult;
  if (res.ok) {
    await reconcileGrants();
  }

  return res;
}
