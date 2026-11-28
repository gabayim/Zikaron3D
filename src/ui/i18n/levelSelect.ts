import { getLocale, type Locale } from './locale';
import type { GameId } from '../../store/profile';

/** Cost of the in-level "skip ahead" purchase, shared by the copy and the handler. */
export const SKIP_COST_STARDUST = 150;
export const SKIP_COST_CRYSTALS = 10;
export const SKIP_XP_REWARD = 50;

export interface LevelSelectStrings {
  chooseLevel: string;
  nextLevel: (level: number) => string;
  skipSubtitle: string;
  skipLvl: string;
  skipToLevel: (level: number) => string;
  skipBody: (level: number) => string;
  stardustCost: (amount: number) => string;
  crystalsCost: (amount: number) => string;
  cancel: string;
  gameTitles: Record<GameId, string>;
  mechanics: Record<string, string>;
}

const EN: LevelSelectStrings = {
  chooseLevel: 'CHOOSE LEVEL (1–30)',
  nextLevel: (level) => `NEXT LEVEL: ${level}`,
  skipSubtitle: 'Skip ahead using Stardust or Crystals',
  skipLvl: 'SKIP LVL',
  skipToLevel: (level) => `SKIP TO LEVEL ${level}?`,
  skipBody: (level) => `Instantly unlock Level ${level} and earn +${SKIP_XP_REWARD} XP!`,
  stardustCost: (amount) => `★ ${amount} STARDUST`,
  crystalsCost: (amount) => `💎 ${amount} CRYSTALS`,
  cancel: 'CANCEL',
  gameTitles: {
    burrows: 'CRITTER BURROWS',
    prisms: 'PRISM CHORUS',
    stars: 'STAR CATCHER',
    shells: 'SHELL SHUFFLE',
    vines: 'VINE FLOW',
    beats: 'BEAT CIRCUIT',
    peaks: 'ECHO PEAKS',
  },
  mechanics: {},
};

const HE: LevelSelectStrings = {
  chooseLevel: 'בחרו שלב (1–30)',
  nextLevel: (level) => `השלב הבא: ${level}`,
  skipSubtitle: 'דלגו קדימה באמצעות אבק כוכבים או קריסטלים',
  skipLvl: 'דלג שלב',
  skipToLevel: (level) => `לדלג לשלב ${level}?`,
  skipBody: (level) => `פתחו מיד את שלב ${level} וקבלו +${SKIP_XP_REWARD} נק' ניסיון!`,
  stardustCost: (amount) => `★ ${amount} אבק כוכבים`,
  crystalsCost: (amount) => `💎 ${amount} קריסטלים`,
  cancel: 'ביטול',
  gameTitles: {
    burrows: 'מחילות היצורים',
    prisms: 'מקהלת פריזמות',
    stars: 'תופס הכוכבים',
    shells: 'ערבוב הצדפים',
    vines: 'זרימת הגפן',
    beats: 'מעגל הקצב',
    peaks: 'פסגות ההד',
  },
  mechanics: {
    arcPattern: 'קשת',
    bomb: 'פצצה',
    bossWave: 'גל בוס',
    chord: 'אקורד',
    chords: 'אקורדים',
    color: 'צבע',
    current: 'זרם',
    dark: 'חושך',
    decoy: 'פיתיון',
    decoys: 'פיתיונות',
    double: 'כפול',
    drift: 'סחיפה',
    dropLimit: 'הגבלת נפילה',
    dualTarget: 'יעד כפול',
    echo: 'הד',
    eighths: 'שמיניות',
    fakeout: 'הטעיה',
    flash: 'הבזק',
    fog: 'ערפל',
    frozen: 'קפוא',
    ghost: 'רוח רפאים',
    gold: 'זהב',
    grow: 'התארכות',
    holds: 'החזקות',
    ink: 'דיו',
    invisible: 'בלתי נראה',
    linePattern: 'קו',
    linked: 'מקושר',
    locked: 'נעול',
    lures: 'פיתויים',
    mirror: 'מראה',
    moves: 'מהלכים',
    narrowBowl: 'קערה צרה',
    offbeat: 'אוף-ביט',
    pos: 'מיקום',
    rain: 'גשם',
    rainbow: 'צבעי קשת',
    rotate: 'סיבוב',
    rotation: 'סיבוב',
    shadow: 'צל',
    shrink: 'התכווצות',
    shuffle: 'ערבוב',
    sound: 'צליל',
    speed: 'מהירות',
    split: 'פיצול',
    staircasePattern: 'מדרגות',
    swap: 'החלפה',
    switch: 'מתג',
    tempo: 'קצב',
    thorns: 'קוצים',
    triple: 'משולש',
    tripleTarget: 'יעד משולש',
    twins: 'תאומים',
    twoRows: 'שתי שורות',
    urchin: 'קיפוד ים',
    wilt: 'נבילה',
    wind: 'רוח',
  },
};

const LEVEL_SELECT_STRINGS: Record<Locale, LevelSelectStrings> = { en: EN, he: HE };

export interface LevelSelectCopy {
  locale: Locale;
  rtl: boolean;
  strings: LevelSelectStrings;
}

export function getLevelSelectCopy(locale: Locale = getLocale()): LevelSelectCopy {
  return { locale, rtl: locale === 'he', strings: LEVEL_SELECT_STRINGS[locale] };
}

/** Display label for a level's first mechanic badge; unknown tokens fall back to uppercase. */
export function getMechanicLabel(token: string, locale: Locale = getLocale()): string {
  if (locale === 'he') return HE.mechanics[token] ?? token.toUpperCase();
  return token.toUpperCase();
}
