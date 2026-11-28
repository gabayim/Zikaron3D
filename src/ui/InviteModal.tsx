import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Copy, Gem, Plus, QrCode, Share2, Users, X } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { sfx } from '../fx/sound';
import {
  createReferralCode,
  listMyReferralCodes,
  myReferralCount,
  referralUrl,
  useReferral,
} from '../services/referral';

interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
}

export function InviteModal({ visible, onClose }: InviteModalProps) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const referralCount = useReferral((s) => s.referralCount);

  useEffect(() => {
    if (!visible) return;
    let active = true;

    async function loadCodes() {
      setLoading(true);
      const existing = await listMyReferralCodes();
      if (!active) return;

      if (existing.length > 0) {
        setCode(existing[0]);
      } else {
        const created = await createReferralCode();
        if (active && created) setCode(created);
      }
      await myReferralCount();
      if (active) setLoading(false);
    }

    void loadCodes();
    return () => {
      active = false;
    };
  }, [visible]);

  const handleNewCode = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    const newCode = await createReferralCode();
    setLoading(false);
    if (newCode) {
      setCode(newCode);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleShare = async () => {
    if (!code) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = referralUrl(code);
    try {
      await Share.share({
        message: `Play Zikaron3D with me and get a 500 Crystal welcome gift! ${url}`,
        url,
      });
    } catch {
      // User cancelled or share unavailable
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sfx.play('pop');
    const url = referralUrl(code);
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <X size={20} color="#94A3B8" />
          </Pressable>

          <View style={styles.headerRow}>
            <QrCode size={24} color="#38BDF8" />
            <Text style={styles.title}>Invite Friends</Text>
          </View>
          <Text style={styles.subtitle}>
            Share your QR code or referral link. When friends install, you both earn 500 Crystals!
          </Text>

          <View style={styles.qrContainer}>
            {loading || !code ? (
              <ActivityIndicator color="#38BDF8" size="large" />
            ) : (
              <View style={styles.qrCard}>
                <QRCode value={referralUrl(code)} size={190} backgroundColor="#FFFFFF" color="#0F172A" />
              </View>
            )}
          </View>

          {code ? (
            <View style={styles.codeRow}>
              <Text style={styles.codeText}>{code}</Text>
              <Pressable style={styles.newCodeBtn} onPress={handleNewCode} hitSlop={8}>
                <Plus size={16} color="#94A3B8" />
                <Text style={styles.newCodeText}>New</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Stats & Reward Badge */}
          <View style={styles.rewardBanner}>
            <View style={styles.rewardLeft}>
              <Gem size={18} color="#A78BFA" />
              <Text style={styles.rewardText}>+500 Crystals per friend</Text>
            </View>
            <View style={styles.statsBadge}>
              <Users size={14} color="#38BDF8" />
              <Text style={styles.statsText}>{referralCount} joined</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <Pressable style={styles.copyBtn} onPress={handleCopy} disabled={!code}>
              <Copy size={16} color="#F8FAFC" />
              <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy Link'}</Text>
            </Pressable>

            <Pressable style={styles.shareBtn} onPress={handleShare} disabled={!code}>
              <Share2 size={16} color="#0B132B" />
              <Text style={styles.shareBtnText}>Share Link</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 10, 24, 0.75)',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  qrContainer: {
    width: 220,
    height: 220,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  qrCard: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  codeText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 3,
  },
  newCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  newCodeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  rewardBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  rewardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rewardText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statsText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  actionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 14,
  },
  copyBtnText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 14,
  },
  shareBtnText: {
    color: '#0B132B',
    fontSize: 14,
    fontWeight: '800',
  },
});
