import { I18nManager, NativeModules, Platform, Settings } from 'react-native';

export type Locale = 'en' | 'he';

const HEBREW_LOCALE = /^(he|iw)([-_]|$)/i;

/**
 * Resolve the preferred device locale without a native dependency.
 *
 * iOS exposes the preferred languages through the public Settings module,
 * Android through the I18nManager constants, and Intl covers everything else.
 * Every bridge read is guarded because these modules are absent in tests and
 * on some platforms.
 */
export function getDeviceLocale(): string {
  try {
    if (Platform.OS === 'ios') {
      const languages = Settings.get('AppleLanguages');
      if (Array.isArray(languages) && languages.length > 0) {
        return String(languages[0]);
      }
      const appleLocale = Settings.get('AppleLocale');
      if (typeof appleLocale === 'string') {
        return appleLocale;
      }
    } else if (Platform.OS === 'android') {
      const identifier = (NativeModules.I18nManager as { localeIdentifier?: unknown } | undefined)
        ?.localeIdentifier;
      if (typeof identifier === 'string') {
        return identifier;
      }
      const constants = I18nManager.getConstants?.();
      if (typeof constants?.localeIdentifier === 'string') {
        return constants.localeIdentifier;
      }
    }
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return 'en';
  }
}

export function isHebrewLocale(locale: string): boolean {
  return HEBREW_LOCALE.test(locale);
}

export function getLocale(): Locale {
  return isHebrewLocale(getDeviceLocale()) ? 'he' : 'en';
}

export interface StreakStrings {
  streakTitle: (streak: number) => string;
  subtitle: string;
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
  subtitle: 'התחברו כל יום כדי לזכות בפרסים נדירים',
  dayLabel: (day) => `יום ${day}`,
  todaysReward: 'הפרס של היום',
  stardust: (amount) => `+${amount} אבק כוכבים`,
  crystals: (amount) => `+${amount} קריסטלים`,
  shield: (amount) => `+${amount} מגן`,
  claimReward: 'קבלו את הפרס',
};

const STREAK_STRINGS: Record<Locale, StreakStrings> = { en: EN, he: HE };

export interface StreakCopy {
  locale: Locale;
  rtl: boolean;
  strings: StreakStrings;
}

export function getStreakCopy(locale: Locale = getLocale()): StreakCopy {
  return { locale, rtl: locale === 'he', strings: STREAK_STRINGS[locale] };
}
