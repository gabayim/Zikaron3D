import { Linking } from 'react-native';

let WebBrowser: typeof import('expo-web-browser') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebBrowser = require('expo-web-browser');
} catch {
  WebBrowser = null;
}

/** Public site. Override with EXPO_PUBLIC_SITE_URL when the pages move. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://zmz.ca/zikaron3d').replace(/\/$/, '');

export const PRIVACY_URL = `${SITE_URL}/privacy.html`;
export const TERMS_URL = `${SITE_URL}/terms.html`;
export const SUPPORT_URL = `${SITE_URL}/support.html`;

/** Opens a legal page in the system browser. Call only after the parental gate. */
export function openLegal(url: string): Promise<unknown> {
  if (WebBrowser?.openBrowserAsync) {
    return WebBrowser.openBrowserAsync(url);
  }
  return Linking.openURL(url);
}
