import { getLocale, type Locale } from './locale';

export interface StreakStrings {
  /** Header headline, e.g. "DAY 3 STREAK!". */
  streakTitle: (streak: number) => string;
  subtitle: string;
  /** Compact label under each node of the 7-day track. */
  dayLabel: (day: number) => string;
  todaysReward: string;
  stardust: (amount: number) => string;
  crystals: (amount: number) => string;
  shield: (amount: number) => string;
  claimReward: string;
}

const EN: StreakStrings = {
  streakTitle: (streak) => `DAY ${streak} STREAK!`,
  subtitle: 'Log in daily to earn rare rewards',
  dayLabel: (day) => `D${day}`,
  todaysReward: "TODAY'S REWARD",
  stardust: (amount) => `+${amount} Stardust`,
  crystals: (amount) => `+${amount} Crystals`,
  shield: (amount) => `+${amount} Shield`,
  claimReward: 'CLAIM REWARD',
};

const HE: StreakStrings = {
  streakTitle: (streak) => `רצף של ${streak} ימים!`,
  subtitle: 'התחברו בכל יום כדי לזכות בפרסים נדירים',
  dayLabel: (day) => `יום ${day}`,
  todaysReward: 'הפרס של היום',
  stardust: (amount) => `+${amount} אבק כוכבים`,
  crystals: (amount) => `+${amount} קריסטלים`,
  shield: (amount) => `+${amount} מגן`,
  claimReward: 'מימוש הפרס',
};

const STREAK_STRINGS: Record<Locale, StreakStrings> = { en: EN, he: HE };

export interface StreakCopy {
  locale: Locale;
  /** True when the component must mirror its rows and align text to the right. */
  rtl: boolean;
  strings: StreakStrings;
}

/** Copy for the daily-streak modal in the device language. */
export function getStreakCopy(locale: Locale = getLocale()): StreakCopy {
  return { locale, rtl: locale === 'he', strings: STREAK_STRINGS[locale] };
}
