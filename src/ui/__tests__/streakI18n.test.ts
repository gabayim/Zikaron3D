import { getStreakCopy } from '../i18n/streak';
import { getLocale, isHebrewLocale } from '../i18n/locale';
import { STREAK_REWARDS } from '../../store/dailyLogin';

const HEBREW = /[\u0590-\u05FF]/;

/** Strips digits, punctuation and symbols so only letters remain. */
const wordsOnly = (text: string): string =>
  text.replace(/[\d+×•✦]/g, ' ').replace(/[^\p{L}\s]/gu, ' ');

const expectNoUntranslatedEnglish = (text: string) => {
  expect(text).toMatch(HEBREW);
  expect(wordsOnly(text)).not.toMatch(/[A-Za-z]{2,}/);
};

describe('daily streak modal i18n', () => {
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

  it('resolves a locale without a native bridge', () => {
    expect(['en', 'he']).toContain(getLocale());
  });

  it('translates every visible string and flags RTL under Hebrew', () => {
    const { strings, rtl } = getStreakCopy('he');
    expect(rtl).toBe(true);
    expect(strings.streakTitle(3)).toBe('רצף של 3 ימים!');
    expect(strings.subtitle).toBe('התחברו בכל יום כדי לזכות בפרסים נדירים');
    expect(strings.todaysReward).toBe('הפרס של היום');
    expect(strings.claimReward).toBe('מימוש הפרס');

    const visible = [
      strings.streakTitle(3),
      strings.subtitle,
      strings.todaysReward,
      strings.claimReward,
      ...STREAK_REWARDS.map((reward) => strings.dayLabel(reward.day)),
      strings.stardust(25),
      strings.crystals(5),
      strings.shield(1),
    ];
    for (const text of visible) expectNoUntranslatedEnglish(text);

    expect(strings.stardust(25)).toContain('25');
    expect(strings.crystals(5)).toContain('5');
    expect(strings.shield(1)).toContain('1');
  });

  it('keeps the English copy with LTR layout', () => {
    const { strings, rtl } = getStreakCopy('en');
    expect(rtl).toBe(false);
    expect(strings.streakTitle(3)).toBe('DAY 3 STREAK!');
    expect(strings.subtitle).toBe('Log in daily to earn rare rewards');
    expect(strings.dayLabel(1)).toBe('D1');
    expect(strings.todaysReward).toBe("TODAY'S REWARD");
    expect(strings.stardust(25)).toBe('+25 Stardust');
    expect(strings.crystals(5)).toBe('+5 Crystals');
    expect(strings.shield(1)).toBe('+1 Shield');
    expect(strings.claimReward).toBe('CLAIM REWARD');
  });
});
