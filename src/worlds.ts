export type WorldId = 'meadow' | 'crystal' | 'candy' | 'deep_sea' | 'grove' | 'circuit' | 'summit';

export interface WorldDef {
  id: WorldId;
  still: number;
  music: number;
  /** Primary accent for portal glow and UI tint. */
  accent: string;
  /** Secondary accent. */
  accent2: string;
  /** Characters that live in this world (ids from the cast registry). */
  residents: string[];
  /** Player level (from XP) at which the portal opens. */
  unlockLevel: number;
  /** Stardust required to unlock (null if free or crystal-only) */
  priceStardust: number | null;
  /** Crystals required to unlock (null if free or stardust-only) */
  priceCrystals: number | null;
}

export const WORLDS: WorldDef[] = [
  {
    id: 'meadow',
    still: require('../assets/worlds/meadow/still.webp'),
    music: require('../assets/audio/music/meadow.m4a'),
    accent: '#FFB86B',
    accent2: '#FF7AC8',
    residents: ['pip', 'bloop', 'fuzz'],
    unlockLevel: 1,
    priceStardust: null,
    priceCrystals: null,
  },
  {
    id: 'crystal',
    still: require('../assets/worlds/crystal/still.webp'),
    music: require('../assets/audio/music/crystal.m4a'),
    accent: '#7FE8FF',
    accent2: '#B48CFF',
    residents: ['frost', 'grumble', 'dusk'],
    unlockLevel: 3,
    priceStardust: 200,
    priceCrystals: null,
  },
  {
    id: 'candy',
    still: require('../assets/worlds/candy/still.webp'),
    music: require('../assets/audio/music/candy.m4a'),
    accent: '#FF8FD0',
    accent2: '#8CFFC1',
    residents: ['zap', 'nutty', 'ember'],
    unlockLevel: 5,
    priceStardust: 800,
    priceCrystals: null,
  },
  {
    id: 'deep_sea',
    still: require('../assets/worlds/deep_sea/still.webp'),
    music: require('../assets/audio/music/deep_sea.m4a'),
    accent: '#FF7F9F',
    accent2: '#48CAE4',
    residents: ['coral'],
    unlockLevel: 7,
    priceStardust: 1200,
    priceCrystals: null,
  },
  {
    id: 'grove',
    still: require('../assets/worlds/grove/still.webp'),
    music: require('../assets/audio/music/grove.m4a'),
    accent: '#7FBF5F',
    accent2: '#F4A261',
    residents: ['moss'],
    unlockLevel: 10,
    priceStardust: 1800,
    priceCrystals: 40,
  },
  {
    id: 'circuit',
    still: require('../assets/worlds/circuit/still.webp'),
    music: require('../assets/audio/music/circuit.m4a'),
    accent: '#FFB833',
    accent2: '#00F0FF',
    residents: ['bolt'],
    unlockLevel: 15,
    priceStardust: null,
    priceCrystals: 75,
  },
  {
    id: 'summit',
    still: require('../assets/worlds/summit/still.webp'),
    music: require('../assets/audio/music/summit.m4a'),
    accent: '#C7A8FF',
    accent2: '#FFD700',
    residents: ['luna', 'nova', 'titan'],
    unlockLevel: 20,
    priceStardust: null,
    priceCrystals: 150,
  },
];

export function getWorld(id: WorldId): WorldDef {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}

export function isWorldUnlocked(id: WorldId, unlockedList?: WorldId[]): boolean {
  if (id === 'meadow') return true;
  if (unlockedList) return unlockedList.includes(id);
  return false;
}
