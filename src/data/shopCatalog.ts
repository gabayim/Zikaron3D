import type { CreatureId } from '../store/profile';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type AccessorySlot = 'hat' | 'trail' | 'aura' | 'expression';

export interface SkinDef {
  id: string;
  creatureId: CreatureId;
  name: string;
  rarity: Rarity;
  palette: {
    primary: string;
    secondary: string;
    glow: string;
  };
  priceStardust: number | null;
  priceCrystals: number | null;
}

export interface AccessoryDef {
  id: string;
  slot: AccessorySlot;
  name: string;
  rarity: Rarity;
  priceStardust: number | null;
  priceCrystals: number | null;
  color: string;
}

// 18 Common (2 per creature @ 200 Stardust) + 9 Rare (1 per creature @ 75 Crystals) + 9 Epic (1 per creature @ 150 Crystals)
export const SKIN_CATALOG: SkinDef[] = [
  // PIP
  {
    id: 'pip_snow',
    creatureId: 'pip',
    name: 'Snow Pip',
    rarity: 'common',
    palette: { primary: '#E2E8F0', secondary: '#94A3B8', glow: '#F8FAFC' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'pip_sunset',
    creatureId: 'pip',
    name: 'Sunset Pip',
    rarity: 'common',
    palette: { primary: '#F43F5E', secondary: '#FB7185', glow: '#FDA4AF' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'pip_chrome',
    creatureId: 'pip',
    name: 'Chrome Pip',
    rarity: 'rare',
    palette: { primary: '#94A3B8', secondary: '#CBD5E1', glow: '#38BDF8' },
    priceStardust: null,
    priceCrystals: 75,
  },
  {
    id: 'pip_starfire',
    creatureId: 'pip',
    name: 'Starfire Pip',
    rarity: 'epic',
    palette: { primary: '#F59E0B', secondary: '#EF4444', glow: '#FDE047' },
    priceStardust: null,
    priceCrystals: 150,
  },

  // BLOOP
  {
    id: 'bloop_lime',
    creatureId: 'bloop',
    name: 'Lime Bloop',
    rarity: 'common',
    palette: { primary: '#84CC16', secondary: '#A3E635', glow: '#BEF264' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'bloop_rose',
    creatureId: 'bloop',
    name: 'Rose Bloop',
    rarity: 'common',
    palette: { primary: '#FB7185', secondary: '#FDA4AF', glow: '#FFE4E6' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'bloop_crystal',
    creatureId: 'bloop',
    name: 'Crystal Bloop',
    rarity: 'rare',
    palette: { primary: '#06B6D4', secondary: '#67E8F9', glow: '#A5F3FC' },
    priceStardust: null,
    priceCrystals: 75,
  },
  {
    id: 'bloop_nebula',
    creatureId: 'bloop',
    name: 'Nebula Bloop',
    rarity: 'epic',
    palette: { primary: '#8B5CF6', secondary: '#EC4899', glow: '#C084FC' },
    priceStardust: null,
    priceCrystals: 150,
  },

  // FUZZ
  {
    id: 'fuzz_mint',
    creatureId: 'fuzz',
    name: 'Mint Fuzz',
    rarity: 'common',
    palette: { primary: '#10B981', secondary: '#6EE7B7', glow: '#A7F3D0' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'fuzz_gold',
    creatureId: 'fuzz',
    name: 'Gold Fuzz',
    rarity: 'common',
    palette: { primary: '#F59E0B', secondary: '#FCD34D', glow: '#FEF08A' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'fuzz_velvet',
    creatureId: 'fuzz',
    name: 'Velvet Fuzz',
    rarity: 'rare',
    palette: { primary: '#BE185D', secondary: '#F472B6', glow: '#FBCFE8' },
    priceStardust: null,
    priceCrystals: 75,
  },
  {
    id: 'fuzz_aurora',
    creatureId: 'fuzz',
    name: 'Aurora Fuzz',
    rarity: 'epic',
    palette: { primary: '#14B8A6', secondary: '#818CF8', glow: '#2DD4BF' },
    priceStardust: null,
    priceCrystals: 150,
  },

  // NUTTY
  {
    id: 'nutty_red',
    creatureId: 'nutty',
    name: 'Red Nutty',
    rarity: 'common',
    palette: { primary: '#DC2626', secondary: '#EF4444', glow: '#FCA5A5' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'nutty_silver',
    creatureId: 'nutty',
    name: 'Silver Nutty',
    rarity: 'common',
    palette: { primary: '#94A3B8', secondary: '#CBD5E1', glow: '#E2E8F0' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'nutty_bronze',
    creatureId: 'nutty',
    name: 'Bronze Nutty',
    rarity: 'rare',
    palette: { primary: '#B45309', secondary: '#D97706', glow: '#FBBF24' },
    priceStardust: null,
    priceCrystals: 75,
  },
  {
    id: 'nutty_diamond',
    creatureId: 'nutty',
    name: 'Diamond Nutty',
    rarity: 'epic',
    palette: { primary: '#38BDF8', secondary: '#BAE6FD', glow: '#E0F2FE' },
    priceStardust: null,
    priceCrystals: 150,
  },

  // ZAP
  {
    id: 'zap_green',
    creatureId: 'zap',
    name: 'Green Zap',
    rarity: 'common',
    palette: { primary: '#22C55E', secondary: '#4ADE80', glow: '#86EFAC' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'zap_purple',
    creatureId: 'zap',
    name: 'Purple Zap',
    rarity: 'common',
    palette: { primary: '#A855F7', secondary: '#C084FC', glow: '#E9D5FF' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'zap_neon',
    creatureId: 'zap',
    name: 'Neon Zap',
    rarity: 'rare',
    palette: { primary: '#EAB308', secondary: '#FEF08A', glow: '#FACC15' },
    priceStardust: null,
    priceCrystals: 75,
  },
  {
    id: 'zap_lightning',
    creatureId: 'zap',
    name: 'Lightning Zap',
    rarity: 'epic',
    palette: { primary: '#0EA5E9', secondary: '#FDE047', glow: '#67E8F9' },
    priceStardust: null,
    priceCrystals: 150,
  },

  // GRUMBLE
  {
    id: 'grumble_teal',
    creatureId: 'grumble',
    name: 'Teal Grumble',
    rarity: 'common',
    palette: { primary: '#0D9488', secondary: '#2DD4BF', glow: '#99F6E4' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'grumble_rust',
    creatureId: 'grumble',
    name: 'Rust Grumble',
    rarity: 'common',
    palette: { primary: '#C2410C', secondary: '#EA580C', glow: '#FDBA74' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'grumble_obsidian',
    creatureId: 'grumble',
    name: 'Obsidian Grumble',
    rarity: 'rare',
    palette: { primary: '#1E293B', secondary: '#334155', glow: '#818CF8' },
    priceStardust: null,
    priceCrystals: 75,
  },
  {
    id: 'grumble_volcano',
    creatureId: 'grumble',
    name: 'Volcanic Grumble',
    rarity: 'epic',
    palette: { primary: '#991B1B', secondary: '#F97316', glow: '#FDE047' },
    priceStardust: null,
    priceCrystals: 150,
  },

  // FROST
  {
    id: 'frost_pink',
    creatureId: 'frost',
    name: 'Pink Frost',
    rarity: 'common',
    palette: { primary: '#EC4899', secondary: '#F472B6', glow: '#FCE7F3' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'frost_black',
    creatureId: 'frost',
    name: 'Black Frost',
    rarity: 'common',
    palette: { primary: '#0F172A', secondary: '#38BDF8', glow: '#7DD3FC' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'frost_sapphire',
    creatureId: 'frost',
    name: 'Sapphire Frost',
    rarity: 'rare',
    palette: { primary: '#2563EB', secondary: '#60A5FA', glow: '#93C5FD' },
    priceStardust: null,
    priceCrystals: 75,
  },
  {
    id: 'frost_blizzard',
    creatureId: 'frost',
    name: 'Blizzard Frost',
    rarity: 'epic',
    palette: { primary: '#E0F2FE', secondary: '#BAE6FD', glow: '#FFFFFF' },
    priceStardust: null,
    priceCrystals: 150,
  },

  // EMBER
  {
    id: 'ember_blue',
    creatureId: 'ember',
    name: 'Blue Ember',
    rarity: 'common',
    palette: { primary: '#3B82F6', secondary: '#60A5FA', glow: '#93C5FD' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'ember_white',
    creatureId: 'ember',
    name: 'White Ember',
    rarity: 'common',
    palette: { primary: '#F8FAFC', secondary: '#F59E0B', glow: '#FEF08A' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'ember_ruby',
    creatureId: 'ember',
    name: 'Ruby Ember',
    rarity: 'rare',
    palette: { primary: '#E11D48', secondary: '#FB7185', glow: '#FECDD3' },
    priceStardust: null,
    priceCrystals: 75,
  },
  {
    id: 'ember_inferno',
    creatureId: 'ember',
    name: 'Inferno Ember',
    rarity: 'epic',
    palette: { primary: '#7F1D1D', secondary: '#EF4444', glow: '#F59E0B' },
    priceStardust: null,
    priceCrystals: 150,
  },

  // DUSK
  {
    id: 'dusk_dawn',
    creatureId: 'dusk',
    name: 'Dawn Dusk',
    rarity: 'common',
    palette: { primary: '#F472B6', secondary: '#FBBF24', glow: '#FDE68A' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'dusk_void',
    creatureId: 'dusk',
    name: 'Void Dusk',
    rarity: 'common',
    palette: { primary: '#1E1B4B', secondary: '#4338CA', glow: '#818CF8' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'dusk_moonstone',
    creatureId: 'dusk',
    name: 'Moonstone Dusk',
    rarity: 'rare',
    palette: { primary: '#6366F1', secondary: '#A5B4FC', glow: '#E0E7FF' },
    priceStardust: null,
    priceCrystals: 75,
  },
  {
    id: 'dusk_eclipse',
    creatureId: 'dusk',
    name: 'Eclipse Dusk',
    rarity: 'epic',
    palette: { primary: '#312E81', secondary: '#F59E0B', glow: '#FBBF24' },
    priceStardust: null,
    priceCrystals: 150,
  },

  // CORAL
  {
    id: 'coral_pearl',
    creatureId: 'coral',
    name: 'Pearl Coral',
    rarity: 'common',
    palette: { primary: '#FFF1F2', secondary: '#FDA4AF', glow: '#FECDD3' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'coral_abyss',
    creatureId: 'coral',
    name: 'Abyss Coral',
    rarity: 'rare',
    palette: { primary: '#0F172A', secondary: '#38BDF8', glow: '#7DD3FC' },
    priceStardust: null,
    priceCrystals: 75,
  },
  {
    id: 'coral_biolum',
    creatureId: 'coral',
    name: 'Bioluminescent Coral',
    rarity: 'epic',
    palette: { primary: '#06B6D4', secondary: '#EC4899', glow: '#F43F5E' },
    priceStardust: null,
    priceCrystals: 150,
  },

  // MOSS
  {
    id: 'moss_autumn',
    creatureId: 'moss',
    name: 'Autumn Moss',
    rarity: 'common',
    palette: { primary: '#D97706', secondary: '#B45309', glow: '#FDE68A' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'moss_sakura',
    creatureId: 'moss',
    name: 'Sakura Moss',
    rarity: 'rare',
    palette: { primary: '#F472B6', secondary: '#FB7185', glow: '#FBCFE8' },
    priceStardust: null,
    priceCrystals: 75,
  },
  {
    id: 'moss_ancient',
    creatureId: 'moss',
    name: 'Ancient Moss',
    rarity: 'epic',
    palette: { primary: '#064E3B', secondary: '#10B981', glow: '#6EE7B7' },
    priceStardust: null,
    priceCrystals: 150,
  },

  // BOLT
  {
    id: 'bolt_silver',
    creatureId: 'bolt',
    name: 'Silver Bolt',
    rarity: 'common',
    palette: { primary: '#94A3B8', secondary: '#64748B', glow: '#E2E8F0' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'bolt_plasma',
    creatureId: 'bolt',
    name: 'Plasma Bolt',
    rarity: 'rare',
    palette: { primary: '#8B5CF6', secondary: '#A78BFA', glow: '#C4B5FD' },
    priceStardust: null,
    priceCrystals: 75,
  },
  {
    id: 'bolt_overcharge',
    creatureId: 'bolt',
    name: 'Overcharge Bolt',
    rarity: 'epic',
    palette: { primary: '#00F0FF', secondary: '#F59E0B', glow: '#FDE047' },
    priceStardust: null,
    priceCrystals: 150,
  },

  // LUNA
  {
    id: 'luna_twilight',
    creatureId: 'luna',
    name: 'Twilight Luna',
    rarity: 'common',
    palette: { primary: '#4C1D95', secondary: '#7C3AED', glow: '#DDD6FE' },
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'luna_starlight',
    creatureId: 'luna',
    name: 'Starlight Luna',
    rarity: 'rare',
    palette: { primary: '#38BDF8', secondary: '#C084FC', glow: '#E0E7FF' },
    priceStardust: null,
    priceCrystals: 75,
  },
  {
    id: 'luna_celestial',
    creatureId: 'luna',
    name: 'Celestial Luna',
    rarity: 'epic',
    palette: { primary: '#EC4899', secondary: '#8B5CF6', glow: '#F472B6' },
    priceStardust: null,
    priceCrystals: 150,
  },

  // NOVA
  {
    id: 'nova_pulsar',
    creatureId: 'nova',
    name: 'Pulsar Nova',
    rarity: 'epic',
    palette: { primary: '#6366F1', secondary: '#EC4899', glow: '#A5B4FC' },
    priceStardust: null,
    priceCrystals: 180,
  },
  {
    id: 'nova_supernova',
    creatureId: 'nova',
    name: 'Supernova',
    rarity: 'legendary',
    palette: { primary: '#F43F5E', secondary: '#FBBF24', glow: '#FFFFFF' },
    priceStardust: null,
    priceCrystals: null,
  },

  // TITAN
  {
    id: 'titan_obsidian',
    creatureId: 'titan',
    name: 'Obsidian Titan',
    rarity: 'epic',
    palette: { primary: '#18181B', secondary: '#D4AF37', glow: '#FBBF24' },
    priceStardust: null,
    priceCrystals: 180,
  },
  {
    id: 'titan_gilded',
    creatureId: 'titan',
    name: 'Gilded Titan',
    rarity: 'legendary',
    palette: { primary: '#D4AF37', secondary: '#F59E0B', glow: '#FEF08A' },
    priceStardust: null,
    priceCrystals: null,
  },
];

export const ACCESSORY_CATALOG: AccessoryDef[] = [
  // HATS
  {
    id: 'hat_crown',
    slot: 'hat',
    name: 'Golden Crown',
    rarity: 'epic',
    priceStardust: null,
    priceCrystals: 120,
    color: '#F59E0B',
  },
  {
    id: 'hat_tophat',
    slot: 'hat',
    name: 'Top Hat',
    rarity: 'rare',
    priceStardust: 400,
    priceCrystals: null,
    color: '#1E293B',
  },
  {
    id: 'hat_pirate',
    slot: 'hat',
    name: 'Pirate Hat',
    rarity: 'rare',
    priceStardust: null,
    priceCrystals: 60,
    color: '#831843',
  },
  {
    id: 'hat_flowercrown',
    slot: 'hat',
    name: 'Flower Crown',
    rarity: 'common',
    priceStardust: 250,
    priceCrystals: null,
    color: '#EC4899',
  },
  {
    id: 'hat_viking',
    slot: 'hat',
    name: 'Viking Horns',
    rarity: 'rare',
    priceStardust: 450,
    priceCrystals: 50,
    color: '#78716C',
  },

  // TRAILS
  {
    id: 'trail_rainbow',
    slot: 'trail',
    name: 'Rainbow Trail',
    rarity: 'epic',
    priceStardust: null,
    priceCrystals: 100,
    color: '#A855F7',
  },
  {
    id: 'trail_sparkle',
    slot: 'trail',
    name: 'Sparkle Trail',
    rarity: 'common',
    priceStardust: 150,
    priceCrystals: null,
    color: '#FDE047',
  },
  {
    id: 'trail_fire',
    slot: 'trail',
    name: 'Fire Trail',
    rarity: 'rare',
    priceStardust: null,
    priceCrystals: 80,
    color: '#EF4444',
  },
  {
    id: 'trail_snow',
    slot: 'trail',
    name: 'Snowflake Trail',
    rarity: 'common',
    priceStardust: 200,
    priceCrystals: null,
    color: '#BAE6FD',
  },
  {
    id: 'trail_star',
    slot: 'trail',
    name: 'Stardust Trail',
    rarity: 'rare',
    priceStardust: 350,
    priceCrystals: 40,
    color: '#FBBF24',
  },

  // AURAS
  {
    id: 'aura_goldenglow',
    slot: 'aura',
    name: 'Golden Radiance',
    rarity: 'epic',
    priceStardust: null,
    priceCrystals: 130,
    color: '#F59E0B',
  },
  {
    id: 'aura_icecrystals',
    slot: 'aura',
    name: 'Ice Crystal Aura',
    rarity: 'rare',
    priceStardust: null,
    priceCrystals: 70,
    color: '#38BDF8',
  },
  {
    id: 'aura_hearts',
    slot: 'aura',
    name: 'Floating Hearts',
    rarity: 'common',
    priceStardust: 250,
    priceCrystals: null,
    color: '#F43F5E',
  },
  {
    id: 'aura_fireflies',
    slot: 'aura',
    name: 'Firefly Swarm',
    rarity: 'common',
    priceStardust: 200,
    priceCrystals: null,
    color: '#A3E635',
  },
  {
    id: 'aura_storm',
    slot: 'aura',
    name: 'Mini Thundercloud',
    rarity: 'rare',
    priceStardust: 400,
    priceCrystals: 50,
    color: '#64748B',
  },

  // EXPRESSIONS
  {
    id: 'expr_sunglasses',
    slot: 'expression',
    name: 'Cool Shades',
    rarity: 'rare',
    priceStardust: 300,
    priceCrystals: 35,
    color: '#0F172A',
  },
  {
    id: 'expr_blush',
    slot: 'expression',
    name: 'Rosy Cheeks',
    rarity: 'common',
    priceStardust: 100,
    priceCrystals: null,
    color: '#FB7185',
  },
  {
    id: 'expr_sleepy',
    slot: 'expression',
    name: 'Sleepy Dreamer',
    rarity: 'common',
    priceStardust: 120,
    priceCrystals: null,
    color: '#818CF8',
  },
  {
    id: 'expr_hearteyes',
    slot: 'expression',
    name: 'Heart Eyes',
    rarity: 'rare',
    priceStardust: null,
    priceCrystals: 45,
    color: '#E11D48',
  },
  {
    id: 'expr_starry',
    slot: 'expression',
    name: 'Star Eyes',
    rarity: 'epic',
    priceStardust: null,
    priceCrystals: 90,
    color: '#FBBF24',
  },
];

export function getSkinDef(id: string): SkinDef | undefined {
  return SKIN_CATALOG.find((s) => s.id === id);
}

export const getSkinById = getSkinDef;
export const getAccessoryById = getAccessoryDef;

export function getAccessoryDef(id: string): AccessoryDef | undefined {
  return ACCESSORY_CATALOG.find((a) => a.id === id);
}

export function getSkinsForCreature(creatureId: CreatureId): SkinDef[] {
  return SKIN_CATALOG.filter((s) => s.creatureId === creatureId);
}

export function getAccessoriesBySlot(slot: AccessorySlot): AccessoryDef[] {
  return ACCESSORY_CATALOG.filter((a) => a.slot === slot);
}
