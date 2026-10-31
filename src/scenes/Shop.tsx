/**
 * Shop.tsx — Arcade Toy Storefront.
 * Features real 3D item artifacts generated via PixVerse, 3D character skin
 * portraits, crystal pack renders, and clean Nintendo / Astro Bot toy aesthetic.
 *
 * Rules:
 *  - Solid, clean contrast (no fuzzy glassy blur overlays).
 *  - sv.set() for Reanimated shared values in callbacks.
 *  - Spacious two-tier header to prevent title/currency text collision.
 *  - 0 TypeScript errors, 0 ESLint warnings.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Check,
  Crown,
  Gem,
  Globe,
  Palette,
  Sparkles,
  Ticket,
} from 'lucide-react-native';
import { sfx } from '../fx/sound';
import { useEconomy } from '../store/economy';
import { useInventory } from '../store/inventory';
import { useProfile, CREATURE_IDS, type CreatureId } from '../store/profile';
import {
  getAccessoriesBySlot,
  getSkinsForCreature,
  type AccessoryDef,
  type AccessorySlot,
  type SkinDef,
  type Rarity,
} from '../data/shopCatalog';
import {
  getAccessoryImage,
  getPackImage,
  getSkinImage,
} from '../data/shopAssets';
import { WORLDS } from '../worlds';
import { CurrencyBar } from '../ui/CurrencyBar';
import { ParentalGate } from '../ui/ParentalGate';
import { useParentalCommerceGate } from '../ui/useParentalCommerceGate';
import { buyShieldPack } from '../services/monetization';

export type Tab = 'skins' | 'accessories' | 'stardust' | 'crystals' | 'worlds';

const TABS: { id: Tab; icon: React.FC<{ size: number; color: string }>; label: string; activeColor: string }[] = [
  { id: 'skins',       icon: Palette,  label: 'SKINS',    activeColor: '#38BDF8' },
  { id: 'accessories', icon: Crown,    label: 'GEAR',     activeColor: '#F59E0B' },
  { id: 'stardust',    icon: Sparkles, label: 'STARDUST', activeColor: '#FBBF24' },
  { id: 'crystals',    icon: Gem,      label: 'GEMS',     activeColor: '#EC4899' },
  { id: 'worlds',      icon: Globe,    label: 'WORLDS',   activeColor: '#10B981' },
];

export interface StardustPack {
  id: string;
  title: string;
  subtitle: string;
  stardust: number;
  costCrystals: number;
  image: string;
  tag?: string;
  tagColor?: string;
}

const STARDUST_PACKS: StardustPack[] = [
  {
    id: 'sd_handful',
    title: '500 Stardust',
    subtitle: 'Handful of sparkling stardust to jumpstart your adventure',
    stardust: 500,
    costCrystals: 25,
    image: 'pack_pouch',
  },
  {
    id: 'sd_jar',
    title: '1,500 Stardust',
    subtitle: 'Concentrated cosmic dust for world unlocks & skips',
    stardust: 1500,
    costCrystals: 65,
    image: 'pack_chest',
    tag: '⭐ POPULAR',
    tagColor: '#38BDF8',
  },
  {
    id: 'sd_crate',
    title: '4,000 Stardust',
    subtitle: 'Massive nebula stash (+20% bonus stardust included)',
    stardust: 4000,
    costCrystals: 150,
    image: 'pack_vault',
    tag: '🔥 BEST VALUE',
    tagColor: '#F59E0B',
  },
  {
    id: 'sd_treasury',
    title: '10,000 Stardust',
    subtitle: 'Astronomical galaxy treasury — unlock all worlds with ease',
    stardust: 10000,
    costCrystals: 320,
    image: 'pack_starter',
    tag: '⚡ MEGA PACK',
    tagColor: '#EC4899',
  },
];

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 44) / 2;

const RARITY_THEME: Record<Rarity, { border: string; bg: string; badgeBg: string; text: string; label: string }> = {
  common:    { border: '#334155', bg: '#1E293B', badgeBg: '#475569', text: '#E2E8F0', label: 'COMMON' },
  rare:      { border: '#0284C7', bg: '#0F2642', badgeBg: '#0369A1', text: '#38BDF8', label: 'RARE' },
  epic:      { border: '#9333EA', bg: '#271247', badgeBg: '#7E22CE', text: '#C084FC', label: 'EPIC' },
  legendary: { border: '#D97706', bg: '#362007', badgeBg: '#B45309', text: '#FBBF24', label: 'LEGEND' },
};

// ---------------------------------------------------------------------------
// Tactile Card Container
// ---------------------------------------------------------------------------
function TactileCard({
  onPress,
  children,
  isEquipped,
  rarity,
}: {
  onPress: () => void;
  children: React.ReactNode;
  isEquipped?: boolean;
  rarity?: Rarity;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const handlePress = useCallback(() => {
    scale.set(withSequence(
      withSpring(0.94, { damping: 10, stiffness: 350 }),
      withSpring(1.0, { damping: 12, stiffness: 250 }),
    ));
    onPress();
  }, [scale, onPress]);

  const theme = rarity ? RARITY_THEME[rarity] : RARITY_THEME.common;
  const borderColor = isEquipped ? '#22C55E' : theme.border;

  return (
    <Pressable onPress={handlePress} style={styles.cardPressable}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: theme.bg,
            borderColor,
          },
          isEquipped && styles.cardEquipped,
          animStyle,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Action Button / Price Tag
// ---------------------------------------------------------------------------
function ActionPill({
  isOwned,
  isEquipped,
  priceStardust,
  priceCrystals,
}: {
  isOwned: boolean;
  isEquipped: boolean;
  priceStardust: number | null;
  priceCrystals: number | null;
}) {
  if (isEquipped) {
    return (
      <View style={styles.pillEquipped}>
        <Check size={14} color="#FFFFFF" strokeWidth={3} />
        <Text style={styles.pillEquippedText}>EQUIPPED</Text>
      </View>
    );
  }
  if (isOwned) {
    return (
      <View style={styles.pillOwned}>
        <Text style={styles.pillOwnedText}>EQUIP</Text>
      </View>
    );
  }
  if (priceStardust != null) {
    return (
      <View style={styles.pillStardust}>
        <Sparkles size={14} color="#FFFFFF" />
        <Text style={styles.pillCostText}>{priceStardust.toLocaleString()}</Text>
      </View>
    );
  }
  return (
    <View style={styles.pillCrystals}>
      <Gem size={14} color="#FFFFFF" />
      <Text style={styles.pillCostText}>{priceCrystals}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Shop Screen
// ---------------------------------------------------------------------------
export interface ShopProps {
  onBack: () => void;
  onCoupon?: () => void;
  initialTab?: Tab;
}

export default function Shop({ onBack, onCoupon, initialTab }: ShopProps) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'skins');
  const [selectedCreature, setSelectedCreature] = useState<CreatureId>('pip');
  const [selectedSlot, setSelectedSlot] = useState<AccessorySlot>('hat');
  const [needCrystalsAlert, setNeedCrystalsAlert] = useState(false);

  const { gateOpen, runGuarded, confirmGate, cancelGate } = useParentalCommerceGate();

  // Economy & Inventory
  const spendStardust = useEconomy((s) => s.spendStardust);
  const earnStardust  = useEconomy((s) => s.earnStardust);
  const spendCrystals = useEconomy((s) => s.spendCrystals);
  const earnCrystals  = useEconomy((s) => s.earnCrystals);

  const ownedSkins       = useInventory((s) => s.ownedSkins);
  const addSkin          = useInventory((s) => s.addSkin);
  const equippedSkins    = useInventory((s) => s.equippedSkins);
  const equipSkin        = useInventory((s) => s.equipSkin);
  const unequipSkin      = useInventory((s) => s.unequipSkin);

  const ownedAccessories    = useInventory((s) => s.ownedAccessories);
  const addAccessory        = useInventory((s) => s.addAccessory);
  const equippedAccessories = useInventory((s) => s.equippedAccessories);
  const equipAccessory      = useInventory((s) => s.equipAccessory);
  const unequipAccessory    = useInventory((s) => s.unequipAccessory);

  const unlockedWorlds = useProfile((s) => s.unlockedWorlds);
  const unlockWorld    = useProfile((s) => s.unlockWorld);

  const handleTabPress = useCallback((t: Tab) => {
    sfx.play('whoosh', 0.4);
    Haptics.selectionAsync();
    setTab(t);
  }, []);

  const handleBuyStardustPack = useCallback(
    (pack: StardustPack) => {
      const ok = spendCrystals(pack.costCrystals);
      if (ok) {
        earnStardust(pack.stardust);
        sfx.play('chime', 0.95);
        sfx.play('sparkle', 0.9);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        sfx.play('sad', 0.5);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setNeedCrystalsAlert(true);
      }
    },
    [spendCrystals, earnStardust],
  );

  // ── Skin buy/equip ──────────────────────────────────────────────────────
  const handleSkinAction = useCallback(
    (skin: SkinDef) => {
      const isOwned    = ownedSkins.includes(skin.id);
      const isEquipped = equippedSkins[skin.creatureId] === skin.id;

      if (isEquipped) {
        unequipSkin(skin.creatureId);
        sfx.play('whoosh', 0.4);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }
      if (isOwned) {
        equipSkin(skin.creatureId, skin.id);
        sfx.play('chime', 0.6);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      }
      if (skin.priceStardust != null) {
        const ok = spendStardust(skin.priceStardust);
        if (ok) {
          addSkin(skin.id);
          equipSkin(skin.creatureId, skin.id);
          sfx.play('chime', 0.8);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          sfx.play('sad', 0.5);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else if (skin.priceCrystals != null) {
        const ok = spendCrystals(skin.priceCrystals);
        if (ok) {
          addSkin(skin.id);
          equipSkin(skin.creatureId, skin.id);
          sfx.play('chime', 0.8);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          sfx.play('sad', 0.5);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    },
    [ownedSkins, equippedSkins, spendStardust, spendCrystals, addSkin, equipSkin, unequipSkin],
  );

  // ── Accessory buy/equip ─────────────────────────────────────────────────
  const handleAccessoryAction = useCallback(
    (acc: AccessoryDef) => {
      const isOwned    = ownedAccessories.includes(acc.id);
      const isEquipped = equippedAccessories[acc.slot] === acc.id;

      if (isEquipped) {
        unequipAccessory(acc.slot);
        sfx.play('whoosh', 0.4);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }
      if (isOwned) {
        equipAccessory(acc.slot, acc.id);
        sfx.play('chime', 0.6);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      }
      if (acc.priceStardust != null) {
        const ok = spendStardust(acc.priceStardust);
        if (ok) {
          addAccessory(acc.id);
          equipAccessory(acc.slot, acc.id);
          sfx.play('chime', 0.8);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          sfx.play('sad', 0.5);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else if (acc.priceCrystals != null) {
        const ok = spendCrystals(acc.priceCrystals);
        if (ok) {
          addAccessory(acc.id);
          equipAccessory(acc.slot, acc.id);
          sfx.play('chime', 0.8);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          sfx.play('sad', 0.5);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    },
    [ownedAccessories, equippedAccessories, spendStardust, spendCrystals, addAccessory, equipAccessory, unequipAccessory],
  );

  // ── Real money purchases ────────────────────────────────────────────────
  const handleBuyPack = useCallback(
    (crystalsGranted: number) => {
      runGuarded(() => {
        earnCrystals(crystalsGranted, false);
        sfx.play('chime', 0.9);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });
    },
    [runGuarded, earnCrystals],
  );

  const handleBuyShields = useCallback(() => {
    runGuarded(async () => {
      const res = await buyShieldPack();
      if (res === 'ok') {
        sfx.play('chime', 0.8);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
  }, [runGuarded]);

  // ── World unlock handler (spend Stardust or Crystals) ───────────────────
  const handleUnlockWorld = useCallback(
    (world: (typeof WORLDS)[number], currency: 'stardust' | 'crystals') => {
      if (currency === 'stardust' && world.priceStardust != null) {
        const ok = spendStardust(world.priceStardust);
        if (ok) {
          unlockWorld(world.id);
          sfx.play('chime', 0.9);
          sfx.play('sparkle', 0.8);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          sfx.play('sad', 0.5);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else if (currency === 'crystals' && world.priceCrystals != null) {
        const ok = spendCrystals(world.priceCrystals);
        if (ok) {
          unlockWorld(world.id);
          sfx.play('chime', 0.9);
          sfx.play('sparkle', 0.8);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          sfx.play('sad', 0.5);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    },
    [spendStardust, spendCrystals, unlockWorld],
  );

  const currentSkins       = useMemo(() => getSkinsForCreature(selectedCreature), [selectedCreature]);
  const currentAccessories = useMemo(() => getAccessoriesBySlot(selectedSlot), [selectedSlot]);

  // ── Skin Card Renderer ──────────────────────────────────────────────────
  const renderSkin = useCallback(
    ({ item }: { item: SkinDef }) => {
      const isOwned    = ownedSkins.includes(item.id);
      const isEquipped = equippedSkins[item.creatureId] === item.id;
      const theme      = RARITY_THEME[item.rarity];
      const skinImg    = getSkinImage(item.id);

      return (
        <TactileCard
          isEquipped={isEquipped}
          rarity={item.rarity}
          onPress={() => handleSkinAction(item)}
        >
          {/* Card Top Row: Rarity Tag */}
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardRarityBadge, { backgroundColor: theme.badgeBg }]}>
              <Text style={styles.cardRarityText}>{theme.label}</Text>
            </View>
          </View>

          {/* 3D Character Skin Portrait Pedestal */}
          <View style={[styles.artifactPedestal, { borderColor: theme.border }]}>
            {skinImg ? (
              <Image source={skinImg} style={styles.critterPortrait} resizeMode="contain" />
            ) : (
              <View style={[styles.swatchFallback, { backgroundColor: item.palette.primary }]} />
            )}
          </View>

          {/* Item Name Container with fixed 2-line height */}
          <View style={styles.itemNameContainer}>
            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          </View>

          <ActionPill
            isOwned={isOwned}
            isEquipped={isEquipped}
            priceStardust={item.priceStardust}
            priceCrystals={item.priceCrystals}
          />
        </TactileCard>
      );
    },
    [ownedSkins, equippedSkins, handleSkinAction],
  );

  // ── Accessory Card Renderer ─────────────────────────────────────────────
  const renderAccessory = useCallback(
    ({ item }: { item: AccessoryDef }) => {
      const isOwned    = ownedAccessories.includes(item.id);
      const isEquipped = equippedAccessories[item.slot] === item.id;
      const theme      = RARITY_THEME[item.rarity];
      const itemImg    = getAccessoryImage(item.id);

      return (
        <TactileCard
          isEquipped={isEquipped}
          rarity={item.rarity}
          onPress={() => handleAccessoryAction(item)}
        >
          {/* Card Top Row: Rarity Tag */}
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardRarityBadge, { backgroundColor: theme.badgeBg }]}>
              <Text style={styles.cardRarityText}>{theme.label}</Text>
            </View>
          </View>

          {/* 3D PixVerse Artifact Image Pedestal */}
          <View style={[styles.artifactPedestal, { borderColor: theme.border }]}>
            {itemImg ? (
              <Image source={itemImg} style={styles.artifactImage} resizeMode="contain" />
            ) : (
              <View style={[styles.swatchFallback, { backgroundColor: item.color }]} />
            )}
          </View>

          {/* Item Name Container with fixed 2-line height */}
          <View style={styles.itemNameContainer}>
            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          </View>

          <ActionPill
            isOwned={isOwned}
            isEquipped={isEquipped}
            priceStardust={item.priceStardust}
            priceCrystals={item.priceCrystals}
          />
        </TactileCard>
      );
    },
    [ownedAccessories, equippedAccessories, handleAccessoryAction],
  );

  return (
    <View style={styles.container}>
      {/* ── Two-Tier Spacious Header (Zero Text Collision) ── */}
      <View style={styles.headerContainer}>
        {/* Navigation & Currency Row */}
        <View style={styles.navRow}>
          <View style={styles.navLeft}>
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

            {onCoupon && (
              <Pressable
                style={styles.couponButton}
                onPress={() => {
                  sfx.play('pop', 0.4);
                  Haptics.selectionAsync();
                  onCoupon();
                }}
                hitSlop={8}
              >
                <Ticket size={13} color="#F5D0FE" />
                <Text style={styles.couponButtonText}>COUPON</Text>
              </Pressable>
            )}
          </View>

          <CurrencyBar
            onPressStardust={() => handleTabPress('stardust')}
            onPressCrystals={() => handleTabPress('crystals')}
          />
        </View>

        {/* Title Row (Full Width - Zero Text Collision) */}
        <View style={styles.titleRow}>
          <Text style={styles.shopTitle} numberOfLines={1}>✦ ARCADE SHOP ✦</Text>
          <Text style={styles.shopSubtitle} numberOfLines={1}>
            {tab === 'skins' ? 'Upgrade critters with stylized toy outfits' :
             tab === 'accessories' ? 'Equip rare 3D animated gear, auras & trails' :
             tab === 'stardust' ? 'Convert Crystals into magical Stardust bundles' :
             tab === 'worlds' ? 'Unlock portals to vibrant new dimensions' :
             'Get crystal bundles & streak shields'}
          </Text>
        </View>
      </View>

      {/* Scrollable Tactile Tab Bar (Zero Text Collision) */}
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScrollView}
          contentContainerStyle={styles.tabBarContent}
        >
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <Pressable
                key={t.id}
                style={[
                  styles.tabButton,
                  isActive && {
                    backgroundColor: t.activeColor,
                    borderColor: t.activeColor,
                  },
                ]}
                onPress={() => handleTabPress(t.id)}
              >
                <t.icon size={15} color={isActive ? '#FFFFFF' : '#94A3B8'} />
                <Text
                  style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content Area */}
      <View style={styles.content}>

        {/* ── SKINS TAB ── */}
        {tab === 'skins' && (
          <View style={styles.tabContent}>
            {/* Creature Selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScrollView}
              contentContainerStyle={styles.filterContent}
            >
              {CREATURE_IDS.map((c) => {
                const isSelected = selectedCreature === c;
                return (
                  <Pressable
                    key={c}
                    style={[
                      styles.filterChip,
                      isSelected && styles.filterChipActive,
                    ]}
                    onPress={() => {
                      sfx.play('chime', 0.3);
                      Haptics.selectionAsync();
                      setSelectedCreature(c);
                    }}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextActive,
                      ]}
                    >
                      {c.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Skins Grid */}
            <FlatList
              data={currentSkins}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContainer}
              renderItem={renderSkin}
            />
          </View>
        )}

        {/* ── GEAR / ACCESSORIES TAB ── */}
        {tab === 'accessories' && (
          <View style={styles.tabContent}>
            {/* Slot Category Selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.slotScrollView}
              contentContainerStyle={styles.slotContent}
            >
              {(['hat', 'trail', 'aura', 'expression'] as AccessorySlot[]).map((slot) => {
                const isSelected = selectedSlot === slot;
                const emoji = slot === 'hat' ? '🎩' : slot === 'trail' ? '✨' : slot === 'aura' ? '🌀' : '😎';
                const label = slot === 'expression' ? 'EXPRESSION' : slot.toUpperCase();
                return (
                  <Pressable
                    key={slot}
                    style={[
                      styles.slotChip,
                      isSelected && styles.slotChipActive,
                    ]}
                    onPress={() => {
                      sfx.play('chime', 0.3);
                      Haptics.selectionAsync();
                      setSelectedSlot(slot);
                    }}
                  >
                    <Text
                      style={[styles.slotChipText, isSelected && styles.slotChipTextActive]}
                      numberOfLines={1}
                    >
                      {emoji} {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Accessories Grid */}
            <FlatList
              data={currentAccessories}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContainer}
              renderItem={renderAccessory}
            />
          </View>
        )}

        {/* ── WORLDS TAB ── */}
        {tab === 'worlds' && (
          <ScrollView contentContainerStyle={styles.worldsContainer}>
            <Text style={styles.worldsSectionSubtitle}>
              Unlock portals directly with Stardust or Crystals to explore new dimensions!
            </Text>

            {WORLDS.map((w) => {
              const isUnlocked = unlockedWorlds.includes(w.id);
              const displayName = w.id.replace('_', ' ').toUpperCase();
              return (
                <View
                  key={w.id}
                  style={[
                    styles.worldCard,
                    isUnlocked ? { borderColor: w.accent } : styles.worldCardLocked,
                  ]}
                >
                  <Image source={w.still} style={styles.worldImage} resizeMode="cover" />

                  {!isUnlocked && (
                    <View style={styles.worldLockShield}>
                      <Text style={styles.worldLockIcon}>🔒</Text>
                      <Text style={styles.worldLockText}>
                        {w.priceStardust != null
                          ? `UNLOCK FOR ★ ${w.priceStardust.toLocaleString()} STARDUST`
                          : `UNLOCK FOR 💎 ${w.priceCrystals} CRYSTALS`}
                      </Text>
                    </View>
                  )}

                  <View style={styles.worldCardBody}>
                    <View style={styles.worldHeaderRow}>
                      <Text style={styles.worldTitleText}>{displayName}</Text>
                      {isUnlocked ? (
                        <View style={[styles.worldPill, { backgroundColor: w.accent }]}>
                          <Text style={styles.worldPillText}>✓ UNLOCKED</Text>
                        </View>
                      ) : (
                        <View style={styles.worldUnlockActions}>
                          {w.priceStardust != null && (
                            <Pressable
                              style={styles.worldUnlockStardustPill}
                              onPress={() => handleUnlockWorld(w, 'stardust')}
                            >
                              <Sparkles size={13} color="#FFFFFF" />
                              <Text style={styles.worldUnlockPillText}>★ {w.priceStardust.toLocaleString()}</Text>
                            </Pressable>
                          )}
                          {w.priceCrystals != null && (
                            <Pressable
                              style={styles.worldUnlockCrystalPill}
                              onPress={() => handleUnlockWorld(w, 'crystals')}
                            >
                              <Gem size={13} color="#FFFFFF" />
                              <Text style={styles.worldUnlockPillText}>💎 {w.priceCrystals}</Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>

                    <View style={styles.worldResidentRow}>
                      <Text style={styles.worldResidentLabel}>RESIDENTS:</Text>
                      {w.residents.map((r) => (
                        <View key={r} style={styles.residentBadge}>
                          <Text style={styles.residentBadgeText}>{r.toUpperCase()}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* ── STARDUST TAB ── */}
        {tab === 'stardust' && (
          <ScrollView contentContainerStyle={styles.packsContainer}>
            {STARDUST_PACKS.map((p) => (
              <Pressable
                key={p.id}
                style={[
                  styles.solidPackCard,
                  p.tag ? { borderColor: p.tagColor ?? '#FBBF24' } : null,
                ]}
                onPress={() => handleBuyStardustPack(p)}
              >
                {p.tag && (
                  <View style={[styles.packTopBanner, { backgroundColor: p.tagColor ?? '#FBBF24' }]}>
                    <Text style={styles.packTopBannerText}>{p.tag}</Text>
                  </View>
                )}
                <View style={styles.packMainRow}>
                  <Image
                    source={getPackImage(p.image)}
                    style={p.tag ? styles.packIconLarge : styles.packIcon}
                    resizeMode="contain"
                  />
                  <View style={styles.packInfo}>
                    <Text style={styles.packTitle}>{p.title}</Text>
                    <Text style={styles.packSubtitle}>{p.subtitle}</Text>
                    <View style={[styles.packPriceButton, { backgroundColor: '#FBBF24' }]}>
                      <Gem size={13} color="#0B0620" />
                      <Text style={[styles.packPriceText, { color: '#0B0620' }]}>
                        💎 {p.costCrystals}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* ── GEMS / CRYSTALS TAB ── */}
        {tab === 'crystals' && (
          <ScrollView contentContainerStyle={styles.packsContainer}>
            {/* Featured Starter Pack */}
            <Pressable
              style={[styles.solidPackCard, styles.starterPackCard]}
              onPress={() => handleBuyPack(500)}
            >
              <View style={styles.packTopBanner}>
                <Text style={styles.packTopBannerText}>⭐ STARTER PACK — ONE-TIME SPECIAL</Text>
              </View>
              <View style={styles.packMainRow}>
                <Image source={getPackImage('pack_starter')} style={styles.packIconLarge} resizeMode="contain" />
                <View style={styles.packInfo}>
                  <Text style={styles.packTitle}>500 Crystals + 3 Rare Skins</Text>
                  <Text style={styles.packSubtitle}>Everything you need to customize your team</Text>
                  <View style={styles.packPriceButton}>
                    <Text style={styles.packPriceText}>$2.99</Text>
                  </View>
                </View>
              </View>
            </Pressable>

            {/* Vault of Astral Gems (Best Value) */}
            <Pressable
              style={[styles.solidPackCard, styles.bestValueCard]}
              onPress={() => handleBuyPack(1200)}
            >
              <View style={[styles.packTopBanner, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.packTopBannerText}>🔥 BEST VALUE (+20% BONUS)</Text>
              </View>
              <View style={styles.packMainRow}>
                <Image source={getPackImage('pack_vault')} style={styles.packIconLarge} resizeMode="contain" />
                <View style={styles.packInfo}>
                  <Text style={styles.packTitle}>1,200 Crystals</Text>
                  <Text style={styles.packSubtitle}>Vault of radiant astral gems</Text>
                  <View style={[styles.packPriceButton, { backgroundColor: '#F59E0B' }]}>
                    <Text style={styles.packPriceText}>$7.99</Text>
                  </View>
                </View>
              </View>
            </Pressable>

            {/* Chest of Radiant Gems */}
            <Pressable
              style={styles.solidPackCard}
              onPress={() => handleBuyPack(500)}
            >
              <View style={styles.packMainRow}>
                <Image source={getPackImage('pack_chest')} style={styles.packIcon} resizeMode="contain" />
                <View style={styles.packInfo}>
                  <Text style={styles.packTitle}>500 Crystals</Text>
                  <Text style={styles.packSubtitle}>Chest overflowing with cosmic crystals</Text>
                  <View style={styles.packPriceButton}>
                    <Text style={styles.packPriceText}>$3.99</Text>
                  </View>
                </View>
              </View>
            </Pressable>

            {/* Pouch of Cosmic Gems */}
            <Pressable
              style={styles.solidPackCard}
              onPress={() => handleBuyPack(100)}
            >
              <View style={styles.packMainRow}>
                <Image source={getPackImage('pack_pouch')} style={styles.packIcon} resizeMode="contain" />
                <View style={styles.packInfo}>
                  <Text style={styles.packTitle}>100 Crystals</Text>
                  <Text style={styles.packSubtitle}>Pouch of sparkling blue gems</Text>
                  <View style={styles.packPriceButton}>
                    <Text style={styles.packPriceText}>$0.99</Text>
                  </View>
                </View>
              </View>
            </Pressable>

            {/* 10 Streak Shields */}
            <Pressable
              style={styles.solidPackCard}
              onPress={handleBuyShields}
            >
              <View style={styles.packMainRow}>
                <Image source={getPackImage('pack_shield')} style={styles.packIcon} resizeMode="contain" />
                <View style={styles.packInfo}>
                  <Text style={styles.packTitle}>10 Streak Shields</Text>
                  <Text style={styles.packSubtitle}>Protects your arcade combo streaks from breaking</Text>
                  <View style={[styles.packPriceButton, { backgroundColor: '#3B82F6' }]}>
                    <Text style={styles.packPriceText}>$0.99</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </ScrollView>
        )}
      </View>

      {/* Need Crystals Modal */}
      <Modal
        visible={needCrystalsAlert}
        transparent
        animationType="fade"
        onRequestClose={() => setNeedCrystalsAlert(false)}
      >
        <View style={styles.needGemsBackdrop}>
          <View style={styles.needGemsBox}>
            <Text style={styles.needGemsEmoji}>💎</Text>
            <Text style={styles.needGemsTitle}>MORE GEMS NEEDED</Text>
            <Text style={styles.needGemsSubtitle}>
              You do not have enough crystals to buy this Stardust bundle. Would you like to check the Gems shop?
            </Text>
            <View style={styles.needGemsActions}>
              <Pressable
                style={styles.needGemsConfirmBtn}
                onPress={() => {
                  setNeedCrystalsAlert(false);
                  handleTabPress('crystals');
                }}
              >
                <Gem size={16} color="#FFFFFF" />
                <Text style={styles.needGemsConfirmText}>GET GEMS</Text>
              </Pressable>
              <Pressable
                style={styles.needGemsCancelBtn}
                onPress={() => setNeedCrystalsAlert(false)}
              >
                <Text style={styles.needGemsCancelText}>CANCEL</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Parental Gate Modal */}
      <ParentalGate visible={gateOpen} onSuccess={confirmGate} onCancel={cancelGate} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Solid Nintendo / Astro Bot Arcade Styling
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },

  // Two-Tier Header
  headerContainer: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#0F172A',
    borderBottomWidth: 2,
    borderBottomColor: '#1E293B',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#86198F',
    borderWidth: 1.5,
    borderColor: '#C026D3',
    alignSelf: 'center',
  },
  couponButtonText: {
    color: '#F5D0FE',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  titleRow: {
    paddingTop: 4,
  },
  shopTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  shopSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 16,
  },

  // Scrollable Tactile Tab Bar
  tabBarWrapper: {
    marginVertical: 10,
  },
  tabScrollView: {
    maxHeight: 50,
  },
  tabBarContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  tabButtonText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  // Content
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },

  // Creature filter chips
  filterScrollView: {
    maxHeight: 52,
    marginBottom: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '900',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // Slot filter row
  slotScrollView: {
    maxHeight: 52,
    marginBottom: 10,
  },
  slotContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  slotChipActive: {
    backgroundColor: '#D97706',
    borderColor: '#FBBF24',
  },
  slotChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '900',
  },
  slotChipTextActive: {
    color: '#FFFFFF',
  },

  // Grid
  gridContainer: {
    paddingHorizontal: 14,
    paddingBottom: 40,
    gap: 12,
  },
  gridRow: {
    gap: 12,
  },

  // Solid Tactile Cards
  cardPressable: {
    width: CARD_W,
  },
  card: {
    width: CARD_W,
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  cardEquipped: {
    borderWidth: 2.5,
    borderColor: '#22C55E',
  },

  // Rarity tag row inside card
  cardHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 6,
  },
  cardRarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cardRarityText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Artifact Pedestal (Dark illuminated background container)
  artifactPedestal: {
    width: CARD_W - 24,
    height: 110,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  artifactImage: {
    width: 90,
    height: 90,
  },
  critterPortrait: {
    width: 92,
    height: 92,
  },
  swatchFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },

  // Name container: fixed 2-line height to prevent any text clipping or shifting
  itemNameContainer: {
    height: 38,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Action Pills
  pillEquipped: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
  },
  pillEquippedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pillOwned: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOwnedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pillStardust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
  },
  pillCrystals: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
  },
  pillCostText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  // Worlds Tab
  worldsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  worldsSectionSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  worldCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  worldCardLocked: {
    borderColor: '#334155',
    opacity: 0.85,
  },
  worldImage: {
    width: '100%',
    height: 120,
  },
  worldLockShield: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(15,23,42,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  worldLockIcon: {
    fontSize: 30,
  },
  worldLockText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  worldCardBody: {
    padding: 14,
    gap: 8,
  },
  worldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  worldTitleText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  worldPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  worldPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  worldUnlockActions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  worldUnlockStardustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  worldUnlockCrystalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  worldUnlockPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  worldResidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  worldResidentLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  residentBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  residentBadgeText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '800',
  },

  // Crystals / Packs Tab
  packsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  solidPackCard: {
    backgroundColor: '#1E293B',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#334155',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  starterPackCard: {
    borderColor: '#EC4899',
    backgroundColor: '#2E1035',
  },
  bestValueCard: {
    borderColor: '#F59E0B',
    backgroundColor: '#2E1B05',
  },
  packTopBanner: {
    backgroundColor: '#EC4899',
    paddingVertical: 4,
    alignItems: 'center',
  },
  packTopBannerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  packMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  packIcon: {
    width: 72,
    height: 72,
  },
  packIconLarge: {
    width: 82,
    height: 82,
  },
  packInfo: {
    flex: 1,
    gap: 4,
  },
  packTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  packSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  packPriceButton: {
    backgroundColor: '#10B981',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  packPriceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  needGemsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 1, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  needGemsBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  needGemsEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  needGemsTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  needGemsSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  needGemsActions: {
    width: '100%',
    gap: 10,
  },
  needGemsConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#EC4899',
  },
  needGemsConfirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  needGemsCancelBtn: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  needGemsCancelText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
