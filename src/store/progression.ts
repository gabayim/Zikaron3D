/** XP curve intentionally eases the first few levels, then leaves long-term room for mastery. */
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 80)) + 1;
}

export function xpForLevel(level: number): number {
  return Math.max(0, (level - 1) * (level - 1) * 80);
}

/** Fraction of progress through the current level, for an icon-only XP ring. */
export function levelProgress(xp: number): number {
  const level = levelForXp(xp);
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  return Math.max(0, Math.min(1, (xp - start) / (end - start)));
}
