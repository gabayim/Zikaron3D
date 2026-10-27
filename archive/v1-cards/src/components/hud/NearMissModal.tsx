import React, { useEffect, useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { AlertCircle, Sparkles, X, Zap } from 'lucide-react-native';
import { useGameStore } from '../../store/useGameStore';
import { getChameleonTheme } from '../../theme/chameleonThemes';
import { SensoryManager } from '../../services/SensoryManager';

export const NearMissModal: React.FC = () => {
  const isNearMissActive = useGameStore((s) => s.isNearMissActive);
  const nearMissModalVisible = useGameStore((s) => s.nearMissModalVisible);
  const nearMissCards = useGameStore((s) => s.nearMissCards);
  const cards = useGameStore((s) => s.cards);
  const themePersona = useGameStore((s) => s.themePersona);
  const claimClutchSave = useGameStore((s) => s.claimClutchSave);
  const dismissNearMiss = useGameStore((s) => s.dismissNearMiss);

  const theme = useMemo(() => getChameleonTheme(themePersona), [themePersona]);

  // Animated values for 1.5s suspense phase
  const revealProgress = useSharedValue(0);
  const pulseTension = useSharedValue(1);
  const modalScale = useSharedValue(0.9);
  const modalOpacity = useSharedValue(0);

  // Find the partner card details for visual clue
  const targetCard = useMemo(() => {
    if (!nearMissCards) return null;
    return cards.find((c) => c.id === nearMissCards[0]);
  }, [nearMissCards, cards]);

  // 1.5s Tension countdown animation during board reveal phase
  useEffect(() => {
    if (isNearMissActive && !nearMissModalVisible) {
      revealProgress.value = 0;
      revealProgress.value = withTiming(1, {
        duration: 1500,
        easing: Easing.linear,
      });

      pulseTension.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 350, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.96, { duration: 350, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      revealProgress.value = 0;
      pulseTension.value = 1;
    }
  }, [isNearMissActive, nearMissModalVisible, revealProgress, pulseTension]);

  // Animate modal appearance when revealed
  useEffect(() => {
    if (nearMissModalVisible) {
      modalScale.value = withTiming(1, {
        duration: 320,
        easing: Easing.out(Easing.back(1.5)),
      });
      modalOpacity.value = withTiming(1, { duration: 250 });
    } else {
      modalScale.value = 0.9;
      modalOpacity.value = 0;
    }
  }, [nearMissModalVisible, modalScale, modalOpacity]);

  const animatedBannerStyle = useAnimatedStyle(() => {
    const scale = pulseTension.value;
    return {
      transform: [{ scale }],
    };
  });

  const animatedProgressStyle = useAnimatedStyle(() => {
    const widthPct = interpolate(revealProgress.value, [0, 1], [0, 100]);
    return {
      width: `${widthPct}%`,
    };
  });

  const animatedModalContentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: modalScale.value }],
    opacity: modalOpacity.value,
  }));

  const handleClaim = () => {
    SensoryManager.triggerMatch(2);
    claimClutchSave(4);
  };

  const handleDismiss = () => {
    SensoryManager.triggerMiss();
    dismissNearMiss();
  };

  return (
    <>
      {/* ================= 1.5s SUSPENSE BOARD REVEAL BANNER ================= */}
      {isNearMissActive && !nearMissModalVisible && (
        <View style={styles.revealBannerContainer} pointerEvents="none">
          <Animated.View
            style={[
              styles.revealBanner,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderColor: theme.colors.accent,
                borderRadius: theme.shape.radiusMedium,
              },
              animatedBannerStyle,
            ]}
          >
            <View style={styles.bannerHeaderRow}>
              <AlertCircle size={20} color={theme.colors.accent} />
              <Text
                style={[
                  styles.revealBannerTitle,
                  {
                    color: theme.colors.accent,
                    fontSize: theme.typography.headerSize,
                    letterSpacing: theme.typography.letterSpacing,
                  },
                ]}
              >
                NEAR MISS! TWIN REVEALED
              </Text>
            </View>

            <Text
              style={[
                styles.revealBannerSubtitle,
                {
                  color: theme.colors.textSecondary,
                  fontSize: theme.typography.captionSize,
                },
              ]}
            >
              Memorize the revealed partner card...
            </Text>

            {/* 1.5s Progress Bar Countdown */}
            <View
              style={[
                styles.progressBarTrack,
                { backgroundColor: theme.colors.feverTrack },
              ]}
            >
              <Animated.View
                style={[
                  styles.progressBarFill,
                  { backgroundColor: theme.colors.accent },
                  animatedProgressStyle,
                ]}
              />
            </View>
          </Animated.View>
        </View>
      )}

      {/* ================= CLUTCH SAVE (+4 FLIPS) MODAL ================= */}
      <Modal
        visible={nearMissModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View
          style={[
            styles.modalBackdrop,
            { backgroundColor: theme.colors.modalBackdrop },
          ]}
        >
          <Animated.View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderColor: theme.colors.surfaceBorderActive,
                borderRadius: theme.shape.radiusLarge,
              },
              animatedModalContentStyle,
            ]}
          >
            {/* Top Close / Dismiss Icon */}
            <TouchableOpacity
              onPress={handleDismiss}
              style={styles.closeIconBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>

            {/* Glowing Icon Ring */}
            <View
              style={[
                styles.modalIconRing,
                {
                  borderColor: theme.colors.accent,
                  backgroundColor: 'rgba(255, 215, 0, 0.1)',
                },
              ]}
            >
              <Zap size={38} color={theme.colors.accent} />
            </View>

            {/* Modal Title */}
            <Text
              style={[
                styles.modalTitle,
                {
                  color: theme.colors.textPrimary,
                  fontSize: theme.typography.titleSize,
                  letterSpacing: theme.typography.letterSpacing,
                },
              ]}
            >
              NEAR MISS!
            </Text>

            {/* Subtitle with missed object hint */}
            <Text
              style={[
                styles.modalSubtitle,
                {
                  color: theme.colors.textSecondary,
                  fontSize: theme.typography.bodySize,
                },
              ]}
            >
              You were one card away from completing the chain! The twin artifact was
              revealed during the clutch window.
            </Text>

            {/* Clue Vault Badge */}
            {targetCard && (
              <View
                style={[
                  styles.cardClueBadge,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.surfaceBorder,
                    borderRadius: theme.shape.radiusSmall,
                  },
                ]}
              >
                <Sparkles size={16} color={theme.colors.primary} />
                <Text
                  style={[
                    styles.cardClueText,
                    {
                      color: theme.colors.primary,
                      fontSize: theme.typography.captionSize + 1,
                    },
                  ]}
                >
                  Twin Artifact Memorized
                </Text>
              </View>
            )}

            {/* Primary Action Button: CLUTCH SAVE (+4 FLIPS) */}
            <TouchableOpacity
              onPress={handleClaim}
              activeOpacity={0.85}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: theme.colors.accent,
                  borderRadius: theme.shape.radiusMedium,
                },
              ]}
            >
              <Sparkles size={20} color="#000" />
              <Text
                style={[
                  styles.primaryBtnText,
                  {
                    fontSize: theme.typography.bodySize,
                    letterSpacing: theme.typography.letterSpacing,
                  },
                ]}
              >
                CLUTCH SAVE (+4 FLIPS)
              </Text>
            </TouchableOpacity>

            {/* Secondary Action Button: GIVE UP */}
            <TouchableOpacity
              onPress={handleDismiss}
              activeOpacity={0.65}
              style={styles.secondaryBtn}
            >
              <Text
                style={[
                  styles.secondaryBtnText,
                  {
                    color: theme.colors.textMuted,
                    fontSize: theme.typography.captionSize + 2,
                  },
                ]}
              >
                CONCEDE LEVEL
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  revealBannerContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 999,
  },
  revealBanner: {
    width: '100%',
    maxWidth: 320,
    padding: 16,
    borderWidth: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  revealBannerTitle: {
    fontWeight: '900',
    marginLeft: 8,
  },
  revealBannerSubtitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 16,
    position: 'relative',
  },
  closeIconBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  modalIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  cardClueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    marginBottom: 20,
  },
  cardClueText: {
    fontWeight: '700',
    marginLeft: 6,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 15,
    marginBottom: 12,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#05080E',
    fontWeight: '900',
    marginLeft: 8,
  },
  secondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    fontWeight: '700',
  },
});

export default NearMissModal;
