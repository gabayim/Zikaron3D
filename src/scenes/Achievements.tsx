import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Check,
  Crown,

  Gem,
  Sparkles,
  Trophy,
} from 'lucide-react-native';
import { sfx } from '../fx/sound';
import {
  ACHIEVEMENTS,
  useAchievements,
  type AchievementCategory,
  type AchievementDef,
} from '../store/achievements';
import { CurrencyBar } from '../ui/CurrencyBar';

interface AchievementsProps {
  onBack: () => void;
}

const CATEGORIES: { id: 'all' | AchievementCategory; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'burrows', label: 'BURROWS' },
  { id: 'orbs', label: 'ORBS' },
  { id: 'stars', label: 'STARS' },
  { id: 'general', label: 'GENERAL' },
];

export default function Achievements({ onBack }: AchievementsProps) {
  const [activeCategory, setActiveCategory] = useState<'all' | AchievementCategory>('all');

  const metrics = useAchievements((s) => s.metrics);
  const claimed = useAchievements((s) => s.claimed);
  const claimAchievement = useAchievements((s) => s.claimAchievement);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return ACHIEVEMENTS;
    return ACHIEVEMENTS.filter((a) => a.category === activeCategory);
  }, [activeCategory]);

  const handleClaim = (item: AchievementDef) => {
    const ok = claimAchievement(item.id);
    if (ok) {
      sfx.play('chime', 0.9);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

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
          <Text style={styles.headerTitle}>ACHIEVEMENTS</Text>
          <Text style={styles.subtitle}>
            {claimed.length} / {ACHIEVEMENTS.length} COMPLETED
          </Text>
        </View>

        <CurrencyBar />
      </View>

      {/* Category Filter Chips */}
      <View style={styles.chipRow}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            style={[
              styles.chip,
              activeCategory === cat.id && styles.chipActive,
            ]}
            onPress={() => {
              sfx.play('chime', 0.3);
              Haptics.selectionAsync();
              setActiveCategory(cat.id);
            }}
          >
            <Text
              style={[
                styles.chipText,
                activeCategory === cat.id && styles.chipTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Achievement List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => {
          const current = Math.min(item.target, metrics[item.metric] ?? 0);
          const isUnlocked = current >= item.target;
          const isClaimed = claimed.includes(item.id);
          const progressPct = Math.min(1, current / item.target);

          return (
            <View
              style={[
                styles.card,
                isUnlocked && !isClaimed && styles.cardReady,
                isClaimed && styles.cardClaimed,
              ]}
            >
              {/* Left icon */}
              <View
                style={[
                  styles.iconWrap,
                  isUnlocked && styles.iconWrapUnlocked,
                  isClaimed && styles.iconWrapClaimed,
                ]}
              >
                {item.rewardType === 'accessory' ? (
                  <Crown size={22} color="#F59E0B" />
                ) : item.rewardType === 'crystals' ? (
                  <Gem size={22} color="#38BDF8" />
                ) : (
                  <Trophy size={22} color="#FBBF24" />
                )}
              </View>

              {/* Middle details */}
              <View style={styles.details}>
                <Text style={styles.achievementName}>{item.name}</Text>
                <Text style={styles.achievementDesc}>{item.description}</Text>

                {/* Progress bar */}
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${progressPct * 100}%` },
                      isUnlocked && styles.barFillComplete,
                    ]}
                  />
                </View>

                {/* Progress text & reward */}
                <View style={styles.metaRow}>
                  <Text style={styles.progressText}>
                    {current} / {item.target}
                  </Text>
                  <View style={styles.rewardTag}>
                    {item.rewardType === 'crystals' ? (
                      <>
                        <Gem size={12} color="#38BDF8" />
                        <Text style={styles.crystalText}>+{item.rewardAmount}</Text>
                      </>
                    ) : item.rewardType === 'accessory' ? (
                      <>
                        <Crown size={12} color="#F59E0B" />
                        <Text style={styles.accessoryText}>EXCLUSIVE</Text>
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} color="#FBBF24" />
                        <Text style={styles.stardustText}>+{item.rewardAmount}</Text>
                      </>
                    )}
                  </View>
                </View>
              </View>

              {/* Right action button */}
              <View style={styles.actionCol}>
                {isClaimed ? (
                  <View style={styles.claimedBadge}>
                    <Check size={16} color="#22C55E" />
                  </View>
                ) : isUnlocked ? (
                  <Pressable
                    style={styles.claimButton}
                    onPress={() => handleClaim(item)}
                  >
                    <Text style={styles.claimButtonText}>CLAIM</Text>
                  </Pressable>
                ) : (
                  <View style={styles.lockBadge}>
                    <Text style={styles.lockText}>{Math.floor(progressPct * 100)}%</Text>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
  },
  chipTextActive: {
    color: '#FEF3C7',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardReady: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  cardClaimed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconWrapUnlocked: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  iconWrapClaimed: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  details: {
    flex: 1,
  },
  achievementName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  achievementDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 8,
  },
  barContainer: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 3,
  },
  barFillComplete: {
    backgroundColor: '#22C55E',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  rewardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  stardustText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FDE047',
  },
  crystalText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7DD3FC',
  },
  accessoryText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#F59E0B',
  },
  actionCol: {
    marginLeft: 12,
  },
  claimButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#22C55E',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  claimButtonText: {
    color: '#052E16',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  claimedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  lockText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
});
