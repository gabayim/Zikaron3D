import React, { useEffect, useMemo } from 'react';
import {
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
import { Flame, Shield } from 'lucide-react-native';
import { useGameStore } from '../../store/useGameStore';
import { getChameleonTheme } from '../../theme/chameleonThemes';
import { SensoryManager } from '../../services/SensoryManager';

/**
 * Individual animated ember particle along the 3D vault border.
 */
const BorderEmber: React.FC<{
  index: number;
  total: number;
  color: string;
  active: boolean;
}> = ({ index, total, color, active }) => {
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 1200 + (index % 4) * 350,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(0, {
          duration: 1200 + (index % 4) * 350,
          easing: Easing.inOut(Easing.quad),
        })
      ),
      -1,
      true
    );
  }, [anim, index]);

  const animatedStyle = useAnimatedStyle(() => {
    const leftPercent = ((index + 0.5) / total) * 100;
    const translateY = interpolate(anim.value, [0, 1], [-2, -8]);
    const scale = interpolate(anim.value, [0, 0.5, 1], [0.6, 1.2, 0.7]);
    const opacity = active ? interpolate(anim.value, [0, 0.5, 1], [0.3, 0.95, 0.4]) : 0;

    return {
      left: `${leftPercent}%`,
      transform: [{ translateY }, { scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.emberParticle,
        {
          backgroundColor: color,
          shadowColor: color,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    />
  );
};

export const FeverVaultBar: React.FC = () => {
  const themePersona = useGameStore((s) => s.themePersona);
  const feverMultiplier = useGameStore((s) => s.feverMultiplier);
  const feverMeter = useGameStore((s) => s.feverMeter);
  const streakShield = useGameStore((s) => s.streakShield);
  const streakShieldInventory = useGameStore((s) => s.streakShieldInventory);
  const activateStreakShield = useGameStore((s) => s.activateStreakShield);

  const theme = useMemo(() => getChameleonTheme(themePersona), [themePersona]);

  // Animated progress fill width
  const progressAnim = useSharedValue(feverMeter);
  const badgePulse = useSharedValue(1);
  const shieldRingPulse = useSharedValue(1);

  // Sync progress animation
  useEffect(() => {
    progressAnim.value = withTiming(Math.min(100, Math.max(0, feverMeter)), {
      duration: 380,
      easing: Easing.out(Easing.cubic),
    });
  }, [feverMeter, progressAnim]);

  // Pulse multiplier badge when multiplier > 1
  useEffect(() => {
    if (feverMultiplier > 1) {
      badgePulse.value = withSequence(
        withTiming(1.22, { duration: 180, easing: Easing.out(Easing.back(2)) }),
        withTiming(1.0, { duration: 250, easing: Easing.inOut(Easing.ease) })
      );
    } else {
      badgePulse.value = withTiming(1.0, { duration: 200 });
    }
  }, [feverMultiplier, badgePulse]);

  // Pulse kinetic shield energy ring when active
  useEffect(() => {
    if (streakShield) {
      shieldRingPulse.value = withRepeat(
        withSequence(
          withTiming(1.14, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.98, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      shieldRingPulse.value = 1;
    }
  }, [streakShield, shieldRingPulse]);

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value}%`,
  }));

  const animatedBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgePulse.value }],
  }));

  const animatedShieldRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shieldRingPulse.value }],
    opacity: streakShield ? 0.9 : 0,
  }));

  const isFeverMax = feverMultiplier >= 8;
  const isFeverHigh = feverMultiplier >= 4;

  const currentFillColor = isFeverMax
    ? theme.colors.feverMax
    : isFeverHigh
      ? theme.colors.danger
      : feverMultiplier > 1
        ? theme.colors.accent
        : theme.colors.feverFill;

  const emberList = useMemo(() => {
    return Array.from({ length: theme.animation.emberCount }).map((_, i) => ({
      id: i,
      color: theme.colors.feverEmbers[i % theme.colors.feverEmbers.length],
    }));
  }, [theme]);

  const handleShieldPress = () => {
    if (!streakShield && streakShieldInventory > 0) {
      SensoryManager.triggerShieldDeflect();
      activateStreakShield();
    }
  };

  return (
    <View
      style={[
        styles.outerContainer,
        {
          backgroundColor: theme.colors.surface,
          borderColor: feverMultiplier > 1 ? currentFillColor : theme.colors.surfaceBorder,
          borderRadius: theme.shape.radiusMedium,
        },
      ]}
    >
      {/* ================= 3D BORDER EMBERS LAYER ================= */}
      <View style={styles.embersOverlay} pointerEvents="none">
        {emberList.map((ember) => (
          <BorderEmber
            key={ember.id}
            index={ember.id}
            total={emberList.length}
            color={ember.color}
            active={feverMultiplier > 1 || feverMeter > 10}
          />
        ))}
      </View>

      {/* ================= FEVER MULTIPLIER VAULT BADGE ================= */}
      <Animated.View
        style={[
          styles.multiplierBadge,
          {
            borderRadius: theme.shape.radiusSmall,
            backgroundColor:
              feverMultiplier > 1
                ? 'rgba(255, 215, 0, 0.16)'
                : theme.colors.surfaceElevated,
            borderColor:
              feverMultiplier > 1 ? currentFillColor : theme.colors.surfaceBorder,
          },
          animatedBadgeStyle,
        ]}
      >
        <Flame
          size={16}
          color={feverMultiplier > 1 ? currentFillColor : theme.colors.textMuted}
        />
        <Text
          style={[
            styles.multiplierText,
            {
              fontSize: theme.typography.captionSize + 2,
              color: feverMultiplier > 1 ? currentFillColor : theme.colors.textMuted,
            },
          ]}
        >
          {feverMultiplier}x
        </Text>
      </Animated.View>

      {/* ================= 3D BEVELED PROGRESS TRACK ================= */}
      <View
        style={[
          styles.trackContainer,
          {
            backgroundColor: theme.colors.feverTrack,
            borderRadius: theme.shape.radiusSmall,
          },
        ]}
      >
        {/* Glow backlight behind active fill */}
        {feverMultiplier > 1 && (
          <View
            style={[
              styles.fillGlowBackdrop,
              {
                backgroundColor: currentFillColor,
                opacity: isFeverMax ? 0.45 : 0.25,
              },
            ]}
          />
        )}

        {/* Liquid Plasma Progress Fill */}
        <Animated.View
          style={[
            styles.fillBar,
            {
              backgroundColor: currentFillColor,
              borderRadius: theme.shape.radiusSmall,
            },
            animatedFillStyle,
          ]}
        >
          {/* Subtle 3D Top Bevel Highlight on liquid fill */}
          <View style={styles.fillHighlight} />
        </Animated.View>

        {/* Combo Status Moniker */}
        <View style={styles.trackLabelOverlay} pointerEvents="none">
          <Text
            style={[
              styles.trackStatusText,
              {
                fontSize: theme.typography.captionSize - 1,
                color: feverMultiplier > 1 ? '#FFFFFF' : theme.colors.textMuted,
                letterSpacing: theme.typography.letterSpacing,
              },
            ]}
          >
            {isFeverMax
              ? 'MAX FEVER'
              : feverMultiplier >= 4
                ? 'OVERDRIVE'
                : feverMultiplier > 1
                  ? 'FEVER COMBO'
                  : 'FEVER METER'}
          </Text>
        </View>
      </View>

      {/* ================= PERSISTENT STREAK SHIELD INDICATOR ================= */}
      <View style={styles.shieldWrapper}>
        {/* Kinetic Aura Ring when Shield Active */}
        <Animated.View
          style={[
            styles.shieldEnergyRing,
            {
              borderColor: theme.colors.shieldActive,
              borderRadius: theme.shape.radiusSmall + 4,
            },
            animatedShieldRingStyle,
          ]}
          pointerEvents="none"
        />

        <TouchableOpacity
          onPress={handleShieldPress}
          disabled={streakShield || streakShieldInventory === 0}
          activeOpacity={0.75}
          style={[
            styles.shieldButton,
            {
              borderRadius: theme.shape.radiusSmall,
              backgroundColor: streakShield
                ? theme.colors.shieldGlow
                : theme.colors.surfaceElevated,
              borderColor: streakShield
                ? theme.colors.shieldActive
                : streakShieldInventory > 0
                  ? theme.colors.surfaceBorder
                  : 'rgba(255,255,255,0.05)',
            },
          ]}
        >
          <Shield
            size={16}
            color={
              streakShield
                ? theme.colors.shieldActive
                : streakShieldInventory > 0
                  ? theme.colors.textSecondary
                  : theme.colors.textMuted
            }
          />
          <Text
            style={[
              styles.shieldText,
              {
                fontSize: theme.typography.captionSize,
                color: streakShield
                  ? theme.colors.shieldActive
                  : streakShieldInventory > 0
                    ? theme.colors.textSecondary
                    : theme.colors.textMuted,
              },
            ]}
          >
            {streakShield ? 'ACTIVE' : `x${streakShieldInventory}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  embersOverlay: {
    position: 'absolute',
    top: -6,
    left: 45,
    right: 90,
    height: 12,
  },
  emberParticle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  multiplierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1.5,
    marginRight: 10,
  },
  multiplierText: {
    fontWeight: '900',
    marginLeft: 3,
  },
  trackContainer: {
    flex: 1,
    height: 14,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  fillGlowBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  fillBar: {
    height: '100%',
    position: 'relative',
  },
  fillHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  trackLabelOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackStatusText: {
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  shieldWrapper: {
    position: 'relative',
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shieldEnergyRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderWidth: 1.5,
  },
  shieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1.5,
  },
  shieldText: {
    fontWeight: '800',
    marginLeft: 4,
  },
});

export default FeverVaultBar;
