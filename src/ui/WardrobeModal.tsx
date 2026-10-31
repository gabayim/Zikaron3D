import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Crown, Lock, Sparkles, Wand2, Wind, X } from 'lucide-react-native';
import {
  getAccessoriesBySlot,
  getSkinsForCreature,
} from '../data/shopCatalog';
import { sfx } from '../fx/sound';
import { CAST_COLOR } from '../render/castColors';
import { CreatureId } from '../store/profile';
import { useInventory } from '../store/inventory';

interface WardrobeModalProps {
  visible: boolean;
  creatureId: CreatureId | null;
  onClose: () => void;
  onOpenShop?: () => void;
}

type Tab = 'skins' | 'hat' | 'aura' | 'trail';

export function WardrobeModal({
  visible,
  creatureId,
  onClose,
  onOpenShop,
}: WardrobeModalProps) {
  const [tab, setTab] = useState<Tab>('skins');

  const ownedSkins = useInventory((s) => s.ownedSkins);
  const ownedAccessories = useInventory((s) => s.ownedAccessories);
  const equippedSkins = useInventory((s) => s.equippedSkins);
  const equippedAccessories = useInventory((s) => s.equippedAccessories);
  const equipSkin = useInventory((s) => s.equipSkin);
  const unequipSkin = useInventory((s) => s.unequipSkin);
  const equipAccessory = useInventory((s) => s.equipAccessory);
  const unequipAccessory = useInventory((s) => s.unequipAccessory);

  if (!visible || !creatureId) return null;

  const currentSkinId = equippedSkins[creatureId];
  const creatureSkins = getSkinsForCreature(creatureId);

  const handleEquipSkin = (skinId: string | null) => {
    sfx.play('chime', 0.8);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!skinId) {
      unequipSkin(creatureId);
    } else {
      equipSkin(creatureId, skinId);
    }
  };

  const handleEquipAccessory = (slot: 'hat' | 'aura' | 'trail', id: string | null) => {
    sfx.play('chime', 0.8);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!id) {
      unequipAccessory(slot);
    } else {
      equipAccessory(slot, id);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.creatureDot,
                  { backgroundColor: CAST_COLOR[creatureId] },
                ]}
              />
              <Text style={styles.title}>
                {creatureId.toUpperCase()} WARDROBE
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
            >
              <X size={20} color="#CBD5E1" />
            </Pressable>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tab, tab === 'skins' && styles.tabActive]}
              onPress={() => setTab('skins')}
            >
              <Sparkles
                size={16}
                color={tab === 'skins' ? '#FFD36E' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.tabText,
                  tab === 'skins' && styles.tabTextActive,
                ]}
              >
                Skins
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tab, tab === 'hat' && styles.tabActive]}
              onPress={() => setTab('hat')}
            >
              <Crown
                size={16}
                color={tab === 'hat' ? '#FFD36E' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.tabText,
                  tab === 'hat' && styles.tabTextActive,
                ]}
              >
                Hats
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tab, tab === 'aura' && styles.tabActive]}
              onPress={() => setTab('aura')}
            >
              <Wand2
                size={16}
                color={tab === 'aura' ? '#FFD36E' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.tabText,
                  tab === 'aura' && styles.tabTextActive,
                ]}
              >
                Auras
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tab, tab === 'trail' && styles.tabActive]}
              onPress={() => setTab('trail')}
            >
              <Wind
                size={16}
                color={tab === 'trail' ? '#FFD36E' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.tabText,
                  tab === 'trail' && styles.tabTextActive,
                ]}
              >
                Trails
              </Text>
            </Pressable>
          </View>

          {/* Tab Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {tab === 'skins' && (
              <>
                {/* Default Classic Skin */}
                <Pressable
                  style={[
                    styles.itemCard,
                    !currentSkinId && styles.itemCardEquipped,
                  ]}
                  onPress={() => handleEquipSkin(null)}
                >
                  <View style={styles.itemRow}>
                    <View
                      style={[
                        styles.paletteCircle,
                        { backgroundColor: CAST_COLOR[creatureId] },
                      ]}
                    />
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>Classic</Text>
                      <Text style={styles.itemSub}>Original Palette</Text>
                    </View>
                  </View>
                  {!currentSkinId ? (
                    <View style={styles.equippedBadge}>
                      <Check size={14} color="#22C55E" />
                      <Text style={styles.equippedText}>EQUIPPED</Text>
                    </View>
                  ) : (
                    <Text style={styles.equipActionText}>EQUIP</Text>
                  )}
                </Pressable>

                {/* Creature Custom Skins */}
                {creatureSkins.map((skin) => {
                  const isOwned = ownedSkins.includes(skin.id);
                  const isEquipped = currentSkinId === skin.id;

                  return (
                    <Pressable
                      key={skin.id}
                      style={[
                        styles.itemCard,
                        isEquipped && styles.itemCardEquipped,
                        !isOwned && styles.itemCardLocked,
                      ]}
                      onPress={() => {
                        if (isOwned) {
                          handleEquipSkin(skin.id);
                        } else if (onOpenShop) {
                          onClose();
                          onOpenShop();
                        }
                      }}
                    >
                      <View style={styles.itemRow}>
                        <View
                          style={[
                            styles.paletteCircle,
                            {
                              backgroundColor: skin.palette.primary,
                              borderColor: skin.palette.glow,
                              borderWidth: 2,
                            },
                          ]}
                        />
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>{skin.name}</Text>
                          <Text
                            style={[
                              styles.itemSub,
                              skin.rarity === 'epic' && { color: '#F59E0B' },
                              skin.rarity === 'rare' && { color: '#38BDF8' },
                            ]}
                          >
                            {skin.rarity.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {isEquipped ? (
                        <View style={styles.equippedBadge}>
                          <Check size={14} color="#22C55E" />
                          <Text style={styles.equippedText}>EQUIPPED</Text>
                        </View>
                      ) : isOwned ? (
                        <Text style={styles.equipActionText}>EQUIP</Text>
                      ) : (
                        <View style={styles.lockedBadge}>
                          <Lock size={12} color="#94A3B8" />
                          <Text style={styles.lockedText}>SHOP</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </>
            )}

            {(tab === 'hat' || tab === 'aura' || tab === 'trail') && (
              <>
                {/* None / Default Option */}
                <Pressable
                  style={[
                    styles.itemCard,
                    !equippedAccessories[tab] && styles.itemCardEquipped,
                  ]}
                  onPress={() => handleEquipAccessory(tab, null)}
                >
                  <View style={styles.itemRow}>
                    <View style={styles.paletteCircleEmpty} />
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>None</Text>
                      <Text style={styles.itemSub}>No {tab} equipped</Text>
                    </View>
                  </View>
                  {!equippedAccessories[tab] ? (
                    <View style={styles.equippedBadge}>
                      <Check size={14} color="#22C55E" />
                      <Text style={styles.equippedText}>EQUIPPED</Text>
                    </View>
                  ) : (
                    <Text style={styles.equipActionText}>EQUIP</Text>
                  )}
                </Pressable>

                {/* Catalog Accessories */}
                {getAccessoriesBySlot(tab).map((acc) => {
                  const isOwned = ownedAccessories.includes(acc.id);
                  const isEquipped = equippedAccessories[tab] === acc.id;

                  return (
                    <Pressable
                      key={acc.id}
                      style={[
                        styles.itemCard,
                        isEquipped && styles.itemCardEquipped,
                        !isOwned && styles.itemCardLocked,
                      ]}
                      onPress={() => {
                        if (isOwned) {
                          handleEquipAccessory(tab, acc.id);
                        } else if (onOpenShop) {
                          onClose();
                          onOpenShop();
                        }
                      }}
                    >
                      <View style={styles.itemRow}>
                        <View
                          style={[
                            styles.paletteCircle,
                            {
                              backgroundColor: acc.color,
                              borderColor: '#FFFFFF',
                              borderWidth: 1.5,
                            },
                          ]}
                        />
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>{acc.name}</Text>
                          <Text
                            style={[
                              styles.itemSub,
                              acc.rarity === 'epic' && { color: '#F59E0B' },
                              acc.rarity === 'rare' && { color: '#38BDF8' },
                            ]}
                          >
                            {acc.rarity.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {isEquipped ? (
                        <View style={styles.equippedBadge}>
                          <Check size={14} color="#22C55E" />
                          <Text style={styles.equippedText}>EQUIPPED</Text>
                        </View>
                      ) : isOwned ? (
                        <Text style={styles.equipActionText}>EQUIP</Text>
                      ) : (
                        <View style={styles.lockedBadge}>
                          <Lock size={12} color="#94A3B8" />
                          <Text style={styles.lockedText}>SHOP</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 1, 15, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#120936',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxHeight: '75%',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  creatureDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabActive: {
    backgroundColor: 'rgba(255, 211, 110, 0.18)',
    borderColor: '#FFD36E',
    borderWidth: 1,
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFD36E',
    fontWeight: '900',
  },
  scrollArea: {
    maxHeight: 380,
  },
  scrollContent: {
    padding: 16,
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  itemCardEquipped: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  itemCardLocked: {
    opacity: 0.6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  paletteCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  paletteCircleEmpty: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
  },
  itemInfo: {
    justifyContent: 'center',
  },
  itemName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  itemSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  equippedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  equippedText: {
    color: '#22C55E',
    fontSize: 10,
    fontWeight: '900',
  },
  equipActionText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lockedText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
});
