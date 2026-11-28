import { getStreakCopy } from '../i18n/dailyStreak';
import { isHebrewLocale } from '../i18n/locale';
import { STREAK_REWARDS } from '../../store/dailyLogin';

/** Brand names that legitimately stay in Latin script inside Hebrew copy. */
const BRAND_ALLOWLIST = [/Zikaron3D/g];

function latinRuns(text: string): string[] {
  let stripped = text;
  for (const brand of BRAND_ALLOWLIST) stripped = stripped.replace(brand, '');
  // Drop numbers and punctuation/emoji; only letter runs are copy for review.
  stripped = stripped.replace(/[\d\s\p{P}\p{S}]/gu, '');
  return stripped.match(/[A-Za-z]{3,}/g) ?? [];
}

function expectHebrewOnly(text: string, context: string) {
  expect(text).toMatch(/[\u0590-\u05FF]/);
  expect({ context, latin: latinRuns(text) }).toEqual({ context, latin: [] });
}

describe('daily streak modal copy', () => {
  it('keeps the English copy the defect reported', () => {
    const { strings } = getStreakCopy('en');
    expect(strings.streakTitle(3)).toBe('DAY 3 STREAK!');
    expect(strings.subtitle).toBe('Log in daily to earn rare rewards');
    expect(strings.dayLabel(1)).toBe('D1');
    expect(strings.todaysReward).toBe("TODAY'S REWARD");
    expect(strings.stardust(10)).toBe('+10 Stardust');
    expect(strings.crystals(5)).toBe('+5 Crystals');
    expect(strings.shield(1)).toBe('+1 Shield');
    expect(strings.claimReward).toBe('CLAIM REWARD');
  });

  it('flags Hebrew as RTL so the modal mirrors its rows', () => {
    expect(getStreakCopy('he')).toMatchObject({ locale: 'he', rtl: true });
    expect(getStreakCopy('en')).toMatchObject({ locale: 'en', rtl: false });
  });

  it('detects every Hebrew locale form the device reports', () => {
    ['he', 'he_IL', 'he-IL', 'iw_IL', 'iw'].forEach((locale) => {
      expect(isHebrewLocale(locale)).toBe(true);
    });
    ['en', 'en_US', 'en-IL', 'ar_IL'].forEach((locale) => {
      expect(isHebrewLocale(locale)).toBe(false);
    });
  });

  it('translates each fixed label of the modal', () => {
    const { strings } = getStreakCopy('he');
    expectHebrewOnly(strings.streakTitle(3), 'streakTitle');
    expectHebrewOnly(strings.subtitle, 'subtitle');
    expectHebrewOnly(strings.todaysReward, 'todaysReward');
    expectHebrewOnly(strings.claimReward, 'claimReward');
    expect(strings.subtitle).not.toBe(getStreakCopy('en').strings.subtitle);
    expect(strings.claimReward).not.toBe(getStreakCopy('en').strings.claimReward);
  });

  it('translates the singular and plural streak headline', () => {
    const { strings } = getStreakCopy('he');
    expectHebrewOnly(strings.streakTitle(1), 'streakTitle(1)');
    expectHebrewOnly(strings.streakTitle(7), 'streakTitle(7)');
    expect(strings.streakTitle(1)).not.toBe(strings.streakTitle(7));
  });

  it('translates every day node and reward amount the track renders', () => {
    const { strings } = getStreakCopy('he');
    const rendered = [
      ...STREAK_REWARDS.map((r) => strings.dayLabel(r.day)),
      ...STREAK_REWARDS.flatMap((r) => [
        strings.stardust(r.stardust),
        strings.crystals(r.crystals),
        strings.shield(r.shields),
      ]),
    ];
    rendered.forEach((text) => expectHebrewOnly(text, text));
  });

  it('keeps reward amounts and numbers intact in Hebrew', () => {
    const { strings } = getStreakCopy('he');
    expect(strings.stardust(50)).toContain('50');
    expect(strings.crystals(5)).toContain('5');
    expect(strings.shield(1)).toContain('1');
    expect(strings.dayLabel(7)).toContain('7');
  });
});
