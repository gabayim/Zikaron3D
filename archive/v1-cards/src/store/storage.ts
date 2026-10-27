import { createMMKV } from 'react-native-mmkv';

/**
 * MMKV persistence wrapper with seamless in-memory fallback.
 * Ensures zero crashes during unit tests, Node scripts, or initial native boots.
 */
class SafeStorage {
  private mmkv: ReturnType<typeof createMMKV> | null = null;
  private memoryMap = new Map<string, string>();

  constructor() {
    try {
      this.mmkv = createMMKV({ id: 'zikaron3d-player-storage' });
    } catch {
      // Running in an environment without C++ Nitro bindings (e.g. Node / web / mock)
      this.mmkv = null;
    }
  }

  public getString(key: string, defaultValue = ''): string {
    try {
      if (this.mmkv) {
        return this.mmkv.getString(key) ?? defaultValue;
      }
    } catch {}
    return this.memoryMap.get(key) ?? defaultValue;
  }

  public setString(key: string, value: string): void {
    try {
      if (this.mmkv) {
        this.mmkv.set(key, value);
        return;
      }
    } catch {}
    this.memoryMap.set(key, value);
  }

  public getNumber(key: string, defaultValue = 0): number {
    try {
      if (this.mmkv) {
        return this.mmkv.getNumber(key) ?? defaultValue;
      }
    } catch {}
    const val = this.memoryMap.get(key);
    return val !== undefined ? Number(val) : defaultValue;
  }

  public setNumber(key: string, value: number): void {
    try {
      if (this.mmkv) {
        this.mmkv.set(key, value);
        return;
      }
    } catch {}
    this.memoryMap.set(key, String(value));
  }

  public getBoolean(key: string, defaultValue = false): boolean {
    try {
      if (this.mmkv) {
        return this.mmkv.getBoolean(key) ?? defaultValue;
      }
    } catch {}
    const val = this.memoryMap.get(key);
    return val !== undefined ? val === 'true' : defaultValue;
  }

  public setBoolean(key: string, value: boolean): void {
    try {
      if (this.mmkv) {
        this.mmkv.set(key, value);
        return;
      }
    } catch {}
    this.memoryMap.set(key, String(value));
  }
}

export const gameStorage = new SafeStorage();
