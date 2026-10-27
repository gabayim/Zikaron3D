import { CAST } from './castRegistry';

export type ClipName = string;

export interface ClipInfo {
  frames: number;
  cols: number;
  rows: number;
  loop: boolean;
  /** Atlas cell rect in logical frame pixels; may extend past the frame. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CharacterSheet {
  frameWidth: number;
  frameHeight: number;
  fps: number;
  /** Clip order defines the numeric clip index used on the UI thread. Index 0 must be the idle loop. */
  order: ClipName[];
  clips: Record<ClipName, ClipInfo>;
  sources: Record<ClipName, number>;
}

export const PIP: CharacterSheet = CAST.pip;

export function getCharacter(id: string): CharacterSheet {
  const sheet = CAST[id];
  if (!sheet) throw new Error(`Unknown character: ${id}`);
  return sheet;
}
