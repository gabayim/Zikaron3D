import { createSafeKV, type SafeKV } from '../../../src/storage/kv';

/**
 * MMKV persistence wrapper with seamless in-memory fallback.
 * Ensures zero crashes during unit tests, Node scripts, or initial native boots.
 */
class SafeStorage {
  private kv: SafeKV;

  constructor() {
    this.kv = createSafeKV('zikaron3d-player-storage');
  }

  public getString(key: string, defaultValue = ''): string {
    return this.kv.getString(key) ?? defaultValue;
  }

  public setString(key: string, value: string): void {
    this.kv.set(key, value);
  }

  public getNumber(key: string, defaultValue = 0): number {
    return this.kv.getNumber(key) ?? defaultValue;
  }

  public setNumber(key: string, value: number): void {
    this.kv.set(key, value);
  }

  public getBoolean(key: string, defaultValue = false): boolean {
    return this.kv.getBoolean(key) ?? defaultValue;
  }

  public setBoolean(key: string, value: boolean): void {
    this.kv.set(key, value);
  }
}

export const gameStorage = new SafeStorage();
