import { getGiftCopy, GIFT_CRYSTALS } from '../i18n/gift';
import { getLocale, isHebrewLocale } from '../i18n/locale';

describe('friend gift banner i18n', () => {
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

  it('returns Hebrew banner copy with RTL enabled', () => {
    const copy = getGiftCopy('he');
    expect(copy.rtl).toBe(true);
    expect(copy.strings.title).toBe('קיבלתם קישור מחבר?');
    expect(copy.strings.subtitle).toContain('מתנת ברוכים הבאים');
    expect(copy.strings.subtitle).toContain(String(GIFT_CRYSTALS));
    expect(copy.strings.giftClaimed(GIFT_CRYSTALS)).toContain('קריסטלים');
  });

  it('returns English banner copy with LTR layout', () => {
    const copy = getGiftCopy('en');
    expect(copy.rtl).toBe(false);
    expect(copy.strings.title).toBe('Got a link from a friend?');
    expect(copy.strings.subtitle).toContain('welcome gift');
    expect(copy.strings.giftClaimed(500)).toBe('Gift claimed! +500 Crystals');
  });

  it('has no English text left in the Hebrew copy', () => {
    const { strings } = getGiftCopy('he');
    const visible = [
      strings.title,
      strings.subtitle,
      strings.paste,
      strings.noCodeFound,
      strings.giftClaimed(GIFT_CRYSTALS),
      strings.alreadyClaimed,
      strings.claimFailed,
      strings.clipboardDenied,
    ];
    for (const text of visible) {
      expect(text).toMatch(/[\u0590-\u05FF]/);
      expect(text.replace(/\+?\d+/g, '')).not.toMatch(/[A-Za-z]{3,}/);
    }
  });
});
