import { SeededRNG } from './SeededRNG';
import type { WorldId } from '../worlds';

const DAILY_WORLDS: WorldId[] = ['meadow', 'crystal', 'candy', 'deep_sea', 'grove', 'circuit', 'summit'];

export function dailyKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** The daily world and seed are stable across every device for a UTC calendar day. */
export function getDailyChallenge(date = new Date()): { key: string; world: WorldId; seed: string } {
  const key = dailyKey(date);
  const rng = new SeededRNG(`zikaron3d-daily-${key}`);
  return {
    key,
    world: DAILY_WORLDS[rng.nextInt(0, DAILY_WORLDS.length - 1)],
    seed: `zikaron3d-daily-${key}`,
  };
}

/** ISO-8601 week key in UTC, e.g. `2026-W44`. Leaderboards reset when it changes. */
export function weekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
