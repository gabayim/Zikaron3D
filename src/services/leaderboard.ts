import { createSafeKV, type SafeKV } from '../storage/kv';
import { weekKey } from '../engine/daily';
import { supabase, useAuth } from './supabase';
import { useProfile } from '../store/profile';
import { useInventory } from '../store/inventory';

const kv: SafeKV = createSafeKV('zikaron3d-leaderboard');

export interface BoardRow {
  rank: number;
  score: number;
  glyph: number;
  mine: boolean;
  skinId?: string;
  accessoryId?: string;
  prestige?: number;
}

export const BOARD_SIZE = 30;

// Deterministic mock competitors for weekly offline/local league
const MOCK_LEAGUE: Omit<BoardRow, 'rank' | 'mine'>[] = [
  { score: 4850, glyph: 0, skinId: 'pip_starfire', accessoryId: 'hat_crown', prestige: 3 },
  { score: 3920, glyph: 8, skinId: 'dusk_eclipse', accessoryId: 'hat_tophat', prestige: 2 },
  { score: 3240, glyph: 7, skinId: 'ember_inferno', accessoryId: 'aura_storm', prestige: 2 },
  { score: 2710, glyph: 4, skinId: 'zap_lightning', accessoryId: 'hat_pirate', prestige: 1 },
  { score: 2190, glyph: 6, skinId: 'frost_blizzard', accessoryId: 'hat_viking', prestige: 1 },
  { score: 1780, glyph: 1, skinId: 'bloop_crystal', accessoryId: 'hat_flowercrown', prestige: 1 },
  { score: 1420, glyph: 5, skinId: 'grumble_obsidian', accessoryId: 'aura_icecrystals', prestige: 0 },
  { score: 1100, glyph: 2, skinId: 'fuzz_velvet', accessoryId: 'aura_hearts', prestige: 0 },
  { score: 850, glyph: 3, skinId: 'nutty_bronze', accessoryId: 'expr_sunglasses', prestige: 0 },
  { score: 620, glyph: 1, skinId: 'bloop_lime', accessoryId: undefined, prestige: 0 },
];

/** Top players this UTC week. Populates offline league or cloud data. */
export async function fetchBoard(): Promise<BoardRow[]> {
  const wk = weekKey();
  const me = useAuth.getState().userId;
  const myScore = useProfile.getState().weeklyScore;
  const myEquippedSkin = useInventory.getState().getEquippedSkin('pip');
  const myHat = useInventory.getState().getEquippedAccessory('hat');

  if (supabase && me) {
    try {
      const { data, error } = await supabase
        .from('weekly_scores')
        .select('user_id, score, glyph')
        .eq('week', wk)
        .order('score', { ascending: false })
        .limit(BOARD_SIZE);
      if (!error && data && data.length > 0) {
        const rows = data.map((r, i) => ({
          rank: i + 1,
          score: r.score as number,
          glyph: r.glyph as number,
          mine: r.user_id === me,
        }));
        kv.set('board', JSON.stringify({ wk, rows }));
        return rows;
      }
    } catch {}
  }

  // Construct local league including player's own score
  const myRow: BoardRow = {
    rank: 1,
    score: myScore,
    glyph: 0,
    mine: true,
    skinId: myEquippedSkin,
    accessoryId: myHat ?? undefined,
    prestige: 1,
  };

  const all = [...MOCK_LEAGUE.map((m) => ({ ...m, mine: false, rank: 0 })), myRow];
  all.sort((a, b) => b.score - a.score);

  const ranked: BoardRow[] = all.slice(0, 10).map((r, idx) => ({
    ...r,
    rank: idx + 1,
  }));

  // If player is below top 10, calculate their rank
  const myIdx = all.findIndex((r) => r.mine);
  if (myIdx >= 10) {
    myRow.rank = myIdx + 1;
    ranked.push(myRow);
  }

  return ranked;
}
