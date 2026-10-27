import {
  BiomeConfig,
  BiomeType,
  CardNode,
  CardVisualId,
  GameMode,
  GridConfig,
  ThemePersona,
} from './types';
import { SeededRNG } from './SeededRNG';

/**
 * Universal 3D visual card asset symbols.
 * Zero text, letters, or numbers on cards.
 */
export const ALL_CARD_VISUAL_IDS: readonly CardVisualId[] = [
  'ruby_gem',
  'cosmic_star',
  'golden_ring',
  'crystal_prism',
  'sacred_flame',
  'water_drop',
  'emerald_leaf',
  'lightning_orb',
  'mystic_moon',
  'solar_sun',
  'ancient_shield',
  'celestial_compass',
];

/**
 * Biome themes with visual and lighting properties for 3D rendering.
 */
export const BIOME_CONFIGS: Record<BiomeType, BiomeConfig> = {
  CRYSTAL_CAVERN: {
    id: 'CRYSTAL_CAVERN',
    name: 'Crystal Cavern',
    primaryColor: '#00E5FF',
    accentColor: '#D500F9',
    ambientLight: '#1A237E',
    pointLight: '#00E5FF',
    cardBackMaterial: 'frosted_quartz',
    glowColor: '#00E5FF',
  },
  NEON_CYBER: {
    id: 'NEON_CYBER',
    name: 'Neon Cyber',
    primaryColor: '#FF007F',
    accentColor: '#00F0FF',
    ambientLight: '#0D0221',
    pointLight: '#FF007F',
    cardBackMaterial: 'cyber_obsidian',
    glowColor: '#FF007F',
  },
  ANCIENT_GOLD: {
    id: 'ANCIENT_GOLD',
    name: 'Ancient Gold',
    primaryColor: '#FFD700',
    accentColor: '#00E676',
    ambientLight: '#261C02',
    pointLight: '#FFD700',
    cardBackMaterial: 'metallic_gold',
    glowColor: '#FFB300',
  },
  ZEN_GARDEN: {
    id: 'ZEN_GARDEN',
    name: 'Zen Garden',
    primaryColor: '#26A69A',
    accentColor: '#F8BBD0',
    ambientLight: '#004D40',
    pointLight: '#E0F2F1',
    cardBackMaterial: 'jade_stone',
    glowColor: '#80CBC4',
  },
  VOLCANIC_CORE: {
    id: 'VOLCANIC_CORE',
    name: 'Volcanic Core',
    primaryColor: '#FF3D00',
    accentColor: '#FFAB00',
    ambientLight: '#3E0A00',
    pointLight: '#FF3D00',
    cardBackMaterial: 'volcanic_matte',
    glowColor: '#FF6D00',
  },
};

export class GridGenerator {
  /**
   * Retrieves styling and material configuration for a biome.
   */
  public static getBiomeConfig(biome: BiomeType): BiomeConfig {
    return BIOME_CONFIGS[biome] ?? BIOME_CONFIGS.CRYSTAL_CAVERN;
  }

  /**
   * Dynamically constructs the recommended grid config for a given level and persona.
   */
  public static getDefaultGridConfig(
    level: number,
    persona: ThemePersona = 'ARCADE',
    mode: GameMode = 'SAGA'
  ): GridConfig {
    const biomes: BiomeType[] = [
      'CRYSTAL_CAVERN',
      'NEON_CYBER',
      'ANCIENT_GOLD',
      'ZEN_GARDEN',
      'VOLCANIC_CORE',
    ];
    const biome = biomes[(level - 1) % biomes.length];
    const seed = SeededRNG.stringToSeed(`level_${level}_${mode}_${persona}`);

    // Early levels: 1-layer 3x4 (6 pairs)
    if (level <= 2 || persona === 'TOYBOX') {
      const rows = 4;
      const cols = 3;
      const totalPairs = (rows * cols) / 2; // 6 pairs
      const maxFlips = persona === 'ARCADE' ? 18 : 30;
      return { rows, cols, layers: 1, seed, biome, totalPairs, maxFlips };
    }

    // Mid levels: 1-layer 4x4 (8 pairs)
    if (level <= 5) {
      const rows = 4;
      const cols = 4;
      const totalPairs = (rows * cols) / 2; // 8 pairs
      const maxFlips = persona === 'ARCADE' ? 22 : 36;
      return { rows, cols, layers: 1, seed, biome, totalPairs, maxFlips };
    }

    // Advanced levels: 2-layer excavation board (4x4 bottom + 4 top frosted glass tiles = 20 cards = 10 pairs)
    const rows = 4;
    const cols = 4;
    const totalPairs = 10; // 16 bottom + 4 excavation tiles
    const maxFlips = persona === 'ARCADE' ? 28 : 45;
    return { rows, cols, layers: 2, seed, biome, totalPairs, maxFlips };
  }

