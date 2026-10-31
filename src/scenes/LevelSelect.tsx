import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Gem, Lock, Sparkles, Star, Zap } from 'lucide-react-native';
import { sfx } from '../fx/sound';
import { useProfile, type GameId } from '../store/profile';
import { useEconomy } from '../store/economy';
import {
  BURROWS_LEVELS,
  ORB_LEVELS,
  STAR_LEVELS,
} from '../engine/levelTables';
import { CurrencyBar } from '../ui/CurrencyBar';

interface LevelSelectProps {
  game: GameId;
  onSelectLevel: (level: number) => void;
  onBack: () => void;
  onOpenShop?: (tab: 'stardust' | 'crystals') => void;
}

const GAME_TITLES: Record<GameId, string> = {
  burrows: 'CRITTER BURROWS',
  orbs: 'ORB MERGE',
  stars: 'STAR CATCHER',
};

const GAME_COLORS: Record<GameId, string> = {
  burrows: '#10B981',
  orbs: '#06B6D4',
  stars: '#F59E0B',
};

export default function LevelSelect({
  game,
  onSelectLevel,
  onBack,
  onOpenShop,
}: LevelSelectProps) {
  // Progress from profile
  const burrowsLevel = useProfile((s) => Math.max(1, (s.burrowsLevel || 0) + 1));
  const orbLevel = useProfile((s) => Math.max(1, (s.orbLevel || 0) + 1));
  const starLevel = useProfile((s) => Math.max(1, (s.starLevel || 0) + 1));
  const spendStardust = useEconomy((s) => s.spendStardust);
  const spendCrystals = useEconomy((s) => s.spendCrystals);
  const [skipTargetLevel, setSkipTargetLevel] = useState<number | null>(null);

  const maxUnlockedLevel = useMemo(() => {
    if (game === 'burrows') return Math.min(30, Math.max(burrowsLevel, 1));
    if (game === 'orbs') return Math.min(30, Math.max(orbLevel, 1));
    return Math.min(30, Math.max(starLevel, 1));
  }, [game, burrowsLevel, orbLevel, starLevel]);

  type LevelItem = { level: number; mechanics?: string[]; stardustReward: number; firstClearBonus: number; };
  const levelConfigs: LevelItem[] = useMemo(() => {
    if (game === 'burrows') return BURROWS_LEVELS;
    if (game === 'orbs') return ORB_LEVELS;
    return STAR_LEVELS;
  }, [game]);

  const handleLevelPress = useCallback(
    (lvl: number) => {
      if (lvl > maxUnlockedLevel) {
        setSkipTargetLevel(maxUnlockedLevel + 1);
        sfx.play('whoosh', 0.4);
        Haptics.selectionAsync();
        return;
      }
      sfx.play('whoosh', 0.5);
      Haptics.selectionAsync();
      onSelectLevel(lvl);
    },
    [maxUnlockedLevel, onSelectLevel],
  );

  const handleConfirmSkip = useCallback(
    (currency: 'stardust' | 'crystals') => {
      if (!skipTargetLevel) return;
      const ok = currency === 'stardust' ? spendStardust(150) : spendCrystals(10);
      if (ok) {
        if (game === 'burrows') {
          useProfile.getState().setBurrowsLevel(skipTargetLevel - 1);
        } else if (game === 'orbs') {
          useProfile.getState().setOrbLevel(skipTargetLevel - 1);
        } else if (game === 'stars') {
          useProfile.getState().setStarLevel(skipTargetLevel - 1);
        }
        useProfile.getState().awardXp(50);
        sfx.play('chime', 0.9);
        sfx.play('sparkle', 0.8);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSkipTargetLevel(null);
      } else {
        sfx.play('sad', 0.5);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [skipTargetLevel, spendStardust, spendCrystals, game],
  );

  const accentColor = GAME_COLORS[game];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            sfx.play('whoosh', 0.5);
            Haptics.selectionAsync();
            onBack();
          }}
          hitSlop={12}
        >
          <ArrowLeft size={22} color="#F8FAFC" />
        </Pressable>

        <View style={styles.titleContainer}>
          <Text style={[styles.gameTitle, { color: accentColor }]}>
            {GAME_TITLES[game]}
          </Text>
          <Text style={styles.subtitle}>CHOOSE LEVEL (1–30)</Text>
        </View>

        <CurrencyBar
          onPressStardust={() => onOpenShop?.('stardust')}
          onPressCrystals={() => onOpenShop?.('crystals')}
        />
      </View>

      {/* Levels Grid (30 levels) */}
      <FlatList
        data={levelConfigs}
        keyExtractor={(item) => `level_${item.level}`}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isUnlocked = item.level <= maxUnlockedLevel;
          const isCurrent = item.level === maxUnlockedLevel;
          const isCleared = item.level < maxUnlockedLevel;

          const mechanics =
            'mechanics' in item ? (item.mechanics as string[]) : [];
          const primaryBadge = mechanics[0] ? mechanics[0].toUpperCase() : null;

          return (
            <Pressable
              style={[
                styles.levelCard,
                isUnlocked && styles.levelCardUnlocked,
                isCurrent && { borderColor: accentColor, borderWidth: 2 },
              ]}
              onPress={() => handleLevelPress(item.level)}
            >
              {/* Level Number or Lock */}
              <View style={styles.levelHeader}>
                {isUnlocked ? (
                  <Text
                    style={[
                      styles.levelNumber,
                      isCurrent && { color: accentColor },
                    ]}
                  >
                    {item.level}
                  </Text>
                ) : (
                  <Lock size={18} color="#475569" />
                )}
              </View>

              {/* Stars earned (preview 3 stars if cleared, 1 if current) */}
              <View style={styles.starsRow}>
                <Star
                  size={12}
                  color={isCleared ? '#FBBF24' : '#334155'}
                  fill={isCleared ? '#FBBF24' : 'transparent'}
                />
                <Star
                  size={12}
                  color={isCleared ? '#FBBF24' : '#334155'}
                  fill={isCleared ? '#FBBF24' : 'transparent'}
                />
                <Star
                  size={12}
                  color={isCleared ? '#FBBF24' : '#334155'}
                  fill={isCleared ? '#FBBF24' : 'transparent'}
                />
              </View>

              {/* Special Mechanic badge */}
              {primaryBadge && isUnlocked && (
                <View
                  style={[
                    styles.mechanicBadge,
                    { backgroundColor: `${accentColor}25` },
                  ]}
                >
                  <Text
                    style={[styles.mechanicText, { color: accentColor }]}
                    numberOfLines={1}
                  >
                    {primaryBadge}
                  </Text>
                </View>
              )}

              {/* Reward preview */}
              {isUnlocked && (
                <View style={styles.rewardRow}>
                  <Sparkles size={11} color="#FBBF24" />
                  <Text style={styles.rewardText}>+{item.stardustReward}</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />

      {/* Quick Skip Bar */}
      {maxUnlockedLevel < 30 && (
        <View style={styles.skipBar}>
          <View style={styles.skipBarInfo}>
            <Text style={styles.skipBarTitle}>NEXT LEVEL: {maxUnlockedLevel + 1}</Text>
            <Text style={styles.skipBarSubtitle}>Skip ahead using Stardust or Crystals</Text>
          </View>
          <Pressable
            style={[styles.skipButton, { backgroundColor: accentColor }]}
            onPress={() => {
              sfx.play('whoosh', 0.4);
              Haptics.selectionAsync();
              setSkipTargetLevel(maxUnlockedLevel + 1);
            }}
          >
            <Zap size={15} color="#0B0620" />
            <Text style={styles.skipButtonText}>SKIP LVL</Text>
          </Pressable>
        </View>
      )}

      {/* Skip Level Modal */}
      <Modal
        visible={skipTargetLevel !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSkipTargetLevel(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalEmoji}>⚡</Text>
            <Text style={styles.modalTitle}>
              SKIP TO LEVEL {skipTargetLevel}?
            </Text>
            <Text style={styles.modalSubtitle}>
              Instantly unlock Level {skipTargetLevel} and earn +50 XP!
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.stardustBtn]}
                onPress={() => handleConfirmSkip('stardust')}
              >
                <Sparkles size={16} color="#FFFFFF" />
                <Text style={styles.modalBtnText}>★ 150 STARDUST</Text>
              </Pressable>

              <Pressable
                style={[styles.modalBtn, styles.crystalBtn]}
                onPress={() => handleConfirmSkip('crystals')}
              >
                <Gem size={16} color="#FFFFFF" />
                <Text style={styles.modalBtnText}>💎 10 CRYSTALS</Text>
              </Pressable>

              <Pressable
                style={styles.cancelBtn}
                onPress={() => setSkipTargetLevel(null)}
              >
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
  },
  gameTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 12,
  },
  row: {
    gap: 12,
  },
  levelCard: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 105,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  levelCardUnlocked: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  levelHeader: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 3,
    marginVertical: 4,
  },
  mechanicBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: '100%',
    marginVertical: 2,
  },
  mechanicText: {
    fontSize: 9,
    fontWeight: '800',
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  rewardText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FDE047',
  },
  skipBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
  },
  skipBarInfo: {
    flex: 1,
  },
  skipBarTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  skipBarSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  skipButtonText: {
    color: '#0B0620',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
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
