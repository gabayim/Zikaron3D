import { getLocale, type Locale } from './locale';
import type { AchievementCategory } from '../../store/achievements';

export type AchievementCategoryKey = 'all' | AchievementCategory;

export interface AchievementText {
  name: string;
  description: string;
}

export interface AchievementsStrings {
  title: string;
  completed: (done: number, total: number) => string;
  exclusive: string;
  claim: string;
  categories: Record<AchievementCategoryKey, string>;
}

const EN: AchievementsStrings = {
  title: 'ACHIEVEMENTS',
  completed: (done, total) => `${done} / ${total} COMPLETED`,
  exclusive: 'EXCLUSIVE',
  claim: 'CLAIM',
  categories: {
    all: 'ALL',
    burrows: 'BURROWS',
    orbs: 'ORBS',
    stars: 'STARS',
    shells: 'SHELLS',
    vines: 'VINES',
    beats: 'BEATS',
    peaks: 'PEAKS',
    collection: 'COLLECTION',
    general: 'GENERAL',
  },
};

const HE: AchievementsStrings = {
  title: 'הישגים',
  completed: (done, total) => `${done} / ${total} הושלמו`,
  exclusive: 'בלעדי',
  claim: 'אסוף',
  categories: {
    all: 'הכל',
    burrows: 'מחילות',
    orbs: 'כדורים',
    stars: 'כוכבים',
    shells: 'צדפים',
    vines: 'גפנים',
    beats: 'קצב',
    peaks: 'פסגות',
    collection: 'אוסף',
    general: 'כללי',
  },
};

/**
 * Achievement names and descriptions live in `src/store/achievements.ts`
 * together with their metrics; only the display copy is translated, keyed by
 * the stable achievement id so the data file (read by the store and tests)
 * stays untouched. `achievementsI18n.test.ts` fails when an id is missing.
 */
const HE_ACHIEVEMENTS: Record<string, AchievementText> = {
  burrows_novice: { name: 'טירון המחילות', description: 'הגיעו לשלב 5 במחילות היצורים' },
  burrows_expert: { name: 'מומחה המחילות', description: 'הגיעו לשלב 15 במחילות היצורים' },
  burrows_master: { name: 'אמן המחילות', description: 'הגיעו לשלב 25 במחילות היצורים' },
  burrows_grandmaster: { name: 'ריבון הזיכרון', description: 'השלימו שלב 30 במחילות היצורים' },
  orbs_novice: { name: 'היתוך ראשון', description: 'מזגו עד דרגת גראמבל' },
  orbs_expert: { name: 'היתוך עמוק', description: 'מזגו עד דרגת דאסק' },
  orbs_pip: { name: 'פיפ נעלה', description: 'מזגו את הפיפ העליון ביותר' },
  orbs_grandmaster: { name: 'ריבון הכבידה', description: 'השלימו שלב 30 במיזוג כדורים' },
  stars_novice: { name: 'מחפש הכוכבים', description: 'תפסו 50 כוכבים בתופס הכוכבים' },
  stars_fever: { name: 'קדחת כפולה', description: 'היכנסו למצב קדחת 5 פעמים' },
  stars_expert: { name: 'רץ המטאורים', description: 'תפסו 250 כוכבים בסך הכול' },
  stars_grandmaster: { name: 'ריבון הקוסמוס', description: 'שרדו שלב 30 בתופס הכוכבים' },
  shells_novice: { name: 'מאתר הפנינים', description: 'הגיעו לשלב 5 בערבוב הצדפים' },
  shells_tracker: { name: 'צוללן עין נשר', description: 'הגיעו לשלב 10 בערבוב הצדפים' },
  shells_expert: { name: 'פורץ הדיו', description: 'הגיעו לשלב 20 בערבוב הצדפים' },
  shells_grandmaster: { name: 'שומר הפנינים', description: 'הגיעו לשלב 30 בערבוב הצדפים' },
  vines_novice: { name: 'מתחיל השרף', description: 'הגיעו לשלב 5 בזרימת הגפן' },
  vines_gardener: { name: 'אורג השורשים', description: 'הגיעו לשלב 10 בזרימת הגפן' },
  vines_expert: { name: 'מעיינות תאומים', description: 'הגיעו לשלב 20 בזרימת הגפן' },
  vines_grandmaster: { name: 'לב החורשה', description: 'הגיעו לשלב 30 בזרימת הגפן' },
  vines_perfect: { name: 'בלי תור מבוזבז', description: 'פתרו 10 חידות זרימת גפן בלי תור מבוזבז' },
  beats_novice: { name: 'הניצוץ הראשון', description: 'הגיעו לשלב 5 במעגל הקצב' },
  beats_groove: { name: 'בתוך הגרוב', description: 'הגיעו לשלב 10 במעגל הקצב' },
  beats_expert: { name: 'בהמהרה', description: 'הגיעו לשלב 20 במעגל הקצב' },
  beats_grandmaster: { name: 'מאסטרו המעגל', description: 'הגיעו לשלב 30 במעגל הקצב' },
  beats_fullcombo: { name: 'אות מושלם', description: 'נגנו 5 שירים במעגל הקצב בלי פספוס' },
  peaks_novice: { name: 'ההד הראשון', description: 'הגיעו לשלב 5 בפסגות ההד' },
  peaks_climber: { name: 'הולך הרכס', description: 'הגיעו לשלב 10 בפסגות ההד' },
  peaks_expert: { name: 'אוויר דליל', description: 'הגיעו לשלב 20 בפסגות ההד' },
  peaks_grandmaster: { name: 'שומר הפסגה', description: 'הגיעו לשלב 30 בפסגות ההד' },
  peaks_n4: { name: 'ארבעה צעדים אחורה', description: 'עברו שלב בפסגות ההד שנראה ארבעה צעדים אחורה' },
  col_starter: { name: 'הלהקה התאספה', description: 'גלו 3 יצורים' },
  col_full: { name: 'ארגז הצעצועים החי', description: 'גלו את כל 9 מיני היצורים' },
  streak_3: { name: 'קצב יומי', description: 'שמרו על רצף התחברות של 3 ימים' },
  streak_7: { name: 'חבר נאמן', description: 'השלימו רצף התחברות מלא של 7 ימים' },
  stardust_500: { name: 'אספן אבק כוכבים', description: 'צברו 500 אבק כוכבים בסך הכול' },
  grand_champion: { name: 'אלוף העל', description: 'פתחו את הילת הזוהר המוזהבת' },
};

const ACHIEVEMENT_STRINGS: Record<Locale, AchievementsStrings> = { en: EN, he: HE };

export interface AchievementsCopy {
  locale: Locale;
  rtl: boolean;
  strings: AchievementsStrings;
}

export function getAchievementsCopy(locale: Locale = getLocale()): AchievementsCopy {
  return { locale, rtl: locale === 'he', strings: ACHIEVEMENT_STRINGS[locale] };
}

/** Localize an achievement's name/description; unknown ids keep the English data. */
export function localizeAchievement(
  id: string,
  name: string,
  description: string,
  locale: Locale = getLocale(),
): AchievementText {
  if (locale !== 'he') return { name, description };
  return HE_ACHIEVEMENTS[id] ?? { name, description };
}

export const HE_ACHIEVEMENT_IDS = Object.keys(HE_ACHIEVEMENTS);
