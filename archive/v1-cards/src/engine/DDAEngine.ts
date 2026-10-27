import { CardNode, GameMode, OutcomeType, ThemePersona } from './types';
import { SeededRNG } from './SeededRNG';

/**
 * Dynamic Difficulty Adjustment (DDA) Engine
 * Manages rolling Player Skill Rating (PSR 0-100) and invisible Mercy RNG swaps.
 */

export interface MercyEvaluationResult {
  shouldTrigger: boolean;
  reason?: 'LOW_PSR' | 'CONSECUTIVE_MISSES' | 'LOW_MOVES_LEFT' | 'TOYBOX_AUTO';
}

export interface MercySwapResult {
  swapped: boolean;
  cards: CardNode[];
  swappedCardIds?: [string, string];
}

export class DDAEngine {
  /** Baseline starting PSR for a neutral player */
  public static readonly DEFAULT_PSR = 50;

  /** Minimum and maximum bounds for PSR */
  public static readonly MIN_PSR = 0;
  public static readonly MAX_PSR = 100;

  /**
   * Calculates the rolling Player Skill Rating (PSR 0-100).
   * Incorporates recent match accuracy, flip latency/speed, and streak momentum.
   */
  public static calculatePSR(params: {
    currentPSR: number;
    recentOutcomes: OutcomeType[];
    lastFlipSpeedMs: number;
    consecutiveMatches: number;
    consecutiveMisses: number;
  }): number {
    const {
      currentPSR,
      recentOutcomes,
      lastFlipSpeedMs,
      consecutiveMatches,
      consecutiveMisses,
    } = params;

    if (recentOutcomes.length === 0) {
      return currentPSR;
    }

    const latestOutcome = recentOutcomes[recentOutcomes.length - 1];
    let delta = 0;

    if (latestOutcome === 'MATCH') {
      // Base match gain
      delta += 3.5;

      // Speed bonus: Quick confident recall (< 1500ms) indicates mastery
      if (lastFlipSpeedMs > 0 && lastFlipSpeedMs < 1200) {
        delta += 2.5;
      } else if (lastFlipSpeedMs >= 1200 && lastFlipSpeedMs < 2500) {
        delta += 1.0;
      }

      // Momentum bonus for consecutive matches
      if (consecutiveMatches >= 4) {
        delta += 2.5;
      } else if (consecutiveMatches >= 2) {
        delta += 1.0;
      }
    } else {
      // Base miss deduction
      delta -= 3.0;

      // Hesitation penalty: Long delay (> 4000ms) before a miss indicates confusion
      if (lastFlipSpeedMs > 4000) {
        delta -= 1.5;
      }

      // Compounding drop for consecutive misses to trigger mercy quickly
      if (consecutiveMisses >= 3) {
        delta -= 2.0;
      }
    }

    // Weight recent outcomes trend: calculate win rate over last 10 turns
    const matchCount = recentOutcomes.filter((o) => o === 'MATCH').length;
    const rollingWinRate = matchCount / recentOutcomes.length;
    const targetPSRFromWinRate = rollingWinRate * 100;

    // Smooth convergence towards rolling win rate
    const blendedPSR = currentPSR + delta * 0.7 + (targetPSRFromWinRate - currentPSR) * 0.1;

    return Math.max(
      DDAEngine.MIN_PSR,
      Math.min(DDAEngine.MAX_PSR, Math.round(blendedPSR * 10) / 10)
    );
  }

  /**
   * Evaluates if invisible mercy assistance should be primed.
   * NEVER triggers in competitive Ghost PvP mode.
   */
  public static evaluateMercyTrigger(params: {
    psr: number;
    consecutiveMisses: number;
    flipsRemaining: number;
    remainingPairs: number;
    persona: ThemePersona;
    mode: GameMode;
  }): MercyEvaluationResult {
    const { psr, consecutiveMisses, flipsRemaining, remainingPairs, persona, mode } =
      params;

    // Ghost PvP must remain strictly deterministic and neutral
    if (mode === 'GHOST_PVP') {
      return { shouldTrigger: false };
    }

    // TOYBOX is designed for kids; provide gentle flow assistance
    if (persona === 'TOYBOX') {
      if (consecutiveMisses >= 2 || flipsRemaining <= 6) {
        return { shouldTrigger: true, reason: 'TOYBOX_AUTO' };
      }
    }

    // Low moves remaining with multiple pairs left
    if (flipsRemaining <= 4 && remainingPairs > 1) {
      return { shouldTrigger: true, reason: 'LOW_MOVES_LEFT' };
    }

    // Frustration threshold: 3 or more consecutive misses
    if (consecutiveMisses >= 3) {
      return { shouldTrigger: true, reason: 'CONSECUTIVE_MISSES' };
    }

    // Struggling player: PSR dropped below critical threshold
    if (psr < 35 && consecutiveMisses >= 2) {
      return { shouldTrigger: true, reason: 'LOW_PSR' };
    }

    return { shouldTrigger: false };
  }

