import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSafeKV, type SafeKV } from '../storage/kv';
import * as AppleAuthentication from 'expo-apple-authentication';
import { create } from 'zustand';

const kv: SafeKV = createSafeKV('zikaron3d-auth');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Null when keys are missing: the app then runs fully offline. */
export const supabase: SupabaseClient | null =
  url?.startsWith('https://') && anon && !anon.includes('your_')
    ? createClient(url, anon, {
        auth: {
          storage: {
            getItem: (k: string) => kv?.getString(k) ?? null,
            setItem: (k: string, v: string) => kv?.set(k, v),
            removeItem: (k: string) => {
              kv?.remove(k);
            },
          },
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

interface AuthState {
  userId: string | null;
  setUserId: (id: string | null) => void;
}
export const useAuth = create<AuthState>((set) => ({
  userId: null,
  setUserId: (userId) => set({ userId }),
}));

let started = false;
/** Restores the stored session and keeps `useAuth` in sync. Call once at app start. */
export function initAuth(): void {
  if (started || !supabase) return;
  started = true;
  void supabase.auth.getSession().then(({ data }) => useAuth.getState().setUserId(data.session?.user.id ?? null));
  supabase.auth.onAuthStateChange((_event, session) => useAuth.getState().setUserId(session?.user.id ?? null));
}

export type SignInResult = 'ok' | 'cancelled' | 'unavailable' | 'error';

export async function appleSignInAvailable(): Promise<boolean> {
  return !!supabase && (await AppleAuthentication.isAvailableAsync());
}

/** Sign in with Apple, exchanged for a Supabase session. No name or email is requested. */
export async function signInWithApple(): Promise<SignInResult> {
  if (!supabase) return 'unavailable';
  try {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    if (!credential.identityToken) return 'error';
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
    return error ? 'error' : 'ok';
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'cancelled';
    console.warn('[auth] apple sign-in failed', err);
    return 'error';
  }
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/** Deletes the cloud account and its data (required by App Store 5.1.1(v)). Local progress stays on device. */
export async function deleteAccount(): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    console.warn('[auth] delete account failed', error.message);
    return false;
  }
  await supabase.auth.signOut();
  return true;
}
