import { getLocale, type Locale } from './locale';
import type { AccessorySlot, Rarity } from '../../data/shopCatalog';

export type ShopTab = 'skins' | 'accessories' | 'stardust' | 'crystals' | 'worlds';

/** Every stardust bundle the shop sells; the record below is exhaustive over these. */
export const STARDUST_PACK_IDS = ['sd_handful', 'sd_jar', 'sd_crate', 'sd_treasury'] as const;
export type StardustPackId = (typeof STARDUST_PACK_IDS)[number];

export interface PackCopy {
  title: string;
  subtitle: string;
}

export interface StardustPackCopy extends PackCopy {
  tag?: string;
}

export interface StarterPackCopy extends PackCopy {
  banner: string;
  ownedBanner: string;
}

export interface ShopStrings {
  title: string;
  subtitles: Record<ShopTab, string>;
  tabs: Record<ShopTab, string>;
  slots: Record<AccessorySlot, string>;
  rarity: Record<Rarity, string>;
  equipped: string;
  equip: string;
  owned: string;
  unlocked: string;
  residents: string;
  unlockForStardust: (amount: string | number) => string;
  unlockForCrystals: (amount: string | number) => string;
  worldsSubtitle: string;
  stardustPacks: Record<StardustPackId, StardustPackCopy>;
  starter: StarterPackCopy;
  vault: PackCopy & { banner: string };
  chest: PackCopy;
  pouch: PackCopy;
  shields: PackCopy;
  restore: string;
  privacyPolicy: string;
  termsOfUse: string;
  support: string;
  needGems: { title: string; body: string; confirm: string; cancel: string };
  ok: string;
}

const EN: ShopStrings = {
  title: '✦ ARCADE SHOP ✦',
  subtitles: {
    skins: 'Upgrade critters with stylized toy outfits',
    accessories: 'Equip rare 3D animated gear, auras & trails',
    stardust: 'Convert Crystals into magical Stardust bundles',
    worlds: 'Unlock portals to vibrant new dimensions',
    crystals: 'Get crystal bundles & streak shields',
  },
  tabs: {
    skins: 'SKINS',
    accessories: 'GEAR',
    stardust: 'STARDUST',
    crystals: 'GEMS',
    worlds: 'WORLDS',
  },
  slots: {
    hat: 'HAT',
    trail: 'TRAIL',
    aura: 'AURA',
  },
  rarity: {
    common: 'COMMON',
    rare: 'RARE',
    epic: 'EPIC',
    legendary: 'LEGEND',
  },
  equipped: 'EQUIPPED',
  equip: 'EQUIP',
  owned: 'OWNED',
  unlocked: '✓ UNLOCKED',
  residents: 'RESIDENTS:',
  unlockForStardust: (amount) => `UNLOCK FOR ★ ${amount} STARDUST`,
  unlockForCrystals: (amount) => `UNLOCK FOR 💎 ${amount} CRYSTALS`,
  worldsSubtitle: 'Unlock portals directly with Stardust or Crystals to explore new dimensions!',
  stardustPacks: {
    sd_handful: {
      title: '500 Stardust',
      subtitle: 'Handful of sparkling stardust to jumpstart your adventure',
    },
    sd_jar: {
      title: '1,500 Stardust',
      subtitle: 'Concentrated cosmic dust for world unlocks & skips',
      tag: '⭐ POPULAR',
    },
    sd_crate: {
      title: '4,000 Stardust',
      subtitle: 'Massive nebula stash (+20% bonus stardust included)',
      tag: '🔥 BEST VALUE',
    },
    sd_treasury: {
      title: '10,000 Stardust',
      subtitle: 'Astronomical galaxy treasury — unlock all worlds with ease',
      tag: '⚡ MEGA PACK',
    },
  },
  starter: {
    banner: '⭐ STARTER PACK — ONE-TIME SPECIAL',
    ownedBanner: '✓ STARTER PACK UNLOCKED',
    title: '500 Crystals + 3 Rare Skins',
    subtitle: 'Chrome Pip, Crystal Bloop & Velvet Fuzz',
  },
  vault: {
    banner: '🔥 BEST VALUE (+20% BONUS)',
    title: '1,200 Crystals',
    subtitle: 'Vault of radiant astral gems',
  },
  chest: { title: '500 Crystals', subtitle: 'Chest overflowing with cosmic crystals' },
  pouch: { title: '100 Crystals', subtitle: 'Pouch of sparkling blue gems' },
  shields: { title: '10 Streak Shields', subtitle: 'Protects your arcade combo streaks from breaking' },
  restore: 'RESTORE PURCHASES',
  privacyPolicy: 'Privacy Policy',
  termsOfUse: 'Terms of Use',
  support: 'Support',
  needGems: {
    title: 'MORE GEMS NEEDED',
    body: 'You do not have enough crystals to buy this Stardust bundle. Would you like to check the Gems shop?',
    confirm: 'GET GEMS',
    cancel: 'CANCEL',
  },
  ok: 'OK',
};

