import type { TextStyle } from 'react-native';

/**
 * Hebrew copy is right-aligned and written RTL. The app is still LTR natively
 * (no `I18nManager.forceRTL`), so each screen mirrors its text explicitly
 * instead of relying on a global flip that would need a reload.
 */
export function rtlTextStyle(rtl: boolean): TextStyle | undefined {
  return rtl ? { textAlign: 'right', writingDirection: 'rtl' } : undefined;
}
