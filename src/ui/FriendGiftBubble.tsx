import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Gift, Sparkles, X } from 'lucide-react-native';
import { sfx } from '../fx/sound';
import {
  claimReferral,
  dismissPastePrompt,
  extractReferralCode,
  useReferral,
} from '../services/referral';

export function FriendGiftBubble() {
  const pendingPaste = useReferral((s) => s.pendingPaste);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!pendingPaste) return null;

  const handleProcessCode = async (rawText: string) => {
    const code = extractReferralCode(rawText);
    if (!code) {
      setFeedback('No gift code found in clipboard');
      setTimeout(() => setFeedback(null), 2500);
      return;
    }

    setLoading(true);
    setFeedback(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const res = await claimReferral(code);
    setLoading(false);

    if (res.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sfx.play('chime');
      setTimeout(() => sfx.play('sparkle'), 200);
      setFeedback('Gift claimed! +500 Crystals');
      setTimeout(() => {
        void dismissPastePrompt();
      }, 1800);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback(
        res.reason === 'already_referred'
          ? 'Already claimed a referral!'
          : 'Could not claim this code.',
      );
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  const handleManualPaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      await handleProcessCode(text);
    } catch {
      setFeedback('Clipboard access denied');
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  const handleDismiss = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void dismissPastePrompt();
  };

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <View style={styles.iconCircle}>
          <Gift size={20} color="#FBBF24" />
        </View>

        <View style={styles.textCol}>
          <Text style={styles.title}>Got a link from a friend?</Text>
          <Text style={styles.subtitle}>
            {feedback ?? 'Paste to claim your 500 Crystal welcome gift!'}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#FBBF24" size="small" style={styles.loader} />
        ) : (
          <View style={styles.btnRow}>
            {Platform.OS === 'ios' && Clipboard.ClipboardPasteButton ? (
              <Clipboard.ClipboardPasteButton
                style={styles.iosPasteBtn}
                displayMode="iconAndLabel"
                onPress={(data) => {
                  if (data.type === 'text' && data.text) {
                    void handleProcessCode(data.text);
                  }
                }}
              />
            ) : (
              <Pressable style={styles.pasteBtn} onPress={handleManualPaste}>
                <Sparkles size={14} color="#0B132B" />
                <Text style={styles.pasteBtnText}>Paste</Text>
              </Pressable>
            )}

            <Pressable style={styles.dismissBtn} onPress={handleDismiss} hitSlop={8}>
              <X size={16} color="#94A3B8" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 999,
  },
  bubble: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
  },
  loader: {
    paddingHorizontal: 12,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iosPasteBtn: {
    width: 80,
    height: 34,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FBBF24',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pasteBtnText: {
    color: '#0B132B',
    fontSize: 12,
    fontWeight: '800',
  },
  dismissBtn: {
    padding: 6,
  },
});
