import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Gem, Sparkles, Zap } from 'lucide-react-native';
import Hub from './src/scenes/Hub';
import Collection from './src/scenes/Collection';
import Settings from './src/scenes/Settings';
import Leaderboard from './src/scenes/Leaderboard';
import Shop, { type Tab } from './src/scenes/Shop';
import LevelSelect from './src/scenes/LevelSelect';
import Achievements from './src/scenes/Achievements';
import SeasonPass from './src/scenes/SeasonPass';
import { CurrencyBar } from './src/ui/CurrencyBar';
import { DailyStreakModal } from './src/ui/DailyStreakModal';
import { ProfileModal } from './src/ui/ProfileModal';
import { useDailyLogin } from './src/store/dailyLogin';
import { getGameLevel, setGameLevel, useProfile, type GameId } from './src/store/profile';
import { useEconomy } from './src/store/economy';
import CritterBurrows from './src/games/burrows/CritterBurrows';
import OrbMerge from './src/games/orbs/OrbMerge';
import StarCatcher from './src/games/stars/StarCatcher';
import ShellShuffle from './src/games/shells/ShellShuffle';
import VineFlow from './src/games/vines/VineFlow';
import BeatCircuit from './src/games/beats/BeatCircuit';
import EchoPeaks from './src/games/peaks/EchoPeaks';
import { WORLDS, getWorld, homeWorld, type WorldId } from './src/worlds';
import { getDailyChallenge } from './src/engine/daily';
import { sfx } from './src/fx/sound';
import { initMonetization } from './src/services/monetization';
import { initAuth } from './src/services/supabase';
import { startSync } from './src/services/sync';
import { ParentalGate } from './src/ui/ParentalGate';
import { useParentalCommerceGate } from './src/ui/useParentalCommerceGate';

const isWorld = (s: string): s is WorldId => WORLDS.some((w) => w.id === s);

type Screen =
  | 'hub'
  | 'collection'
  | 'settings'
  | 'leaderboard'
  | 'shop'
  | 'level_select'
  | 'achievements'
  | 'season_pass'
  | WorldId;

