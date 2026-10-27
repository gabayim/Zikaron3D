import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import {
  BiomeType,
  CardNode,
  GameMode,
  GridConfig,
  OutcomeType,
  Telemetry,
  ThemePersona,
} from '../engine/types';
import { SeededRNG } from '../engine/SeededRNG';
import { DDAEngine } from '../engine/DDAEngine';
import { GridGenerator } from '../engine/GridGenerator';
import { gameStorage } from './storage';

interface GameState {
  // Config & Meta
  themePersona: ThemePersona;
  gameMode: GameMode;
  currentLevel: number;
  currentSeed: number;
  biome: BiomeType;

  // Board State
  cards: CardNode[];
  flippedCardIds: string[];
  seenCardIds: string[]; // Cards the player has seen
  matchedPairCount: number;
  totalPairs: number;
  flipsRemaining: number;
  score: number;

  // Combos & Powerups
  feverMultiplier: number; // 1x to 8x
  feverMeter: number; // 0 to 100
  streakShield: boolean; // Active protection against a miss
  streakShieldInventory: number; // Persistent shields owned

  // Near-Miss Mechanics
  isNearMissActive: boolean;
  nearMissModalVisible: boolean;
  nearMissCards: [string, string] | null;

  // Flow & Locks
  isProcessingFlip: boolean;
  isGameOver: boolean;
  isGameWon: boolean;

  // Metrics
  telemetry: Telemetry;

  // Actions
  initGame: (customConfig?: Partial<GridConfig>) => void;
  flipCard: (cardId: string) => Promise<void>;
  claimClutchSave: (bonusFlips?: number) => void;
  dismissNearMiss: () => void;
  activateStreakShield: () => boolean;
  setThemePersona: (persona: ThemePersona) => void;
  setGameMode: (mode: GameMode) => void;
  resetLevel: () => void;
  nextLevel: () => void;
}

// Storage Keys
const STORAGE_PERSONA = 'zikaron3d_persona';
const STORAGE_SHIELD_INVENTORY = 'zikaron3d_shield_inventory';
const STORAGE_MAX_LEVEL = 'zikaron3d_max_level';
const STORAGE_HIGH_SCORE = 'zikaron3d_high_score';

