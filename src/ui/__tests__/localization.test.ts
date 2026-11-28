import {
  getRarityLabel,
  HEBREW_CATALOG_NAMES,
  localizeCatalogName,
  localizeCreatureName,
} from '../i18n/catalog';
import { getLocale, isHebrewLocale, type Locale } from '../i18n/locale';
import { getProfileCopy } from '../i18n/profile';
import { getRedeemCopy, getRedeemError } from '../i18n/redeem';
import { getSplashCopy } from '../i18n/splash';
import { getWardrobeCopy } from '../i18n/wardrobe';
import { ACCESSORY_CATALOG, SKIN_CATALOG } from '../../data/shopCatalog';

const HEBREW = /[\u0590-\u05FF]/;

/** Strips numbers, punctuation and symbols so only words remain. */
const wordsOnly = (text: string): string =>
  text.replace(/[\d+×•✦]/g, ' ').replace(/[^\p{L}\s]/gu, ' ');

const expectNoUntranslatedEnglish = (text: string) => {
  expect(text).toMatch(HEBREW);
  expect(wordsOnly(text)).not.toMatch(/[A-Za-z]{2,}/);
};

const LOCALES: Locale[] = ['en', 'he'];

describe('Hebrew locale detection', () => {
  it('detects Hebrew locales in their common forms', () => {
    expect(isHebrewLocale('he')).toBe(true);
    expect(isHebrewLocale('he_IL')).toBe(true);
    expect(isHebrewLocale('he-IL')).toBe(true);
    expect(isHebrewLocale('iw_IL')).toBe(true);
  });

  it('does not treat other locales as Hebrew', () => {
    expect(isHebrewLocale('en_US')).toBe(false);
    expect(isHebrewLocale('ar_IL')).toBe(false);
    expect(isHebrewLocale('')).toBe(false);
  });

  it('resolves a locale without a native bridge', () => {
    expect(['en', 'he']).toContain(getLocale());
  });
});

describe('profile modal copy', () => {
  it('translates every visible string and mirrors under Hebrew', () => {
    const { strings, rtl } = getProfileCopy('he');
    expect(rtl).toBe(true);
    expect(strings.title).toBe('פרופיל שחקן');
    expect(strings.levelBadge(7)).toBe('רמה 7');
    expect(strings.characterName).toMatch(HEBREW);
    expect(strings.wardrobeTitle).toMatch(HEBREW);
    expect(strings.wardrobeSubtitle).toMatch(HEBREW);
    expect(strings.giftsTitle).toMatch(HEBREW);
    expect(strings.redeemCode).toBe('מימוש קוד');
    expect(strings.inviteFriends).toBe('הזמנת חברים');
    expect(strings.dailyChallenge).toBe('אתגר יומי');
    expect(strings.dailyReward(80, 25)).toContain('80');
    expect(strings.dailyReward(80, 25)).toContain('25');
    expect(strings.equipped).toBe('מצויד');
    expect(strings.equip).toBe('ציוד');
    expect(strings.shop).toBe('חנות');
    expect(strings.none).toBe('ללא');

    const visible = [
      strings.title,
      strings.characterName,
      strings.noHat,
      strings.classicSkin,
      strings.wardrobeTitle,
      strings.wardrobeSubtitle,
      ...Object.values(strings.slots),
      strings.none,
      strings.equipped,
      strings.equip,
      strings.shop,
      strings.giftsTitle,
      strings.redeemCode,
      strings.inviteFriends,
      ...Object.values(strings.stats),
      ...Object.values(strings.modes),
      strings.dailyChallenge,
      strings.dailyReward(80, 25),
      strings.levelBadge(7),
    ];
    for (const text of visible) expectNoUntranslatedEnglish(text);
  });

  it('keeps the English copy with LTR layout', () => {
    const { strings, rtl } = getProfileCopy('en');
    expect(rtl).toBe(false);
    expect(strings.title).toBe('PLAYER PROFILE');
    expect(strings.levelBadge(3)).toBe('LVL 3');
    expect(strings.dailyReward(80, 25)).toBe('Earn +80 XP & +25 Stardust');
    expect(strings.modes.ARCADE).toBe('ARCADE');
    expect(strings.slots.hat).toBe('HEAD');
  });
});

