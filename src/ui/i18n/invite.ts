import { getLocale, type Locale } from './locale';

/**
 * Crystals granted to each side of a referral. Kept beside the copy so the
 * banner, the share message and the server-side reward stay in sync.
 * The authoritative value lives in the `referral-claim` edge function.
 */
export const REFERRAL_CRYSTALS = 50;

export interface InviteStrings {
  /** Modal headline. */
  title: string;
  /** Explains what the QR code and link do, including the reward. */
  subtitle: (crystals: number) => string;
  /** Button that mints a replacement referral code. */
  newCode: string;
  /** Reward line above the join counter. */
  rewardPerFriend: (crystals: number) => string;
  /** How many friends joined through this player's codes. */
  joined: (count: number) => string;
  copyLink: string;
  copied: string;
  shareLink: string;
  /** Body of the OS share sheet. The URL is appended verbatim. */
  shareMessage: (url: string, crystals: number) => string;
}

const EN: InviteStrings = {
  title: 'Invite Friends',
  subtitle: (crystals) =>
    `Share your QR code or referral link. When friends install, you both earn ${crystals} Crystals!`,
  newCode: 'New',
  rewardPerFriend: (crystals) => `+${crystals} Crystals per friend`,
  joined: (count) => `${count} joined`,
  copyLink: 'Copy Link',
  copied: 'Copied!',
  shareLink: 'Share Link',
  shareMessage: (url, crystals) =>
    `Play Zikaron3D with me and get a ${crystals} Crystal welcome gift! ${url}`,
};

const HE: InviteStrings = {
  title: 'הזמינו חברים',
  subtitle: (crystals) =>
    `שתפו את קוד ה-QR או קישור ההפניה. כשחברים מתקינים, שניכם מקבלים ${crystals} קריסטלים!`,
  newCode: 'חדש',
  rewardPerFriend: (crystals) => `+${crystals} קריסטלים לכל חבר`,
  joined: (count) => `${count} הצטרפו`,
  copyLink: 'העתקת קישור',
  copied: 'הועתק!',
  shareLink: 'שיתוף קישור',
  shareMessage: (url, crystals) =>
    `שחקו איתי ב-Zikaron3D וקבלו מתנת ברוכים הבאים של ${crystals} קריסטלים! ${url}`,
};

const INVITE_STRINGS: Record<Locale, InviteStrings> = { en: EN, he: HE };

export interface InviteCopy {
  locale: Locale;
  /** True when the component must mirror its rows and align text to the right. */
  rtl: boolean;
  strings: InviteStrings;
}

/** Copy for the invite-friends modal in the device language. */
export function getInviteCopy(locale: Locale = getLocale()): InviteCopy {
  return { locale, rtl: locale === 'he', strings: INVITE_STRINGS[locale] };
}