/** Scene host. Hub <-> world stages. */
export default function App() {
  useEffect(() => {
    initMonetization();
    initAuth();
    startSync();
    useDailyLogin.getState().checkLogin();
  }, []);

  const [screen, setScreen] = useState<Screen>('hub');
  const [daily, setDaily] = useState(false);
  const [levelGame, setLevelGame] = useState<GameId>('burrows');
  const [startLevel, setStartLevel] = useState<number>(1);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [shopInitialTab, setShopInitialTab] = useState<Tab>('skins');
  const mode = useProfile((s) => s.mode);
  const { gateOpen, runGuarded, confirmGate, cancelGate } = useParentalCommerceGate();
  const spendStardust = useEconomy((s) => s.spendStardust);
  const spendCrystals = useEconomy((s) => s.spendCrystals);
  const veil = useSharedValue(0);

  const transitionTo = useCallback(
    (next: Screen, onMiddle?: () => void) => {
      veil.set(
        withTiming(1, { duration: 160 }, (done) => {
          if (!done) return;
          veil.set(withTiming(0, { duration: 220 }));
        }),
      );
      setTimeout(() => {
        onMiddle?.();
        setScreen(next);
      }, 160);
    },
    [veil],
  );

  const openShop = useCallback(
    (initialTab: Tab = 'skins') => {
      const doOpen = () => {
        setShopInitialTab(initialTab);
        sfx.play('whoosh');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        transitionTo('shop');
      };
      if (useProfile.getState().mode === 'TOYBOX') {
        runGuarded(doOpen);
      } else {
        doOpen();
      }
    },
    [transitionTo, runGuarded],
  );

  const enter = useCallback(
    (world: WorldId, isDaily = false) => {
      setDaily(isDaily);
      setStartLevel(Math.max(1, getGameLevel(getWorld(world).game) + 1));
      sfx.play('whoosh');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      transitionTo(world);
    },
    [transitionTo],
  );

  const handleConfirmSkipInGame = useCallback(
    (currency: 'stardust' | 'crystals') => {
      const doSkip = () => {
        const ok = currency === 'stardust' ? spendStardust(150) : spendCrystals(10);
        if (ok) {
          const nextLvl = startLevel + 1;
          if (isWorld(screen)) setGameLevel(getWorld(screen).game, nextLvl - 1);
          useProfile.getState().awardXp(50);
          sfx.play('chime', 0.9);
          sfx.play('sparkle', 0.8);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setStartLevel(nextLvl);
          setShowSkipModal(false);
        } else {
          sfx.play('sad', 0.5);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      };
      if (useProfile.getState().mode === 'TOYBOX') {
        runGuarded(doSkip);
      } else {
        doSkip();
      }
    },
    [screen, startLevel, spendStardust, spendCrystals, runGuarded],
  );

  const back = useCallback(() => {
    sfx.play('whoosh');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    transitionTo('hub', () => setDaily(false));
  }, [transitionTo]);

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
          onShop={() => openShop('skins')}
          onSeasonPass={() => setScreen('season_pass')}
          onLevelSelect={(game) => {
            setLevelGame(game);
            setScreen('level_select');
          }}
          onProfile={() => setShowProfileModal(true)}
        />
      ) : screen === 'collection' ? (
        <Collection
          onBack={back}
          onAchievements={() => setScreen('achievements')}
          onShop={() => openShop('skins')}
        />
      ) : screen === 'settings' ? (
        <Settings onBack={back} />
      ) : screen === 'leaderboard' ? (
        <Leaderboard onBack={back} />
      ) : screen === 'shop' ? (
        <Shop key={`shop_${shopInitialTab}`} onBack={back} initialTab={shopInitialTab} />
      ) : screen === 'level_select' ? (
        <LevelSelect
          game={levelGame}
          onBack={back}
          onSelectLevel={(lvl) => {
            setStartLevel(lvl);
            setScreen(homeWorld(levelGame));
          }}
          onOpenShop={(tab) => openShop(tab)}
        />
      ) : screen === 'achievements' ? (
        <Achievements onBack={back} />
      ) : screen === 'season_pass' ? (
        <SeasonPass onBack={back} />
      ) : getWorld(screen).game === 'burrows' ? (
        <CritterBurrows key={`burrows_${screen}_${startLevel}`} daily={daily} startLevel={startLevel} worldId={screen} />
      ) : getWorld(screen).game === 'orbs' ? (
        <OrbMerge key={`orbs_${screen}_${startLevel}`} daily={daily} startLevel={startLevel} worldId={screen} />
      ) : getWorld(screen).game === 'shells' ? (
        <ShellShuffle key={`shells_${screen}_${startLevel}`} daily={daily} startLevel={startLevel} worldId={screen} />
      ) : getWorld(screen).game === 'vines' ? (
        <VineFlow key={`vines_${screen}_${startLevel}`} daily={daily} startLevel={startLevel} worldId={screen} />
      ) : getWorld(screen).game === 'beats' ? (
        <BeatCircuit key={`beats_${screen}_${startLevel}`} daily={daily} startLevel={startLevel} worldId={screen} />
      ) : getWorld(screen).game === 'peaks' ? (
        <EchoPeaks key={`peaks_${screen}_${startLevel}`} daily={daily} startLevel={startLevel} worldId={screen} />
      ) : (
        <StarCatcher key={`stars_${screen}_${startLevel}`} daily={daily} startLevel={startLevel} worldId={screen as WorldId} />
      )}
      {screen === 'hub' && (
        <View style={styles.hubHeader} pointerEvents="box-none">
          <CurrencyBar
            onPressStardust={() => openShop('stardust')}
            onPressCrystals={() => openShop('crystals')}
          />
        </View>
      )}
      {screen !== 'hub' &&
        screen !== 'settings' &&
        screen !== 'leaderboard' &&
        screen !== 'shop' &&
        screen !== 'level_select' &&
        screen !== 'achievements' &&
        screen !== 'season_pass' && (
          <View style={styles.gameHeader} pointerEvents="box-none">
            <View style={styles.headerLeft}>
              <Pressable style={styles.back} hitSlop={14} onPress={back}>
                <View style={styles.chevron} />
              </Pressable>
              {mode !== 'TOYBOX' && (
                <CurrencyBar
                  style={styles.gameCurrency}
                  onPressStardust={() => openShop('stardust')}
                  onPressCrystals={() => openShop('crystals')}
                />
              )}
            </View>
            <Pressable
              style={styles.skipLvlBtn}
              onPress={() => {
                sfx.play('whoosh', 0.4);
                Haptics.selectionAsync();
                setShowSkipModal(true);
              }}
            >
              <Zap size={14} color="#FBBF24" />
              <Text style={styles.skipLvlText}>SKIP LVL</Text>
            </Pressable>
          </View>
        )}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, veilStyle]} />
      <ParentalGate visible={gateOpen} onSuccess={confirmGate} onCancel={cancelGate} />
      <DailyStreakModal />
      <ProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onStartDaily={() => {
          const challenge = getDailyChallenge();
          enter(challenge.world, true);
        }}
        onOpenShop={(tab) => {
          setShowProfileModal(false);
          openShop(tab);
        }}
      />

      {/* In-Game Skip Level Modal */}
      <Modal
        visible={showSkipModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSkipModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalEmoji}>⚡</Text>
            <Text style={styles.modalTitle}>
              SKIP TO LEVEL {startLevel + 1}?
            </Text>
            <Text style={styles.modalSubtitle}>
              Skip the current level immediately and jump straight into Level {startLevel + 1}!
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.stardustBtn]}
                onPress={() => handleConfirmSkipInGame('stardust')}
              >
                <Sparkles size={16} color="#FFFFFF" />
                <Text style={styles.modalBtnText}>★ 150 STARDUST</Text>
              </Pressable>

              <Pressable
                style={[styles.modalBtn, styles.crystalBtn]}
                onPress={() => handleConfirmSkipInGame('crystals')}
              >
                <Gem size={16} color="#FFFFFF" />
                <Text style={styles.modalBtnText}>💎 10 CRYSTALS</Text>
              </Pressable>

              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowSkipModal(false)}
              >
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
  hubHeader: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 90,
  },
  gameHeader: {
    position: 'absolute',
    top: 54,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,15,61,0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  chevron: {
    width: 13,
    height: 13,
    marginLeft: 4,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  gameCurrency: {
    marginLeft: 2,
  },
  skipLvlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(26,15,61,0.85)',
    borderWidth: 1.5,
    borderColor: '#FBBF24',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 19,
  },
  skipLvlText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  veil: { backgroundColor: '#FFFFFF' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 1, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  modalEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  modalActions: {
    width: '100%',
    gap: 10,
  },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
  },
  stardustBtn: {
    backgroundColor: '#D97706',
  },
  crystalBtn: {
    backgroundColor: '#0284C7',
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cancelBtn: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
