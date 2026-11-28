import { getLocale, type Locale } from './locale';

export interface SettingsStrings {
  deleteTitle: string;
  deleteBody: string;
  cancel: string;
  delete: string;
}

const EN: SettingsStrings = {
  deleteTitle: 'Delete cloud account?',
  deleteBody: 'Removes your online profile and leaderboard entry. Progress on this device stays.',
  cancel: 'Cancel',
  delete: 'Delete',
};

const HE: SettingsStrings = {
  deleteTitle: 'למחוק את חשבון הענן?',
  deleteBody: 'הפעולה תמחק את הפרופיל המקוון ואת הרשומה בלוח המובילים. ההתקדמות במכשיר תישאר.',
  cancel: 'ביטול',
  delete: 'מחיקה',
};

const SETTINGS_STRINGS: Record<Locale, SettingsStrings> = { en: EN, he: HE };

export interface SettingsCopy {
  locale: Locale;
  rtl: boolean;
  strings: SettingsStrings;
}

export function getSettingsCopy(locale: Locale = getLocale()): SettingsCopy {
  return { locale, rtl: locale === 'he', strings: SETTINGS_STRINGS[locale] };
}
