import { createMMKV } from 'react-native-mmkv';
import { weekKey } from '../engine/daily';
import { supabase, useAuth } from './supabase';

let kv: ReturnType<typeof createMMKV> | null = null;
try {
  kv = createMMKV({ id: 'zikaron3d-leaderboard' });
} catch {
  kv = null;
}

export interface BoardRow {
  rank: number;
  score: number;
  glyph: number;
  mine: boolean;
}

export const BOARD_SIZE = 30;

/** Top players this UTC week. Falls back to the last cached board when offline. */
export async function fetchBoard(): Promise<BoardRow[]> {
  const wk = weekKey();
  const me = useAuth.getState().userId;
  if (supabase && me) {
    const { data, error } = await supabase
      .from('weekly_scores')
      .select('user_id, score, glyph')
      .eq('week', wk)
      .order('score', { ascending: false })
      .limit(BOARD_SIZE);
    if (!error && data) {
      const rows = data.map((r, i) => ({ rank: i + 1, score: r.score as number, glyph: r.glyph as number, mine: r.user_id === me }));
      kv?.set('board', JSON.stringify({ wk, rows }));
      return rows;
    }
  }
  try {
    const cached = JSON.parse(kv?.getString('board') ?? 'null') as { wk: string; rows: BoardRow[] } | null;
    if (cached && cached.wk === wk) return cached.rows;
  } catch {}
  return [];
}
