import { I18nManager, NativeModules, Platform, Settings } from 'react-native';

export type Locale = 'en' | 'he';

const HEBREW_LOCALE = /^(he|iw)([-_]|$)/i;

/**
 * Resolve the preferred device locale without a native dependency.
 *
 * iOS exposes the preferred languages through the public Settings module,
 * Android through the I18nManager constants, and Intl covers everything else.
 * Every bridge read is guarded because these modules are absent in tests and
 * on some platforms.
 */
export function getDeviceLocale(): string {
  try {
    if (Platform.OS === 'ios') {
      const languages = Settings.get('AppleLanguages');
      if (Array.isArray(languages) && languages.length > 0) {
        return String(languages[0]);
      }
      const appleLocale = Settings.get('AppleLocale');
      if (typeof appleLocale === 'string') {
        return appleLocale;
      }
    } else if (Platform.OS === 'android') {
      const identifier = (NativeModules.I18nManager as { localeIdentifier?: unknown } | undefined)
        ?.localeIdentifier;
      if (typeof identifier === 'string') {
        return identifier;
      }
      const constants = (
        I18nManager as { getConstants?: () => { localeIdentifier?: string } | undefined }
      ).getConstants?.();
      if (typeof constants?.localeIdentifier === 'string') {
        return constants.localeIdentifier;
      }
    }
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return 'en';
  }
}

export function isHebrewLocale(locale: string): boolean {
  return HEBREW_LOCALE.test(locale);
}

export function getLocale(): Locale {
  return isHebrewLocale(getDeviceLocale()) ? 'he' : 'en';
}
