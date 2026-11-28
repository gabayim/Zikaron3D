import { getInviteCopy, REFERRAL_CRYSTALS } from '../i18n/invite';
import { getLocale, isHebrewLocale } from '../i18n/locale';

const URL = 'https://go.zmz.ca/r/ABC123';

describe('invite modal i18n', () => {
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

  it('returns Hebrew copy with RTL layout flags', () => {
    const copy = getInviteCopy('he');
    expect(copy.rtl).toBe(true);
    expect(copy.strings.title).toBe('הזמינו חברים');
    expect(copy.strings.subtitle(REFERRAL_CRYSTALS)).toContain('קריסטלים');
    expect(copy.strings.rewardPerFriend(REFERRAL_CRYSTALS)).toContain('לכל חבר');
    expect(copy.strings.joined(3)).toContain('3');
    expect(copy.strings.joined(3)).toContain('הצטרפו');
    expect(copy.strings.shareMessage(URL, REFERRAL_CRYSTALS)).toContain(URL);
  });

  it('keeps the English copy unchanged with LTR layout', () => {
    const copy = getInviteCopy('en');
    expect(copy.rtl).toBe(false);
    expect(copy.strings.title).toBe('Invite Friends');
    expect(copy.strings.subtitle(REFERRAL_CRYSTALS)).toBe(
      'Share your QR code or referral link. When friends install, you both earn 500 Crystals!',
    );
    expect(copy.strings.rewardPerFriend(REFERRAL_CRYSTALS)).toBe('+500 Crystals per friend');
    expect(copy.strings.joined(0)).toBe('0 joined');
    expect(copy.strings.copyLink).toBe('Copy Link');
    expect(copy.strings.copied).toBe('Copied!');
    expect(copy.strings.shareLink).toBe('Share Link');
    expect(copy.strings.shareMessage(URL, REFERRAL_CRYSTALS)).toBe(
      `Play Zikaron3D with me and get a 500 Crystal welcome gift! ${URL}`,
    );
  });

  it('has no untranslated English words in the Hebrew copy', () => {
    const { strings } = getInviteCopy('he');
    const visible = [
      strings.title,
      strings.subtitle(REFERRAL_CRYSTALS),
      strings.newCode,
      strings.rewardPerFriend(REFERRAL_CRYSTALS),
      strings.joined(7),
      strings.copyLink,
      strings.copied,
      strings.shareLink,
      strings.shareMessage(URL, REFERRAL_CRYSTALS),
    ];
    for (const text of visible) {
      expect(text).toMatch(/[\u0590-\u05FF]/);
      const withoutBrandAndUrl = text
        .replace(new RegExp(URL, 'g'), '')
        .replace(/Zikaron3D/g, '')
        .replace(/\+?\d+/g, '');
      expect(withoutBrandAndUrl).not.toMatch(/[A-Za-z]{3,}/);
    }
  });
});
