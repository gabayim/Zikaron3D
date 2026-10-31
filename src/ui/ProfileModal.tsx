import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Check,
  ChevronRight,
  Crown,
  Flame,
  Gem,
  Lock,
  Palette,
  Smile,
  Sparkles,
  Ticket,
  Trophy,
  Wand2,
  Wind,
  X,
} from 'lucide-react-native';
import { sfx } from '../fx/sound';
import { useProfile } from '../store/profile';
import { useEconomy } from '../store/economy';
import { useInventory } from '../store/inventory';
import { levelForXp } from '../store/progression';
import {
  ACCESSORY_CATALOG,
  getAccessoriesBySlot,
  getSkinsForCreature,
  type AccessoryDef,
  type AccessorySlot,
  type SkinDef,
} from '../data/shopCatalog';
import { ACCESSORY_ASSETS, getSkinImage } from '../data/shopAssets';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onStartDaily?: () => void;
  onOpenShop?: (tab: 'skins' | 'accessories') => void;
}

type WardrobeSlot = 'hat' | 'skin' | 'aura' | 'trail' | 'expression';

const WARDROBE_TABS: { id: WardrobeSlot; label: string; icon: React.FC<{ size: number; color: string }> }[] = [
  { id: 'hat', label: 'HEAD', icon: Crown },
  { id: 'skin', label: 'SKIN', icon: Palette },
  { id: 'aura', label: 'AURA', icon: Wand2 },
  { id: 'trail', label: 'TRAIL', icon: Wind },
  { id: 'expression', label: 'FACE', icon: Smile },
];

