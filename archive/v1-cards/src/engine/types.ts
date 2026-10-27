/**
 * Zikaron3D Core Engine Types
 * Universal design - Zero letters, numbers, or text on cards.
 */

export type ThemePersona = 'TOYBOX' | 'ARCADE' | 'SANCTUARY';

export type GameMode = 'SAGA' | 'GHOST_PVP';

export type BiomeType =
  | 'CRYSTAL_CAVERN'
  | 'NEON_CYBER'
  | 'ANCIENT_GOLD'
  | 'ZEN_GARDEN'
  | 'VOLCANIC_CORE';

export type CardVisualId =
  | 'ruby_gem'
  | 'cosmic_star'
  | 'golden_ring'
  | 'crystal_prism'
  | 'sacred_flame'
  | 'water_drop'
  | 'emerald_leaf'
  | 'lightning_orb'
  | 'mystic_moon'
  | 'solar_sun'
  | 'ancient_shield'
  | 'celestial_compass';

export type CardState =
  | 'FACE_DOWN'
  | 'FLIPPING_UP'
  | 'FACE_UP'
  | 'MATCHED'
  | 'FLIPPING_DOWN';

export interface CardNode {
  id: string;
  visualId: CardVisualId;
  row: number;
  col: number;
  layer: number; // 0 = bedrock/bottom layer, 1 = excavation/top frosted glass layer
  isBlocked: boolean; // True if a card in layer 1 directly above this cell is not yet matched
  state: CardState;
  isFlipped: boolean;
  isMatched: boolean;
  elevation: number; // 3D Y-offset: layer 0 = 0, layer 1 = 0.18
  videoUri?: string; // 1:1 square PixVerse MP4 animation for matched living state
  frame0Uri?: string; // Static frame-0 preview for instant 3D flipping
  wiggling?: boolean; // Subtle wiggle hint for TOYBOX mode
}

export interface BiomeConfig {
  id: BiomeType;
  name: string;
  primaryColor: string;
  accentColor: string;
  ambientLight: string;
  pointLight: string;
  cardBackMaterial: 'metallic_gold' | 'cyber_obsidian' | 'frosted_quartz' | 'jade_stone' | 'volcanic_matte';
  glowColor: string;
}

export interface GridConfig {
  rows: number;
  cols: number;
  layers: 1 | 2;
  seed: number;
  biome: BiomeType;
  totalPairs: number;
  maxFlips?: number;
}

export type OutcomeType = 'MATCH' | 'MISS';

export interface Telemetry {
  turnCount: number;
  consecutiveMatches: number;
  consecutiveMisses: number;
  totalMatches: number;
  totalPairs: number;
  timeElapsedMs: number;
  averageFlipSpeedMs: number;
  lastFlipTimestamp: number;
  flipsRemaining: number;
  recentOutcomes: OutcomeType[]; // Rolling last 10 turns
  psr: number; // Player Skill Rating (0 - 100)
}

export interface GhostPvPMove {
  timestampMs: number;
  cardId: string;
  action: 'FLIP' | 'MATCH' | 'MISS';
  moveIndex: number;
}

export interface GhostPvPProfile {
  ghostId: string;
  displayName: string;
  seed: number;
  totalTurns: number;
  totalTimeMs: number;
  moves: GhostPvPMove[];
}

export interface NearMissState {
  isActive: boolean;
  triggerCardIds: [string, string] | null;
  expiresAt: number | null;
}

export type TrophyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'OBSIDIAN';

export type TrophyModelType =
  | 'crystal_monolith'
  | 'volcanic_totem'
  | 'cyber_quantum'
  | 'ancient_scarab'
  | 'zen_lotus';

export interface BiomeTrophy {
  id: string;
  name: string;
  biome: BiomeType;
  tier: TrophyTier;
  unlocked: boolean;
  equippedSlot?: 1 | 2 | 3;
  modelType: TrophyModelType;
  glowColor: string;
  achievementDescription: string;
}

export type LeagueTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'OBSIDIAN' | 'MASTER';

export interface WeeklyLeagueParticipant {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  tier: LeagueTier;
  equippedTrophies: string[];
  isCurrentPlayer?: boolean;
}

export interface WeeklyLeagueCohort {
  leagueId: string;
  weekNumber: number;
  endsAtTimestamp: number;
  participants: WeeklyLeagueParticipant[];
}

export type ProductType = 'VAULT_SKIN' | 'FOLEY_PACK' | 'SEASON_PASS' | 'STREAK_SHIELDS';

export interface StoreProduct {
  id: string;
  type: ProductType;
  title: string;
  description: string;
  priceString: string;
  unlocked: boolean;
  iconName?: string;
}

