import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Sparkles, Gem } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useEconomy } from '../store/economy';
import { sfx } from '../fx/sound';

export interface CurrencyBarProps {
  onPressShop?: () => void;
  onPressStardust?: () => void;
  onPressCrystals?: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function CurrencyBar({
  onPressShop,
  onPressStardust,
  onPressCrystals,
  style,
  compact = false,
}: CurrencyBarProps) {
  const stardust = useEconomy((s) => s.stardust);
  const crystals = useEconomy((s) => s.crystals);

  const prevDust = useRef(stardust);
  const prevCrystals = useRef(crystals);

  const dustScale = useSharedValue(1);
  const dustGlow = useSharedValue(0);
  const crystalScale = useSharedValue(1);
  const crystalGlow = useSharedValue(0);

  useEffect(() => {
    if (prevDust.current !== stardust) {
      prevDust.current = stardust;
      dustScale.set(
        withSequence(
          withTiming(1.25, { duration: 80 }),
          withSpring(1, { damping: 9, stiffness: 320 }),
        ),
      );
      dustGlow.set(
        withSequence(
          withTiming(1, { duration: 80 }),
          withTiming(0, { duration: 450 }),
        ),
      );
    }
  }, [stardust, dustScale, dustGlow]);

  useEffect(() => {
    if (prevCrystals.current !== crystals) {
      prevCrystals.current = crystals;
      crystalScale.set(
        withSequence(
          withTiming(1.25, { duration: 80 }),
          withSpring(1, { damping: 9, stiffness: 320 }),
        ),
      );
      crystalGlow.set(
        withSequence(
          withTiming(1, { duration: 80 }),
          withTiming(0, { duration: 450 }),
        ),
      );
    }
  }, [crystals, crystalScale, crystalGlow]);

  const dustAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dustScale.get() }],
    borderColor: dustGlow.get() > 0 ? '#FDE047' : 'rgba(251, 191, 36, 0.35)',
    backgroundColor: dustGlow.get() > 0 ? 'rgba(251, 191, 36, 0.25)' : 'rgba(15, 23, 42, 0.78)',
  }));

  const crystalAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: crystalScale.get() }],
    borderColor: crystalGlow.get() > 0 ? '#38BDF8' : 'rgba(56, 189, 248, 0.35)',
    backgroundColor: crystalGlow.get() > 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.78)',
  }));

  const handleDustPress = () => {
    const fn = onPressStardust ?? onPressShop;
    if (!fn) return;
    sfx.play('whoosh', 0.4);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fn();
  };

  const handleCrystalPress = () => {
    const fn = onPressCrystals ?? onPressShop;
    if (!fn) return;
    sfx.play('whoosh', 0.4);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fn();
  };

  const hasDustAction = Boolean(onPressStardust ?? onPressShop);
  const hasCrystalAction = Boolean(onPressCrystals ?? onPressShop);

  return (
    <View style={[styles.container, style]}>
      {/* Stardust pill */}
      <Animated.View style={[styles.pill, dustAnimStyle, compact && styles.compactPill]}>
        <Pressable
          style={styles.innerPressable}
          onPress={handleDustPress}
          hitSlop={8}
          disabled={!hasDustAction}
        >
          <Sparkles size={compact ? 12 : 14} color="#FBBF24" />
          <Text style={[styles.text, styles.stardustText, compact && styles.compactText]}>
            {stardust.toLocaleString()}
          </Text>
          {hasDustAction && (
            <View style={[styles.plusBadge, styles.dustPlusBadge]}>
              <Text style={styles.plusText}>+</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>

      {/* Crystal pill */}
      <Animated.View style={[styles.pill, styles.crystalPill, crystalAnimStyle, compact && styles.compactPill]}>
        <Pressable
          style={styles.innerPressable}
          onPress={handleCrystalPress}
          hitSlop={8}
          disabled={!hasCrystalAction}
        >
          <Gem size={compact ? 12 : 14} color="#38BDF8" />
          <Text style={[styles.text, styles.crystalText, compact && styles.compactText]}>
            {crystals.toLocaleString()}
          </Text>
          {hasCrystalAction && (
            <View style={[styles.plusBadge, styles.crystalPlusBadge]}>
              <Text style={styles.plusText}>+</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1.2,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  innerPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  compactPill: {
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  crystalPill: {
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  compactText: {
    fontSize: 11.5,
  },
  stardustText: {
    color: '#FDE047',
  },
  crystalText: {
    color: '#7DD3FC',
  },
  plusBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  dustPlusBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  crystalPlusBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.5)',
  },
  plusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 11,
  },
});
