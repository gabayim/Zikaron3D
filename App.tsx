import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Hub from './src/scenes/Hub';
import Collection from './src/scenes/Collection';
import Settings from './src/scenes/Settings';
import Leaderboard from './src/scenes/Leaderboard';
import CritterBurrows from './src/games/burrows/CritterBurrows';
import OrbMerge from './src/games/orbs/OrbMerge';
import StarCatcher from './src/games/stars/StarCatcher';
import { type WorldId } from './src/worlds';
import { getDailyChallenge } from './src/engine/daily';
import { sfx } from './src/fx/sound';
import { initMonetization } from './src/services/monetization';
import { initAuth } from './src/services/supabase';
import { startSync } from './src/services/sync';

type Screen = 'hub' | 'collection' | 'settings' | 'leaderboard' | WorldId;

/** Scene host. Hub <-> world stages. Replace world stages with real games in Phase 3. */
export default function App() {
  useEffect(() => {
    initMonetization();
    initAuth();
    startSync();
  }, []);

  const [screen, setScreen] = useState<Screen>('hub');
  const [daily, setDaily] = useState(false);
  const veil = useSharedValue(0);

  const enter = useCallback(
    (world: WorldId, isDaily = false) => {
      setDaily(isDaily);
      setScreen(world);
      // Arrive from the portal's white-out.
      veil.set(1);
      veil.set(withTiming(0, { duration: 650 }));
    },
    [veil],
  );

  const back = useCallback(() => {
    sfx.play('whoosh', 0.5);
    Haptics.selectionAsync();
    setScreen('hub');
    setDaily(false);
  }, []);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.get() }));

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      {screen === 'hub' ? (
        <Hub
          onEnter={enter}
          onDaily={() => {
            const challenge = getDailyChallenge();
            enter(challenge.world, true);
          }}
          onCollection={() => setScreen('collection')}
          onSettings={() => setScreen('settings')}
          onLeaderboard={() => setScreen('leaderboard')}
        />
      ) : screen === 'collection' ? (
        <Collection onBack={back} />
      ) : screen === 'settings' ? (
        <Settings onBack={back} />
      ) : screen === 'leaderboard' ? (
        <Leaderboard onBack={back} />
      ) : screen === 'meadow' ? (
        <CritterBurrows daily={daily} />
      ) : screen === 'crystal' ? (
        <OrbMerge daily={daily} />
      ) : (
        <StarCatcher daily={daily} />
      )}
      {screen !== 'hub' && screen !== 'settings' && screen !== 'leaderboard' && (
        <Pressable style={styles.back} hitSlop={14} onPress={back}>
          <View style={styles.chevron} />
        </Pressable>
      )}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, veilStyle]} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
  back: {
    position: 'absolute',
    top: 54,
    left: 18,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,15,61,0.6)',
  },
  chevron: {
    width: 14,
    height: 14,
    marginLeft: 5,
    borderLeftWidth: 3.5,
    borderBottomWidth: 3.5,
    borderColor: '#FFFFFF',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  veil: { backgroundColor: '#FFFFFF' },
});
