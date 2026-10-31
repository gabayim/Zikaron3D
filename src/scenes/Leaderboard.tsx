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
import { getSkinDef } from '../data/shopCatalog';
import { ParentalGate } from '../ui/ParentalGate';
import { useParentalCommerceGate } from '../ui/useParentalCommerceGate';

const SHOWN = 10;
const TOP = 0.18;
const BOTTOM = 0.88;

/** Weekly Arcade league with cosmetic flex (crowns, skins, prestige). */
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
    void fetchBoard().then(setRows);
  }, [userId, weeklyScore]);

  const doSignIn = useCallback(() => setShowButton(true), []);
  const onApplePress = useCallback(async () => {
    const r = await signInWithApple();
    if (r === 'ok') {
      sfx.play('chime', 0.8);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowButton(false);
      void fetchBoard().then(setRows);
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

    // Header Back & Cup
    paint.setColor(Skia.Color('rgba(26,15,61,0.7)'));
    c.drawCircle(42, 72, 24, paint);
    drawIcon(c, 'back', 42, 72, 14, '#FFFFFF', 0.9);
    drawIcon(c, 'cup', W / 2, 72, 17, '#FFD36E', 1);

    const list = rows.slice(0, SHOWN);
    const mine = rows.find((r) => r.mine);
    const extra = mine && mine.rank > SHOWN ? mine : null;
    const slots = list.length + (extra ? 1 : 0);
    const top = H * TOP;
    const rowH = Math.min(56, (H * BOTTOM - top) / Math.max(slots, 1));
    const best = Math.max(1, ...rows.map((r) => r.score));

    const draw = (r: BoardRow, i: number) => {
      const y = top + i * rowH + rowH / 2;
      const baseColor = CAST_COLOR[CREATURE_IDS[r.glyph] ?? 'pip'];
      const skin = r.skinId ? getSkinDef(r.skinId) : undefined;
      const gem = skin ? skin.palette.primary : baseColor;

      const barX = 78;
      const maxBarW = W - barX - 34;
      const barW = maxBarW * Math.max(0.06, r.score / best);

      // Background track
      paint.setColor(Skia.Color('rgba(255,255,255,0.08)'));
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(barX, y - 9, maxBarW, 18), 9, 9), paint);

      // Score bar fill
      paint.setColor(Skia.Color(r.mine ? '#FBBF24' : gem));
      paint.setAlphaf(r.mine ? 1 : 0.85);
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(barX, y - 9, barW, 18), 9, 9), paint);

      // Creature avatar circle
      paint.setAlphaf(1);
      paint.setColor(Skia.Color(gem));
      c.drawCircle(46, y, r.mine ? 17 : 14, paint);

      // Player highlight ring
      if (r.mine) {
        paint.setStyle(1);
        paint.setStrokeWidth(2.5);
        paint.setColor(Skia.Color('#38BDF8'));
        c.drawCircle(46, y, 20, paint);
        paint.setStyle(0);
      }

      // Top 3 medals
      if (r.rank <= 3) {
        drawIcon(c, 'star', 46, y, 7, ['#FFD84D', '#E2E8F0', '#F97316'][r.rank - 1], 1);
      }

      // Accessory Hat/Crown indicator above avatar
      if (r.accessoryId === 'hat_crown' || r.rank === 1) {
        paint.setColor(Skia.Color('#F59E0B'));
        c.drawCircle(46, y - 17, 3.5, paint);
      }

      // Prestige stars (★)
      if (r.prestige && r.prestige > 0) {
        for (let p = 0; p < Math.min(3, r.prestige); p++) {
          paint.setColor(Skia.Color('#38BDF8'));
          c.drawCircle(W - 42 - p * 8, y, 2.5, paint);
        }
      }
    };

    list.forEach(draw);
    if (extra) draw(extra, list.length);

    return rec.finishRecordingAsPicture();
  }, [W, H, rows]);

  const tap = useTapGesture({
    runOnJS: true,
    onActivate: (e) => {
      if (Math.hypot(e.x - 42, e.y - 72) < 34) onBack();
      else if (!userId && canApple && !showButton && e.y > H * 0.9) runGuarded(doSignIn);
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
        <View style={[styles.appleContainer, { top: H * 0.88 }]}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={22}
            style={styles.appleButton}
            onPress={onApplePress}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0620' },
  appleContainer: {
    position: 'absolute',
    left: 28,
    right: 28,
    alignItems: 'center',
  },
  appleButton: {
    width: '100%',
    height: 44,
  },
});
