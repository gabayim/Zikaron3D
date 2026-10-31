import { CREATURE_IDS, useProfile, type RemoteProfile } from '../store/profile';
import { weekKey } from '../engine/daily';
import { supabase, useAuth } from './supabase';

const PUSH_DEBOUNCE_MS = 4000;

function snapshot(): RemoteProfile {
  const s = useProfile.getState();
  return {
    xp: s.xp,
    collection: s.collection,
    burrowsLevel: s.burrowsLevel,
    orbLevel: s.orbLevel,
    orbBest: s.orbBest,
    starLevel: s.starLevel,
    starBest: s.starBest,
    shields: s.shields,
    unlockedWorlds: s.unlockedWorlds,
    celebratedWorlds: s.celebratedWorlds,
    dailyKey: s.dailyKey,
    dailyCompleted: s.dailyCompleted,
    weekKey: s.weekKey,
    weeklyScore: s.weeklyScore,
  };
}

/** Index of the newest creature the player owns; shown as their leaderboard glyph. */
function glyph(): number {
  const { collection } = useProfile.getState();
  const last = collection[collection.length - 1];
  return Math.max(0, CREATURE_IDS.indexOf(last as (typeof CREATURE_IDS)[number]));
}

export async function pull(): Promise<void> {
  const userId = useAuth.getState().userId;
  if (!supabase || !userId) return;
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) {
    console.warn('[sync] pull failed', error.message);
    return;
  }
  const wk = weekKey();
  const { data: score } = await supabase.from('weekly_scores').select('score').eq('user_id', userId).eq('week', wk).maybeSingle();
  if (data) {
    useProfile.getState().mergeRemote({
      xp: data.xp ?? 0,
      collection: data.collection ?? [],
      burrowsLevel: data.burrows_level ?? 0,
      orbBest: data.orb_best ?? 0,
      starBest: data.star_best ?? 0,
      shields: data.shields ?? 0,
      celebratedWorlds: data.celebrated_worlds ?? [],
      dailyKey: data.daily_key ?? '',
      dailyCompleted: data.daily_completed ?? [],
      weekKey: wk,
      weeklyScore: score?.score ?? 0,
    });
  }
}

export async function push(): Promise<void> {
  const userId = useAuth.getState().userId;
  if (!supabase || !userId) return;
  const p = snapshot();
  const { error } = await supabase.from('profiles').upsert({
    user_id: userId,
    xp: p.xp,
    collection: p.collection,
    burrows_level: p.burrowsLevel,
    orb_best: p.orbBest,
    star_best: p.starBest,
    shields: p.shields,
    celebrated_worlds: p.celebratedWorlds,
    daily_key: p.dailyKey,
    daily_completed: p.dailyCompleted,
    updated_at: new Date().toISOString(),
  });
  if (error) console.warn('[sync] push failed', error.message);
  if (p.weeklyScore > 0) {
    const { error: scoreError } = await supabase.from('weekly_scores').upsert({
      week: weekKey(),
      user_id: userId,
      score: p.weeklyScore,
      glyph: glyph(),
      updated_at: new Date().toISOString(),
    });
    if (scoreError) console.warn('[sync] score push failed', scoreError.message);
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

/** On sign-in: pull, merge, push. Afterwards every local profile change is pushed (debounced). Offline writes retry on the next change. */
export function startSync(): void {
  if (started) return;
  started = true;
  const schedule = () => {
    if (!useAuth.getState().userId) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void push(), PUSH_DEBOUNCE_MS);
  };
  useProfile.subscribe(schedule);
  useAuth.subscribe((state, prev) => {
    if (state.userId && state.userId !== prev.userId) void pull().then(push);
  });
  if (useAuth.getState().userId) void pull().then(push);
}
