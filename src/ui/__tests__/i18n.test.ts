import { getStreakCopy, isHebrewLocale } from '../i18n';

describe('ui i18n', () => {
  it('detects Hebrew locales in their common forms', () => {
    expect(isHebrewLocale('he')).toBe(true);
    expect(isHebrewLocale('he_IL')).toBe(true);
    expect(isHebrewLocale('he-IL')).toBe(true);
    expect(isHebrewLocale('iw_IL')).toBe(true);
  });

  it('does not treat other locales as Hebrew', () => {
    expect(isHebrewLocale('en_US')).toBe(false);
    expect(isHebrewLocale('ar_IL')).toBe(false);
    expect(isHebrewLocale('')).toBe(false);
  });

  it('returns Hebrew streak copy with RTL enabled', () => {
    const copy = getStreakCopy('he');
    expect(copy.rtl).toBe(true);
    expect(copy.strings.claimReward).toBe('קבלו את הפרס');
    expect(copy.strings.streakTitle(3)).toContain('3');
    expect(copy.strings.stardust(10)).toContain('אבק כוכבים');
  });

  it('returns English streak copy with LTR layout', () => {
    const copy = getStreakCopy('en');
    expect(copy.rtl).toBe(false);
    expect(copy.strings.claimReward).toBe('CLAIM REWARD');
    expect(copy.strings.stardust(10)).toBe('+10 Stardust');
  });
});
