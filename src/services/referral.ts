import * as Linking from 'expo-linking';
import { create } from 'zustand';
import { createSafeKV, type SafeKV } from '../storage/kv';
import { reconcileGrants } from './grants';
import { ensureSession, supabase } from './supabase';

let SecureStore: typeof import('expo-secure-store') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SecureStore = require('expo-secure-store');
} catch {
  SecureStore = null;
}

const kv: SafeKV = createSafeKV('zikaron3d-referral');
const SECURE_DONE_KEY = 'zikaron3d.referral.done';
const SECURE_DISMISSED_KEY = 'zikaron3d.referral.paste_dismissed';

interface ReferralStore {
  pendingPaste: boolean;
  setPendingPaste: (pending: boolean) => void;
  referralCount: number;
  setReferralCount: (count: number) => void;
}

export const useReferral = create<ReferralStore>((set) => ({
  pendingPaste: false,
  setPendingPaste: (pendingPaste) => set({ pendingPaste }),
  referralCount: 0,
  setReferralCount: (referralCount) => set({ referralCount }),
}));

async function isReferralDone(): Promise<boolean> {
  if (SecureStore?.getItemAsync) {
    try {
      const val = await SecureStore.getItemAsync(SECURE_DONE_KEY);
      if (val === 'true') return true;
    } catch {
      // fallback
    }
  }
  return kv.getBoolean(SECURE_DONE_KEY) === true;
}

async function markReferralDone(): Promise<void> {
  if (SecureStore?.setItemAsync) {
    try {
      await SecureStore.setItemAsync(SECURE_DONE_KEY, 'true');
    } catch {
      // fallback
    }
  }
  kv.set(SECURE_DONE_KEY, true);
  useReferral.getState().setPendingPaste(false);
}

export async function isPasteDismissed(): Promise<boolean> {
  if (SecureStore?.getItemAsync) {
    try {
      const val = await SecureStore.getItemAsync(SECURE_DISMISSED_KEY);
      if (val === 'true') return true;
    } catch {
      // fallback
    }
  }
  return kv.getBoolean(SECURE_DISMISSED_KEY) === true;
}

export async function dismissPastePrompt(): Promise<void> {
  if (SecureStore?.setItemAsync) {
    try {
      await SecureStore.setItemAsync(SECURE_DISMISSED_KEY, 'true');
    } catch {
      // fallback
    }
  }
  kv.set(SECURE_DISMISSED_KEY, true);
  useReferral.getState().setPendingPaste(false);
}

/**
 * Generates the full universal link for a referral code.
 */
export function referralUrl(code: string): string {
  const host = process.env.EXPO_PUBLIC_REFERRAL_HOST ?? 'https://go.zmz.ca';
  return `${host.replace(/\/+$/, '')}/r/${code.trim().toUpperCase()}`;
}

/**
 * Extracts a 7-character referral code from a URL or raw string.
 */
export function extractReferralCode(input: string): string | null {
  const match = input.match(/(?:^|\/r\/)([A-Z2-9]{7})(?:[/?#]|$)/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Creates a new personal referral code for the player.
 */
export async function createReferralCode(): Promise<string | null> {
  const userId = await ensureSession();
  if (!supabase || !userId) return null;

  const { data, error } = await supabase.rpc('create_referral_code');
  if (error || !data) {
    if (__DEV__) console.warn('[referral] create code failed', error?.message);
    return null;
  }
  return data as string;
}

/**
 * Fetches all active referral codes owned by the player.
 */
export async function listMyReferralCodes(): Promise<string[]> {
  const userId = await ensureSession();
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('owner_id', userId)
    .eq('disabled', false)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map((r: { code: string }) => r.code);
}

/**
 * Returns the count of players who have successfully joined via this player's referral codes.
 */
export async function myReferralCount(): Promise<number> {
  const userId = await ensureSession();
  if (!supabase || !userId) return 0;

  const { count, error } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_id', userId);

  if (error || typeof count !== 'number') return 0;
  useReferral.getState().setReferralCount(count);
  return count;
}

export interface ClaimResult {
  ok: boolean;
  reason?: string;
  code?: string;
  referrer_id?: string;
}

/**
 * Claims a referral reward via the `referral-claim` Edge Function.
 */
export async function claimReferral(code?: string): Promise<ClaimResult> {
  const userId = await ensureSession();
  if (!supabase || !userId) return { ok: false, reason: 'not_signed_in' };

  try {
    const payload = code ? { code: code.trim().toUpperCase() } : {};
    const { data, error } = await supabase.functions.invoke('referral-claim', {
      body: payload,
    });

    if (error || !data) {
      if (__DEV__) console.warn('[referral] claim failed', error?.message);
      return { ok: false, reason: error?.message ?? 'network_error' };
    }

    const res = data as ClaimResult;
    if (res.ok) {
      await markReferralDone();
      await reconcileGrants();
      return res;
    }

    // Terminal failure reasons mean this device/account cannot claim any referral
    if (
      res.reason === 'already_referred' ||
      res.reason === 'self' ||
      res.reason === 'too_old'
    ) {
      await markReferralDone();
    }

    return res;
  } catch (err) {
    if (__DEV__) console.warn('[referral] unexpected claim exception', err);
    return { ok: false, reason: 'network_error' };
  }
}

let listenerRegistered = false;

/**
 * Checks for referral attribution on app launch:
 * 1. Deep link / universal link URL if opened via link
 * 2. Server IP match fallback
 * 3. Shows paste fallback bubble on first 2 launches if unclaimed
 */
export async function tryClaimOnFirstLaunch(): Promise<void> {
  if (await isReferralDone()) return;

  const launches = (kv.getNumber('launch_count') ?? 0) + 1;
  kv.set('launch_count', launches);

  // 1. Check if launched with initial URL
  const initialUrl = await Linking.getInitialURL();
  const codeFromUrl = initialUrl ? extractReferralCode(initialUrl) : null;

  if (codeFromUrl) {
    const res = await claimReferral(codeFromUrl);
    if (res.ok) return;
  }

  // 2. Fall back to server IP match
  const ipClaim = await claimReferral();
  if (ipClaim.ok) return;

  // 3. If unclaimed and within first 2 launches, enable paste bubble (if not dismissed)
  if (ipClaim.reason === 'no_match' && launches <= 2) {
    const dismissed = await isPasteDismissed();
    if (!dismissed) {
      useReferral.getState().setPendingPaste(true);
    }
  }

  // 4. Register runtime URL listener (for when app is opened from background)
  if (!listenerRegistered) {
    listenerRegistered = true;
    Linking.addEventListener('url', (event) => {
      void (async () => {
        if (await isReferralDone()) return;
        const code = extractReferralCode(event.url);
        if (code) {
          await claimReferral(code);
        }
      })();
    });
  }
}
