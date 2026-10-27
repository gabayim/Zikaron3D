export type WorldId = 'meadow' | 'crystal' | 'candy';

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
  },
  {
    id: 'crystal',
    still: require('../assets/worlds/crystal/still.webp'),
    music: require('../assets/audio/music/crystal.m4a'),
    accent: '#7FE8FF',
    accent2: '#B48CFF',
    residents: ['frost', 'grumble', 'dusk'],
    unlockLevel: 3,
  },
  {
    id: 'candy',
    still: require('../assets/worlds/candy/still.webp'),
    music: require('../assets/audio/music/candy.m4a'),
    accent: '#FF8FD0',
    accent2: '#8CFFC1',
    residents: ['zap', 'nutty', 'ember'],
    unlockLevel: 5,
  },
];

export function getWorld(id: WorldId): WorldDef {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}

export function isWorldUnlocked(id: WorldId, level: number): boolean {
  return level >= getWorld(id).unlockLevel;
}
