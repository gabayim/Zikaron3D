import React, { useEffect, useState } from 'react';
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
import {
  BlurMask,
  Canvas,
  Group,
  Image as SkiaImage,
  Oval,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flame,
  Gem,
  Gift,
  Music,
  Palette,
  Pencil,
  QrCode,
  ShoppingBag,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  Wand2,
  Wind,
  X,
} from 'lucide-react-native';
import { applyMusicMute, sfx } from '../fx/sound';
import { useAudioSettings } from '../store/audioSettings';
import { useProfile } from '../store/profile';
import { useEconomy } from '../store/economy';
import { useInventory } from '../store/inventory';
import { levelForXp } from '../store/progression';
import {
  getAccessoriesBySlot,
  getSkinsForCreature,
  type AccessoryDef,
  type AccessorySlot,
  type SkinDef,
} from '../data/shopCatalog';
import { ACCESSORY_ASSETS, getSkinImage } from '../data/shopAssets';
import { PIP } from '../render/sprites';
import { SpriteCharacter, useClipImages, useSpritePlayer } from '../render/SpriteCharacter';
import { localizeCatalogName } from './i18n/catalog';
import {
  COLLECTION_TOTAL,
  DAILY_CHALLENGE_STARDUST,
  DAILY_CHALLENGE_XP,
  getProfileCopy,
} from './i18n/profile';
import { RedeemCodeModal } from './RedeemCodeModal';
import { InviteModal } from './InviteModal';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onStartDaily?: () => void;
  onOpenShop?: (tab: 'skins' | 'accessories') => void;
}

const ACCESSORY_AREAS: { slot: AccessorySlot; icon: React.FC<{ size: number; color: string }> }[] = [
  { slot: 'hat', icon: Crown },
  { slot: 'aura', icon: Wand2 },
  { slot: 'trail', icon: Wind },
];

const STAGE_SIZE = 180;
const PIP_CLIPS = ['idle', 'hop', 'wave'] as const;