export const useGameStore = create<GameState>((set, get) => {
  // Load persisted initial values
  const storedPersona = gameStorage.getString(STORAGE_PERSONA) as ThemePersona;
  const initialPersona: ThemePersona =
    storedPersona === 'TOYBOX' || storedPersona === 'ARCADE' || storedPersona === 'SANCTUARY'
      ? storedPersona
      : 'ARCADE';

  const initialShields = gameStorage.getNumber(STORAGE_SHIELD_INVENTORY, 3);
  const initialLevel = Math.max(1, gameStorage.getNumber(STORAGE_MAX_LEVEL, 1));

  return {
    themePersona: initialPersona,
    gameMode: 'SAGA',
    currentLevel: initialLevel,
    currentSeed: SeededRNG.stringToSeed(`seed_${initialLevel}`),
    biome: 'CRYSTAL_CAVERN',

    cards: [],
    flippedCardIds: [],
    seenCardIds: [],
    matchedPairCount: 0,
    totalPairs: 0,
    flipsRemaining: 20,
    score: 0,

    feverMultiplier: 1,
    feverMeter: 0,
    streakShield: false,
    streakShieldInventory: initialShields,

    isNearMissActive: false,
    nearMissModalVisible: false,
    nearMissCards: null,

    isProcessingFlip: false,
    isGameOver: false,
    isGameWon: false,

    telemetry: {
      turnCount: 0,
      consecutiveMatches: 0,
      consecutiveMisses: 0,
      totalMatches: 0,
      totalPairs: 0,
      timeElapsedMs: 0,
      averageFlipSpeedMs: 0,
      lastFlipTimestamp: 0,
      flipsRemaining: 20,
      recentOutcomes: [],
      psr: DDAEngine.DEFAULT_PSR,
    },

    initGame: (customConfig) => {
      const state = get();
      const baseConfig = GridGenerator.getDefaultGridConfig(
        state.currentLevel,
        state.themePersona,
        state.gameMode
      );

      const config: GridConfig = {
        ...baseConfig,
        ...customConfig,
      };

      const generatedCards = GridGenerator.generateBoard(config);

      set({
        biome: config.biome,
        currentSeed: config.seed,
        cards: generatedCards,
        flippedCardIds: [],
        seenCardIds: [],
        matchedPairCount: 0,
        totalPairs: config.totalPairs,
        flipsRemaining: config.maxFlips ?? (state.themePersona === 'ARCADE' ? 24 : 40),
        score: 0,
        feverMultiplier: 1,
        feverMeter: 0,
        streakShield: false,
        isNearMissActive: false,
        nearMissModalVisible: false,
        nearMissCards: null,
        isProcessingFlip: false,
        isGameOver: false,
        isGameWon: false,
        telemetry: {
          turnCount: 0,
          consecutiveMatches: 0,
          consecutiveMisses: 0,
          totalMatches: 0,
          totalPairs: config.totalPairs,
          timeElapsedMs: 0,
          averageFlipSpeedMs: 0,
          lastFlipTimestamp: 0,
          flipsRemaining: config.maxFlips ?? 24,
          recentOutcomes: [],
          psr: state.telemetry.psr || DDAEngine.DEFAULT_PSR,
        },
      });
    },

    flipCard: async (cardId: string) => {
      const state = get();
      const {
        cards,
        flippedCardIds,
        seenCardIds,
        isProcessingFlip,
        isGameOver,
        isGameWon,
        flipsRemaining,
        telemetry,
        themePersona,
        gameMode,
        feverMultiplier,
        feverMeter,
        streakShield,
        score,
        matchedPairCount,
        totalPairs,
      } = state;

      // Lock input if animations are running or round ended
      if (isProcessingFlip || isGameOver || isGameWon) {
        return;
      }

      // Find target card
      const targetCard = cards.find((c) => c.id === cardId);
      if (!targetCard) return;

      // Cannot flip already matched, blocked, or currently flipped cards
      if (targetCard.isMatched || targetCard.isFlipped || targetCard.isBlocked) {
        return;
      }

      // Trigger card flip tactile haptic
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      const now = Date.now();
      const updatedSeen = Array.from(new Set([...seenCardIds, cardId]));

      // -------------------------------------------------------------
      // FIRST CARD FLIPPED IN TURN
      // -------------------------------------------------------------
      if (flippedCardIds.length === 0) {
        const flippedCards = cards.map((c) =>
          c.id === cardId ? { ...c, isFlipped: true, state: 'FACE_UP' as const } : c
        );

        // Check Solo Saga DDA Mercy assistance
        let finalCards = flippedCards;
        const mercyEval = DDAEngine.evaluateMercyTrigger({
          psr: telemetry.psr,
          consecutiveMisses: telemetry.consecutiveMisses,
          flipsRemaining,
          remainingPairs: totalPairs - matchedPairCount,
          persona: themePersona,
          mode: gameMode,
        });

        if (mercyEval.shouldTrigger) {
          const firstCardObj = flippedCards.find((c) => c.id === cardId)!;
          const rng = new SeededRNG(state.currentSeed + telemetry.turnCount);
          const mercyResult = DDAEngine.applyInvisibleMercySwap({
            cards: flippedCards,
            firstFlippedCard: firstCardObj,
            seenCardIds: new Set(updatedSeen),
            rng,
          });

          if (mercyResult.swapped) {
            finalCards = mercyResult.cards;
          }
        }

        set({
          cards: finalCards,
          flippedCardIds: [cardId],
          seenCardIds: updatedSeen,
          telemetry: {
            ...telemetry,
            lastFlipTimestamp: now,
          },
        });
        return;
      }

      // -------------------------------------------------------------
      // SECOND CARD FLIPPED IN TURN
      // -------------------------------------------------------------
      if (flippedCardIds.length === 1) {
        const firstCardId = flippedCardIds[0];
        if (firstCardId === cardId) return;

        // Lock board during resolution
        set({ isProcessingFlip: true });

        const firstCard = cards.find((c) => c.id === firstCardId)!;
        const secondCard = { ...targetCard, isFlipped: true, state: 'FACE_UP' as const };

        const updatedCards = cards.map((c) => (c.id === cardId ? secondCard : c));

        set({
          cards: updatedCards,
          flippedCardIds: [firstCardId, cardId],
          seenCardIds: updatedSeen,
        });

        const flipSpeedMs =
          telemetry.lastFlipTimestamp > 0 ? now - telemetry.lastFlipTimestamp : 1500;
        const isMatch = firstCard.visualId === secondCard.visualId;
        const outcome: OutcomeType = isMatch ? 'MATCH' : 'MISS';
        const updatedRecentOutcomes = [...telemetry.recentOutcomes.slice(-9), outcome];

        if (isMatch) {
          // ==================== MATCH LOGIC ====================
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {}

          const newConsecutiveMatches = telemetry.consecutiveMatches + 1;
          const newMatchedPairCount = matchedPairCount + 1;

          // Fever Progression
          const feverGain = themePersona === 'ARCADE' ? 35 : 25;
          const rawMeter = feverMeter + feverGain;
          const newFeverMultiplier =
            rawMeter >= 100
              ? Math.min(8, feverMultiplier + 1)
              : feverMultiplier;
          const newFeverMeter = rawMeter >= 100 ? rawMeter % 100 : rawMeter;

          // Score Calculation
          const baseMatchScore = 150;
          const personaMultiplier = themePersona === 'ARCADE' ? 1.5 : 1.0;
          const scoreDelta = Math.round(
            baseMatchScore * newFeverMultiplier * personaMultiplier
          );
          const newScore = score + scoreDelta;

          // Update card states to MATCHED
          const matchedCards = updatedCards.map((c) => {
            if (c.id === firstCardId || c.id === cardId) {
              return { ...c, isMatched: true, state: 'MATCHED' as const };
            }
            return c;
          });

          // Unblock underlying excavation cards
          const unblockedCards = GridGenerator.updateGridBlockedStates(matchedCards);

          // Update Player Skill Rating
          const newPSR = DDAEngine.calculatePSR({
            currentPSR: telemetry.psr,
            recentOutcomes: updatedRecentOutcomes,
            lastFlipSpeedMs: flipSpeedMs,
            consecutiveMatches: newConsecutiveMatches,
            consecutiveMisses: 0,
          });

          const isWin = newMatchedPairCount >= totalPairs;
          if (isWin) {
            // Save progression
            const nextLvl = state.currentLevel + 1;
            gameStorage.setNumber(STORAGE_MAX_LEVEL, nextLvl);
            const prevHighScore = gameStorage.getNumber(STORAGE_HIGH_SCORE, 0);
            if (newScore > prevHighScore) {
              gameStorage.setNumber(STORAGE_HIGH_SCORE, newScore);
            }
          }

          set({
            cards: unblockedCards,
            flippedCardIds: [],
            matchedPairCount: newMatchedPairCount,
            score: newScore,
            feverMultiplier: newFeverMultiplier,
            feverMeter: newFeverMeter,
            isGameWon: isWin,
            isProcessingFlip: false,
            telemetry: {
              ...telemetry,
              turnCount: telemetry.turnCount + 1,
              consecutiveMatches: newConsecutiveMatches,
              consecutiveMisses: 0,
              totalMatches: telemetry.totalMatches + 1,
              averageFlipSpeedMs:
                telemetry.averageFlipSpeedMs === 0
                  ? flipSpeedMs
                  : Math.round((telemetry.averageFlipSpeedMs + flipSpeedMs) / 2),
              recentOutcomes: updatedRecentOutcomes,
              psr: newPSR,
            },
          });
        } else {
          // ==================== MISS LOGIC ====================
          const newConsecutiveMisses = telemetry.consecutiveMisses + 1;
          const nextFlipsRemaining =
            themePersona === 'SANCTUARY'
              ? flipsRemaining // Untimed / no flip penalty
              : Math.max(0, flipsRemaining - 1);

          // Streak Shield deflection check
          let finalFeverMultiplier = feverMultiplier;
          let finalFeverMeter = feverMeter;
          let shieldConsumed = false;

          if (streakShield) {
            // Streak Shield absorbs the miss!
            shieldConsumed = true;
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}
          } else {
            // Miss breaks fever combo
            finalFeverMultiplier = 1;
            finalFeverMeter = 0;
            try {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch {}
          }

          const newPSR = DDAEngine.calculatePSR({
            currentPSR: telemetry.psr,
            recentOutcomes: updatedRecentOutcomes,
            lastFlipSpeedMs: flipSpeedMs,
            consecutiveMatches: 0,
            consecutiveMisses: newConsecutiveMisses,
          });

          // Near-Miss Clutch Trigger check
          const isOutOfFlips =
            themePersona !== 'SANCTUARY' &&
            nextFlipsRemaining === 0 &&
            matchedPairCount < totalPairs;

          if (isOutOfFlips) {
            // Locate partner for the Near-Miss 1.5s reveal
            const partnerOfSecond = cards.find(
              (c) => c.id !== secondCard.id && c.visualId === secondCard.visualId
            );

            const nearMissCardIds: [string, string] = [
              secondCard.id,
              partnerOfSecond ? partnerOfSecond.id : firstCard.id,
            ];

            // Temporarily reveal partner during near-miss
            const nearMissRevealedCards = updatedCards.map((c) => {
              if (c.id === nearMissCardIds[1]) {
                return { ...c, isFlipped: true, state: 'FACE_UP' as const };
              }
              return c;
            });

            set({
              cards: nearMissRevealedCards,
              flipsRemaining: 0,
              streakShield: shieldConsumed ? false : streakShield,
              feverMultiplier: finalFeverMultiplier,
              feverMeter: finalFeverMeter,
              isNearMissActive: true,
              nearMissCards: nearMissCardIds,
              telemetry: {
                ...telemetry,
                turnCount: telemetry.turnCount + 1,
                consecutiveMatches: 0,
                consecutiveMisses: newConsecutiveMisses,
                flipsRemaining: 0,
                recentOutcomes: updatedRecentOutcomes,
                psr: newPSR,
              },
            });

            // 1.5s dramatic reveal then display the Near-Miss clutch save modal
            setTimeout(() => {
              set({
                nearMissModalVisible: true,
                isProcessingFlip: false,
              });
            }, 1500);
          } else {
            // Normal miss: pause 750ms so player can register cards, then flip back
            setTimeout(() => {
              const resetCards = get().cards.map((c) => {
                if (c.id === firstCardId || c.id === cardId) {
                  return { ...c, isFlipped: false, state: 'FACE_DOWN' as const };
                }
                return c;
              });

              set({
                cards: resetCards,
                flippedCardIds: [],
                flipsRemaining: nextFlipsRemaining,
                streakShield: shieldConsumed ? false : streakShield,
                feverMultiplier: finalFeverMultiplier,
                feverMeter: finalFeverMeter,
                isProcessingFlip: false,
                telemetry: {
                  ...telemetry,
                  turnCount: telemetry.turnCount + 1,
                  consecutiveMatches: 0,
                  consecutiveMisses: newConsecutiveMisses,
                  flipsRemaining: nextFlipsRemaining,
                  recentOutcomes: updatedRecentOutcomes,
                  psr: newPSR,
                },
              });
            }, 750);
          }
        }
      }
    },

    claimClutchSave: (bonusFlips = 4) => {
      const state = get();
      const resetCards = state.cards.map((c) => {
        if (!c.isMatched) {
          return { ...c, isFlipped: false, state: 'FACE_DOWN' as const };
        }
        return c;
      });

      set({
        cards: resetCards,
        flippedCardIds: [],
        flipsRemaining: bonusFlips,
        isNearMissActive: false,
        nearMissModalVisible: false,
        nearMissCards: null,
        isGameOver: false,
        isProcessingFlip: false,
      });

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    },

    dismissNearMiss: () => {
      set({
        isNearMissActive: false,
        nearMissModalVisible: false,
        isGameOver: true,
        isProcessingFlip: false,
      });
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    },

    activateStreakShield: () => {
      const state = get();
      if (state.streakShieldInventory > 0 && !state.streakShield) {
        const nextInventory = state.streakShieldInventory - 1;
        gameStorage.setNumber(STORAGE_SHIELD_INVENTORY, nextInventory);

        set({
          streakShield: true,
          streakShieldInventory: nextInventory,
        });

        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        return true;
      }
      return false;
    },

    setThemePersona: (persona: ThemePersona) => {
      gameStorage.setString(STORAGE_PERSONA, persona);
      set({ themePersona: persona });
      get().initGame();
    },

    setGameMode: (mode: GameMode) => {
      set({ gameMode: mode });
      get().initGame();
    },

    resetLevel: () => {
      get().initGame();
    },

    nextLevel: () => {
      const nextLvl = get().currentLevel + 1;
      set({ currentLevel: nextLvl });
      get().initGame();
    },
  };
});
