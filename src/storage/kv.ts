import { TurboModuleRegistry } from 'react-native';

export interface SafeKV {
  getString(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
  set(key: string, value: string | number | boolean): void;
  remove(key: string): boolean;
}

class MemoryStorage implements SafeKV {
  private map = new Map<string, string | number | boolean>();

  getString(key: string): string | undefined {
    const val = this.map.get(key);
    return typeof val === 'string' ? val : undefined;
  }
  getNumber(key: string): number | undefined {
    const val = this.map.get(key);
    return typeof val === 'number' ? val : undefined;
  }
  getBoolean(key: string): boolean | undefined {
    const val = this.map.get(key);
    return typeof val === 'boolean' ? val : undefined;
  }
  set(key: string, value: string | number | boolean): void {
    this.map.set(key, value);
  }
  remove(key: string): boolean {
    return this.map.delete(key);
  }
}

/**
 * Creates a persistent MMKV store if native NitroModules is linked,
 * or gracefully falls back to an in-memory store in environments like Expo Go.
 */
export function createSafeKV(id: string): SafeKV {
  try {
    const hasNitro =
      typeof TurboModuleRegistry !== 'undefined' &&
      TurboModuleRegistry.get('NitroModules') != null;

    if (hasNitro) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mmkv = require('react-native-mmkv');
      if (typeof mmkv?.createMMKV === 'function') {
        return mmkv.createMMKV({ id });
      }
    }
  } catch {
    // NitroModules missing in Expo Go; fallback to MemoryStorage
  }
  return new MemoryStorage();
}
