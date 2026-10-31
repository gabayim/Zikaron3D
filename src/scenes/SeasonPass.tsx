import React, { useState } from 'react';
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
  Flame,
  Gem,
  Lock,
  Shield,
  Sparkles,
  Star,
  Wand2,
  Wind,
} from 'lucide-react-native';
import { sfx } from '../fx/sound';
import { CurrencyBar } from '../ui/CurrencyBar';
import { ParentalGate } from '../ui/ParentalGate';
import {
  SEASON_TIERS,
  SeasonTierReward,
  TOTAL_TIERS,
  useSeasonPass,
  XP_PER_TIER,
} from '../store/seasonPass';

export default function SeasonPass({ onBack }: { onBack: () => void }) {
  const [showGate, setShowGate] = useState(false);

  const seasonName = useSeasonPass((s) => s.seasonName);
  const hasAdventurePass = useSeasonPass((s) => s.hasAdventurePass);
  const claimedFree = useSeasonPass((s) => s.claimedFree);
  const claimedPremium = useSeasonPass((s) => s.claimedPremium);

  const currentTier = useSeasonPass((s) => s.currentTier());
  const xpInTier = useSeasonPass((s) => s.xpInCurrentTier());
  const progressPercent = useSeasonPass((s) => s.progressPercent());

  const upgradeToAdventurePass = useSeasonPass((s) => s.upgradeToAdventurePass);
  const claimReward = useSeasonPass((s) => s.claimReward);

  const handleClaim = (tier: number, track: 'free' | 'premium') => {
    const success = claimReward(tier, track);
    if (success) {
      sfx.play('chime', 0.9);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleUpgradePress = () => {
    setShowGate(true);
  };

  const handleGatePassed = () => {
    setShowGate(false);
    const ok = upgradeToAdventurePass();
    if (ok) {
      sfx.play('chime', 1.0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const renderRewardIcon = (reward: SeasonTierReward['freeReward'] | SeasonTierReward['premiumReward'], isGold = false) => {
    if (reward.crystals) return <Gem size={18} color="#38BDF8" />;
    if (reward.shields) return <Shield size={18} color="#F59E0B" />;
    if (reward.itemId?.startsWith('hat')) return <Crown size={18} color={isGold ? '#FFD36E' : '#F59E0B'} />;
    if (reward.itemId?.startsWith('aura')) return <Wand2 size={18} color={isGold ? '#FFD36E' : '#A855F7'} />;
    if (reward.itemId?.startsWith('trail')) return <Wind size={18} color={isGold ? '#FFD36E' : '#38BDF8'} />;
    return <Sparkles size={18} color={isGold ? '#FFD36E' : '#FBBF24'} />;
  };

  const renderTierItem = ({ item }: { item: SeasonTierReward }) => {
    const isUnlocked = item.tier <= currentTier;
    const isCurrent = item.tier === currentTier;
    const isFreeClaimed = claimedFree.includes(item.tier);
    const isPremiumClaimed = claimedPremium.includes(item.tier);

    return (
      <View style={[styles.tierRow, isCurrent && styles.tierRowCurrent]}>
        {/* Tier Node Circle */}
        <View style={styles.tierNodeCol}>
          <View
            style={[
              styles.tierCircle,
              isUnlocked && styles.tierCircleUnlocked,
              isCurrent && styles.tierCircleCurrent,
            ]}
          >
            {isUnlocked ? (
              <Star size={16} color={isCurrent ? '#FFD36E' : '#FFFFFF'} />
            ) : (
              <Text style={styles.tierNumber}>{item.tier}</Text>
            )}
          </View>
          <Text style={styles.tierSubtitle}>T{item.tier}</Text>
        </View>

        {/* Free Track Card */}
        <View style={[styles.rewardCard, styles.freeCard, isFreeClaimed && styles.cardClaimed]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTrackLabel}>FREE</Text>
            {renderRewardIcon(item.freeReward)}
          </View>
          <Text style={styles.rewardTitle} numberOfLines={2}>
            {item.freeReward.label}
          </Text>
          {isFreeClaimed ? (
            <View style={styles.claimedPill}>
              <Check size={12} color="#22C55E" />
              <Text style={styles.claimedText}>CLAIMED</Text>
            </View>
          ) : isUnlocked ? (
            <Pressable
              style={styles.claimBtn}
              onPress={() => handleClaim(item.tier, 'free')}
            >
              <Text style={styles.claimBtnText}>CLAIM</Text>
            </Pressable>
          ) : (
            <View style={styles.lockedPill}>
              <Lock size={12} color="#94A3B8" />
            </View>
          )}
        </View>

        {/* Premium Adventure Track Card */}
        <View
          style={[
            styles.rewardCard,
            styles.premiumCard,
            isPremiumClaimed && styles.cardClaimed,
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.goldBadge}>
              <Crown size={11} color="#FFD36E" />
              <Text style={styles.goldBadgeText}>PASS</Text>
            </View>
            {renderRewardIcon(item.premiumReward, true)}
          </View>
          <Text style={[styles.rewardTitle, styles.rewardTitleGold]} numberOfLines={2}>
            {item.premiumReward.label}
          </Text>
          {isPremiumClaimed ? (
            <View style={styles.claimedPill}>
              <Check size={12} color="#22C55E" />
              <Text style={styles.claimedText}>CLAIMED</Text>
            </View>
          ) : !hasAdventurePass ? (
            <Pressable
              style={styles.lockedPassBtn}
              onPress={handleUpgradePress}
            >
              <Lock size={12} color="#FFD36E" />
              <Text style={styles.lockedPassText}>UNLOCK</Text>
            </Pressable>
          ) : isUnlocked ? (
            <Pressable
              style={[styles.claimBtn, styles.claimBtnGold]}
              onPress={() => handleClaim(item.tier, 'premium')}
            >
              <Text style={styles.claimBtnGoldText}>CLAIM</Text>
            </Pressable>
          ) : (
            <View style={styles.lockedPill}>
              <Lock size={12} color="#94A3B8" />
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={14} style={styles.iconBtn}>
          <ArrowLeft size={20} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.screenTitle}>{seasonName.toUpperCase()}</Text>
        <CurrencyBar />
      </View>

      {/* Hero Pass Progress Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View>
            <View style={styles.tierBadge}>
              <Flame size={14} color="#F97316" />
              <Text style={styles.tierBadgeText}>
                TIER {currentTier} OF {TOTAL_TIERS}
              </Text>
            </View>
            <Text style={styles.xpText}>
              {xpInTier} / {XP_PER_TIER} XP
            </Text>
          </View>

          {/* Adventure Pass Status / Upgrade Button */}
          {hasAdventurePass ? (
            <View style={styles.passActiveBadge}>
              <Crown size={16} color="#FFD36E" />
              <Text style={styles.passActiveText}>ADVENTURE PASS ACTIVE</Text>
            </View>
          ) : (
            <Pressable
              style={styles.upgradeBtn}
              onPress={handleUpgradePress}
            >
              <Crown size={16} color="#0B0620" />
              <Text style={styles.upgradeBtnText}>GET PASS</Text>
              <View style={styles.crystalCost}>
                <Gem size={12} color="#0B0620" />
                <Text style={styles.crystalCostText}>250</Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(progressPercent * 100)}%` },
            ]}
          />
        </View>
      </View>

      {/* Track List */}
      <FlatList
        data={SEASON_TIERS}
        keyExtractor={(item) => `tier_${item.tier}`}
        renderItem={renderTierItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Parental Gate for purchasing the Adventure Pass */}
      <ParentalGate
        visible={showGate}
        onSuccess={handleGatePassed}
        onCancel={() => setShowGate(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#08031A',
    paddingTop: 54,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: 'rgba(22, 11, 56, 0.85)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 16,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 4,
  },
  tierBadgeText: {
    color: '#F97316',
    fontSize: 12,
    fontWeight: '900',
  },
  xpText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    paddingLeft: 4,
  },
  passActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 211, 110, 0.18)',
    borderColor: '#FFD36E',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  passActiveText: {
    color: '#FFD36E',
    fontSize: 11,
    fontWeight: '900',
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD36E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  upgradeBtnText: {
    color: '#0B0620',
    fontSize: 12,
    fontWeight: '900',
  },
  crystalCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  crystalCostText: {
    color: '#0B0620',
    fontSize: 11,
    fontWeight: '900',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFD36E',
    borderRadius: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tierRowCurrent: {
    backgroundColor: 'rgba(255, 211, 110, 0.05)',
    borderRadius: 16,
    padding: 4,
  },
  tierNodeCol: {
    alignItems: 'center',
    width: 36,
  },
  tierCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  tierCircleUnlocked: {
    backgroundColor: '#3B82F6',
    borderColor: '#60A5FA',
  },
  tierCircleCurrent: {
    backgroundColor: '#EAB308',
    borderColor: '#FDE047',
  },
  tierNumber: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
  },
  tierSubtitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  rewardCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    justifyContent: 'space-between',
    minHeight: 110,
  },
  freeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  premiumCard: {
    backgroundColor: 'rgba(255, 211, 110, 0.06)',
    borderColor: 'rgba(255, 211, 110, 0.25)',
  },
  cardClaimed: {
    opacity: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTrackLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
  },
  goldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  goldBadgeText: {
    color: '#FFD36E',
    fontSize: 10,
    fontWeight: '900',
  },
  rewardTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  rewardTitleGold: {
    color: '#FDE047',
  },
  claimBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  claimBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  claimBtnGold: {
    backgroundColor: '#FFD36E',
  },
  claimBtnGoldText: {
    color: '#0B0620',
    fontSize: 11,
    fontWeight: '900',
  },
  claimedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  claimedText: {
    color: '#22C55E',
    fontSize: 10,
    fontWeight: '800',
  },
  lockedPill: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  lockedPassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 211, 110, 0.12)',
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 211, 110, 0.3)',
  },
  lockedPassText: {
    color: '#FFD36E',
    fontSize: 10,
    fontWeight: '900',
  },
});
