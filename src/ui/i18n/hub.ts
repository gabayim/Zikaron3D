import { getLocale, type Locale } from './locale';

export interface HubStrings {
  unlockTitle: (worldName: string) => string;
  unlockBody: string;
  stardustCost: (amount: string | number) => string;
  crystalsCost: (amount: string | number) => string;
  cancel: string;
}

const EN: HubStrings = {
  unlockTitle: (worldName) => `UNLOCK ${worldName}?`,
  unlockBody: 'Unlock this portal now to play new games and meet exclusive critters!',
  stardustCost: (amount) => `★ ${amount} STARDUST`,
  crystalsCost: (amount) => `💎 ${amount} CRYSTALS`,
  cancel: 'CANCEL',
};

const HE: HubStrings = {
  unlockTitle: (worldName) => `לפתוח את ${worldName}?`,
  unlockBody: 'פתחו את השער עכשיו כדי לשחק במשחקים חדשים ולפגוש יצורים בלעדיים!',
  stardustCost: (amount) => `★ ${amount} אבק כוכבים`,
  crystalsCost: (amount) => `💎 ${amount} קריסטלים`,
  cancel: 'ביטול',
};

const HUB_STRINGS: Record<Locale, HubStrings> = { en: EN, he: HE };

export interface HubCopy {
  locale: Locale;
  rtl: boolean;
  strings: HubStrings;
}

export function getHubCopy(locale: Locale = getLocale()): HubCopy {
  return { locale, rtl: locale === 'he', strings: HUB_STRINGS[locale] };
}
