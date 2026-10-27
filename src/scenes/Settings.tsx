import React, { useCallback, useMemo } from 'react';
import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Canvas, Fill, LinearGradient, Picture, Rect, Skia, vec, type SkCanvas } from '@shopify/react-native-skia';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { drawIcon } from '../render/hubDraw';
import { applyMusicMute, sfx } from '../fx/sound';
import { buyShieldPack, restorePurchases } from '../services/monetization';
import { useAudioSettings } from '../store/audioSettings';
import { useProfile } from '../store/profile';
import { deleteAccount, signOut, useAuth } from '../services/supabase';
import { ParentalGate } from '../ui/ParentalGate';
import { useParentalCommerceGate } from '../ui/useParentalCommerceGate';

const ROWS = [0.22, 0.32, 0.42, 0.54, 0.64, 0.77, 0.88];

function drawToggle(c: SkCanvas, cx: number, cy: number, on: boolean) {
  const track = Skia.Paint();
  track.setAntiAlias(true);
  track.setColor(Skia.Color(on ? 'rgba(140,255,193,0.35)' : 'rgba(255,255,255,0.12)'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(cx - 56, cy - 22, 112, 44), 22, 22), track);
  const knob = Skia.Paint();
  knob.setColor(Skia.Color('#FFFFFF'));
  knob.setAlphaf(on ? 1 : 0.55);
  c.drawCircle(on ? cx + 28 : cx - 28, cy, 18, knob);
}

function drawSfxIcon(c: SkCanvas, x: number, y: number, on: boolean) {
  const p = Skia.PathBuilder.Make()
    .moveTo(x - 10, y - 6)
    .lineTo(x - 2, y - 6)
    .lineTo(x + 8, y - 14)
    .lineTo(x + 8, y + 14)
    .lineTo(x - 2, y + 6)
    .lineTo(x - 10, y + 6)
    .close()
    .build();
  const fill = Skia.Paint();
  fill.setColor(Skia.Color(on ? '#8CFFC1' : '#666666'));
  c.drawPath(p, fill);
}

function drawRestoreIcon(c: SkCanvas, x: number, y: number) {
  const stroke = Skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(1);
  stroke.setStrokeWidth(2.5);
  stroke.setColor(Skia.Color('#C9B5FF'));
  stroke.setStrokeCap(1);
  const arc = Skia.PathBuilder.Make()
    .addArc(Skia.XYWHRect(x - 14, y - 14, 28, 28), 40, 280)
    .build();
  c.drawPath(arc, stroke);
  const head = Skia.PathBuilder.Make()
    .moveTo(x + 10, y - 6)
    .lineTo(x + 14, y - 14)
    .lineTo(x + 6, y - 12)
    .close()
    .build();
  const fill = Skia.Paint();
  fill.setColor(Skia.Color('#C9B5FF'));
  c.drawPath(head, fill);
}

function drawShieldRow(c: SkCanvas, cx: number, cy: number, iconX: number, count: number) {
  const bg = Skia.Paint();
  bg.setColor(Skia.Color('rgba(255,216,77,0.2)'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(cx - 56, cy - 22, 112, 44), 22, 22), bg);
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  fill.setColor(Skia.Color('#FFD84D'));
  const shield = Skia.PathBuilder.Make()
    .moveTo(iconX, cy - 13)
    .lineTo(iconX + 11, cy - 8)
    .quadTo(iconX + 11, cy + 8, iconX, cy + 14)
    .quadTo(iconX - 11, cy + 8, iconX - 11, cy - 8)
    .close()
    .build();
  c.drawPath(shield, fill);
  // Owned shields as pips (no numerals).
  const shown = Math.min(count, 5);
  for (let i = 0; i < 5; i++) {
    fill.setColor(Skia.Color(i < shown ? '#FFD84D' : 'rgba(255,255,255,0.2)'));
    c.drawCircle(cx - 24 + i * 12, cy, 4, fill);
  }
}

function drawRestoreButton(c: SkCanvas, cx: number, cy: number) {
  const bg = Skia.Paint();
  bg.setColor(Skia.Color('rgba(201,181,255,0.22)'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(cx - 56, cy - 22, 112, 44), 22, 22), bg);
}

