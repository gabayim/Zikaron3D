import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { sfx } from '../fx/sound';

interface Challenge {
  a: number;
  b: number;
  answer: number;
  choices: number[];
}

const LOCK_MS = 30_000;
const LOCK_AFTER = 3;

function makeChallenge(): Challenge {
  const a = 12 + Math.floor(Math.random() * 28);
  const b = 3 + Math.floor(Math.random() * 7);
  const answer = a * b;
  const wrong = new Set<number>();
  while (wrong.size < 3) {
    const off = 8 + Math.floor(Math.random() * 14);
    const c = answer + (Math.random() < 0.5 ? -off : off);
    if (c > 0 && c !== answer && Math.abs(c - answer) >= 8) wrong.add(c);
  }
  const choices = [...wrong];
  choices.splice(Math.floor(Math.random() * 4), 0, answer);
  return { a, b, answer, choices };
}

function GateDialog({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [challenge, setChallenge] = useState(makeChallenge);
  const [fails, setFails] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const label = useMemo(() => `${challenge.a} × ${challenge.b}`, [challenge]);
  const locked = now < lockedUntil;

  useEffect(() => {
    if (!locked) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [locked]);

  const pick = useCallback(
    (n: number) => {
      if (Date.now() < lockedUntil) return;
      if (n === challenge.answer) {
        sfx.play('chime', 0.7);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess();
        return;
      }
      sfx.play('sad', 0.5);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const next = fails + 1;
      setFails(next);
      if (next >= LOCK_AFTER) {
        setLockedUntil(Date.now() + LOCK_MS);
        setNow(Date.now());
        setFails(0);
      }
      setChallenge(makeChallenge());
    },
    [challenge, fails, lockedUntil, onSuccess],
  );

  const remain = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  return (
    <Pressable style={styles.backdrop} onPress={onCancel}>
      <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
        <View style={styles.equation}>
          {(locked ? String(remain) : label).split('').map((ch, i) => (
            <View key={`${ch}-${i}`} style={styles.digit}>
              <Text style={styles.digitInner}>{ch === ' ' ? '' : ch}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.grid, locked && styles.locked]}>
          {challenge.choices.map((n) => (
            <Pressable key={n} style={styles.choice} disabled={locked} onPress={() => pick(n)}>
              <Text style={styles.choiceInner}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.close} onPress={onCancel} hitSlop={12}>
          <View style={styles.closeBar} />
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

/** Adult check before purchases, external pages, sign-in and leaving Toybox. Numbers only. */
export function ParentalGate({
  visible,
  onSuccess,
  onCancel,
}: {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {visible && <GateDialog onSuccess={onSuccess} onCancel={onCancel} />}
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
  locked: { opacity: 0.35 },
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
