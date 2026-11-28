import { getLocale, type Locale } from './locale';

/** Shortest accepted coupon code; mirrored by the input's maxLength (16). */
export const MIN_CODE_LENGTH = 6;

export type RedeemErrorReason =
  | 'throttled'
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'used_up'
  | 'already_redeemed'
  | 'not_signed_in'
  | 'invalid_code';

export interface RedeemStrings {
  title: string;
  subtitle: string;
  placeholder: string;
  submit: string;
  rewardUnlocked: string;
  equipNow: string;
  done: string;
  minLength: (min: number) => string;
  failed: string;
  /** Fallback title for a reward type without a catalog entry. */
  item: (amount: number) => string;
  exclusiveSkin: string;
  exclusiveAccessory: string;
  crystals: (amount: number) => string;
  stardust: (amount: number) => string;
  shield: (amount: number) => string;
  errors: Record<RedeemErrorReason, string>;
}

const EN: RedeemStrings = {
  title: 'Redeem Code',
  subtitle: 'Enter a promotional code to unlock exclusive skins, accessories, or currencies.',
  placeholder: 'ENTER CODE',
  submit: 'Redeem Reward',
  rewardUnlocked: 'Reward Unlocked!',
  equipNow: 'Equip Now',
  done: 'Awesome!',
  minLength: (min) => `Code must be at least ${min} characters.`,
  failed: 'Failed to redeem. Please try again.',
  item: (amount) => `${amount}x Item`,
  exclusiveSkin: 'Exclusive Skin',
  exclusiveAccessory: 'Exclusive Accessory',
  crystals: (amount) => `${amount} Crystals`,
  stardust: (amount) => `${amount} Stardust`,
  shield: (amount) => `${amount} Shield`,
  errors: {
    throttled: 'Too many attempts! Please try again in an hour.',
    not_found: 'Invalid code. Check for typos and try again.',
    inactive: 'This coupon code is no longer active.',
    not_started: 'This coupon code is not valid yet.',
    expired: 'This coupon code has expired.',
    used_up: 'This coupon has reached its maximum redemptions.',
    already_redeemed: 'You have already redeemed this coupon!',
    not_signed_in: 'Connecting to cloud account... Please retry in a moment.',
    invalid_code: 'Please enter a valid coupon code (6-16 characters).',
  },
};

const HE: RedeemStrings = {
  title: 'מימוש קוד',
  subtitle: 'הזינו קוד מבצע כדי לפתוח סקינים, אביזרים או מטבעות בלעדיים.',
  placeholder: 'הזינו קוד',
  submit: 'מימוש הפרס',
  rewardUnlocked: 'פרס נפתח!',
  equipNow: 'ציוד עכשיו',
  done: 'מעולה!',
  minLength: (min) => `הקוד חייב להכיל לפחות ${min} תווים.`,
  failed: 'המימוש נכשל. נסו שוב.',
  item: (amount) => `${amount}× פריט`,
  exclusiveSkin: 'סקין בלעדי',
  exclusiveAccessory: 'אביזר בלעדי',
  crystals: (amount) => `${amount} קריסטלים`,
  stardust: (amount) => `${amount} אבק כוכבים`,
  shield: (amount) => `${amount} מגן`,
  errors: {
    throttled: 'יותר מדי ניסיונות! נסו שוב בעוד שעה.',
    not_found: 'קוד שגוי. בדקו שלא נפלה טעות הקלדה ונסו שוב.',
    inactive: 'קוד הקופון הזה כבר לא פעיל.',
    not_started: 'קוד הקופון הזה עדיין לא בתוקף.',
    expired: 'תוקף הקופון הזה פג.',
    used_up: 'הקופון הזה מיצה את מספר המימושים המרבי.',
    already_redeemed: 'כבר מימשתם את הקופון הזה!',
    not_signed_in: 'מתחברים לחשבון הענן... נסו שוב בעוד רגע.',
    invalid_code: 'הזינו קוד קופון תקין (6-16 תווים).',
  },
};

const REDEEM_STRINGS: Record<Locale, RedeemStrings> = { en: EN, he: HE };

export interface RedeemCopy {
  locale: Locale;
  rtl: boolean;
  strings: RedeemStrings;
}

/** Copy for the redeem-code modal in the device language. */
export function getRedeemCopy(locale: Locale = getLocale()): RedeemCopy {
  return { locale, rtl: locale === 'he', strings: REDEEM_STRINGS[locale] };
}

/** Server reasons are free-form; unknown reasons fall back to the generic error. */
export function getRedeemError(
  strings: RedeemStrings,
  reason: string | null | undefined,
): string {
  if (!reason) return strings.failed;
  return strings.errors[reason as RedeemErrorReason] ?? strings.failed;
}
