import React, { useState, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Lock, X } from 'lucide-react-native';
import { SensoryManager } from '../../services/SensoryManager';
import { TOYBOX_THEME } from '../../theme/chameleonThemes';

export interface ParentalGateModalProps {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

interface MathChallenge {
  num1: number;
  num2: number;
  operation: '×' | '+';
  correctAnswer: number;
  options: number[];
}

function generateMathChallenge(): MathChallenge {
  const isMultiplication = Math.random() > 0.35;

  let num1: number;
  let num2: number;
  let correctAnswer: number;
  let operation: '×' | '+';

  if (isMultiplication) {
    num1 = Math.floor(Math.random() * 6) + 4; // 4 to 9
    num2 = Math.floor(Math.random() * 6) + 4; // 4 to 9
    operation = '×';
    correctAnswer = num1 * num2;
  } else {
    num1 = Math.floor(Math.random() * 25) + 15; // 15 to 39
    num2 = Math.floor(Math.random() * 25) + 15; // 15 to 39
    operation = '+';
    correctAnswer = num1 + num2;
  }

  // Generate 3 plausible distractors
  const distractors = new Set<number>();
  while (distractors.size < 3) {
    const offset = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 8) + 1);
    const candidate = correctAnswer + offset;
    if (candidate > 0 && candidate !== correctAnswer) {
      distractors.add(candidate);
    }
  }

  // Shuffle options
  const options = Array.from(distractors);
  const insertIndex = Math.floor(Math.random() * 4);
  options.splice(insertIndex, 0, correctAnswer);

  return {
    num1,
    num2,
    operation,
    correctAnswer,
    options,
  };
}

/**
 * ParentalGateModal - COPPA & App Store Kids Category compliant challenge.
 * Protects purchases, external links, and account settings when in TOYBOX mode.
 */
export const ParentalGateModal: React.FC<ParentalGateModalProps> = ({
  visible,
  onSuccess,
  onCancel,
}) => {
  const [challenge, setChallenge] = useState<MathChallenge>(generateMathChallenge);
  const [hasError, setHasError] = useState(false);

  const refreshChallenge = useCallback(() => {
    setChallenge(generateMathChallenge());
    setHasError(false);
  }, []);

  // When modal closes or reopens, reset error state if needed
  const handleClose = () => {
    setHasError(false);
    onCancel();
  };

  const handleSelectOption = (selected: number) => {
    if (selected === challenge.correctAnswer) {
      SensoryManager.triggerMatch(1);
      onSuccess();
    } else {
      SensoryManager.triggerMiss();
      setHasError(true);
      // Wait 300ms then generate a fresh challenge
      setTimeout(() => {
        refreshChallenge();
      }, 350);
    }
  };

  const theme = TOYBOX_THEME;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.modalBackdrop }]}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderColor: hasError ? theme.colors.danger : theme.colors.primary,
              borderRadius: theme.shape.radiusLarge,
            },
          ]}
        >
          {/* Top Close Button */}
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          {/* Lock Emblem */}
          <View
            style={[
              styles.iconRing,
              {
                borderColor: hasError ? theme.colors.danger : theme.colors.primary,
                backgroundColor: 'rgba(255, 183, 3, 0.1)',
              },
            ]}
          >
            <Lock size={32} color={hasError ? theme.colors.danger : theme.colors.primary} />
          </View>

          {/* Title */}
          <Text
            style={[
              styles.title,
              {
                color: theme.colors.textPrimary,
                fontSize: theme.typography.titleSize - 2,
              },
            ]}
          >
            GROWN-UPS ONLY
          </Text>

          {/* Subtitle */}
          <Text
            style={[
              styles.subtitle,
              {
                color: theme.colors.textSecondary,
                fontSize: theme.typography.bodySize,
              },
            ]}
          >
            Please solve the arithmetic challenge below to proceed.
          </Text>

          {/* Arithmetic Problem Display */}
          <View
            style={[
              styles.equationBox,
              {
                backgroundColor: theme.colors.surface,
                borderColor: hasError ? theme.colors.danger : theme.colors.surfaceBorder,
                borderRadius: theme.shape.radiusMedium,
              },
            ]}
          >
            <Text style={[styles.equationText, { color: theme.colors.primary }]}>
              {challenge.num1} {challenge.operation} {challenge.num2} = ?
            </Text>
          </View>

          {hasError && (
            <Text style={[styles.errorText, { color: theme.colors.danger }]}>
              Incorrect. Try this new question:
            </Text>
          )}

          {/* 4 Multi-Choice Answers Grid */}
          <View style={styles.optionsGrid}>
            {challenge.options.map((option, idx) => (
              <TouchableOpacity
                key={`${option}-${idx}`}
                onPress={() => handleSelectOption(option)}
                activeOpacity={0.8}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.surfaceBorder,
                    borderRadius: theme.shape.radiusSmall,
                  },
                ]}
              >
                <Text style={[styles.optionText, { color: theme.colors.textPrimary }]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={handleClose}
            activeOpacity={0.7}
            style={styles.cancelButton}
          >
            <Text style={[styles.cancelText, { color: theme.colors.textMuted }]}>
              CANCEL
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
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
    shadowRadius: 20,
    elevation: 16,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  equationBox: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 16,
  },
  equationText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
    marginBottom: 16,
  },
  optionButton: {
    width: '48%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  optionText: {
    fontSize: 22,
    fontWeight: '900',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});

export default ParentalGateModal;
