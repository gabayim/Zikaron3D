import { getLocale, type Locale } from './locale';

export interface SeasonPassStrings {
  seasonName: string;
  free: string;
  claimed: string;
  claim: string;
  pass: string;
  unlock: string;
  tierOf: (tier: number, total: number) => string;
  xp: (current: number, total: number) => string;
  passActive: string;
  getPass: string;
  tierLabel: (tier: number) => string;
}

const EN: SeasonPassStrings = {
  seasonName: 'Starlight Odyssey',
  free: 'FREE',
  claimed: 'CLAIMED',
  claim: 'CLAIM',
  pass: 'PASS',
  unlock: 'UNLOCK',
  tierOf: (tier, total) => `TIER ${tier} OF ${total}`,
  xp: (current, total) => `${current} / ${total} XP`,
  passActive: 'ADVENTURE PASS ACTIVE',
  getPass: 'GET PASS',
  tierLabel: (tier) => `T${tier}`,
};

const HE: SeasonPassStrings = {
  seasonName: 'מסע אור הכוכבים',
  free: 'חינם',
  claimed: 'נאסף',
  claim: 'אסוף',
  pass: 'מסלול',
  unlock: 'פתחו',
  tierOf: (tier, total) => `דרגה ${tier} מתוך ${total}`,
  xp: (current, total) => `${current} / ${total} נק'`,
  passActive: 'מסלול ההרפתקאות פעיל',
  getPass: 'השיגו מסלול',
  tierLabel: (tier) => `ד${tier}`,
};

const SEASON_PASS_STRINGS: Record<Locale, SeasonPassStrings> = { en: EN, he: HE };

/**
 * Reward labels are built in `src/store/seasonPass.ts` from the reward amounts
 * (`"25 Crystals"`, `"150 Stardust"`) plus a handful of named items. Translating
 * the rendered label keyed by its English value keeps the store — which also
 * drives claiming — untouched.
 */
const HE_REWARD_ITEMS: Record<string, string> = {
  'Party Hat': 'כובע מסיבה',
  'Golden Radiance Aura + 250 Crystals': 'הילת זוהר מוזהבת + 250 קריסטלים',
  'Rainbow Star Trail': 'שובל כוכבים בצבעי קשת',
  'Imperial Gold Crown': 'כתר זהב קיסרי',
};

const AMOUNT = /^([\d,]+) (Stardust|Crystals|Shields)$/;

export function localizeSeasonRewardLabel(label: string, locale: Locale = getLocale()): string {
  if (locale !== 'he') return label;
  const item = HE_REWARD_ITEMS[label];
  if (item) return item;
  const match = AMOUNT.exec(label);
  if (!match) return label;
  const [, amount, unit] = match;
  if (unit === 'Stardust') return `${amount} אבק כוכבים`;
  if (unit === 'Crystals') return `${amount} קריסטלים`;
  return `${amount} מגנים`;
}

export interface SeasonPassCopy {
  locale: Locale;
  rtl: boolean;
  strings: SeasonPassStrings;
}

export function getSeasonPassCopy(locale: Locale = getLocale()): SeasonPassCopy {
  return { locale, rtl: locale === 'he', strings: SEASON_PASS_STRINGS[locale] };
}
