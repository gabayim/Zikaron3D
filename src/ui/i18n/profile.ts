import { getLocale, type Locale } from './locale';

/**
 * Daily-challenge reward amounts. The banner, the engine payout and the copy
 * must agree, so the numbers live here and are interpolated per language
 * rather than being baked into one string.
 */
export const DAILY_CHALLENGE_XP = 80;
export const DAILY_CHALLENGE_STARDUST = 25;

/** Critters needed to complete the collection stat. */
export const COLLECTION_TOTAL = 15;

export type ProfileSlot = 'hat' | 'skin' | 'aura' | 'trail' | 'expression';
export type ProfileMode = 'TOYBOX' | 'ARCADE' | 'SANCTUARY';

export interface ProfileStrings {
  levelBadge: (level: number) => string;
  title: string;
  characterName: string;
  noHat: string;
  classicSkin: string;
  wardrobeTitle: string;
  wardrobeSubtitle: string;
  /** Labels for the body-member tabs. */
  slots: Record<ProfileSlot, string>;
  none: string;
  equipped: string;
  equip: string;
  shop: string;
  giftsTitle: string;
  redeemCode: string;
  inviteFriends: string;
  stats: {
    stardust: string;
    crystals: string;
    critters: string;
    mode: string;
  };
  modes: Record<ProfileMode, string>;
  dailyChallenge: string;
  dailyReward: (xp: number, stardust: number) => string;
}

const EN: ProfileStrings = {
  levelBadge: (level) => `LVL ${level}`,
  title: 'PLAYER PROFILE',
  characterName: 'PIP • STAR TRAVELER',
  noHat: 'No Hat',
  classicSkin: 'Classic Pip',
  wardrobeTitle: '✦ BODY MEMBER CUSTOMIZER ✦',
  wardrobeSubtitle: 'Change your mascot gear live. Tap an item to equip it:',
  slots: {
    hat: 'HEAD',
    skin: 'SKIN',
    aura: 'AURA',
    trail: 'TRAIL',
    expression: 'FACE',
  },
  none: 'None',
  equipped: 'EQUIPPED',
  equip: 'EQUIP',
  shop: 'SHOP',
  giftsTitle: '✦ GIFTS & REWARDS ✦',
  redeemCode: 'Redeem Code',
  inviteFriends: 'Invite Friends',
  stats: {
    stardust: 'STARDUST',
    crystals: 'CRYSTALS',
    critters: 'CRITTERS',
    mode: 'MODE',
  },
  modes: {
    TOYBOX: 'TOYBOX',
    ARCADE: 'ARCADE',
    SANCTUARY: 'SANCTUARY',
  },
  dailyChallenge: 'DAILY CHALLENGE',
  dailyReward: (xp, stardust) => `Earn +${xp} XP & +${stardust} Stardust`,
};

const HE: ProfileStrings = {
  levelBadge: (level) => `רמה ${level}`,
  title: 'פרופיל שחקן',
  characterName: 'פיפ • מטייל הכוכבים',
  noHat: 'בלי כובע',
  classicSkin: 'פיפ קלאסי',
  wardrobeTitle: '✦ התאמת הדמות ✦',
  wardrobeSubtitle: 'החליפו את ציוד הדמות בזמן אמת. הקישו על פריט כדי לצייד אותו:',
  slots: {
    hat: 'ראש',
    skin: 'גוון',
    aura: 'הילה',
    trail: 'שובל',
    expression: 'פנים',
  },
  none: 'ללא',
  equipped: 'מצויד',
  equip: 'ציוד',
  shop: 'חנות',
  giftsTitle: '✦ מתנות ופרסים ✦',
  redeemCode: 'מימוש קוד',
  inviteFriends: 'הזמנת חברים',
  stats: {
    stardust: 'אבק כוכבים',
    crystals: 'קריסטלים',
    critters: 'יצורים',
    mode: 'מצב',
  },
  modes: {
    TOYBOX: 'ארגז צעצועים',
    ARCADE: 'ארקייד',
    SANCTUARY: 'מקלט',
  },
  dailyChallenge: 'אתגר יומי',
  dailyReward: (xp, stardust) => `קבלו +${xp} ניסיון ו-+${stardust} אבק כוכבים`,
};

const PROFILE_STRINGS: Record<Locale, ProfileStrings> = { en: EN, he: HE };

export interface ProfileCopy {
  locale: Locale;
  /** True when the component must mirror its rows and align text to the right. */
  rtl: boolean;
  strings: ProfileStrings;
}

/** Copy for the player profile modal in the device language. */
export function getProfileCopy(locale: Locale = getLocale()): ProfileCopy {
  return { locale, rtl: locale === 'he', strings: PROFILE_STRINGS[locale] };
}