  /**
   * Generates a deterministic 1-layer or 2-layer card board.
   */
  public static generateBoard(config: GridConfig): CardNode[] {
    const { rows, cols, layers, seed, totalPairs } = config;
    const rng = new SeededRNG(seed);

    // Determine board layout slots
    interface Slot {
      row: number;
      col: number;
      layer: number;
      elevation: number;
    }

    const slots: Slot[] = [];

    // Layer 0: Bedrock grid
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        slots.push({ row: r, col: c, layer: 0, elevation: 0 });
      }
    }

    // Layer 1: Frosted glass excavation overlay tiles
    if (layers === 2) {
      // In 2-layer mode, place additional overlay tiles
      // For instance, the center 2x2 or 4 strategic positions
      const topCount = totalPairs * 2 - slots.length;
      if (topCount > 0) {
        // Candidate coordinates for layer 1 overlay
        const candidates: [number, number][] = [];
        for (let r = 1; r < rows - 1; r++) {
          for (let c = 1; c < cols - 1; c++) {
            candidates.push([r, c]);
          }
        }

        // If candidates are fewer than needed, expand to outer cells
        if (candidates.length < topCount) {
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (!candidates.some(([cr, cc]) => cr === r && cc === c)) {
                candidates.push([r, c]);
              }
            }
          }
        }

        const pickedPositions = rng.sample(candidates, topCount);
        for (const [r, c] of pickedPositions) {
          slots.push({ row: r, col: c, layer: 1, elevation: 0.18 });
        }
      }
    }

    const totalCards = slots.length;
    const requiredPairs = totalCards / 2;

    // Pick visual IDs for the required pairs
    // Cycle through ALL_CARD_VISUAL_IDS if requiredPairs exceeds length
    const selectedVisuals: CardVisualId[] = [];
    let pool = rng.shuffle(ALL_CARD_VISUAL_IDS);
    while (selectedVisuals.length < requiredPairs) {
      if (pool.length === 0) {
        pool = rng.shuffle(ALL_CARD_VISUAL_IDS);
      }
      selectedVisuals.push(pool.pop()!);
    }

    // Duplicate each visualId to create matching pairs
    const deckVisuals: CardVisualId[] = [];
    for (const visualId of selectedVisuals) {
      deckVisuals.push(visualId, visualId);
    }

    // Deterministically shuffle the card deck
    const shuffledDeck = rng.shuffle(deckVisuals);

    // Initialise cards
    const cards: CardNode[] = slots.map((slot, index) => {
      const visualId = shuffledDeck[index];
      const id = `card_${slot.layer}_${slot.row}_${slot.col}_${index}`;
      return {
        id,
        visualId,
        row: slot.row,
        col: slot.col,
        layer: slot.layer,
        isBlocked: false, // will be evaluated below
        state: 'FACE_DOWN',
        isFlipped: false,
        isMatched: false,
        elevation: slot.elevation,
      };
    });

    // Compute blocked status for 2-layer excavations
    return GridGenerator.updateGridBlockedStates(cards);
  }

  /**
   * Recalculates blocked status across all cards.
   * A layer 0 card is blocked if an unmatched layer 1 card sits directly above it at (row, col).
   */
  public static updateGridBlockedStates(cards: CardNode[]): CardNode[] {
    // Map of active (unmatched) layer 1 cards by coordinate "r,c"
    const activeTopLayerSet = new Set<string>();
    for (const card of cards) {
      if (card.layer === 1 && !card.isMatched) {
        activeTopLayerSet.add(`${card.row},${card.col}`);
      }
    }

    return cards.map((card) => {
      if (card.layer === 0) {
        const isCovered = activeTopLayerSet.has(`${card.row},${card.col}`);
        if (card.isBlocked !== isCovered) {
          return { ...card, isBlocked: isCovered };
        }
      }
      return card;
    });
  }
}
