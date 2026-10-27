import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  GhostPvPMove,
  GhostPvPProfile,
  WeeklyLeagueCohort,
  WeeklyLeagueParticipant,
} from '../engine/types';
import { SeededRNG } from '../engine/SeededRNG';
import { gameStorage } from '../store/storage';

const STORAGE_USER_ID = 'zikaron3d_supabase_user_id';
const STORAGE_USER_NAME = 'zikaron3d_display_name';
const STORAGE_CACHED_LEAGUE = 'zikaron3d_cached_league';

class SupabaseServiceManager {
  private client: SupabaseClient | null = null;
  private isConfigured: boolean = false;
  private currentUserId: string = '';
  private currentDisplayName: string = '';

  constructor() {
    this.init();
  }

  private init() {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    // Check if real Supabase credentials are configured
    if (
      supabaseUrl &&
      supabaseAnonKey &&
      !supabaseUrl.includes('your_supabase_url_here') &&
      !supabaseAnonKey.includes('your_supabase_anon_key_here')
    ) {
      try {
        this.client = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
        });
        this.isConfigured = true;
      } catch (err) {
        console.warn('Supabase initialization failed, falling back to local simulation:', err);
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
    }

    // Restore or generate unique device user id
    let userId = gameStorage.getString(STORAGE_USER_ID);
    if (!userId) {
      userId = `pilot_${Math.random().toString(36).substring(2, 9)}`;
      gameStorage.setString(STORAGE_USER_ID, userId);
    }
    this.currentUserId = userId;

