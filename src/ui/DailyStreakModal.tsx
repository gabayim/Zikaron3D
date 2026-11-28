import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Flame, Gem, Gift, Shield, Sparkles } from 'lucide-react-native';
import { sfx } from '../fx/sound';
import { getStreakCopy } from './i18n/streak';
import { STREAK_REWARDS, useDailyLogin } from '../store/dailyLogin';

export function DailyStreakModal() {
  const modalVisible = useDailyLogin((s) => s.modalVisible);
  const streak = useDailyLogin((s) => s.streak);
  const currentReward = useDailyLogin((s) => s.currentReward);
  const claimReward = useDailyLogin((s) => s.claimReward);
  const dismissModal = useDailyLogin((s) => s.dismissModal);
  const { strings, rtl } = getStreakCopy();

  if (!modalVisible || !currentReward) return null;

  const handleClaim = () => {
    sfx.play('chime', 0.9);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    claimReward();
  };

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="fade"
      onRequestClose={dismissModal}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.fireRow, rtl && styles.rowReverse]}>
              <Flame size={24} color="#F97316" />
              <Text style={[styles.streakTitle, rtl && styles.rtlCentered]}>
                {strings.streakTitle(streak)}
              </Text>
            </View>
            <Text style={[styles.subtitle, rtl && styles.rtlCentered]}>{strings.subtitle}</Text>
          </View>

          {/* 7-Day Track */}
          <View style={[styles.track, rtl && styles.rowReverse]}>
            {STREAK_REWARDS.map((r) => {
              const isPast = r.day < streak;
              const isToday = r.day === streak;
              return (
                <View
                  key={`day_${r.day}`}
                  style={[
                    styles.dayNode,
                    isToday && styles.dayNodeToday,
                    isPast && styles.dayNodePast,
                  ]}
                >
                  <Text
                    style={[styles.dayLabel, rtl && styles.rtlCentered]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {strings.dayLabel(r.day)}
                  </Text>
                  <View style={styles.iconContainer}>
                    {isPast ? (
                      <Check size={16} color="#22C55E" />
                    ) : r.crystals > 0 ? (
                      <Gem size={18} color="#38BDF8" />
                    ) : r.shields > 0 ? (
                      <Shield size={18} color="#F59E0B" />
                    ) : (
                      <Sparkles size={18} color="#FBBF24" />
                    )}
                  </View>
                  <Text style={[styles.rewardText, rtl && styles.rtlCentered]}>
                    {r.crystals > 0
                      ? `+${r.crystals}💎`
                      : r.shields > 0
                      ? `+1🛡️`
                      : `+${r.stardust}⭐`}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Today's Reward Spotlight */}
          <View style={styles.spotlight}>
            <Text style={[styles.spotlightTitle, rtl && styles.rtlCentered]}>
              {strings.todaysReward}
            </Text>
            <View style={[styles.rewardsRow, rtl && styles.rowReverse]}>
              {currentReward.stardust > 0 && (
                <View style={[styles.rewardPill, rtl && styles.rowReverse]}>
                  <Sparkles size={16} color="#FBBF24" />
                  <Text style={[styles.pillText, rtl && styles.rtlCentered]}>
                    {strings.stardust(currentReward.stardust)}
                  </Text>
                </View>
              )}
              {currentReward.crystals > 0 && (
                <View style={[styles.rewardPill, styles.crystalPill, rtl && styles.rowReverse]}>
                  <Gem size={16} color="#38BDF8" />
                  <Text style={[styles.pillText, styles.crystalText, rtl && styles.rtlCentered]}>
                    {strings.crystals(currentReward.crystals)}
                  </Text>
                </View>
              )}
              {currentReward.shields > 0 && (
                <View style={[styles.rewardPill, styles.shieldPill, rtl && styles.rowReverse]}>
                  <Shield size={16} color="#F59E0B" />
                  <Text style={[styles.pillText, styles.shieldText, rtl && styles.rtlCentered]}>
                    {strings.shield(currentReward.shields)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Claim Button */}
          <Pressable style={[styles.claimButton, rtl && styles.rowReverse]} onPress={handleClaim}>
            <Gift size={20} color="#0F172A" />
            <Text style={[styles.claimButtonText, rtl && styles.rtlCentered]}>
              {strings.claimReward}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /** RTL: swap the visual order of icon/label rows. */
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  /** RTL: keep centered text centered, only fix the bidi paragraph direction. */
  rtlCentered: {
    writingDirection: 'rtl',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 1, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  fireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  streakTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  track: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
    gap: 4,
  },
  dayNode: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dayNodeToday: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: '#F97316',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
  },
  dayNodePast: {
    opacity: 0.6,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
  },
  iconContainer: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  rewardText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  spotlight: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  spotlightTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  rewardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  crystalPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  shieldPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FDE047',
  },
  crystalText: {
    color: '#7DD3FC',
  },
  shieldText: {
    color: '#FCD34D',
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#38BDF8',
    borderRadius: 16,
    width: '100%',
    paddingVertical: 14,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  claimButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
