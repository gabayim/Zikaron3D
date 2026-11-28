import { getLocale, type Locale } from './locale';

export type WardrobeTab = 'skins' | 'hat' | 'aura' | 'trail';
export type AccessoryTab = Exclude<WardrobeTab, 'skins'>;

export interface WardrobeStrings {
  /** Heading, given the already-localized creature name. */
  title: (creature: string) => string;
  tabs: Record<WardrobeTab, string>;
  classic: string;
  originalPalette: string;
  none: string;
  /** Empty-state line for an accessory slot. */
  emptySlot: (slot: AccessoryTab) => string;
  equipped: string;
  equip: string;
  shop: string;
}

/** Slot nouns used inside the empty-state sentence. */
export const HE_SLOT_NAMES: Record<AccessoryTab, string> = {
  hat: 'כובע',
  aura: 'הילה',
  trail: 'שובל',
};

const EN: WardrobeStrings = {
  title: (creature) => `${creature} WARDROBE`,
  tabs: {
    skins: 'Skins',
    hat: 'Hats',
    aura: 'Auras',
    trail: 'Trails',
  },
  classic: 'Classic',
  originalPalette: 'Original Palette',
  none: 'None',
  emptySlot: (slot) => `No ${slot} equipped`,
  equipped: 'EQUIPPED',
  equip: 'EQUIP',
  shop: 'SHOP',
};

const HE: WardrobeStrings = {
  title: (creature) => `ארון הלבוש של ${creature}`,
  tabs: {
    skins: 'סקינים',
    hat: 'כובעים',
    aura: 'הילות',
    trail: 'שובלים',
  },
  classic: 'קלאסי',
  originalPalette: 'צבע מקורי',
  none: 'ללא',
  emptySlot: (slot) => `אין ${HE_SLOT_NAMES[slot]} מצויד`,
  equipped: 'מצויד',
  equip: 'ציוד',
  shop: 'חנות',
};

const WARDROBE_STRINGS: Record<Locale, WardrobeStrings> = { en: EN, he: HE };

export interface WardrobeCopy {
  locale: Locale;
  rtl: boolean;
  strings: WardrobeStrings;
}

/** Copy for the wardrobe sheet in the device language. */
export function getWardrobeCopy(locale: Locale = getLocale()): WardrobeCopy {
  return { locale, rtl: locale === 'he', strings: WARDROBE_STRINGS[locale] };
}