    let displayName = gameStorage.getString(STORAGE_USER_NAME);
    if (!displayName) {
      displayName = `Challenger_${userId.substring(6, 10).toUpperCase()}`;
      gameStorage.setString(STORAGE_USER_NAME, displayName);
    }
    this.currentDisplayName = displayName;
  }

  public getUserId(): string {
    return this.currentUserId;
  }

  public getDisplayName(): string {
    return this.currentDisplayName;
  }

  public setDisplayName(name: string): void {
    this.currentDisplayName = name;
    gameStorage.setString(STORAGE_USER_NAME, name);
  }

  // =========================================================================
  // 1v1 GHOST REPLAY ASYNCHRONOUS MATCHMAKING
  // Matches ghosts on identical seed boards within +/- 15 PSR
  // =========================================================================

  /**
   * Fetches an asynchronous ghost opponent for an identical seed board.
   * If remote record is not found or offline, generates a deterministic ghost replay.
   */
  public async fetchGhostOpponent(
    seed: number,
    playerPSR: number = 50,
    cardIds: string[] = []
  ): Promise<GhostPvPProfile> {
    if (this.isConfigured && this.client) {
      try {
        const { data, error } = await this.client
          .from('ghost_replays')
          .select('*')
          .eq('seed', seed)
          .gte('psr', Math.max(0, playerPSR - 18))
          .lte('psr', Math.min(100, playerPSR + 18))
          .neq('user_id', this.currentUserId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data && !error) {
          return {
            ghostId: data.ghost_id || data.id,
            displayName: data.display_name || 'Ghost Rival',
            seed: data.seed,
            totalTurns: data.total_turns,
            totalTimeMs: data.total_time_ms,
            moves: data.moves as GhostPvPMove[],
          };
        }
      } catch (e) {
        console.warn('Error fetching Supabase ghost replay, using seeded synthetic ghost:', e);
      }
    }

    // Deterministic synthetic ghost replay generator based on seed & PSR
    return this.generateSyntheticGhostReplay(seed, playerPSR, cardIds);
  }

  /**
   * Upload player's completed run as a new ghost replay for future challengers.
   */
  public async uploadGhostRun(
    profile: GhostPvPProfile,
    psr: number
  ): Promise<boolean> {
    if (this.isConfigured && this.client) {
      try {
        const { error } = await this.client.from('ghost_replays').insert({
          user_id: this.currentUserId,
          ghost_id: profile.ghostId,
          display_name: profile.displayName || this.currentDisplayName,
          seed: profile.seed,
          total_turns: profile.totalTurns,
          total_time_ms: profile.totalTimeMs,
          moves: profile.moves,
          psr,
        });

        if (!error) return true;
        console.warn('Supabase upload ghost run error:', error);
      } catch (err) {
        console.warn('Failed to upload ghost run to Supabase:', err);
      }
    }

    return false;
  }

  // =========================================================================
  // 30-PLAYER WEEKLY LEAGUES (ASYNC COHORTS)
  // =========================================================================

  /**
   * Fetches the player's 30-player weekly league bracket.
   */
  public async fetchWeeklyLeague(): Promise<WeeklyLeagueCohort> {
    const currentWeekNumber = this.getWeekNumber();

    if (this.isConfigured && this.client) {
      try {
        const { data, error } = await this.client
          .from('weekly_league_participants')
          .select('*')
          .eq('week_number', currentWeekNumber)
          .order('score', { ascending: false })
          .limit(30);

        if (data && data.length > 0 && !error) {
          const participants: WeeklyLeagueParticipant[] = data.map((item, idx) => ({
            rank: idx + 1,
            userId: item.user_id,
            displayName: item.display_name,
            score: item.score,
            tier: item.tier || 'GOLD',
            equippedTrophies: item.equipped_trophies || [],
            isCurrentPlayer: item.user_id === this.currentUserId,
          }));

          const cohort: WeeklyLeagueCohort = {
            leagueId: `league_w${currentWeekNumber}`,
            weekNumber: currentWeekNumber,
            endsAtTimestamp: this.getEndOfWeekTimestamp(),
            participants,
          };

          gameStorage.setString(STORAGE_CACHED_LEAGUE, JSON.stringify(cohort));
          return cohort;
        }
      } catch (err) {
        console.warn('Supabase weekly league error, falling back to cached/seeded cohort:', err);
      }
    }

    // Try reading cached league
    const cached = gameStorage.getString(STORAGE_CACHED_LEAGUE);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }

    // Generate balanced 30-player weekly cohort
    const simulatedCohort = this.generateSimulatedWeeklyLeague(currentWeekNumber);
    gameStorage.setString(STORAGE_CACHED_LEAGUE, JSON.stringify(simulatedCohort));
    return simulatedCohort;
  }

  /**
   * Submit weekly league score and update rank.
   */
  public async submitWeeklyScore(score: number): Promise<number> {
    const currentWeek = this.getWeekNumber();

    if (this.isConfigured && this.client) {
      try {
        await this.client.from('weekly_league_participants').upsert({
          user_id: this.currentUserId,
          week_number: currentWeek,
          display_name: this.currentDisplayName,
          score,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Failed to submit weekly score to Supabase:', err);
      }
    }

    // Update local cached cohort
    const cohort = await this.fetchWeeklyLeague();
    const playerEntry = cohort.participants.find((p) => p.userId === this.currentUserId);
    if (playerEntry) {
      playerEntry.score = Math.max(playerEntry.score, score);
      cohort.participants.sort((a, b) => b.score - a.score);
      cohort.participants.forEach((p, index) => {
        p.rank = index + 1;
      });
      gameStorage.setString(STORAGE_CACHED_LEAGUE, JSON.stringify(cohort));
      return playerEntry.rank;
    }

    return 15;
  }

  // =========================================================================
  // HELPER SIMULATORS (Ensures 100% offline & zero-dependency functionality)
  // =========================================================================

  private generateSyntheticGhostReplay(
    seed: number,
    psr: number,
    cardIds: string[]
  ): GhostPvPProfile {
    const rng = new SeededRNG(seed + 777);
    const rivalNames = [
      'Valkyrie_Nova',
      'CyberPulse',
      'QuantumGhost',
      'ZenMaster_88',
      'Solaris_Prime',
      'EchoRacer',
      'Chronos_Seeker',
      'NeonPhantom',
    ];
    const displayName = rng.pick(rivalNames);

    const moves: GhostPvPMove[] = [];
    let currentTime = 1200; // Initial delay to inspect board

    // Skill-based flip speed & accuracy
    const flipSpeedBase = Math.max(700, 1900 - psr * 12);
    const turns = Math.max(8, Math.round(18 - (psr / 100) * 8));

    for (let i = 0; i < turns; i++) {
      const stepTime = Math.round(flipSpeedBase + rng.nextInt(-200, 300));
      currentTime += stepTime;

      const randomCardId = cardIds.length > 0 ? rng.pick(cardIds) : `card_${i % 12}`;
      const action = rng.next() * 100 < psr + 20 ? 'MATCH' : 'MISS';

      moves.push({
        timestampMs: currentTime,
        cardId: randomCardId,
        action,
        moveIndex: i,
      });
    }

    return {
      ghostId: `ghost_${seed}_${Math.round(psr)}`,
      displayName,
      seed,
      totalTurns: turns,
      totalTimeMs: currentTime,
      moves,
    };
  }

  private generateSimulatedWeeklyLeague(weekNumber: number): WeeklyLeagueCohort {
    const rng = new SeededRNG(weekNumber * 31337);
    const botPrefixes = [
      'Aero',
      'Viper',
      'Shadow',
      'Blaze',
      'Orbit',
      'Titan',
      'Prism',
      'Lumina',
      'Frost',
      'Apex',
      'Stellar',
      'Zephyr',
      'Glitch',
      'Nova',
      'Echo',
    ];

    const participants: WeeklyLeagueParticipant[] = [];

    // Generate 29 simulated rivals with realistic bell-curve scores
    for (let i = 0; i < 29; i++) {
      const name = `${rng.pick(botPrefixes)}_${rng.nextInt(10, 99)}`;
      const baseScore = Math.round(18000 - i * 480 + rng.nextInt(-250, 350));
      const tier =
        i < 3
          ? 'MASTER'
          : i < 8
            ? 'OBSIDIAN'
            : i < 18
              ? 'GOLD'
              : i < 25
                ? 'SILVER'
                : 'BRONZE';

      participants.push({
        rank: i + 1,
        userId: `rival_${i}`,
        displayName: name,
        score: Math.max(1200, baseScore),
        tier,
        equippedTrophies: ['trophy_crystal_1', 'trophy_cyber_1'],
        isCurrentPlayer: false,
      });
    }

    // Insert current player at rank 12 initially
    participants.push({
      rank: 12,
      userId: this.currentUserId,
      displayName: this.currentDisplayName,
      score: 9450,
      tier: 'GOLD',
      equippedTrophies: ['trophy_crystal_1'],
      isCurrentPlayer: true,
    });

    participants.sort((a, b) => b.score - a.score);
    participants.forEach((p, idx) => {
      p.rank = idx + 1;
    });

    return {
      leagueId: `weekly_cohort_${weekNumber}`,
      weekNumber,
      endsAtTimestamp: this.getEndOfWeekTimestamp(),
      participants,
    };
  }

  private getWeekNumber(): number {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek) + 1;
  }

  private getEndOfWeekTimestamp(): number {
    const now = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7;
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + daysUntilSunday);
    sunday.setHours(23, 59, 59, 999);
    return sunday.getTime();
  }
}

export const SupabaseService = new SupabaseServiceManager();
export default SupabaseService;
