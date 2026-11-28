import { getLocale, type Locale } from './locale';

export interface SplashStrings {
  stageReady: string;
  level: (level: number) => string;
}

const EN: SplashStrings = {
  stageReady: 'STAGE READY',
  level: (level) => `LEVEL ${level}`,
};

const HE: SplashStrings = {
  stageReady: 'השלב מוכן',
  level: (level) => `שלב ${level}`,
};

const SPLASH_STRINGS: Record<Locale, SplashStrings> = { en: EN, he: HE };

export interface SplashCopy {
  locale: Locale;
  rtl: boolean;
  strings: SplashStrings;
}

/** Copy for the level splash overlay in the device language. */
export function getSplashCopy(locale: Locale = getLocale()): SplashCopy {
  return { locale, rtl: locale === 'he', strings: SPLASH_STRINGS[locale] };
}
