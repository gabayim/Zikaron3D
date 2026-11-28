import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Gem, Gift, Shield, Sparkles, X } from 'lucide-react-native';
import { ACCESSORY_ASSETS, SKIN_ASSETS } from '../data/shopAssets';
import { ACCESSORY_CATALOG, SKIN_CATALOG } from '../data/shopCatalog';
import { sfx } from '../fx/sound';
import { localizeCatalogName } from './i18n/catalog';
import { getRedeemCopy, getRedeemError, MIN_CODE_LENGTH } from './i18n/redeem';
import { redeemCoupon, type GrantAssetType, type RedeemResult } from '../services/grants';
import { useInventory } from '../store/inventory';

interface RedeemCodeModalProps {
  visible: boolean;
  onClose: () => void;
}

export function RedeemCodeModal({ visible, onClose }: RedeemCodeModalProps) {
  const { strings, rtl, locale } = getRedeemCopy();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successReward, setSuccessReward] = useState<{
    asset_type: GrantAssetType;
    asset_id: string;
    amount: number;
    title: string;
    image?: number;
  } | null>(null);

  const resetState = () => {
    setCode('');
    setLoading(false);
    setErrorMsg(null);
    setSuccessReward(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleRedeem = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < MIN_CODE_LENGTH) {
      setErrorMsg(strings.minLength(MIN_CODE_LENGTH));
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result: RedeemResult = await redeemCoupon(trimmed);
    setLoading(false);

    if (result.ok && result.asset_type && result.asset_id) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sfx.play('chime');
      setTimeout(() => sfx.play('sparkle'), 200);

      let title = strings.item(result.amount ?? 1);
      let image: number | undefined;

      if (result.asset_type === 'skin') {
        const found = SKIN_CATALOG.find((s) => s.id === result.asset_id);
        title = found ? localizeCatalogName(found.name, locale) : strings.exclusiveSkin;
        image = SKIN_ASSETS[result.asset_id];
      } else if (result.asset_type === 'accessory') {
        const found = ACCESSORY_CATALOG.find((a) => a.id === result.asset_id);
        title = found ? localizeCatalogName(found.name, locale) : strings.exclusiveAccessory;
        image = ACCESSORY_ASSETS[result.asset_id];
      } else if (result.asset_type === 'crystals') {
        title = strings.crystals(result.amount ?? 50);
      } else if (result.asset_type === 'stardust') {
        title = strings.stardust(result.amount ?? 100);
      } else if (result.asset_type === 'shields') {
        title = strings.shield(result.amount ?? 1);
      }

      setSuccessReward({
        asset_type: result.asset_type,
        asset_id: result.asset_id,
        amount: result.amount ?? 1,
        title,
        image,
      });
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg(getRedeemError(strings, result.reason));
    }
  };

  const handleEquipShortcut = () => {
    if (!successReward) return;
    if (successReward.asset_type === 'skin') {
      const found = SKIN_CATALOG.find((s) => s.id === successReward.asset_id);
      if (found) {
        useInventory.getState().equipSkin(found.creatureId, found.id);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else if (successReward.asset_type === 'accessory') {
      const found = ACCESSORY_CATALOG.find((a) => a.id === successReward.asset_id);
      if (found) {
        useInventory.getState().equipAccessory(found.slot, found.id);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
    handleClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.card}>
          <Pressable
            style={[styles.closeBtn, rtl ? styles.closeBtnRtl : styles.closeBtnLtr]}
            onPress={handleClose}
            hitSlop={12}
          >
            <X size={20} color="#94A3B8" />
          </Pressable>

          {successReward ? (
            <View style={styles.rewardContainer}>
              <View style={styles.rewardIconCircle}>
                {successReward.image ? (
                  <Image source={successReward.image} style={styles.rewardImage} resizeMode="contain" />
                ) : successReward.asset_type === 'crystals' ? (
                  <Gem size={56} color="#A78BFA" />
                ) : successReward.asset_type === 'stardust' ? (
                  <Sparkles size={56} color="#FBBF24" />
                ) : (
                  <Shield size={56} color="#38BDF8" />
                )}
              </View>
              <Text style={[styles.rewardTitle, rtl && styles.rtlCentered]}>
                {strings.rewardUnlocked}
              </Text>
              <Text style={[styles.rewardSubtitle, rtl && styles.rtlCentered]}>
                {successReward.title}
              </Text>

              {(successReward.asset_type === 'skin' || successReward.asset_type === 'accessory') && (
                <Pressable
                  style={[styles.equipBtn, rtl && styles.rowReverse]}
                  onPress={handleEquipShortcut}
                >
                  <Check size={18} color="#0B132B" />
                  <Text style={styles.equipBtnText}>{strings.equipNow}</Text>
                </Pressable>
              )}

              <Pressable style={styles.doneBtn} onPress={handleClose}>
                <Text style={styles.doneBtnText}>{strings.done}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.formContainer}>
              <View style={[styles.headerRow, rtl && styles.rowReverse]}>
                <Gift size={24} color="#FBBF24" />
                <Text style={[styles.title, rtl && styles.rtlText]}>{strings.title}</Text>
              </View>
              <Text style={[styles.subtitle, rtl && styles.rtlCentered]}>
                {strings.subtitle}
              </Text>

              <TextInput
                style={styles.input}
                value={code}
                onChangeText={(val) => {
                  setCode(val.toUpperCase());
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder={strings.placeholder}
                placeholderTextColor="#64748B"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={16}
                returnKeyType="done"
                onSubmitEditing={handleRedeem}
              />

              {errorMsg ? (
                <Text style={[styles.errorText, rtl && styles.rtlCentered]}>{errorMsg}</Text>
              ) : null}

              <Pressable
                style={[styles.redeemBtn, loading && styles.btnDisabled]}
                onPress={handleRedeem}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#0B132B" size="small" />
                ) : (
                  <Text style={styles.redeemBtnText}>{strings.submit}</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 10, 24, 0.75)',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    zIndex: 10,
    padding: 4,
  },
  closeBtnLtr: {
    right: 16,
  },
  closeBtnRtl: {
    left: 16,
  },
  formContainer: {
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 2,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  errorText: {
    color: '#F43F5E',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  redeemBtn: {
    width: '100%',
    backgroundColor: '#FBBF24',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  redeemBtnText: {
    color: '#0B132B',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rewardContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  rewardIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 2,
    borderColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  rewardImage: {
    width: 72,
    height: 72,
  },
  rewardTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  rewardSubtitle: {
    color: '#FBBF24',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 20,
  },
  equipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#34D399',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 10,
    width: '100%',
    justifyContent: 'center',
  },
  equipBtnText: {
    color: '#0B132B',
    fontSize: 15,
    fontWeight: '800',
  },
  doneBtn: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
});