  /**
   * Applies an invisible Mercy swap on the unrevealed card deck.
   *
   * Rules for fairness and zero cognitive dissonance:
   * 1. NEVER swap any card that has already been seen/revealed by the player.
   * 2. NEVER swap already matched cards.
   * 3. NEVER swap the currently flipped card.
   * 4. Swaps the hidden partner of `firstFlippedCard` with an unrevealed, UNBLOCKED card,
   *    ensuring the player has an accessible match opportunity.
   */
  public static applyInvisibleMercySwap(params: {
    cards: CardNode[];
    firstFlippedCard: CardNode;
    seenCardIds: Set<string>;
    rng: SeededRNG;
  }): MercySwapResult {
    const { cards, firstFlippedCard, seenCardIds, rng } = params;

    // Find the partner card that shares the same visualId
    const partnerCard = cards.find(
      (c) => c.id !== firstFlippedCard.id && c.visualId === firstFlippedCard.visualId
    );

    if (!partnerCard) {
      return { swapped: false, cards };
    }

    // If partner is already matched or currently face up, do not swap
    if (partnerCard.isMatched || partnerCard.isFlipped) {
      return { swapped: false, cards };
    }

    // If partner was already seen by the player, NEVER swap it (breaks player memory)
    if (seenCardIds.has(partnerCard.id)) {
      return { swapped: false, cards };
    }

    // If partner card is already unblocked, we don't strictly need a swap unless it's trapped
    if (!partnerCard.isBlocked) {
      return { swapped: false, cards };
    }

    // Partner is currently BLOCKED in layer 0 under an excavation tile.
    // Find unrevealed, UNBLOCKED candidate cards that the player has NEVER seen
    const eligibleCandidates = cards.filter((c) => {
      return (
        c.id !== firstFlippedCard.id &&
        c.id !== partnerCard.id &&
        !c.isMatched &&
        !c.isFlipped &&
        !c.isBlocked &&
        !seenCardIds.has(c.id) &&
        c.visualId !== firstFlippedCard.visualId
      );
    });

    if (eligibleCandidates.length === 0) {
      return { swapped: false, cards };
    }

    // Pick a candidate to swap with
    const targetCandidate = rng.pick(eligibleCandidates);

    // Swap their visualIds and video/frame0 URIs invisibly
    const updatedCards = cards.map((c) => {
      if (c.id === partnerCard.id) {
        return {
          ...c,
          visualId: targetCandidate.visualId,
          videoUri: targetCandidate.videoUri,
          frame0Uri: targetCandidate.frame0Uri,
        };
      }
      if (c.id === targetCandidate.id) {
        return {
          ...c,
          visualId: partnerCard.visualId,
          videoUri: partnerCard.videoUri,
          frame0Uri: partnerCard.frame0Uri,
        };
      }
      return c;
    });

    return {
      swapped: true,
      cards: updatedCards,
      swappedCardIds: [partnerCard.id, targetCandidate.id],
    };
  }

  /**
   * For TOYBOX persona: finds a subtle wiggle candidate card.
   * If a card is already flipped, hints its partner (if unblocked).
   */
  public static getWiggleHintCard(
    cards: CardNode[],
    firstFlippedCard: CardNode | null
  ): CardNode | null {
    if (firstFlippedCard) {
      const partner = cards.find(
        (c) =>
          c.id !== firstFlippedCard.id &&
          c.visualId === firstFlippedCard.visualId &&
          !c.isMatched &&
          !c.isBlocked
      );
      if (partner) return partner;
    }

    // Otherwise pick an unblocked face-down card
    const available = cards.filter((c) => !c.isMatched && !c.isFlipped && !c.isBlocked);
    if (available.length === 0) return null;
    return available[0];
  }
}
