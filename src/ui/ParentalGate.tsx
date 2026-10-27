import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { sfx } from '../fx/sound';

interface Challenge {
  a: number;
  b: number;
  op: '+' | '×';
  answer: number;
  choices: number[];
}

function makeChallenge(): Challenge {
  const mul = Math.random() > 0.4;
  const a = mul ? 4 + Math.floor(Math.random() * 6) : 12 + Math.floor(Math.random() * 18);
  const b = mul ? 4 + Math.floor(Math.random() * 6) : 12 + Math.floor(Math.random() * 18);
  const answer = mul ? a * b : a + b;
  const wrong = new Set<number>();
  while (wrong.size < 3) {
    const c = answer + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 7));
    if (c > 0 && c !== answer) wrong.add(c);
  }
  const choices = [...wrong];
  choices.splice(Math.floor(Math.random() * 4), 0, answer);
  return { a, b, op: mul ? '×' : '+', answer, choices };
}

/** COPPA-style gate before leaving Toybox for timed Arcade mode. Numbers only — no gameplay UI. */
export function ParentalGate({
  visible,
  onSuccess,
  onCancel,
}: {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [challenge, setChallenge] = useState(makeChallenge);
  const label = useMemo(() => `${challenge.a} ${challenge.op} ${challenge.b}`, [challenge]);

  const pick = useCallback(
    (n: number) => {
      if (n === challenge.answer) {
        sfx.play('chime', 0.7);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess();
      } else {
        sfx.play('sad', 0.5);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setChallenge(makeChallenge());
      }
    },
    [challenge, onSuccess],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.equation}>
            {label.split('').map((ch, i) => (
              <View key={i} style={styles.digit}>
                <Text style={styles.digitInner}>{ch === ' ' ? '' : ch}</Text>
              </View>
            ))}
          </View>
          <View style={styles.grid}>
            {challenge.choices.map((n) => (
              <Pressable key={n} style={styles.choice} onPress={() => pick(n)}>
                <Text style={styles.choiceInner}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.close} onPress={onCancel} hitSlop={12}>
            <View style={styles.closeBar} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,1,15,0.82)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '84%',
    maxWidth: 340,
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: '#1A0F3D',
    borderWidth: 2,
    borderColor: 'rgba(255,211,110,0.35)',
  },
  equation: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24, gap: 6 },
  digit: {
    minWidth: 36,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitInner: { color: '#FFE9A8', fontSize: 22, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  choice: {
    width: '42%',
    minWidth: 120,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,143,208,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceInner: { color: '#FFFFFF', fontSize: 24, fontWeight: '600' },
  close: { alignSelf: 'center', marginTop: 20, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeBar: { width: 28, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)' },
});
