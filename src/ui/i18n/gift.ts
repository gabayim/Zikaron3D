import { getLocale, type Locale } from './locale';

/**
 * Crystals granted by a referral claim. Kept here so the banner copy and the
 * reward stay in sync; the server value lives in the `referral-claim` function.
 */
export const GIFT_CRYSTALS = 50;

export interface GiftStrings {
  /** Banner headline. */
  title: string;
  /** Banner body shown until a claim attempt returns feedback. */
  subtitle: string;
  /** Paste button label (Android / non-iOS paste path). */
  paste: string;
  noCodeFound: string;
  giftClaimed: (crystals: number) => string;
  alreadyClaimed: string;
  claimFailed: string;
  clipboardDenied: string;
}

const EN: GiftStrings = {
  title: 'Got a link from a friend?',
  subtitle: `Paste to claim your ${GIFT_CRYSTALS} Crystal welcome gift!`,
  paste: 'Paste',
  noCodeFound: 'No gift code found in clipboard',
  giftClaimed: (crystals) => `Gift claimed! +${crystals} Crystals`,
  alreadyClaimed: 'Already claimed a referral!',
  claimFailed: 'Could not claim this code.',
  clipboardDenied: 'Clipboard access denied',
};

const HE: GiftStrings = {
  title: 'קיבלתם קישור מחבר?',
  subtitle: `הדביקו כדי לממש את מתנת ברוכים הבאים של ${GIFT_CRYSTALS} קריסטלים!`,
  paste: 'הדבק',
  noCodeFound: 'לא נמצא קוד מתנה בלוח',
  giftClaimed: (crystals) => `המתנה התקבלה! +${crystals} קריסטלים`,
  alreadyClaimed: 'כבר מימשתם מתנת חבר!',
  claimFailed: 'לא ניתן לממש את הקוד הזה.',
  clipboardDenied: 'אין גישה ללוח',
};

const GIFT_STRINGS: Record<Locale, GiftStrings> = { en: EN, he: HE };

export interface GiftCopy {
  locale: Locale;
  rtl: boolean;
  strings: GiftStrings;
}

/** Copy for the friend-gift banner in the device language. */
export function getGiftCopy(locale: Locale = getLocale()): GiftCopy {
  return { locale, rtl: locale === 'he', strings: GIFT_STRINGS[locale] };
}
