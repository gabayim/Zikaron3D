import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Canvas, Fill, LinearGradient, Picture, Rect, Skia, vec } from '@shopify/react-native-skia';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { drawIcon } from '../render/hubDraw';
import { CAST_COLOR } from '../render/castColors';
import { sfx } from '../fx/sound';
import { appleSignInAvailable, signInWithApple, useAuth } from '../services/supabase';
import { fetchBoard, type BoardRow } from '../services/leaderboard';
import { CREATURE_IDS, useProfile } from '../store/profile';
import { ParentalGate } from '../ui/ParentalGate';
import { useParentalCommerceGate } from '../ui/useParentalCommerceGate';

const SHOWN = 10;
const TOP = 0.2;
const BOTTOM = 0.9;
const SIGN_Y = 0.58;

/** Weekly Arcade league. Icon-only: gems, bars, and a cup. Signing in is gated behind the parental math gate. */
export default function Leaderboard({ onBack }: { onBack: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const userId = useAuth((s) => s.userId);
  const weeklyScore = useProfile((s) => s.weeklyScore);
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [canApple, setCanApple] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const { gateOpen, runGuarded, confirmGate, cancelGate } = useParentalCommerceGate();

  useEffect(() => {
    void appleSignInAvailable().then(setCanApple);
  }, []);
  useEffect(() => {
    if (userId) void fetchBoard().then(setRows);
  }, [userId, weeklyScore]);

  const doSignIn = useCallback(() => setShowButton(true), []);
  const onApplePress = useCallback(async () => {
    const r = await signInWithApple();
    if (r === 'ok') {
      sfx.play('chime', 0.8);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowButton(false);
    } else if (r === 'error') {
      sfx.play('sad', 0.4);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, []);

  const picture = useMemo(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color('rgba(26,15,61,0.7)'));
    c.drawCircle(42, 72, 24, paint);
    drawIcon(c, 'back', 42, 72, 14, '#FFFFFF', 0.9);
    drawIcon(c, 'cup', W / 2, 72, 17, '#FFD36E', 1);

    if (!userId) {
      drawIcon(c, 'cup', W / 2, H * 0.36, 54, '#FFD36E', 0.35);
      if (canApple && !showButton) {
        paint.setColor(Skia.Color('rgba(255,211,110,0.22)'));
        c.drawCircle(W / 2, H * SIGN_Y, 44, paint);
        paint.setStyle(1);
        paint.setStrokeWidth(3);
        paint.setColor(Skia.Color('#FFD36E'));
        c.drawCircle(W / 2, H * SIGN_Y, 44, paint);
        paint.setStyle(0);
        drawIcon(c, 'avatar', W / 2, H * SIGN_Y, 22, '#FFFFFF', 0.95);
      }
    } else {
      const list = rows.slice(0, SHOWN);
      const mine = rows.find((r) => r.mine);
      const extra = mine && mine.rank > SHOWN ? mine : null;
      const slots = list.length + (extra ? 1 : 0);
      const top = H * TOP;
      const rowH = Math.min(58, (H * BOTTOM - top) / Math.max(slots, 1));
      const best = Math.max(1, ...rows.map((r) => r.score));
      const draw = (r: BoardRow, i: number) => {
        const y = top + i * rowH + rowH / 2;
        const gem = CAST_COLOR[CREATURE_IDS[r.glyph] ?? 'pip'];
        const barX = 78;
        const barW = (W - barX - 34) * Math.max(0.05, r.score / best);
        paint.setColor(Skia.Color('rgba(255,255,255,0.1)'));
        c.drawRRect(Skia.RRectXY(Skia.XYWHRect(barX, y - 9, W - barX - 34, 18), 9, 9), paint);
        paint.setColor(Skia.Color(r.mine ? '#FFD36E' : gem));
        paint.setAlphaf(r.mine ? 1 : 0.85);
        c.drawRRect(Skia.RRectXY(Skia.XYWHRect(barX, y - 9, barW, 18), 9, 9), paint);
        paint.setAlphaf(1);
        paint.setColor(Skia.Color(gem));
        c.drawCircle(46, y, r.mine ? 17 : 14, paint);
        if (r.mine) {
          paint.setStyle(1);
          paint.setStrokeWidth(3);
          paint.setColor(Skia.Color('#FFFFFF'));
          c.drawCircle(46, y, 20, paint);
          paint.setStyle(0);
        }
        if (r.rank <= 3) drawIcon(c, 'star', 46, y, 7, ['#FFD84D', '#E6E9F2', '#E3A36B'][r.rank - 1], 1);
      };
      list.forEach(draw);
      if (extra) draw(extra, list.length);
    }
    return rec.finishRecordingAsPicture();
  }, [W, H, userId, rows, canApple, showButton]);

  const tap = useTapGesture({
    runOnJS: true,
    onActivate: (e) => {
      if (Math.hypot(e.x - 42, e.y - 72) < 34) onBack();
      else if (!userId && canApple && !showButton && Math.hypot(e.x - W / 2, e.y - H * SIGN_Y) < 52) runGuarded(doSignIn);
    },
  });

  return (
    <View style={styles.root}>
      <ParentalGate
        visible={gateOpen}
        onSuccess={() => {
          confirmGate();
        }}
        onCancel={cancelGate}
      />
      <GestureDetector gesture={tap}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill color="#0B0620" />
          <Rect x={0} y={0} width={W} height={H}>
            <LinearGradient start={vec(0, 0)} end={vec(W, H)} colors={['#241257', '#0D0630', '#08021C']} />
          </Rect>
          <Picture picture={picture} />
        </Canvas>
      </GestureDetector>
      {!userId && canApple && showButton && (
        <View style={[styles.signIn, { top: H * (SIGN_Y - 0.03) }]}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={14}
            style={styles.appleButton}
            onPress={onApplePress}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
  signIn: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  appleButton: { width: 220, height: 52 },
});
