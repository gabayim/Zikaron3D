import { getLocale, type Locale } from './locale';

export interface CurrencyStrings {
  stardust: string;
  crystals: string;
  openShop: string;
}

const EN: CurrencyStrings = {
  stardust: 'Stardust',
  crystals: 'Crystals',
  openShop: 'Open the shop',
};

const HE: CurrencyStrings = {
  stardust: 'אבק כוכבים',
  crystals: 'קריסטלים',
  openShop: 'פתיחת החנות',
};

const CURRENCY_STRINGS: Record<Locale, CurrencyStrings> = { en: EN, he: HE };

export interface CurrencyCopy {
  locale: Locale;
  rtl: boolean;
  strings: CurrencyStrings;
}

export function getCurrencyCopy(locale: Locale = getLocale()): CurrencyCopy {
  return { locale, rtl: locale === 'he', strings: CURRENCY_STRINGS[locale] };
}
