import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Award, RotateCcw, ShoppingBag, Trophy, X } from 'lucide-react-native';
import { ThemePersona } from '../engine/types';
import { useGameStore } from '../store/useGameStore';
import { getChameleonTheme } from '../theme/chameleonThemes';
import { SensoryManager } from '../services/SensoryManager';
import { FeverVaultBar } from './hud/FeverVaultBar';
import { NearMissModal } from './hud/NearMissModal';
import { TrophyShelf3D } from './meta/TrophyShelf3D';
import { ParentalGateModal } from './compliance/ParentalGateModal';
import { MonetizationService } from '../services/MonetizationService';

export const GameHUD: React.FC = () => {
  const currentLevel = useGameStore((s) => s.currentLevel);
  const score = useGameStore((s) => s.score);
  const flipsRemaining = useGameStore((s) => s.flipsRemaining);
  const themePersona = useGameStore((s) => s.themePersona);
  const matchedPairCount = useGameStore((s) => s.matchedPairCount);
  const totalPairs = useGameStore((s) => s.totalPairs);
  const isGameWon = useGameStore((s) => s.isGameWon);
  const isGameOver = useGameStore((s) => s.isGameOver);
  const nearMissModalVisible = useGameStore((s) => s.nearMissModalVisible);

  const setThemePersona = useGameStore((s) => s.setThemePersona);
  const resetLevel = useGameStore((s) => s.resetLevel);
  const nextLevel = useGameStore((s) => s.nextLevel);

  // Sprint 5 Modals
  const [trophyShowcaseVisible, setTrophyShowcaseVisible] = useState(false);
  const [parentalGateVisible, setParentalGateVisible] = useState(false);
  const [storeModalVisible, setStoreModalVisible] = useState(false);

  const theme = useMemo(() => getChameleonTheme(themePersona), [themePersona]);
  const personas: ThemePersona[] = ['TOYBOX', 'ARCADE', 'SANCTUARY'];
  const catalog = useMemo(() => MonetizationService.getCatalog(), []);

  const handleOpenStore = () => {
    SensoryManager.triggerFlip();
    if (themePersona === 'TOYBOX') {
      // COPPA compliance: require Parental Gate verification for kids mode
      setParentalGateVisible(true);
    } else {
      setStoreModalVisible(true);
    }
  };

  const handleParentalGateSuccess = () => {
    setParentalGateVisible(false);
    setStoreModalVisible(true);
  };

  return (
    <View style={styles.hudOverlay} pointerEvents="box-none">
      {/* ================= TOP HEADER BAR ================= */}
      <View style={styles.topBar}>
        {/* Chameleon Persona Switcher */}
        <View
          style={[
            styles.personaRow,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.surfaceBorder,
              borderRadius: theme.shape.radiusPill,
            },
          ]}
        >
          {personas.map((p) => {
            const active = themePersona === p;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => {
                  SensoryManager.triggerFlip();
                  setThemePersona(p);
                }}
                activeOpacity={0.8}
                style={[
                  styles.personaChip,
                  { borderRadius: theme.shape.radiusPill },
                  active && {
                    backgroundColor: theme.colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.personaText,
                    {
                      fontSize: theme.typography.captionSize,
                      letterSpacing: theme.typography.letterSpacing,
                      color: active ? '#05080E' : theme.colors.textMuted,
                    },
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Action Group: Trophies, Store, Quick Restart */}
        <View style={styles.actionGroup}>
          {/* 3D Biome Figurine Showcase Button */}
          <TouchableOpacity
            onPress={() => {
              SensoryManager.triggerFlip();
              setTrophyShowcaseVisible(true);
            }}
            activeOpacity={0.8}
            style={[
              styles.iconButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.surfaceBorder,
                borderRadius: theme.shape.radiusPill,
              },
            ]}
          >
            <Award size={18} color={theme.colors.accent} />
          </TouchableOpacity>

          {/* Store / Parental Gate Button */}
          <TouchableOpacity
            onPress={handleOpenStore}
            activeOpacity={0.8}
            style={[
              styles.iconButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.surfaceBorder,
                borderRadius: theme.shape.radiusPill,
              },
            ]}
          >
            <ShoppingBag size={18} color={theme.colors.primary} />
          </TouchableOpacity>

          {/* Quick Restart Button */}
          <TouchableOpacity
            onPress={() => {
              SensoryManager.triggerFlip();
              resetLevel();
            }}
            activeOpacity={0.8}
            style={[
              styles.iconButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.surfaceBorder,
                borderRadius: theme.shape.radiusPill,
              },
            ]}
          >
            <RotateCcw size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ================= STATS DISPLAY ================= */}
      <View
        style={[
          styles.statsRow,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.surfaceBorder,
            borderRadius: theme.shape.radiusMedium,
          },
        ]}
      >
        {/* Level & Excavation Pairs */}
        <View style={styles.statBox}>
          <Text
            style={[
              styles.statLabel,
              {
                color: theme.colors.textMuted,
                fontSize: theme.typography.captionSize - 1,
                letterSpacing: theme.typography.letterSpacing,
              },
            ]}
          >
            LEVEL
          </Text>
          <Text
            style={[
              styles.statValue,
              {
                color: theme.colors.textPrimary,
                fontSize: theme.typography.valueSize - 2,
              },
            ]}
          >
            {currentLevel}
          </Text>
          <Text
            style={[
              styles.statSub,
              {
                color: theme.colors.textSecondary,
                fontSize: theme.typography.captionSize - 2,
              },
            ]}
          >
            {matchedPairCount}/{totalPairs}
          </Text>
        </View>

        {/* Score */}
        <View style={[styles.statBox, styles.statBoxCenter]}>
          <Text
            style={[
              styles.statLabel,
              {
                color: theme.colors.textMuted,
                fontSize: theme.typography.captionSize - 1,
                letterSpacing: theme.typography.letterSpacing,
              },
            ]}
          >
            SCORE
          </Text>
          <Text
            style={[
              styles.scoreValue,
              {
                color: theme.colors.accent,
                fontSize: theme.typography.valueSize + 2,
              },
            ]}
          >
            {score.toLocaleString()}
          </Text>
        </View>

        {/* Flips Remaining (Untimed in SANCTUARY) */}
        <View style={styles.statBox}>
          <Text
            style={[
              styles.statLabel,
              {
                color: theme.colors.textMuted,
                fontSize: theme.typography.captionSize - 1,
                letterSpacing: theme.typography.letterSpacing,
              },
            ]}
          >
            {themePersona === 'SANCTUARY' ? 'ZEN' : 'FLIPS'}
          </Text>
          <Text
            style={[
              styles.statValue,
              {
                fontSize: theme.typography.valueSize - 2,
                color:
                  flipsRemaining <= 4 && themePersona !== 'SANCTUARY'
                    ? theme.colors.danger
                    : theme.colors.textPrimary,
              },
            ]}
          >
            {themePersona === 'SANCTUARY' ? '∞' : flipsRemaining}
          </Text>
          <Text
            style={[
              styles.statSub,
              {
                color: theme.colors.textSecondary,
                fontSize: theme.typography.captionSize - 2,
              },
            ]}
          >
            {themePersona === 'ARCADE' ? 'MOVES' : 'CASUAL'}
          </Text>
        </View>
      </View>

      {/* Spacer pushing bottom HUD controls */}
      <View style={styles.centerSpacer} pointerEvents="none" />

      {/* ================= FEVER VAULT PROGRESS BAR & STREAK SHIELD ================= */}
      <FeverVaultBar />

      {/* ================= NEAR-MISS 1.5s SUSPENSE & CLUTCH SAVE MODAL ================= */}
      <NearMissModal />

      {/* ================= 3D BIOME FIGURINE SHOWCASE MODAL ================= */}
      <Modal
        visible={trophyShowcaseVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
      >
        <View
          style={[
            styles.modalBackdrop,
            { backgroundColor: theme.colors.modalBackdrop },
          ]}
        >
          <View style={styles.showcaseModalContent}>
            <TouchableOpacity
              onPress={() => setTrophyShowcaseVisible(false)}
              style={styles.closeModalBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color="#FFF" />
            </TouchableOpacity>

            <TrophyShelf3D mode="showcase" />
          </View>
        </View>
      </Modal>

      {/* ================= PARENTAL GATE COMPLIANCE MODAL ================= */}
      <ParentalGateModal
        visible={parentalGateVisible}
        onSuccess={handleParentalGateSuccess}
        onCancel={() => setParentalGateVisible(false)}
      />

      {/* ================= VAULT STORE MODAL ================= */}
      <Modal
        visible={storeModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
      >
        <View
          style={[
            styles.modalBackdrop,
            { backgroundColor: theme.colors.modalBackdrop },
          ]}
        >
          <View
            style={[
              styles.storeModalCard,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderColor: theme.colors.surfaceBorderActive,
                borderRadius: theme.shape.radiusLarge,
              },
            ]}
          >
            <View style={styles.storeHeader}>
              <View style={styles.storeHeaderTitle}>
                <ShoppingBag size={22} color={theme.colors.primary} />
                <Text
                  style={[
                    styles.storeTitleText,
                    {
                      color: theme.colors.textPrimary,
                      fontSize: theme.typography.titleSize - 2,
                    },
                  ]}
                >
                  VAULT REVENUECAT STORE
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setStoreModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text
              style={[
                styles.storeSubtitle,
                { color: theme.colors.textSecondary },
              ]}
            >
              Vault Skins, Foley Sound Packs & Season Pass
            </Text>

            {/* Product Catalog Items */}
            <View style={styles.catalogList}>
              {catalog.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.catalogItem,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: item.unlocked
                        ? theme.colors.success
                        : theme.colors.surfaceBorder,
                    },
                  ]}
                >
                  <View style={styles.itemTextWrap}>
                    <Text
                      style={[
                        styles.itemTitle,
                        { color: theme.colors.textPrimary },
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        styles.itemDescription,
                        { color: theme.colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {item.description}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={async () => {
                      SensoryManager.triggerFlip();
                      await MonetizationService.purchaseProduct(item.id);
                      setStoreModalVisible(false);
                    }}
                    disabled={item.unlocked}
                    style={[
                      styles.buyBtn,
                      {
                        backgroundColor: item.unlocked
                          ? 'rgba(0, 230, 118, 0.2)'
                          : theme.colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.buyBtnText,
                        {
                          color: item.unlocked
                            ? theme.colors.success
                            : '#05080E',
                        },
                      ]}
                    >
                      {item.unlocked ? 'OWNED' : item.priceString}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= VICTORY MODAL ================= */}
      <Modal visible={isGameWon} transparent animationType="fade" statusBarTranslucent>
        <View
          style={[
            styles.modalBackdrop,
            { backgroundColor: theme.colors.modalBackdrop },
          ]}
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderColor: theme.colors.success,
                borderRadius: theme.shape.radiusLarge,
              },
            ]}
          >
            <View
              style={[
                styles.modalIconRing,
                {
                  borderColor: theme.colors.success,
                  backgroundColor: 'rgba(0, 230, 118, 0.1)',
                },
              ]}
            >
              <Trophy size={40} color={theme.colors.success} />
            </View>
            <Text
              style={[
                styles.modalTitle,
                {
                  color: theme.colors.success,
                  fontSize: theme.typography.titleSize,
                  letterSpacing: theme.typography.letterSpacing,
                },
              ]}
            >
              VAULT CLEARED!
            </Text>
            <Text
              style={[
                styles.modalSubtitle,
                {
                  color: theme.colors.textSecondary,
                  fontSize: theme.typography.bodySize,
                },
              ]}
            >
              Excavation Complete! Final Score: {score.toLocaleString()}
            </Text>

            <TouchableOpacity
              onPress={() => {
                SensoryManager.triggerVictory();
                nextLevel();
              }}
              activeOpacity={0.85}
              style={[
                styles.modalPrimaryButton,
                {
                  backgroundColor: theme.colors.success,
                  borderRadius: theme.shape.radiusMedium,
                },
              ]}
            >
              <Text
                style={[
                  styles.modalPrimaryText,
                  {
                    fontSize: theme.typography.bodySize,
                    letterSpacing: theme.typography.letterSpacing,
                  },
                ]}
              >
                NEXT LEVEL
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= GAME OVER MODAL ================= */}
      <Modal
        visible={isGameOver && !nearMissModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View
          style={[
            styles.modalBackdrop,
            { backgroundColor: theme.colors.modalBackdrop },
          ]}
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderColor: theme.colors.danger,
                borderRadius: theme.shape.radiusLarge,
              },
            ]}
          >
            <View
              style={[
                styles.modalIconRing,
                {
                  borderColor: theme.colors.danger,
                  backgroundColor: 'rgba(255, 23, 68, 0.1)',
                },
              ]}
            >
              <RotateCcw size={36} color={theme.colors.danger} />
            </View>
            <Text
              style={[
                styles.modalTitle,
                {
                  color: theme.colors.danger,
                  fontSize: theme.typography.titleSize,
                  letterSpacing: theme.typography.letterSpacing,
                },
              ]}
            >
              VAULT LOCKED
            </Text>
            <Text
              style={[
                styles.modalSubtitle,
                {
                  color: theme.colors.textSecondary,
                  fontSize: theme.typography.bodySize,
                },
              ]}
            >
              Moves depleted before excavation was finished. Reset the chamber to retry.
            </Text>

            <TouchableOpacity
              onPress={() => {
                SensoryManager.triggerFlip();
                resetLevel();
              }}
              activeOpacity={0.85}
              style={[
                styles.modalPrimaryButton,
                {
                  backgroundColor: theme.colors.danger,
                  borderRadius: theme.shape.radiusMedium,
                },
              ]}
            >
              <Text
                style={[
                  styles.modalPrimaryText,
                  {
                    fontSize: theme.typography.bodySize,
                    letterSpacing: theme.typography.letterSpacing,
                  },
                ]}
              >
                RETRY LEVEL
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  hudOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personaRow: {
    flexDirection: 'row',
    padding: 3,
    borderWidth: 1.5,
  },
  personaChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  personaText: {
    fontWeight: '800',
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    marginTop: 8,
  },
  statBox: {
    alignItems: 'center',
    minWidth: 60,
  },
  statBoxCenter: {
    flex: 1,
  },
  statLabel: {
    fontWeight: '800',
  },
  statValue: {
    fontWeight: '900',
    marginTop: 2,
  },
  statSub: {
    fontWeight: '700',
  },
  scoreValue: {
    fontWeight: '900',
  },
  centerSpacer: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  showcaseModalContent: {
    width: '100%',
    position: 'relative',
  },
  closeModalBtn: {
    alignSelf: 'flex-end',
    marginBottom: 8,
    padding: 6,
  },
  storeModalCard: {
    width: '100%',
    maxWidth: 360,
    padding: 20,
    borderWidth: 2,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  storeHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeTitleText: {
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  storeSubtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  catalogList: {
    gap: 10,
  },
  catalogItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  itemDescription: {
    fontSize: 11,
  },
  buyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buyBtnText: {
    fontSize: 12,
    fontWeight: '900',
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 16,
  },
  modalIconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontWeight: '900',
    marginBottom: 8,
  },
  modalSubtitle: {
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  modalPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
  },
  modalPrimaryText: {
    color: '#05080E',
    fontWeight: '900',
  },
});

export default GameHUD;
