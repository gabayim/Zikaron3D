import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, Image, StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { CardVisualId } from '../../engine/types';

/**
 * Static media dictionary for zero-latency bundled access.
 * Maps visual IDs to extracted Frame-0 WebP images and optimized HEVC MP4 loops.
 */
export const LIVING_CARD_ASSETS: Record<
  string,
  {
    frame0: any;
    video: any;
  }
> = {
  ruby_gem: {
    frame0: require('../../../assets/cards/ruby_gem_frame0.webp'),
    video: require('../../../assets/cards/ruby_gem_optimized.mp4'),
  },
  cosmic_star: {
    frame0: require('../../../assets/cards/cosmic_star_frame0.webp'),
    video: require('../../../assets/cards/cosmic_star_optimized.mp4'),
  },
  golden_ring: {
    frame0: require('../../../assets/cards/golden_ring_frame0.webp'),
    video: require('../../../assets/cards/golden_ring_optimized.mp4'),
  },
  crystal_prism: {
    frame0: require('../../../assets/cards/crystal_prism_frame0.webp'),
    video: require('../../../assets/cards/crystal_prism_optimized.mp4'),
  },
  sacred_flame: {
    frame0: require('../../../assets/cards/sacred_flame_frame0.webp'),
    video: require('../../../assets/cards/sacred_flame_optimized.mp4'),
  },
  water_drop: {
    frame0: require('../../../assets/cards/water_drop_frame0.webp'),
    video: require('../../../assets/cards/water_drop_optimized.mp4'),
  },
  emerald_leaf: {
    frame0: require('../../../assets/cards/emerald_leaf_frame0.webp'),
    video: require('../../../assets/cards/emerald_leaf_optimized.mp4'),
  },
  lightning_orb: {
    frame0: require('../../../assets/cards/lightning_orb_frame0.webp'),
    video: require('../../../assets/cards/lightning_orb_optimized.mp4'),
  },
};

export interface LivingPortalVideoProps {
  visualId: CardVisualId;
  isMatched: boolean;
  isFlipped?: boolean;
  size?: number;
  borderRadius?: number;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
  customVideoUri?: string;
  customFrame0Uri?: string;
  showAura?: boolean;
}

/**
 * LivingPortalVideo - Renders 1:1 square PixVerse Living Dioramas inside matched card vaults.
 *
 * Performance Architecture:
 * 1. Instant Card Flips: Displays static ~25KB Frame-0 WebP during fast flipping (0ms latency, zero decoding overhead).
 * 2. Seamless Living Transition: On card match (`isMatched = true`), launches the looped HEVC MP4 video
 *    and smoothly cross-fades from Frame 0 into the living 3D diorama.
 * 3. Matched Aura Pulse: Subtly breathes energy around the card frame once matched.
 */
export const LivingPortalVideo: React.FC<LivingPortalVideoProps> = ({
  visualId,
  isMatched,
  size = 180,
  borderRadius = 14,
  muted = false,
  style,
  customVideoUri,
  customFrame0Uri,
  showAura = true,
}) => {
  const asset = LIVING_CARD_ASSETS[visualId];

  // Resolve media sources (custom URI takes precedence, fallback to bundled asset)
  const imageSource = useMemo(() => {
    if (customFrame0Uri) return { uri: customFrame0Uri };
    return asset ? asset.frame0 : null;
  }, [customFrame0Uri, asset]);

  const videoSource = useMemo(() => {
    if (customVideoUri) return { uri: customVideoUri };
    return asset ? asset.video : null;
  }, [customVideoUri, asset]);

  // Animated values for smooth crossfade
  const videoOpacity = useSharedValue(0);
  const auraPulse = useSharedValue(1);

  // Configure expo-video player
  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = true;
    p.muted = muted;
    if (isMatched) {
      p.play();
    }
  });

  // Track playback state & trigger cross-fade
  useEffect(() => {
    if (!player) return;

    if (isMatched) {
      player.play();

      const subscription = player.addListener('statusChange', (payload) => {
        if (payload.status === 'readyToPlay' || (player as any).isPlaying) {
          videoOpacity.value = withTiming(1, {
            duration: 650,
            easing: Easing.out(Easing.cubic),
          });
        }
      });

      const fallbackTimer = setTimeout(() => {
        videoOpacity.value = withTiming(1, {
          duration: 650,
          easing: Easing.out(Easing.cubic),
        });
      }, 350);

      if (showAura) {
        auraPulse.value = withRepeat(
          withSequence(
            withTiming(1.08, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.96, { duration: 1400, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        );
      }

      return () => {
        subscription.remove();
        clearTimeout(fallbackTimer);
      };
    } else {
      player.pause();
      videoOpacity.value = 0;
      auraPulse.value = 1;
    }
  }, [isMatched, player, showAura, auraPulse, videoOpacity]);

  const animatedVideoStyle = useAnimatedStyle(() => ({
    opacity: videoOpacity.value,
  }));

  const animatedAuraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: auraPulse.value }],
    opacity: isMatched ? withTiming(0.85, { duration: 400 }) : 0,
  }));

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Dynamic Aura Glow (revealed on match) */}
      {showAura && (
        <Animated.View
          style={[
            styles.auraGlow,
            {
              width: size + 20,
              height: size + 20,
              borderRadius: borderRadius + 8,
            },
            animatedAuraStyle,
          ]}
          pointerEvents="none"
        />
      )}

      {/* Main Portal Viewport with beveled clipping */}
      <View
        style={[
          styles.viewport,
          {
            width: size,
            height: size,
            borderRadius,
          },
        ]}
      >
        {/* Layer 1: Frame-0 Static WebP (~25KB) - Instant zero-latency display */}
        {imageSource && (
          <Image
            source={imageSource}
            style={[styles.frame0Image, { width: size, height: size }]}
            resizeMode="cover"
          />
        )}

        {/* Layer 2: Living PixVerse MP4 Loop (cross-fades on match) */}
        {videoSource && isMatched && (
          <Animated.View style={[StyleSheet.absoluteFill, animatedVideoStyle]}>
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          </Animated.View>
        )}

        {/* Layer 3: Inner Glass Bevel / Reflection Edge */}
        <View
          style={[
            styles.innerBezelBorder,
            {
              borderRadius,
              borderColor: isMatched ? 'rgba(0, 229, 255, 0.45)' : 'rgba(255, 255, 255, 0.12)',
            },
          ]}
          pointerEvents="none"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  auraGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 229, 255, 0.22)',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 8,
  },
  viewport: {
    overflow: 'hidden',
    backgroundColor: '#0A0E14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame0Image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  innerBezelBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1.5,
  },
});

export default LivingPortalVideo;
