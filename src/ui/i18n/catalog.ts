import { getLocale, type Locale } from './locale';
import type { CreatureId } from '../../store/profile';

/**
 * Catalog item names ship with the shop data as English product names. The
 * name is the only place the language shows up, so the Hebrew catalog lives
 * here instead of duplicating every entry in `src/data/shopCatalog.ts`.
 *
 * Keep this map in sync with the `name` fields of SKIN_CATALOG and
 * ACCESSORY_CATALOG; `localization.test.ts` fails when an entry is missing.
 */
export const HEBREW_CATALOG_NAMES: Record<string, string> = {
  // Skins — Pip
  'Snow Pip': 'פיפ שלג',
  'Sunset Pip': 'פיפ שקיעה',
  'Chrome Pip': 'פיפ כרום',
  'Starfire Pip': 'פיפ אש כוכבים',
  // Skins — Bloop
  'Lime Bloop': 'בלופ לימוני',
  'Rose Bloop': 'בלופ ורד',
  'Crystal Bloop': 'בלופ קריסטל',
  'Nebula Bloop': 'בלופ ערפילית',
  // Skins — Fuzz
  'Mint Fuzz': 'פאז מנטה',
  'Gold Fuzz': 'פאז זהב',
  'Velvet Fuzz': 'פאז קטיפה',
  'Aurora Fuzz': 'פאז זוהר',
  // Skins — Nutty
  'Red Nutty': 'נאטי אדום',
  'Silver Nutty': 'נאטי כסף',
  'Bronze Nutty': 'נאטי ארד',
  'Diamond Nutty': 'נאטי יהלום',
  // Skins — Zap
  'Green Zap': 'זאפ ירוק',
  'Purple Zap': 'זאפ סגול',
  'Neon Zap': 'זאפ ניאון',
  'Lightning Zap': 'זאפ ברק',
  // Skins — Grumble
  'Teal Grumble': 'גראמבל טורקיז',
  'Rust Grumble': 'גראמבל חלודה',
  'Obsidian Grumble': 'גראמבל אובסידיאן',
  'Volcanic Grumble': 'גראמבל געש',
  // Skins — Frost
  'Pink Frost': 'פרוסט ורוד',
  'Black Frost': 'פרוסט שחור',
  'Sapphire Frost': 'פרוסט ספיר',
  'Blizzard Frost': 'פרוסט סופה',
  // Skins — Ember
  'Blue Ember': 'אמבר כחול',
  'White Ember': 'אמבר לבן',
  'Ruby Ember': 'אמבר רובי',
  'Inferno Ember': 'אמבר להבה',
  // Skins — Dusk
  'Dawn Dusk': 'דאסק שחר',
  'Void Dusk': 'דאסק תהום',
  'Moonstone Dusk': 'דאסק אבן ירח',
  'Eclipse Dusk': 'דאסק ליקוי',
  // Skins — Coral
  'Pearl Coral': 'קורל פנינה',
  'Abyss Coral': 'קורל תהום',
  'Bioluminescent Coral': 'קורל זוהר',
  // Skins — Moss
  'Autumn Moss': 'מוס סתיו',
  'Sakura Moss': 'מוס סאקורה',
  'Ancient Moss': 'מוס עתיק',
  // Skins — Bolt
  'Silver Bolt': 'בולט כסף',
  'Plasma Bolt': 'בולט פלזמה',
  'Overcharge Bolt': 'בולט טעון',
  // Skins — Luna
  'Twilight Luna': 'לונה דמדומים',
  'Starlight Luna': 'לונה אור כוכבים',
  'Celestial Luna': 'לונה שמימית',
  // Skins — Nova
  'Pulsar Nova': 'נובה פולסאר',
  Supernova: 'סופרנובה',
  // Skins — Titan
  'Obsidian Titan': 'טיטן אובסידיאן',
  'Gilded Titan': 'טיטן מוזהב',
  // Accessories — hats
  'Golden Crown': 'כתר זהב',
  'Top Hat': 'כובע צילינדר',
  'Pirate Hat': 'כובע פיראט',
  'Flower Crown': 'זר פרחים',
  'Viking Horns': 'קרני ויקינג',
  // Accessories — trails
  'Rainbow Trail': 'שובל קשת',
  'Sparkle Trail': 'שובל ניצוצות',
  'Fire Trail': 'שובל אש',
  'Snowflake Trail': 'שובל פתיתי שלג',
  'Stardust Trail': 'שובל אבק כוכבים',
  // Accessories — auras
  'Golden Radiance': 'הילה מוזהבת',
  'Ice Crystal Aura': 'הילת קריסטל קרח',
  'Floating Hearts': 'לבבות מרחפים',
  'Firefly Swarm': 'נחיל גחליליות',
  'Mini Thundercloud': 'ענן רעם זעיר',
};

/** Creature ids are Latin tokens; their display names are copy. */
export const HEBREW_CREATURE_NAMES: Record<CreatureId, string> = {
  pip: 'פיפ',
  bloop: 'בלופ',
  fuzz: 'פאז',
  nutty: 'נאטי',
  zap: 'זאפ',
  grumble: 'גראמבל',
  frost: 'פרוסט',
  ember: 'אמבר',
  dusk: 'דאסק',
  coral: 'קורל',
  moss: 'מוס',
  bolt: 'בולט',
  luna: 'לונה',
  nova: 'נובה',
  titan: 'טיטן',
};

export type CatalogRarity = 'common' | 'rare' | 'epic' | 'legendary';

const RARITY_LABELS: Record<Locale, Record<CatalogRarity, string>> = {
  en: {
    common: 'COMMON',
    rare: 'RARE',
    epic: 'EPIC',
    legendary: 'LEGENDARY',
  },
  he: {
    common: 'רגיל',
    rare: 'נדיר',
    epic: 'אפי',
    legendary: 'אגדי',
  },
};

/** Display name for a catalog item in the given locale. Unknown names pass through. */
export function localizeCatalogName(name: string, locale: Locale = getLocale()): string {
  if (locale !== 'he') return name;
  return HEBREW_CATALOG_NAMES[name] ?? name;
}

export function localizeCreatureName(id: CreatureId, locale: Locale = getLocale()): string {
  if (locale !== 'he') return id.toUpperCase();
  return HEBREW_CREATURE_NAMES[id];
}

export function getRarityLabel(rarity: string, locale: Locale = getLocale()): string {
  const label = RARITY_LABELS[locale][rarity as CatalogRarity];
  return label ?? rarity.toUpperCase();
}
