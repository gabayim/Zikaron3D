import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { sfx } from '../fx/sound';

interface LevelSplashProps {
  level: number;
  gameTitle?: string;
  worldName?: string;
  triggerKey?: number | string;
}

export function LevelSplash({
  level,
  gameTitle,
  worldName,
  triggerKey,
}: LevelSplashProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);
  const translateY = useSharedValue(30);

  useEffect(() => {
    // Sound & Haptics on appearance
    try {
      sfx.play('chime', 0.9, 1.15);
      sfx.play('sparkle', 0.75, 1.0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // ignore
    }

    // Spring In -> Hold -> Glide Out
    translateY.value = withSequence(
      withSpring(0, { damping: 12, stiffness: 220 }),
      withDelay(1400, withTiming(-24, { duration: 380 })),
    );

    scale.value = withSequence(
      withSpring(1, { damping: 11, stiffness: 220 }),
      withDelay(1400, withTiming(1.12, { duration: 380 })),
    );

    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(1400, withTiming(0, { duration: 380 })),
    );
  }, [triggerKey, level, opacity, scale, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View style={[styles.card, animStyle]}>
        {/* Glow halo */}
        <View style={styles.glowBackdrop} />

        {/* Decorative Top Star Badge */}
        <View style={styles.badgeRow}>
          <Star size={16} color="#FBBF24" fill="#FBBF24" />
          <Text style={styles.levelTag}>STAGE READY</Text>
          <Star size={16} color="#FBBF24" fill="#FBBF24" />
        </View>

        {/* Big Bold Level Display */}
        <Text style={styles.levelNumber}>LEVEL {level}</Text>

        {/* World / Game Subtitle */}
        {(gameTitle || worldName) && (
          <View style={styles.subtitlePill}>
            <Text style={styles.subtitleText}>
              {[gameTitle, worldName].filter(Boolean).join(' • ').toUpperCase()}
            </Text>
          </View>
        )}

        {/* 3 Golden Stars */}
        <View style={styles.starsRow}>
          <Star size={18} color="#FFD84D" fill="#FFD84D" />
          <Star size={24} color="#FFE680" fill="#FFE680" />
          <Star size={18} color="#FFD84D" fill="#FFD84D" />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 36,
    borderRadius: 28,
    backgroundColor: 'rgba(10, 4, 30, 0.92)',
    borderWidth: 2,
    borderColor: 'rgba(255, 216, 77, 0.75)',
    shadowColor: '#FFD84D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 20,
    minWidth: 260,
  },
  glowBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  levelTag: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: '#FDE047',
  },
  levelNumber: {
    fontSize: 46,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    textShadowColor: 'rgba(251, 191, 36, 0.85)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 16,
    marginVertical: 4,
  },
  subtitlePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  subtitleText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 1.5,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
});