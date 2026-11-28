import { getLocale, isHebrewLocale } from '../i18n/locale';
import { getAchievementsCopy, localizeAchievement, HE_ACHIEVEMENT_IDS } from '../i18n/achievements';
import {
  getLevelSelectCopy,
  getMechanicLabel,
  SKIP_COST_CRYSTALS,
  SKIP_COST_STARDUST,
} from '../i18n/levelSelect';
import { getSeasonPassCopy, localizeSeasonRewardLabel } from '../i18n/seasonPass';
import { getShopCopy, STARDUST_PACK_IDS } from '../i18n/shop';
import { getCommonCopy } from '../i18n/common';
import { getSettingsCopy } from '../i18n/settings';
import { getHubCopy } from '../i18n/hub';
import { getCurrencyCopy } from '../i18n/currency';
import { localizeWorldName } from '../i18n/worlds';
import { localizeCatalogName } from '../i18n/catalog';

import { ACHIEVEMENTS } from '../../store/achievements';
import { SEASON_TIERS } from '../../store/seasonPass';
import { ACCESSORY_CATALOG, SKIN_CATALOG } from '../../data/shopCatalog';
import { WORLDS } from '../../worlds';
import {
  BEAT_LEVELS,
  BURROWS_LEVELS,
  ORB_LEVELS,
  PEAK_LEVELS,
  SHELL_LEVELS,
  STAR_LEVELS,
  VINE_LEVELS,
} from '../../engine/levelTables';

/** Brand names that legitimately stay in Latin script inside Hebrew copy. */
const BRAND_ALLOWLIST = [/App Store/g, /Zikaron3D/g];

function latinRuns(text: string): string[] {
  let stripped = text;
  for (const brand of BRAND_ALLOWLIST) stripped = stripped.replace(brand, '');
  // Drop numbers and punctuation/emoji; only letter runs are copy for review.
  stripped = stripped.replace(/[\d\s\p{P}\p{S}]/gu, '');
  return stripped.match(/[A-Za-z]{3,}/g) ?? [];
}

function expectHebrewOnly(text: string, context: string) {
  expect(text).toMatch(/[\u0590-\u05FF]/);
  expect({ context, latin: latinRuns(text) }).toEqual({ context, latin: [] });
}

function eachString(value: unknown, visit: (text: string) => void) {
  if (typeof value === 'string') visit(value);
  else if (typeof value === 'function') {
    const sample = (value as (...args: number[]) => string)(1, 2);
    if (typeof sample === 'string') visit(sample);
  } else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((child) => eachString(child, visit));
  }
}

describe('locale detection', () => {
  it('recognizes Hebrew locales in every form the device reports', () => {
    ['he', 'he_IL', 'he-IL', 'iw_IL', 'iw'].forEach((locale) => {
      expect(isHebrewLocale(locale)).toBe(true);
    });
  });

  it('leaves non-Hebrew locales on English', () => {
    ['en', 'en_US', 'ru_RU', 'ar_SA', 'fr'].forEach((locale) => {
      expect(isHebrewLocale(locale)).toBe(false);
    });
  });

  it('resolves a default locale without throwing', () => {
    expect(['en', 'he']).toContain(getLocale());
  });
});

describe('achievements copy', () => {
  const copy = getAchievementsCopy('he');

  it('keeps the English dictionary pinned to the shipped strings', () => {
    const en = getAchievementsCopy('en');
    expect(en.strings.title).toBe('ACHIEVEMENTS');
    expect(en.strings.completed(3, 12)).toBe('3 / 12 COMPLETED');
    expect(en.strings.claim).toBe('CLAIM');
    expect(en.strings.exclusive).toBe('EXCLUSIVE');
  });

  it('has a Hebrew name and description for every achievement', () => {
    expect(HE_ACHIEVEMENT_IDS.sort()).toEqual(ACHIEVEMENTS.map((a) => a.id).sort());
    ACHIEVEMENTS.forEach((achievement) => {
      const he = localizeAchievement(achievement.id, achievement.name, achievement.description, 'he');
      expectHebrewOnly(he.name, `${achievement.id}.name`);
      expectHebrewOnly(he.description, `${achievement.id}.description`);
    });
  });

  it('returns the data strings untouched in English', () => {
    const first = ACHIEVEMENTS[0];
    expect(localizeAchievement(first.id, first.name, first.description, 'en')).toEqual({
      name: first.name,
      description: first.description,
    });
  });

  it('translates every category chip', () => {
    eachString(copy.strings.categories, (text) => expectHebrewOnly(text, 'category'));
  });
});

