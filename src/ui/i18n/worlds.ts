import { getLocale, type Locale } from './locale';
import type { WorldId } from '../../worlds';

/**
 * World ids are Latin tokens in `src/worlds.ts`; the names the player sees are
 * copy. Keep this map in sync with `WORLDS` (`worldsI18n.test.ts` fails when an
 * id is missing) instead of rewriting the data module, which Hub also reads.
 */
const WORLD_NAMES: Record<Locale, Record<WorldId, string>> = {
  en: {
    meadow: 'MEADOW',
    crystal: 'CRYSTAL',
    candy: 'CANDY',
    deep_sea: 'DEEP SEA',
    grove: 'GROVE',
    circuit: 'CIRCUIT',
    summit: 'SUMMIT',
  },
  he: {
    meadow: 'אחו',
    crystal: 'קריסטל',
    candy: 'ממתקים',
    deep_sea: 'מעמקי הים',
    grove: 'חורשה',
    circuit: 'מעגלים',
    summit: 'פסגה',
  },
};

/** Display name for a world portal in the given locale. */
export function localizeWorldName(worldId: string, locale: Locale = getLocale()): string {
  const names = WORLD_NAMES[locale] as Record<string, string>;
  return names[worldId] ?? worldId.replace(/_/g, ' ').toUpperCase();
}