const HE: ShopStrings = {
  title: '✦ חנות הארקייד ✦',
  subtitles: {
    skins: 'שדרגו יצורים עם תלבושות צעצוע מעוצבות',
    accessories: 'ציידו ציוד תלת-ממד נדיר, הילות ושובלים',
    stardust: 'המירו קריסטלים לחבילות אבק כוכבים קסומות',
    worlds: 'פתחו שערים לממדים חדשים וססגוניים',
    crystals: 'חבילות קריסטלים ומגני רצף',
  },
  tabs: {
    skins: 'סקינים',
    accessories: 'ציוד',
    stardust: 'אבק כוכבים',
    crystals: 'קריסטלים',
    worlds: 'עולמות',
  },
  slots: {
    hat: 'כובע',
    trail: 'שובל',
    aura: 'הילה',
  },
  rarity: {
    common: 'רגיל',
    rare: 'נדיר',
    epic: 'אפי',
    legendary: 'אגדי',
  },
  equipped: 'לבוש',
  equip: 'הלבישו',
  owned: 'בבעלותכם',
  unlocked: '✓ נפתח',
  residents: 'תושבים:',
  unlockForStardust: (amount) => `פתחו תמורת ★ ${amount} אבק כוכבים`,
  unlockForCrystals: (amount) => `פתחו תמורת 💎 ${amount} קריסטלים`,
  worldsSubtitle: 'פתחו שערים ישירות באמצעות אבק כוכבים או קריסטלים וצאו לחקור ממדים חדשים!',
  stardustPacks: {
    sd_handful: {
      title: '500 אבק כוכבים',
      subtitle: 'קומץ אבק כוכבים נוצץ שיניע את ההרפתקה שלכם',
    },
    sd_jar: {
      title: '1,500 אבק כוכבים',
      subtitle: 'אבק קוסמי מרוכז לפתיחת עולמות ולדילוגים',
      tag: '⭐ פופולרי',
    },
    sd_crate: {
      title: '4,000 אבק כוכבים',
      subtitle: 'מלאי ערפילית עצום (כולל 20% אבק כוכבים בונוס)',
      tag: '🔥 משתלם במיוחד',
    },
    sd_treasury: {
      title: '10,000 אבק כוכבים',
      subtitle: 'אוצר גלקסיה אסטרונומי — פתחו את כל העולמות בקלות',
      tag: '⚡ חבילת ענק',
    },
  },
  starter: {
    banner: '⭐ חבילת התחלה — מבצע חד-פעמי',
    ownedBanner: '✓ חבילת ההתחלה נפתחה',
    title: '500 קריסטלים + 3 סקינים נדירים',
    subtitle: 'פיפ כרום, בלופ קריסטל ופאז קטיפה',
  },
  vault: {
    banner: '🔥 משתלם במיוחד (+20% בונוס)',
    title: '1,200 קריסטלים',
    subtitle: 'כספת אבני חן שמימיות זוהרות',
  },
  chest: { title: '500 קריסטלים', subtitle: 'תיבה גדושה בקריסטלים קוסמיים' },
  pouch: { title: '100 קריסטלים', subtitle: 'שקית אבני חן כחולות נוצצות' },
  shields: { title: '10 מגני רצף', subtitle: 'מגן על רצפי הקומבו שלכם בארקייד מפני שבירה' },
  restore: 'שחזור רכישות',
  privacyPolicy: 'מדיניות פרטיות',
  termsOfUse: 'תנאי שימוש',
  support: 'תמיכה',
  needGems: {
    title: 'נדרשים עוד קריסטלים',
    body: 'אין לכם מספיק קריסטלים לרכישת חבילת אבק הכוכבים הזו. לבדוק את חנות הקריסטלים?',
    confirm: 'לחנות הקריסטלים',
    cancel: 'ביטול',
  },
  ok: 'אישור',
};

const SHOP_STRINGS: Record<Locale, ShopStrings> = { en: EN, he: HE };

export interface ShopCopy {
  locale: Locale;
  rtl: boolean;
  strings: ShopStrings;
}

export function getShopCopy(locale: Locale = getLocale()): ShopCopy {
  return { locale, rtl: locale === 'he', strings: SHOP_STRINGS[locale] };
}