export default function Settings({ onBack }: { onBack: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const musicOn = useAudioSettings((s) => s.musicOn);
  const sfxOn = useAudioSettings((s) => s.sfxOn);
  const reduceMotion = useAudioSettings((s) => s.reduceMotion);
  const { toggleMusic, toggleSfx, toggleReduceMotion } = useAudioSettings();
  const shields = useProfile((s) => s.shields);
  const signedIn = useAuth((s) => !!s.userId);
  const { gateOpen, runGuarded, confirmGate, cancelGate } = useParentalCommerceGate();

  const doRestore = useCallback(() => {
    void restorePurchases().then((r) => {
      if (r.ok) {
        sfx.play('chime', 0.65);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        sfx.play('sad', 0.45);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    });
  }, []);

  const doBuyShields = useCallback(() => {
    void buyShieldPack().then((r) => {
      if (r === 'ok') {
        sfx.play('chime', 0.8);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (r !== 'cancelled') {
        sfx.play('sad', 0.4);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    });
  }, []);

  const doDelete = useCallback(() => {
    Alert.alert('Delete cloud account?', 'Removes your online profile and leaderboard entry. Progress on this device stays.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteAccount().then((ok) => {
            sfx.play(ok ? 'whoosh' : 'sad', 0.5);
            Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
          });
        },
      },
    ]);
  }, []);

  const picture = useMemo(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    const cx = W / 2;
    drawIcon(c, 'back', 42, 72, 14, '#FFFFFF', 0.9);
    const iconX = cx - 90;
    ROWS.forEach((frac, i) => {
      const cy = H * frac;
      if (i < 3) {
        const on = i === 0 ? musicOn : i === 1 ? sfxOn : reduceMotion;
        drawToggle(c, cx, cy, on);
        if (i === 0) {
          drawIcon(c, 'star', iconX, cy, 14, on ? '#FFD36E' : '#888888', 0.9);
          if (!on) {
            const line = Skia.Paint();
            line.setColor(Skia.Color('#FF6B8A'));
            line.setStrokeWidth(3);
            c.drawLine(iconX - 12, cy - 12, iconX + 12, cy + 12, line);
          }
        } else if (i === 1) drawSfxIcon(c, iconX, cy, on);
        else drawIcon(c, 'gear', iconX, cy, 12, on ? '#7FE8FF' : '#666666', 0.85);
      } else if (i === 3) {
        drawShieldRow(c, cx, cy, iconX, shields);
      } else if (i === 4) {
        drawRestoreButton(c, cx, cy);
        drawRestoreIcon(c, iconX, cy);
      } else if (signedIn) {
        drawRestoreButton(c, cx, cy);
        drawIcon(c, i === 5 ? 'door' : 'trash', iconX, cy, 12, i === 5 ? '#C9B5FF' : '#FF6B8A', 0.95);
      }
    });
    return rec.finishRecordingAsPicture();
  }, [W, H, musicOn, sfxOn, reduceMotion, shields, signedIn]);

  const onTap = useCallback(
    (x: number, y: number) => {
      if (Math.hypot(x - 42, y - 72) < 34) {
        onBack();
        return;
      }
      const hit = (frac: number) => Math.abs(y - H * frac) < 36 && x > W * 0.2 && x < W * 0.8;
      if (hit(ROWS[0])) {
        toggleMusic();
        applyMusicMute(useAudioSettings.getState().musicOn);
        if (useAudioSettings.getState().musicOn) sfx.play('sparkle', 0.4);
      } else if (hit(ROWS[1])) {
        const wasOn = sfxOn;
        toggleSfx();
        if (!wasOn) sfx.play('pop', 0.5);
      } else if (hit(ROWS[2])) {
        toggleReduceMotion();
        sfx.play('sparkle', 0.35);
      } else if (hit(ROWS[3])) {
        runGuarded(doBuyShields);
      } else if (hit(ROWS[4])) {
        runGuarded(doRestore);
      } else if (signedIn && hit(ROWS[5])) {
        void signOut();
        sfx.play('whoosh', 0.4);
      } else if (signedIn && hit(ROWS[6])) {
        runGuarded(doDelete);
      } else return;
      Haptics.selectionAsync();
    },
    [W, H, sfxOn, toggleMusic, toggleSfx, toggleReduceMotion, onBack, runGuarded, doRestore, doBuyShields, doDelete, signedIn],
  );
  const tap = useTapGesture({ runOnJS: true, onActivate: (e) => onTap(e.x, e.y) });

  return (
    <View style={styles.root}>
      <ParentalGate visible={gateOpen} onSuccess={confirmGate} onCancel={cancelGate} />
      <GestureDetector gesture={tap}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill color="#0B0620" />
          <Rect x={0} y={0} width={W} height={H}>
            <LinearGradient start={vec(0, 0)} end={vec(W, H)} colors={['#1A1048', '#0D0630', '#08021C']} />
          </Rect>
          <Picture picture={picture} />
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
});