function ProfileStage({
  skinId,
  hatAsset,
  auraAsset,
  trailAsset,
}: {
  skinId: string;
  hatAsset: number | null;
  auraAsset: number | null;
  trailAsset: number | null;
}) {
  const isClassic = skinId === 'pip_classic';
  const pipImages = useClipImages(PIP, PIP_CLIPS);
  const pip = useSpritePlayer(PIP);
  const fallbackSkinSource = getSkinImage(skinId) ?? getSkinImage('pip_classic') ?? null;
  const skinSkia = useImage(fallbackSkinSource);
  const hatSkia = useImage(hatAsset);
  const auraSkia = useImage(auraAsset);
  const trailSkia = useImage(trailAsset);

  const bob = useSharedValue(0);
  const sqx = useSharedValue(1);
  const sqy = useSharedValue(1);

  useFrameCallback((info) => {
    const t = info.timestamp / 1000;
    bob.set(Math.sin(t * 2.6) * 3.5);
  });

  useEffect(() => {
    if (!isClassic) return;
    const id = setInterval(() => {
      if (pip.current() === 'idle' && Math.random() < 0.65) {
        pip.play(Math.random() < 0.5 ? 'wave' : 'hop');
      }
    }, 3400);
    return () => clearInterval(id);
  }, [isClassic, pip]);

  const pipH = 148;
  const pipW = (pipH * PIP.frameWidth) / PIP.frameHeight;
  const pipX = STAGE_SIZE / 2;
  const pipGround = 162;
  const pipY = pipGround - pipH * 0.9;

  const charTransform = useDerivedValue(() => [
    { translateY: bob.get() },
    { scaleX: sqx.get() },
    { scaleY: sqy.get() },
  ]);
  const shadowTransform = useDerivedValue(() => [
    { scaleX: sqx.get() * (1 - bob.get() * 0.015) },
    { scaleY: 1 - bob.get() * 0.015 },
  ]);

  const handleTap = () => {
    sqx.set(withSequence(withTiming(1.14, { duration: 70 }), withSpring(1, { damping: 5, stiffness: 320 })));
    sqy.set(withSequence(withTiming(0.86, { duration: 70 }), withSpring(1, { damping: 5, stiffness: 320 })));
    if (isClassic) pip.play(Math.random() < 0.5 ? 'wave' : 'hop');
    sfx.play('pop');
    if (Math.random() < 0.45) setTimeout(() => sfx.play('boing', 0.55), 240);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const showAnimatedPip = isClassic && !!pipImages[0];

  return (
    <Pressable style={styles.stageBackdrop} onPress={handleTap}>
      <Canvas style={styles.stageCanvas}>
        <Group transform={shadowTransform} origin={vec(pipX, pipGround)}>
          <Oval
            x={pipX - pipW * 0.32}
            y={pipGround - pipH * 0.05}
            width={pipW * 0.64}
            height={pipH * 0.07}
            color="rgba(10,0,28,0.55)"
          >
            <BlurMask blur={8} style="normal" />
          </Oval>
        </Group>

        {trailSkia && (
          <SkiaImage
            image={trailSkia}
            x={pipX - pipW * 0.5}
            y={pipY + pipH * 0.66}
            width={pipW}
            height={pipH * 0.32}
            fit="contain"
            blendMode="plus"
            opacity={0.88}
          />
        )}

        {auraSkia && (
          <SkiaImage
            image={auraSkia}
            x={pipX - pipH * 0.52}
            y={pipY + pipH * 0.02}
            width={pipH * 1.04}
            height={pipH * 1.04}
            fit="contain"
            blendMode="plus"
            opacity={0.88}
          />
        )}

        <Group transform={charTransform} origin={vec(pipX, pipGround)}>
          {showAnimatedPip ? (
            <SpriteCharacter
              sheet={PIP}
              images={pipImages}
              clip={pip.clip}
              frame={pip.frame}
              x={pipX - pipW / 2}
              y={pipY}
              height={pipH}
            />
          ) : (
            skinSkia && (
              <SkiaImage
                image={skinSkia}
                x={pipX - 60}
                y={pipGround - 126}
                width={120}
                height={120}
                fit="contain"
              />
            )
          )}

          {hatSkia && (
            <SkiaImage
              image={hatSkia}
              x={pipX - pipW * 0.29}
              y={pipY - pipH * 0.04}
              width={pipW * 0.58}
              height={pipH * 0.30}
              fit="contain"
            />
          )}
        </Group>
      </Canvas>
    </Pressable>
  );
}

export function ProfileModal({ visible, onClose, onStartDaily, onOpenShop }: ProfileModalProps) {
  const xp = useProfile((s) => s.xp);
  const mode = useProfile((s) => s.mode);
  const collectionCount = useProfile((s) => s.collection.length);
  const characterName = useProfile((s) => s.characterName);
  const setCharacterName = useProfile((s) => s.setCharacterName);
  const musicOn = useAudioSettings((s) => s.musicOn);
  const sfxOn = useAudioSettings((s) => s.sfxOn);
  const toggleMusic = useAudioSettings((s) => s.toggleMusic);
  const toggleSfx = useAudioSettings((s) => s.toggleSfx);
  const { strings, rtl, locale } = getProfileCopy();

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

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(characterName);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const level = levelForXp(xp);

  // Equipped assets for preview
  const currentSkinId = equippedSkins['pip'] ?? 'pip_classic';
  const hatAsset = equippedAccessories.hat ? ACCESSORY_ASSETS[equippedAccessories.hat] ?? null : null;
  const auraAsset = equippedAccessories.aura ? ACCESSORY_ASSETS[equippedAccessories.aura] ?? null : null;
  const trailAsset = equippedAccessories.trail ? ACCESSORY_ASSETS[equippedAccessories.trail] ?? null : null;

  const handleSaveName = () => {
    setCharacterName(nameDraft);
    setEditingName(false);
    sfx.play('pop', 0.5);
    Haptics.selectionAsync();
  };

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

  // Owned assets grouped per area (only items the player actually owns)
  const ownedAreas = ACCESSORY_AREAS.map((area) => ({
    ...area,
    items: getAccessoriesBySlot(area.slot).filter((a) => ownedAccessories.includes(a.id)),
  })).filter((area) => area.items.length > 0);

  const ownedPipSkins: SkinDef[] = getSkinsForCreature('pip').filter(
    (s) => s.id !== 'pip_classic' && ownedSkins.includes(s.id),
  );
  const hasAnyAssets = ownedAreas.length > 0 || ownedPipSkins.length > 0;

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
          <View style={[styles.header, rtl && styles.rowReverse]}>
            <View style={[styles.titleRow, rtl && styles.rowReverse]}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>{strings.levelBadge(level)}</Text>
              </View>
              <Text style={[styles.title, rtl && styles.rtlText]}>{strings.title}</Text>
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

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ── 1. Character Showcase Stage ── */}
            <View style={styles.characterStage}>
              {visible ? (
                <ProfileStage
                  skinId={currentSkinId}
                  hatAsset={hatAsset}
                  auraAsset={auraAsset}
                  trailAsset={trailAsset}
                />
              ) : (
                <View style={styles.stageBackdrop} />
              )}

              <View style={styles.characterInfo}>
                {editingName ? (
                  <View style={[styles.nameEditRow, rtl && styles.rowReverse]}>
                    <TextInput
                      style={[styles.nameInput, rtl && styles.rtlCentered]}
                      value={nameDraft}
                      onChangeText={setNameDraft}
                      placeholder={strings.namePlaceholder}
                      placeholderTextColor="#64748B"
                      maxLength={18}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleSaveName}
                    />
                    <Pressable style={styles.nameSaveBtn} onPress={handleSaveName} hitSlop={8}>
                      <Check size={16} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.nameDisplayBtn, rtl && styles.rowReverse]}
                    onPress={() => {
                      setNameDraft(characterName);
                      setEditingName(true);
                      void Haptics.selectionAsync();
                    }}
                    hitSlop={8}
                  >
                    <Text style={[styles.characterName, rtl && styles.rtlCentered]}>{characterName}</Text>
                    <Pencil size={13} color="#94A3B8" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* ── 2. Owned Assets (1 item or none per area) ── */}
            <View style={styles.wardrobeHeader}>
              <Text style={[styles.wardrobeTitle, rtl && styles.rtlCentered]}>
                {strings.myAssetsTitle}
              </Text>
              <Text style={[styles.wardrobeSub, rtl && styles.rtlCentered]}>
                {hasAnyAssets ? strings.myAssetsSubtitle : strings.emptyAssetsTitle}
              </Text>
            </View>

            {!hasAnyAssets ? (
              <View style={styles.emptyAssetsCard}>
                <ShoppingBag size={26} color="#38BDF8" />
                <Text style={[styles.emptyAssetsTitle, rtl && styles.rtlCentered]}>
                  {strings.emptyAssetsTitle}
                </Text>
                <Text style={[styles.emptyAssetsSub, rtl && styles.rtlCentered]}>
                  {strings.emptyAssetsSub}
                </Text>
                {onOpenShop && (
                  <Pressable
                    style={[styles.goToShopBtn, rtl && styles.rowReverse]}
                    onPress={() => {
                      sfx.play('pop', 0.5);
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onOpenShop('accessories');
                    }}
                  >
                    <ShoppingBag size={15} color="#0B132B" />
                    <Text style={styles.goToShopBtnText}>{strings.goToShop}</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.ownedAreasWrap}>
                {ownedAreas.map((area) => {
                  const AreaIcon = area.icon;
                  const activeId = equippedAccessories[area.slot];
                  return (
                    <View key={area.slot} style={styles.areaBlock}>
                      <View style={[styles.areaLabelRow, rtl && styles.rowReverse]}>
                        <AreaIcon size={13} color="#94A3B8" />
                        <Text style={[styles.areaLabelText, rtl && styles.rtlText]}>
                          {strings.slots[area.slot]}
                        </Text>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.itemCardsScroll}
                        contentContainerStyle={styles.itemCardsContent}
                      >
                        <Pressable
                          style={[styles.itemCard, !activeId && styles.itemCardEquipped]}
                          onPress={() => handleEquipSlotAccessory(area.slot, null)}
                        >
                          <View style={styles.itemCardThumbWrap}>
                            <Text style={styles.noneEmoji}>🚫</Text>
                          </View>
                          <Text style={[styles.itemCardName, rtl && styles.rtlCentered]}>
                            {strings.none}
                          </Text>
                          {!activeId ? (
                            <View style={[styles.itemBtnEquipped, rtl && styles.rowReverse]}>
                              <Check size={11} color="#FFFFFF" />
                              <Text style={[styles.itemBtnText, rtl && styles.rtlCentered]} numberOfLines={1}>
                                {strings.equipped}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.itemBtnEquip}>
                              <Text style={[styles.itemBtnText, rtl && styles.rtlCentered]} numberOfLines={1}>
                                {strings.remove}
                              </Text>
                            </View>
                          )}
                        </Pressable>

                        {area.items.map((acc: AccessoryDef) => {
                          const isEquipped = activeId === acc.id;
                          const itemImg = ACCESSORY_ASSETS[acc.id];
                          return (
                            <Pressable
                              key={acc.id}
                              style={[styles.itemCard, isEquipped && styles.itemCardEquipped]}
                              onPress={() =>
                                handleEquipSlotAccessory(area.slot, isEquipped ? null : acc.id)
                              }
                            >
                              <View style={styles.itemCardThumbWrap}>
                                {itemImg && (
                                  <Image source={itemImg} style={styles.itemCardThumb} resizeMode="contain" />
                                )}
                              </View>
                              <Text
                                style={[styles.itemCardName, rtl && styles.rtlCentered]}
                                numberOfLines={2}
                              >
                                {localizeCatalogName(acc.name, locale)}
                              </Text>
                              {isEquipped ? (
                                <View style={[styles.itemBtnEquipped, rtl && styles.rowReverse]}>
                                  <Check size={11} color="#FFFFFF" />
                                  <Text style={[styles.itemBtnText, rtl && styles.rtlCentered]} numberOfLines={1}>
                                    {strings.equipped}
                                  </Text>
                                </View>
                              ) : (
                                <View style={styles.itemBtnEquip}>
                                  <Text style={[styles.itemBtnText, rtl && styles.rtlCentered]} numberOfLines={1}>
                                    {strings.equip}
                                  </Text>
                                </View>
                              )}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  );
                })}

                {ownedPipSkins.length > 0 && (
                  <View style={styles.areaBlock}>
                    <View style={[styles.areaLabelRow, rtl && styles.rowReverse]}>
                      <Palette size={13} color="#94A3B8" />
                      <Text style={[styles.areaLabelText, rtl && styles.rtlText]}>
                        {strings.slots.skin}
                      </Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.itemCardsScroll}
                      contentContainerStyle={styles.itemCardsContent}
                    >
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
                        <Text style={[styles.itemCardName, rtl && styles.rtlCentered]}>
                          {strings.classicSkin}
                        </Text>
                        {!equippedSkins['pip'] || equippedSkins['pip'] === 'pip_classic' ? (
                          <View style={[styles.itemBtnEquipped, rtl && styles.rowReverse]}>
                            <Check size={11} color="#FFFFFF" />
                            <Text style={[styles.itemBtnText, rtl && styles.rtlCentered]} numberOfLines={1}>
                              {strings.equipped}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.itemBtnEquip}>
                            <Text style={[styles.itemBtnText, rtl && styles.rtlCentered]} numberOfLines={1}>
                              {strings.equip}
                            </Text>
                          </View>
                        )}
                      </Pressable>

                      {ownedPipSkins.map((skin) => {
                        const isEquipped = equippedSkins['pip'] === skin.id;
                        const skinThumb = getSkinImage(skin.id);
                        return (
                          <Pressable
                            key={skin.id}
                            style={[styles.itemCard, isEquipped && styles.itemCardEquipped]}
                            onPress={() => handleEquipSkin(isEquipped ? null : skin.id)}
                          >
                            <View style={styles.itemCardThumbWrap}>
                              {skinThumb && (
                                <Image source={skinThumb} style={styles.itemCardThumb} resizeMode="contain" />
                              )}
                            </View>
                            <Text
                              style={[styles.itemCardName, rtl && styles.rtlCentered]}
                              numberOfLines={2}
                            >
                              {localizeCatalogName(skin.name, locale)}
                            </Text>
                            {isEquipped ? (
                              <View style={[styles.itemBtnEquipped, rtl && styles.rowReverse]}>
                                <Check size={11} color="#FFFFFF" />
                                <Text style={[styles.itemBtnText, rtl && styles.rtlCentered]} numberOfLines={1}>
                                  {strings.equipped}
                                </Text>
                              </View>
                            ) : (
                              <View style={styles.itemBtnEquip}>
                                <Text style={[styles.itemBtnText, rtl && styles.rtlCentered]} numberOfLines={1}>
                                  {strings.equip}
                                </Text>
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {/* ── 4. Gifts & Rewards ── */}
            <View style={styles.giftsSectionHeader}>
              <Text style={[styles.giftsSectionTitle, rtl && styles.rtlCentered]}>
                {strings.giftsTitle}
              </Text>
            </View>
            <View style={[styles.giftsSection, rtl && styles.rowReverse]}>
              <Pressable
                style={[styles.giftBtn, rtl && styles.rowReverse]}
                onPress={() => {
                  sfx.play('pop');
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowRedeemModal(true);
                }}
              >
                <Gift size={16} color="#FBBF24" />
                <Text style={[styles.giftBtnText, rtl && styles.rtlCentered]} numberOfLines={1}>
                  {strings.redeemCode}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.inviteBtn, rtl && styles.rowReverse]}
                onPress={() => {
                  sfx.play('pop');
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowInviteModal(true);
                }}
              >
                <QrCode size={16} color="#38BDF8" />
                <Text style={[styles.inviteBtnText, rtl && styles.rtlCentered]} numberOfLines={1}>
                  {strings.inviteFriends}
                </Text>
              </Pressable>
            </View>

            {/* ── 5. Sound & Audio ── */}
            <View style={styles.giftsSectionHeader}>
              <Text style={[styles.giftsSectionTitle, rtl && styles.rtlCentered]}>{strings.soundTitle}</Text>
            </View>
            <View style={[styles.audioRow, rtl && styles.rowReverse]}>
              <Pressable
                style={[styles.audioBtn, rtl && styles.rowReverse, musicOn ? styles.audioBtnOn : styles.audioBtnOff]}
                onPress={() => {
                  toggleMusic();
                  const next = useAudioSettings.getState().musicOn;
                  applyMusicMute(!next);
                  if (next) sfx.play('sparkle', 0.4);
                  void Haptics.selectionAsync();
                }}
              >
                <Music size={16} color={musicOn ? '#38BDF8' : '#64748B'} />
                <Text style={[styles.audioBtnText, !musicOn && styles.audioBtnTextOff, rtl && styles.rtlCentered]}>
                  {musicOn ? strings.musicOn : strings.musicOff}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.audioBtn, rtl && styles.rowReverse, sfxOn ? styles.audioBtnOn : styles.audioBtnOff]}
                onPress={() => {
                  const wasOn = sfxOn;
                  toggleSfx();
                  if (!wasOn) sfx.play('pop', 0.5);
                  void Haptics.selectionAsync();
                }}
              >
                {sfxOn ? (
                  <Volume2 size={16} color="#8CFFC1" />
                ) : (
                  <VolumeX size={16} color="#64748B" />
                )}
                <Text style={[styles.audioBtnText, !sfxOn && styles.audioBtnTextOff, rtl && styles.rtlCentered]}>
                  {sfxOn ? strings.sfxOn : strings.sfxOff}
                </Text>
              </Pressable>
            </View>

            {/* ── 6. Stats Overview ── */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Sparkles size={16} color="#FBBF24" />
                <Text style={styles.statVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{stardust.toLocaleString()}</Text>
                <Text style={[styles.statLabel, rtl && styles.rtlCentered]}>{strings.stats.stardust}</Text>
              </View>

              <View style={styles.statBox}>
                <Gem size={16} color="#38BDF8" />
                <Text style={styles.statVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{crystals.toLocaleString()}</Text>
                <Text style={[styles.statLabel, rtl && styles.rtlCentered]}>{strings.stats.crystals}</Text>
              </View>

              <View style={styles.statBox}>
                <Flame size={16} color="#F97316" />
                <Text style={styles.statVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{collectionCount} / {COLLECTION_TOTAL}</Text>
                <Text style={[styles.statLabel, rtl && styles.rtlCentered]}>{strings.stats.critters}</Text>
              </View>

              <View style={styles.statBox}>
                <Trophy size={16} color="#A78BFA" />
                <Text style={styles.statVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{strings.modes[mode]}</Text>
                <Text style={[styles.statLabel, rtl && styles.rtlCentered]}>{strings.stats.mode}</Text>
              </View>
            </View>

            {/* ── 5. Daily Challenge Action ── */}
            {onStartDaily && (
              <Pressable
                style={[styles.dailyBanner, rtl && styles.rowReverse]}
                onPress={() => {
                  sfx.play('whoosh', 0.5);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onClose();
                  onStartDaily();
                }}
              >
                <View style={[styles.dailyLeft, rtl && styles.rowReverse]}>
                  <Sparkles size={20} color="#FFD36E" />
                  <View>
                    <Text style={[styles.dailyTitle, rtl && styles.rtlText]}>
                      {strings.dailyChallenge}
                    </Text>
                    <Text style={[styles.dailySub, rtl && styles.rtlText]}>
                      {strings.dailyReward(DAILY_CHALLENGE_XP, DAILY_CHALLENGE_STARDUST)}
                    </Text>
                  </View>
                </View>
                {rtl ? (
                  <ChevronLeft size={18} color="#FFD36E" />
                ) : (
                  <ChevronRight size={18} color="#FFD36E" />
                )}
              </Pressable>
            )}

          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <RedeemCodeModal
        visible={showRedeemModal}
        onClose={() => setShowRedeemModal(false)}
      />
      <InviteModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  /** RTL: swap the visual order of icon/label rows. */
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  /** RTL: right-align a text block that is left-aligned in English. */
  rtlText: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  /** RTL: keep centered text centered, only fix the bidi paragraph direction. */
  rtlCentered: {
    writingDirection: 'rtl',
  },
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
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 24,
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
  stageCanvas: {
    width: 180,
    height: 180,
  },
  characterInfo: {
    alignItems: 'center',
    marginTop: 6,
    width: '100%',
  },
  characterName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  nameDisplayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    minWidth: 140,
    maxWidth: 200,
    height: 36,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    borderRadius: 10,
    paddingHorizontal: 10,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  nameSaveBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
  },
  wardrobeSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },

  // Empty & Owned Asset Areas
  emptyAssetsCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    padding: 18,
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  emptyAssetsTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
  },
  emptyAssetsSub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  goToShopBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#38BDF8',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  goToShopBtnText: {
    color: '#0B132B',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  ownedAreasWrap: {
    gap: 6,
    marginBottom: 8,
  },
  areaBlock: {
    marginBottom: 4,
  },
  areaLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  areaLabelText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  // Item Cards Carousel
  itemCardsScroll: {
    marginBottom: 10,
  },
  itemCardsContent: {
    gap: 10,
    paddingRight: 10,
  },
  itemCard: {
    width: 112,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 8,
    alignItems: 'center',
    gap: 6,
    minHeight: 144,
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
    paddingHorizontal: 4,
    paddingVertical: 5,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBtnEquipped: {
    backgroundColor: '#10B981',
    paddingHorizontal: 4,
    paddingVertical: 5,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
  },
  itemBtnShop: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 4,
    paddingVertical: 4.5,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
  },
  itemBtnText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  itemBtnShopText: {
    color: '#FDE047',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.2,
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
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: 3,
  },
  statVal: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
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
    marginBottom: 8,
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
  giftsSection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    width: '100%',
  },
  giftsSectionHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  giftsSectionTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  giftBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 6,
  },
  giftBtnText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '800',
  },
  inviteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 6,
  },
  inviteBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  audioRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    width: '100%',
  },
  audioBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 8,
  },
  audioBtnOn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  audioBtnOff: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  audioBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  audioBtnTextOff: {
    color: '#94A3B8',
  },
});