describe('redeem code modal copy', () => {
  it('translates the form, success state and every server error', () => {
    const { strings, rtl } = getRedeemCopy('he');
    expect(rtl).toBe(true);
    expect(strings.title).toBe('מימוש קוד');
    expect(strings.minLength(6)).toContain('6');
    expect(strings.item(2)).toContain('2');
    expect(strings.crystals(50)).toContain('50');
    expect(getRedeemError(strings, 'expired')).toBe('תוקף הקופון הזה פג.');
    expect(getRedeemError(strings, 'not_signed_in')).toMatch(HEBREW);
    expect(getRedeemError(strings, 'unknown_reason')).toBe(strings.failed);

    const visible = [
      strings.title,
      strings.subtitle,
      strings.placeholder,
      strings.submit,
      strings.rewardUnlocked,
      strings.equipNow,
      strings.done,
      strings.minLength(6),
      strings.failed,
      strings.item(2),
      strings.exclusiveSkin,
      strings.exclusiveAccessory,
      strings.crystals(50),
      strings.stardust(100),
      strings.shield(1),
      ...Object.values(strings.errors),
    ];
    for (const text of visible) expectNoUntranslatedEnglish(text);
  });

  it('keeps the English copy with LTR layout', () => {
    const { strings, rtl } = getRedeemCopy('en');
    expect(rtl).toBe(false);
    expect(strings.title).toBe('Redeem Code');
    expect(strings.submit).toBe('Redeem Reward');
    expect(strings.item(2)).toBe('2x Item');
    expect(getRedeemError(strings, 'throttled')).toBe(
      'Too many attempts! Please try again in an hour.',
    );
  });
});

describe('wardrobe sheet copy', () => {
  it('translates the heading, tabs, rarity and empty state', () => {
    const { strings, rtl } = getWardrobeCopy('he');
    expect(rtl).toBe(true);
    expect(strings.title('פיפ')).toBe('ארון הלבוש של פיפ');
    expect(strings.emptySlot('hat')).toContain('כובע');
    expect(strings.emptySlot('aura')).toContain('הילה');
    expect(getRarityLabel('epic', 'he')).toBe('אפי');

    const visible = [
      strings.title('פיפ'),
      ...Object.values(strings.tabs),
      strings.classic,
      strings.originalPalette,
      strings.none,
      strings.emptySlot('hat'),
      strings.emptySlot('aura'),
      strings.emptySlot('trail'),
      strings.equipped,
      strings.equip,
      strings.shop,
      getRarityLabel('common', 'he'),
      getRarityLabel('rare', 'he'),
      getRarityLabel('epic', 'he'),
      getRarityLabel('legendary', 'he'),
    ];
    for (const text of visible) expectNoUntranslatedEnglish(text);
  });

  it('keeps the English copy with LTR layout', () => {
    const { strings, rtl } = getWardrobeCopy('en');
    expect(rtl).toBe(false);
    expect(strings.title('PIP')).toBe('PIP WARDROBE');
    expect(strings.emptySlot('hat')).toBe('No hat equipped');
    expect(getRarityLabel('epic', 'en')).toBe('EPIC');
  });
});

describe('level splash copy', () => {
  it('translates the overlay', () => {
    const { strings, rtl } = getSplashCopy('he');
    expect(rtl).toBe(true);
    expect(strings.level(4)).toBe('שלב 4');
    expectNoUntranslatedEnglish(strings.stageReady);
  });

  it('keeps the English copy with LTR layout', () => {
    const { strings, rtl } = getSplashCopy('en');
    expect(rtl).toBe(false);
    expect(strings.stageReady).toBe('STAGE READY');
    expect(strings.level(4)).toBe('LEVEL 4');
  });
});

describe('catalog names', () => {
  it('has a Hebrew name for every skin and accessory', () => {
    const catalogNames = [
      ...SKIN_CATALOG.map((skin) => skin.name),
      ...ACCESSORY_CATALOG.map((accessory) => accessory.name),
    ];

    for (const name of catalogNames) {
      expect(HEBREW_CATALOG_NAMES[name]).toBeDefined();
      const hebrew = localizeCatalogName(name, 'he');
      expect(hebrew).not.toBe(name);
      expectNoUntranslatedEnglish(hebrew);
    }

    // The English branch must return the catalog string untouched.
    expect(localizeCatalogName('Golden Crown', 'en')).toBe('Golden Crown');
  });

  it('does not carry stale entries for removed catalog items', () => {
    const catalogNames = new Set([
      ...SKIN_CATALOG.map((skin) => skin.name),
      ...ACCESSORY_CATALOG.map((accessory) => accessory.name),
    ]);
    for (const name of Object.keys(HEBREW_CATALOG_NAMES)) {
      expect(catalogNames.has(name)).toBe(true);
    }
  });

  it('localizes creature names for the wardrobe heading', () => {
    expect(localizeCreatureName('pip', 'he')).toBe('פיפ');
    expect(localizeCreatureName('pip', 'en')).toBe('PIP');
  });

  it('exposes RTL flags for both supported locales', () => {
    expect(getProfileCopy('he').rtl).toBe(true);
    expect(getProfileCopy('en').rtl).toBe(false);
    for (const locale of LOCALES) {
      expect(typeof getProfileCopy(locale).strings.title).toBe('string');
    }
  });
});
