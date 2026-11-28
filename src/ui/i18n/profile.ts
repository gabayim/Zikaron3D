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

export type ProfileSlot = 'hat' | 'skin' | 'aura' | 'trail';
export type ProfileMode = 'TOYBOX' | 'ARCADE' | 'SANCTUARY';

export interface ProfileStrings {
  levelBadge: (level: number) => string;
  title: string;
  characterName: string;
  namePlaceholder: string;
  noHat: string;
  classicSkin: string;
  wardrobeTitle: string;
  wardrobeSubtitle: string;
  myAssetsTitle: string;
  myAssetsSubtitle: string;
  emptyAssetsTitle: string;
  emptyAssetsSub: string;
  goToShop: string;
  /** Labels for the body-member tabs. */
  slots: Record<ProfileSlot, string>;
  none: string;
  remove: string;
  equipped: string;
  equip: string;
  shop: string;
  soundTitle: string;
  musicOn: string;
  musicOff: string;
  sfxOn: string;
  sfxOff: string;
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
  namePlaceholder: 'Character name',
  noHat: 'No Hat',
  classicSkin: 'Classic Pip',
  wardrobeTitle: '✦ BODY MEMBER CUSTOMIZER ✦',
  wardrobeSubtitle: 'Change your mascot gear live. Tap an item to equip it:',
  myAssetsTitle: '✦ MY ASSETS ✦',
  myAssetsSubtitle: 'Tap to equip or remove (1 item per area):',
  emptyAssetsTitle: 'No assets yet',
  emptyAssetsSub: 'Buy hats, skins, auras, or trails in the Shop to customize your character!',
  goToShop: 'GO TO SHOP',
  slots: {
    hat: 'HEAD',
    skin: 'SKIN',
    aura: 'AURA',
    trail: 'TRAIL',
  },
  none: 'None',
  remove: 'REMOVE',
  equipped: 'EQUIPPED',
  equip: 'EQUIP',
  shop: 'SHOP',
  soundTitle: '✦ SOUND & AUDIO ✦',
  musicOn: 'Music: ON',
  musicOff: 'Music: OFF',
  sfxOn: 'Effects: ON',
  sfxOff: 'Effects: OFF',
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
  namePlaceholder: 'שם הדמות',
  noHat: 'בלי כובע',
  classicSkin: 'פיפ קלאסי',
  wardrobeTitle: '✦ התאמת הדמות ✦',
  wardrobeSubtitle: 'החליפו את ציוד הדמות בזמן אמת. הקישו על פריט כדי לצייד אותו:',
  myAssetsTitle: '✦ הציוד שלי ✦',
  myAssetsSubtitle: 'הקישו כדי לצייד או להסיר (פריט אחד לכל אזור):',
  emptyAssetsTitle: 'אין ציוד עדיין',
  emptyAssetsSub: 'קנו כובעים, סקינים, הילות או שובלים בחנות כדי להתאים את הדמות!',
  goToShop: 'לחנות',
  slots: {
    hat: 'ראש',
    skin: 'גוון',
    aura: 'הילה',
    trail: 'שובל',
  },
  none: 'ללא',
  remove: 'הסר',
  equipped: 'מצויד',
  equip: 'ציוד',
  shop: 'חנות',
  soundTitle: '✦ צליל ומוזיקה ✦',
  musicOn: 'מוזיקה: פעיל',
  musicOff: 'מוזיקה: כבוי',
  sfxOn: 'אפקטים: פעיל',
  sfxOff: 'אפקטים: כבוי',
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
