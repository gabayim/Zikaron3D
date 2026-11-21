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
import { redeemCoupon, type GrantAssetType, type RedeemResult } from '../services/grants';
import { useInventory } from '../store/inventory';

interface RedeemCodeModalProps {
  visible: boolean;
  onClose: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  throttled: 'Too many attempts! Please try again in an hour.',
  not_found: 'Invalid code. Check for typos and try again.',
  inactive: 'This coupon code is no longer active.',
  not_started: 'This coupon code is not valid yet.',
  expired: 'This coupon code has expired.',
  used_up: 'This coupon has reached its maximum redemptions.',
  already_redeemed: 'You have already redeemed this coupon!',
  not_signed_in: 'Connecting to cloud account... Please retry in a moment.',
  invalid_code: 'Please enter a valid coupon code (6-16 characters).',
};

export function RedeemCodeModal({ visible, onClose }: RedeemCodeModalProps) {
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
    if (trimmed.length < 6) {
      setErrorMsg('Code must be at least 6 characters.');
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

      let title = `${result.amount ?? 1}x Item`;
      let image: number | undefined;

      if (result.asset_type === 'skin') {
        const found = SKIN_CATALOG.find((s) => s.id === result.asset_id);
        title = found ? found.name : 'Exclusive Skin';
        image = SKIN_ASSETS[result.asset_id];
      } else if (result.asset_type === 'accessory') {
        const found = ACCESSORY_CATALOG.find((a) => a.id === result.asset_id);
        title = found ? found.name : 'Exclusive Accessory';
        image = ACCESSORY_ASSETS[result.asset_id];
      } else if (result.asset_type === 'crystals') {
        title = `${result.amount ?? 50} Crystals`;
      } else if (result.asset_type === 'stardust') {
        title = `${result.amount ?? 100} Stardust`;
      } else if (result.asset_type === 'shields') {
        title = `${result.amount ?? 1} Shield`;
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
      const msg = (result.reason && ERROR_MESSAGES[result.reason]) || 'Failed to redeem. Please try again.';
      setErrorMsg(msg);
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
          <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={12}>
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
              <Text style={styles.rewardTitle}>Reward Unlocked!</Text>
              <Text style={styles.rewardSubtitle}>{successReward.title}</Text>

              {(successReward.asset_type === 'skin' || successReward.asset_type === 'accessory') && (
                <Pressable style={styles.equipBtn} onPress={handleEquipShortcut}>
                  <Check size={18} color="#0B132B" />
                  <Text style={styles.equipBtnText}>Equip Now</Text>
                </Pressable>
              )}

              <Pressable style={styles.doneBtn} onPress={handleClose}>
                <Text style={styles.doneBtnText}>Awesome!</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.formContainer}>
              <View style={styles.headerRow}>
                <Gift size={24} color="#FBBF24" />
                <Text style={styles.title}>Redeem Code</Text>
              </View>
              <Text style={styles.subtitle}>
                Enter a promotional code to unlock exclusive skins, accessories, or currencies.
              </Text>

              <TextInput
                style={styles.input}
                value={code}
                onChangeText={(val) => {
                  setCode(val.toUpperCase());
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="ENTER CODE"
                placeholderTextColor="#64748B"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={16}
                returnKeyType="done"
                onSubmitEditing={handleRedeem}
              />

              {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

              <Pressable
                style={[styles.redeemBtn, loading && styles.btnDisabled]}
                onPress={handleRedeem}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#0B132B" size="small" />
                ) : (
                  <Text style={styles.redeemBtnText}>Redeem Reward</Text>
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
    right: 16,
    zIndex: 10,
    padding: 4,
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
