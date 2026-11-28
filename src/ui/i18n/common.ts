import { getLocale, type Locale } from './locale';

export type StoreIssue = 'unavailable' | 'error' | 'restore';

export interface StoreIssueCopy {
  title: string;
  body: string;
}

export interface CommonStrings {
  cancel: string;
  ok: string;
  privacy: string;
  terms: string;
  support: string;
  storeIssue: Record<StoreIssue, StoreIssueCopy>;
  restoreFailed: StoreIssueCopy;
}

const EN: CommonStrings = {
  cancel: 'Cancel',
  ok: 'OK',
  privacy: 'Privacy',
  terms: 'Terms',
  support: 'Support',
  storeIssue: {
    unavailable: {
      title: 'Store unavailable',
      body: 'This item could not be loaded from the App Store right now. Please check your connection and try again later.',
    },
    error: {
      title: 'Purchase failed',
      body: 'The App Store could not complete this purchase. Please try again.',
    },
    restore: {
      title: 'Restore failed',
      body: 'We could not reach the App Store to restore your purchases. Please try again later.',
    },
  },
  restoreFailed: {
    title: 'Restore failed',
    body: 'We could not reach the App Store to restore your purchases. Please try again later.',
  },
};

const HE: CommonStrings = {
  cancel: 'ביטול',
  ok: 'אישור',
  privacy: 'פרטיות',
  terms: 'תנאים',
  support: 'תמיכה',
  storeIssue: {
    unavailable: {
      title: 'החנות אינה זמינה',
      body: 'לא ניתן היה לטעון את הפריט מ-App Store כרגע. בדקו את החיבור ונסו שוב מאוחר יותר.',
    },
    error: {
      title: 'הרכישה נכשלה',
      body: '‏App Store לא הצליח להשלים את הרכישה. נסו שוב.',
    },
    restore: {
      title: 'השחזור נכשל',
      body: 'לא הצלחנו להגיע ל-App Store כדי לשחזר את הרכישות. נסו שוב מאוחר יותר.',
    },
  },
  restoreFailed: {
    title: 'השחזור נכשל',
    body: 'לא הצלחנו להגיע ל-App Store כדי לשחזר את הרכישות. נסו שוב מאוחר יותר.',
  },
};

const COMMON_STRINGS: Record<Locale, CommonStrings> = { en: EN, he: HE };

export interface CommonCopy {
  locale: Locale;
  rtl: boolean;
  strings: CommonStrings;
}

export function getCommonCopy(locale: Locale = getLocale()): CommonCopy {
  return { locale, rtl: locale === 'he', strings: COMMON_STRINGS[locale] };
}