export function ProfileModal({ visible, onClose, onStartDaily, onOpenShop }: ProfileModalProps) {
  const xp = useProfile((s) => s.xp);
  const mode = useProfile((s) => s.mode);
  const collectionCount = useProfile((s) => s.collection.length);
  const redeemCoupon = useProfile((s) => s.redeemCoupon);

  const stardust = useEconomy((s) => s.stardust);
  const crystals = useEconomy((s) => s.crystals);

  const ownedSkins = useInventory((s) => s.ownedSkins);
  const ownedAccessories = useInventory((s) => s.ownedAccessories);
  const equippedSkins = useInventory((s) => s.equippedSkins);
  const equippedAccessories = useInventory((s) => s.equippedAccessories);
  const equipSkin = useInventory((s) => s.equipSkin);
  const unequipSkin = useInventory((s) => s.unequipSkin);
  const equipAccessory = useInventory((s) => s.equipAccessory);
  const unequipAccessory = useInventory((s) => s.unequipAccessory);

  const [activeSlot, setActiveSlot] = useState<WardrobeSlot>('hat');
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const level = levelForXp(xp);

  // Equipped assets for preview
  const currentSkinId = equippedSkins['pip'] ?? 'pip_classic';
  const skinImg = getSkinImage(currentSkinId) ?? getSkinImage('pip_classic');
  const hatImg = equippedAccessories.hat ? ACCESSORY_ASSETS[equippedAccessories.hat] : null;
  const auraImg = equippedAccessories.aura ? ACCESSORY_ASSETS[equippedAccessories.aura] : null;
  const trailImg = equippedAccessories.trail ? ACCESSORY_ASSETS[equippedAccessories.trail] : null;
  const exprImg = equippedAccessories.expression ? ACCESSORY_ASSETS[equippedAccessories.expression] : null;

  const currentHatDef = ACCESSORY_CATALOG.find((a) => a.id === equippedAccessories.hat);
  const currentAuraDef = ACCESSORY_CATALOG.find((a) => a.id === equippedAccessories.aura);
  const currentTrailDef = ACCESSORY_CATALOG.find((a) => a.id === equippedAccessories.trail);
  const currentExprDef = ACCESSORY_CATALOG.find((a) => a.id === equippedAccessories.expression);
  const currentSkinDef = getSkinsForCreature('pip').find((s) => s.id === currentSkinId);

  const handleEquipSlotAccessory = (slot: AccessorySlot, id: string | null) => {
    if (!id) {
      unequipAccessory(slot);
      sfx.play('whoosh', 0.4);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      equipAccessory(slot, id);
      sfx.play('chime', 0.9);
      sfx.play('sparkle', 0.7);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleEquipSkin = (id: string | null) => {
    if (!id) {
      unequipSkin('pip');
      sfx.play('whoosh', 0.4);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      equipSkin('pip', id);
      sfx.play('chime', 0.9);
      sfx.play('sparkle', 0.7);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleApply = (inputCode?: string) => {
    const targetCode = inputCode ?? code;
    if (!targetCode.trim()) return;

    const res = redeemCoupon(targetCode);
    setFeedback(res);

    if (res.success) {
      sfx.play('chime', 0.9);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCode('');
    } else {
      sfx.play('sad', 0.5);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  // Options for active slot
  const currentSlotAccessories: AccessoryDef[] =
    activeSlot !== 'skin' ? getAccessoriesBySlot(activeSlot as AccessorySlot) : [];
  const currentCreatureSkins: SkinDef[] = activeSlot === 'skin' ? getSkinsForCreature('pip') : [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>LVL {level}</Text>
              </View>
              <Text style={styles.title}>PLAYER PROFILE</Text>
            </View>
            <Pressable
              style={styles.closeBtn}
              onPress={() => {
                sfx.play('pop', 0.4);
                Haptics.selectionAsync();
                onClose();
              }}
              hitSlop={12}
            >
              <X size={20} color="#94A3B8" />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* ── 1. Character Showcase Stage ── */}
            <View style={styles.characterStage}>
              <View style={styles.stageBackdrop}>
                {/* Aura */}
                {auraImg && (
                  <Image source={auraImg} style={styles.stageAura} resizeMode="contain" />
                )}

                {/* Trail */}
                {trailImg && (
                  <Image source={trailImg} style={styles.stageTrail} resizeMode="contain" />
                )}

                {/* Mascot Body */}
                {skinImg && (
                  <Image source={skinImg} style={styles.stageMascot} resizeMode="contain" />
                )}

                {/* Expression on face */}
                {exprImg && (
                  <Image source={exprImg} style={styles.stageExpr} resizeMode="contain" />
                )}

                {/* Hat on head */}
                {hatImg && (
                  <Image source={hatImg} style={styles.stageHat} resizeMode="contain" />
                )}
              </View>

              <View style={styles.characterInfo}>
                <Text style={styles.characterName}>PIP • STAR TRAVELER</Text>
                <View style={styles.activePillsRow}>
                  <View style={styles.gearPill}>
                    <Text style={styles.gearPillText}>
                      👑 {currentHatDef?.name ?? 'No Hat'}
                    </Text>
                  </View>
                  <View style={styles.gearPill}>
                    <Text style={styles.gearPillText}>
                      🎨 {currentSkinDef?.name ?? 'Classic Pip'}
                    </Text>
                  </View>
                  {currentAuraDef && (
                    <View style={styles.gearPill}>
                      <Text style={styles.gearPillText}>
                        🌀 {currentAuraDef.name}
                      </Text>
                    </View>
                  )}
                  {currentTrailDef && (
                    <View style={styles.gearPill}>
                      <Text style={styles.gearPillText}>
                        ✨ {currentTrailDef.name}
                      </Text>
                    </View>
                  )}
                  {currentExprDef && (
                    <View style={styles.gearPill}>
                      <Text style={styles.gearPillText}>
                        😎 {currentExprDef.name}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* ── 2. Body Member Customizer Tabs ── */}
            <View style={styles.wardrobeHeader}>
              <Text style={styles.wardrobeTitle}>✦ BODY MEMBER CUSTOMIZER ✦</Text>
              <Text style={styles.wardrobeSub}>
                Change your mascot gear live. Tap an item to equip it:
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.slotTabScroll}
              contentContainerStyle={styles.slotTabContent}
            >
              {WARDROBE_TABS.map((tab) => {
                const isSelected = activeSlot === tab.id;
                return (
                  <Pressable
                    key={tab.id}
                    style={[styles.slotTabBtn, isSelected && styles.slotTabBtnActive]}
                    onPress={() => {
                      sfx.play('whoosh', 0.4);
                      Haptics.selectionAsync();
                      setActiveSlot(tab.id);
                    }}
                  >
                    <tab.icon size={14} color={isSelected ? '#FFFFFF' : '#94A3B8'} />
                    <Text style={[styles.slotTabText, isSelected && styles.slotTabTextActive]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* ── 3. Items Carousel for Active Slot ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.itemCardsScroll}
              contentContainerStyle={styles.itemCardsContent}
            >
              {/* Accessory slots: 'hat', 'aura', 'trail', 'expression' */}
              {activeSlot !== 'skin' && (
                <>
                  {/* None / Unequip Option */}
                  <Pressable
                    style={[
                      styles.itemCard,
                      !equippedAccessories[activeSlot as AccessorySlot] && styles.itemCardEquipped,
                    ]}
                    onPress={() => handleEquipSlotAccessory(activeSlot as AccessorySlot, null)}
                  >
                    <View style={styles.itemCardThumbWrap}>
                      <Text style={styles.noneEmoji}>🚫</Text>
                    </View>
                    <Text style={styles.itemCardName}>None</Text>
                    {!equippedAccessories[activeSlot as AccessorySlot] ? (
                      <View style={styles.itemBtnEquipped}>
                        <Check size={12} color="#FFFFFF" />
                        <Text style={styles.itemBtnText}>EQUIPPED</Text>
                      </View>
                    ) : (
                      <View style={styles.itemBtnEquip}>
                        <Text style={styles.itemBtnText}>EQUIP</Text>
                      </View>
                    )}
                  </Pressable>

                  {/* Catalog accessories for this slot */}
                  {currentSlotAccessories.map((acc) => {
                    const isEquipped = equippedAccessories[activeSlot as AccessorySlot] === acc.id;
                    const isOwned = ownedAccessories.includes(acc.id);
                    const itemImg = ACCESSORY_ASSETS[acc.id];

                    return (
                      <Pressable
                        key={acc.id}
                        style={[styles.itemCard, isEquipped && styles.itemCardEquipped]}
                        onPress={() => {
                          if (isOwned) {
                            handleEquipSlotAccessory(activeSlot as AccessorySlot, isEquipped ? null : acc.id);
                          } else if (onOpenShop) {
                            onOpenShop('accessories');
                          }
                        }}
                      >
                        <View style={styles.itemCardThumbWrap}>
                          {itemImg && (
                            <Image source={itemImg} style={styles.itemCardThumb} resizeMode="contain" />
                          )}
                        </View>
                        <Text style={styles.itemCardName} numberOfLines={2}>
                          {acc.name}
                        </Text>
                        {isEquipped ? (
                          <View style={styles.itemBtnEquipped}>
                            <Check size={12} color="#FFFFFF" />
                            <Text style={styles.itemBtnText}>EQUIPPED</Text>
                          </View>
                        ) : isOwned ? (
                          <View style={styles.itemBtnEquip}>
                            <Text style={styles.itemBtnText}>EQUIP</Text>
                          </View>
                        ) : (
                          <View style={styles.itemBtnShop}>
                            <Lock size={11} color="#FBBF24" />
                            <Text style={styles.itemBtnShopText}>SHOP</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </>
              )}

              {/* Skin Slot */}
              {activeSlot === 'skin' && (
                <>
                  {/* Classic Pip Skin */}
                  <Pressable
                    style={[
                      styles.itemCard,
                      (!equippedSkins['pip'] || equippedSkins['pip'] === 'pip_classic') && styles.itemCardEquipped,
                    ]}
                    onPress={() => handleEquipSkin(null)}
                  >
                    <View style={styles.itemCardThumbWrap}>
                      <Image
                        source={getSkinImage('pip_classic')}
                        style={styles.itemCardThumb}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={styles.itemCardName}>Classic Pip</Text>
                    {(!equippedSkins['pip'] || equippedSkins['pip'] === 'pip_classic') ? (
                      <View style={styles.itemBtnEquipped}>
                        <Check size={12} color="#FFFFFF" />
                        <Text style={styles.itemBtnText}>EQUIPPED</Text>
                      </View>
                    ) : (
                      <View style={styles.itemBtnEquip}>
                        <Text style={styles.itemBtnText}>EQUIP</Text>
                      </View>
                    )}
                  </Pressable>

                  {/* Pip Skin variants */}
                  {currentCreatureSkins.map((skin) => {
                    const isEquipped = equippedSkins['pip'] === skin.id;
                    const isOwned = ownedSkins.includes(skin.id);
                    const skinThumb = getSkinImage(skin.id);

                    return (
                      <Pressable
                        key={skin.id}
                        style={[styles.itemCard, isEquipped && styles.itemCardEquipped]}
                        onPress={() => {
                          if (isOwned) {
                            handleEquipSkin(isEquipped ? null : skin.id);
                          } else if (onOpenShop) {
                            onOpenShop('skins');
                          }
                        }}
                      >
                        <View style={styles.itemCardThumbWrap}>
                          {skinThumb && (
                            <Image source={skinThumb} style={styles.itemCardThumb} resizeMode="contain" />
                          )}
                        </View>
                        <Text style={styles.itemCardName} numberOfLines={2}>
                          {skin.name}
                        </Text>
                        {isEquipped ? (
                          <View style={styles.itemBtnEquipped}>
                            <Check size={12} color="#FFFFFF" />
                            <Text style={styles.itemBtnText}>EQUIPPED</Text>
                          </View>
                        ) : isOwned ? (
                          <View style={styles.itemBtnEquip}>
                            <Text style={styles.itemBtnText}>EQUIP</Text>
                          </View>
                        ) : (
                          <View style={styles.itemBtnShop}>
                            <Lock size={11} color="#FBBF24" />
                            <Text style={styles.itemBtnShopText}>SHOP</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </>
              )}
            </ScrollView>

            {/* ── 4. Stats Overview ── */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Sparkles size={16} color="#FBBF24" />
                <Text style={styles.statVal}>{stardust.toLocaleString()}</Text>
                <Text style={styles.statLabel}>STARDUST</Text>
              </View>

              <View style={styles.statBox}>
                <Gem size={16} color="#38BDF8" />
                <Text style={styles.statVal}>{crystals.toLocaleString()}</Text>
                <Text style={styles.statLabel}>CRYSTALS</Text>
              </View>

              <View style={styles.statBox}>
                <Flame size={16} color="#F97316" />
                <Text style={styles.statVal}>{collectionCount} / 15</Text>
                <Text style={styles.statLabel}>CRITTERS</Text>
              </View>

              <View style={styles.statBox}>
                <Trophy size={16} color="#A78BFA" />
                <Text style={styles.statVal}>{mode}</Text>
                <Text style={styles.statLabel}>MODE</Text>
              </View>
            </View>

            {/* ── 5. Daily Challenge Action ── */}
            {onStartDaily && (
              <Pressable
                style={styles.dailyBanner}
                onPress={() => {
                  sfx.play('whoosh', 0.5);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onClose();
                  onStartDaily();
                }}
              >
                <View style={styles.dailyLeft}>
                  <Sparkles size={20} color="#FFD36E" />
                  <View>
                    <Text style={styles.dailyTitle}>DAILY CHALLENGE</Text>
                    <Text style={styles.dailySub}>Earn +80 XP & +25 Stardust</Text>
                  </View>
                </View>
                <ChevronRight size={18} color="#FFD36E" />
              </Pressable>
            )}

            {/* ── 6. Coupon / Promo Section ── */}
            <View style={styles.couponSection}>
              <View style={styles.sectionHeader}>
                <Ticket size={18} color="#E879F9" />
                <Text style={styles.sectionTitle}>REDEEM PROMO CODE</Text>
              </View>
              <Text style={styles.sectionSub}>
                Enter a promotional code to claim free rewards:
              </Text>

              {/* Input Row */}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={(t) => {
                    setCode(t);
                    setFeedback(null);
                  }}
                  placeholder="ENTER CODE (e.g. WELCOME)"
                  placeholderTextColor="#64748B"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => handleApply()}
                />
                <Pressable
                  style={[styles.applyBtn, !code.trim() && styles.applyBtnDisabled]}
                  onPress={() => handleApply()}
                  disabled={!code.trim()}
                >
                  <Text style={styles.applyBtnText}>APPLY</Text>
                </Pressable>
              </View>

              {/* Feedback Message */}
              {feedback && (
                <View
                  style={[
                    styles.feedbackBanner,
                    feedback.success ? styles.feedbackSuccess : styles.feedbackError,
                  ]}
                >
                  {feedback.success ? (
                    <Check size={16} color="#10B981" />
                  ) : (
                    <X size={16} color="#EF4444" />
                  )}
                  <Text
                    style={[
                      styles.feedbackText,
                      feedback.success ? styles.feedbackSuccessText : styles.feedbackErrorText,
                    ]}
                  >
                    {feedback.message}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 1, 15, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  scroll: {
    maxHeight: 560,
  },

  // Character Showcase Stage
  characterStage: {
    backgroundColor: '#1E1B4B',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#4338CA',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  stageBackdrop: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stageMascot: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    zIndex: 5,
  },
  stageHat: {
    position: 'absolute',
    top: 8,
    width: 84,
    height: 52,
    alignSelf: 'center',
    zIndex: 10,
  },
  stageExpr: {
    position: 'absolute',
    top: 68,
    width: 64,
    height: 32,
    alignSelf: 'center',
    zIndex: 8,
  },
  stageAura: {
    position: 'absolute',
    width: 180,
    height: 180,
    alignSelf: 'center',
    opacity: 0.88,
    zIndex: 1,
  },
  stageTrail: {
    position: 'absolute',
    bottom: 8,
    width: 140,
    height: 46,
    alignSelf: 'center',
    opacity: 0.88,
    zIndex: 2,
  },
  characterInfo: {
    alignItems: 'center',
    marginTop: 6,
    width: '100%',
  },
  characterName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  activePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: 8,
  },
  gearPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  gearPillText: {
    color: '#FDE047',
    fontSize: 11,
    fontWeight: '800',
  },

  // Wardrobe Body Customizer Header
  wardrobeHeader: {
    marginBottom: 8,
  },
  wardrobeTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  wardrobeSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  // Slot Navigation Tabs
  slotTabScroll: {
    maxHeight: 46,
    marginBottom: 12,
  },
  slotTabContent: {
    gap: 8,
    alignItems: 'center',
  },
  slotTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    borderWidth: 1.2,
    borderColor: '#334155',
  },
  slotTabBtnActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#60A5FA',
  },
  slotTabText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  slotTabTextActive: {
    color: '#FFFFFF',
  },

  // Item Cards Carousel
  itemCardsScroll: {
    marginBottom: 18,
  },
  itemCardsContent: {
    gap: 10,
    paddingRight: 10,
  },
  itemCard: {
    width: 106,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 8,
    alignItems: 'center',
    gap: 6,
    minHeight: 142,
    justifyContent: 'space-between',
  },
  itemCardEquipped: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  itemCardThumbWrap: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
  },
  itemCardThumb: {
    width: 52,
    height: 52,
  },
  noneEmoji: {
    fontSize: 26,
  },
  itemCardName: {
    color: '#F8FAFC',
    fontSize: 10.5,
    fontWeight: '800',
    textAlign: 'center',
    height: 26,
    lineHeight: 13,
  },
  itemBtnEquip: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  itemBtnEquipped: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
  },
  itemBtnShop: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  itemBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  itemBtnShopText: {
    color: '#FDE047',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: 3,
  },
  statVal: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dailyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  dailyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dailyTitle: {
    color: '#FFD36E',
    fontWeight: '800',
    fontSize: 13,
  },
  dailySub: {
    color: '#94A3B8',
    fontSize: 11,
  },
  couponSection: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    color: '#E879F9',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  sectionSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  applyBtn: {
    backgroundColor: '#A855F7',
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnDisabled: {
    opacity: 0.4,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  feedbackError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackSuccessText: {
    color: '#34D399',
  },
  feedbackErrorText: {
    color: '#F87171',
  },
});
