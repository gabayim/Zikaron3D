import { TurboModuleRegistry } from 'react-native';
import { createSafeKV, type SafeKV } from './kv';

let SecureStore: typeof import('expo-secure-store') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SecureStore = require('expo-secure-store');
} catch {
  SecureStore = null;
}

const KEY_NAME = 'zikaron3d.auth.mmkv';
const STORE_ID = 'zikaron3d-auth-enc';
const LEGACY_ID = 'zikaron3d-auth';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

let opening: Promise<SafeKV> | null = null;

function randomKey(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/**
 * MMKV store for the sign-in session. The 32-byte key lives in the iOS Keychain
 * (expo-secure-store) and is never written next to the session.
 */
export function openAuthStore(): Promise<SafeKV> {
  if (!opening) opening = open();
  return opening;
}

async function open(): Promise<SafeKV> {
  try {
    const hasNitro = TurboModuleRegistry.get('NitroModules') != null;
    if (!hasNitro || !SecureStore?.getItemAsync) return createSafeKV(LEGACY_ID);
    let key: string | null = null;
    try {
      key = await SecureStore.getItemAsync(KEY_NAME);
      if (!key || key.length !== 32) {
        key = randomKey();
        await SecureStore.setItemAsync(KEY_NAME, key, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      }
    } catch {
      return createSafeKV(LEGACY_ID);
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mmkv = require('react-native-mmkv') as {
      createMMKV: (config: { id: string; encryptionKey?: string; encryptionType?: 'AES-128' | 'AES-256' }) => SafeKV & {
        length: number;
        getAllKeys: () => string[];
        clearAll: () => void;
      };
    };
    const next = mmkv.createMMKV({ id: STORE_ID, encryptionKey: key, encryptionType: 'AES-256' });
    const legacy = mmkv.createMMKV({ id: LEGACY_ID });
    if (next.length === 0 && legacy.length > 0) {
      for (const name of legacy.getAllKeys()) {
        const value = legacy.getString(name);
        if (value !== undefined) next.set(name, value);
      }
      legacy.clearAll();
    }
    return next;
  } catch {
    return createSafeKV(LEGACY_ID);
  }
}