describe('level select copy', () => {
  it('pins the English chrome and costs', () => {
    const en = getLevelSelectCopy('en');
    expect(en.strings.chooseLevel).toBe('CHOOSE LEVEL (1–30)');
    expect(en.strings.skipLvl).toBe('SKIP LVL');
    expect(en.strings.stardustCost(SKIP_COST_STARDUST)).toBe('★ 150 STARDUST');
    expect(en.strings.crystalsCost(SKIP_COST_CRYSTALS)).toBe('💎 10 CRYSTALS');
  });

  it('translates every game title and every mechanics badge the level tables use', () => {
    const he = getLevelSelectCopy('he');
    eachString(he.strings.gameTitles, (text) => expectHebrewOnly(text, 'gameTitle'));
    eachString(he.strings, (text) => expectHebrewOnly(text, 'levelSelect'));

    const tokens = new Set(
      [BURROWS_LEVELS, ORB_LEVELS, STAR_LEVELS, SHELL_LEVELS, VINE_LEVELS, BEAT_LEVELS, PEAK_LEVELS]
        .flatMap((levels) => levels as { mechanics?: string[] }[])
        .flatMap((level) => level.mechanics ?? []),
    );
    expect(tokens.size).toBeGreaterThan(10);
    tokens.forEach((token) => {
      expectHebrewOnly(getMechanicLabel(token, 'he'), `mechanics.${token}`);
    });
  });
});

describe('season pass copy', () => {
  it('translates every tier reward label on both tracks', () => {
    SEASON_TIERS.forEach((tier) => {
      expectHebrewOnly(
        localizeSeasonRewardLabel(tier.freeReward.label, 'he'),
        `tier ${tier.tier} free`,
      );
      expectHebrewOnly(
        localizeSeasonRewardLabel(tier.premiumReward.label, 'he'),
        `tier ${tier.tier} premium`,
      );
      expect(localizeSeasonRewardLabel(tier.freeReward.label, 'en')).toBe(tier.freeReward.label);
    });
  });

  it('interpolates amounts instead of baking them into one sentence', () => {
    expect(localizeSeasonRewardLabel('25 Crystals', 'he')).toBe('25 קריסטלים');
    expect(localizeSeasonRewardLabel('3 Shields', 'he')).toBe('3 מגנים');
  });

  it('pins the English chrome', () => {
    const en = getSeasonPassCopy('en');
    expect(en.strings.claim).toBe('CLAIM');
    expect(en.strings.tierOf(3, 30)).toBe('TIER 3 OF 30');
    expect(en.strings.xp(12, 120)).toBe('12 / 120 XP');
  });
});

describe('shop copy', () => {
  const copy = getShopCopy('he');

  it('pins the English chrome', () => {
    const en = getShopCopy('en');
    expect(en.strings.title).toBe('✦ ARCADE SHOP ✦');
    expect(en.strings.restore).toBe('RESTORE PURCHASES');
    expect(en.strings.needGems.title).toBe('MORE GEMS NEEDED');
    expect(en.strings.subtitles.crystals).toBe('Get crystal bundles & streak shields');
  });

  it('translates tabs, slots, rarity badges and every pack', () => {
    eachString(copy.strings.tabs, (text) => expectHebrewOnly(text, 'tab'));
    eachString(copy.strings.slots, (text) => expectHebrewOnly(text, 'slot'));
    eachString(copy.strings.rarity, (text) => expectHebrewOnly(text, 'rarity'));
    STARDUST_PACK_IDS.forEach((id) => {
      const pack = copy.strings.stardustPacks[id];
      expect(pack).toBeDefined();
      expectHebrewOnly(pack.title, `${id}.title`);
      expectHebrewOnly(pack.subtitle, `${id}.subtitle`);
    });
    eachString(
      [copy.strings.starter, copy.strings.vault, copy.strings.chest, copy.strings.pouch, copy.strings.shields],
      (text) => expectHebrewOnly(text, 'crystalPack'),
    );
  });

  it('translates every catalog item name the shop can render', () => {
    [...SKIN_CATALOG, ...ACCESSORY_CATALOG].forEach((item) => {
      const name = localizeCatalogName(item.name, 'he');
      expect(name).not.toBe(item.name);
      expectHebrewOnly(name, item.id);
      expect(localizeCatalogName(item.name, 'en')).toBe(item.name);
    });
  });
});

describe('remaining unclaimed surfaces', () => {
  it('translates every world name in shop and hub', () => {
    WORLDS.forEach((world) => {
      expectHebrewOnly(localizeWorldName(world.id, 'he'), world.id);
      expect(localizeWorldName(world.id, 'en')).toBe(world.id.replace(/_/g, ' ').toUpperCase());
    });
  });

  it('translates hub, settings, common and currency copy', () => {
    eachString(getHubCopy('he').strings, (text) => expectHebrewOnly(text, 'hub'));
    eachString(getSettingsCopy('he').strings, (text) => expectHebrewOnly(text, 'settings'));
    eachString(getCommonCopy('he').strings, (text) => expectHebrewOnly(text, 'common'));
    eachString(getCurrencyCopy('he').strings, (text) => expectHebrewOnly(text, 'currency'));
  });

  it('keeps the English dictionaries on the shipped wording', () => {
    expect(getCommonCopy('en').strings.privacy).toBe('Privacy');
    expect(getSettingsCopy('en').strings.deleteTitle).toBe('Delete cloud account?');
    expect(getHubCopy('en').strings.unlockBody).toBe(
      'Unlock this portal now to play new games and meet exclusive critters!',
    );
    expect(getCurrencyCopy('en').strings.stardust).toBe('Stardust');
  });
});
