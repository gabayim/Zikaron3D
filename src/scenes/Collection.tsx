import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  BlurMask,
  Canvas,
  Circle,
  Fill,
  Group,
  LinearGradient,
  Oval,
  Picture,
  RadialGradient,
  Rect,
  RoundedRect,
  Skia,
  useImage,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { CAST } from '../render/castRegistry';
import { CAST_COLOR } from '../render/castColors';
import { SpriteCharacter, useSpritePlayer } from '../render/SpriteCharacter';
import { useJuice } from '../fx/useJuice';
import { sfx } from '../fx/sound';
import { ParticleKind } from '../render/particles';
import { drawIcon } from '../render/hubDraw';
import { useAudioSettings } from '../store/audioSettings';
import { CREATURE_IDS, useProfile, type CreatureId } from '../store/profile';

const PAGES: CreatureId[][] = [
  ['pip', 'bloop', 'fuzz'],
  ['nutty', 'zap', 'grumble'],
  ['frost', 'ember', 'dusk'],
];

interface ShelfCreatureProps {
  id: CreatureId;
  owned: boolean;
  x: number;
  ground: number;
  size: number;
}

/** One shelf position. Locked creatures are silhouettes and do not decode their atlas. */
function ShelfCreature({ id, owned, x, ground, size, staticPose }: ShelfCreatureProps & { staticPose: boolean }) {
  const sheet = CAST[id];
  const image = useImage(owned ? sheet.sources.idle : null);
  const player = useSpritePlayer(sheet, (x * 17) % 2000, staticPose);
  const h = size;
  const w = (h * sheet.frameWidth) / sheet.frameHeight;
  const images: (SkImage | null)[] = sheet.order.map((name) => (name === 'idle' ? image : null));
  const halo = useDerivedValue(() => 0.35 + Math.sin(x * 0.02 + player.frame.get() * 0.16) * 0.1);

  return (
    <Group>
      <Circle cx={x} cy={ground - h * 0.44} r={w * 0.5} color={CAST_COLOR[id]} opacity={owned ? halo : 0.1} blendMode="plus">
        <BlurMask blur={18} style="normal" />
      </Circle>
      <Oval x={x - w * 0.32} y={ground - h * 0.025} width={w * 0.64} height={h * 0.07} color="rgba(8,1,25,0.55)">
        <BlurMask blur={8} style="normal" />
      </Oval>
      {owned ? (
        <SpriteCharacter sheet={sheet} images={images} clip={player.clip} frame={player.frame} x={x - w / 2} y={ground - h} height={h} />
      ) : (
        <Group>
          <Circle cx={x} cy={ground - h * 0.54} r={w * 0.28} color="#160A31" />
          <RoundedRect x={x - w * 0.22} y={ground - h * 0.42} width={w * 0.44} height={h * 0.36} r={w * 0.22} color="#160A31" />
          <Circle cx={x} cy={ground - h * 0.47} r={w * 0.34} color="rgba(255,255,255,0.18)" style="stroke" strokeWidth={2} />
        </Group>
      )}
    </Group>
  );
}

export default function Collection({ onBack }: { onBack: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const collection = useProfile((s) => s.collection);
  const xp = useProfile((s) => s.xp);
  const reduceMotion = useAudioSettings((s) => s.reduceMotion);
  const [page, setPage] = useState(0);
  const juice = useJuice(W, H, reduceMotion ? 6 : 14);
  const slots = PAGES[page];
  const floor = H * 0.76;
  const size = Math.min(W * 0.54, H * 0.43);
  const xs = useMemo(() => [W * 0.2, W * 0.5, W * 0.8], [W]);
  const ownedSet = useMemo(() => new Set(collection), [collection]);
  const ownedCount = collection.length;

  const ui = useMemo(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    const paint = Skia.Paint();
    paint.setAntiAlias(true);

    paint.setColor(Skia.Color('rgba(26,15,61,0.7)'));
    c.drawCircle(42, 72, 24, paint);
    drawIcon(c, 'back', 42, 72, 14, '#FFFFFF', 0.9);

    // Progress shelf: filled gems represent discovered creatures (no text / numerals).
    for (let i = 0; i < CREATURE_IDS.length; i++) {
      const x = W / 2 + (i - (CREATURE_IDS.length - 1) / 2) * 21;
      paint.setStyle(0);
      paint.setColor(Skia.Color(i < ownedCount ? CAST_COLOR[CREATURE_IDS[i]] : 'rgba(255,255,255,0.18)'));
      c.drawCircle(x, 72, i < ownedCount ? 7 : 5.5, paint);
    }

    // Navigation chevrons and page pips.
    drawIcon(c, 'back', 34, H * 0.5, 16, '#FFFFFF', page > 0 ? 0.9 : 0.2);
    c.save();
    c.translate(W - 34, H * 0.5);
    c.rotate(180, 0, 0);
    drawIcon(c, 'back', 0, 0, 16, '#FFFFFF', page < PAGES.length - 1 ? 0.9 : 0.2);
    c.restore();
    for (let i = 0; i < PAGES.length; i++) {
      paint.setColor(Skia.Color(i === page ? '#FFD36E' : 'rgba(255,255,255,0.3)'));
      c.drawCircle(W / 2 + (i - 1) * 16, H * 0.9, i === page ? 5 : 3.5, paint);
    }

    // XP spark at the top is deliberately just a visual trace of earned progression.
    if (xp > 0) {
      paint.setColor(Skia.Color('#FFD36E'));
      paint.setAlphaf(0.8);
      c.drawCircle(W - 35, 72, 7, paint);
    }
    return rec.finishRecordingAsPicture();
  }, [W, H, page, ownedCount, xp]);

  const onTap = useCallback(
    (x: number, y: number) => {
      if (Math.hypot(x - 42, y - 72) < 34) {
        onBack();
        return;
      }
      if (x < W * 0.18 && page > 0) {
        setPage((p) => p - 1);
      } else if (x > W * 0.82 && page < PAGES.length - 1) {
        setPage((p) => p + 1);
      } else {
        const index = xs.findIndex((cx) => Math.abs(x - cx) < W * 0.13 && y > H * 0.25 && y < H * 0.85);
        if (index >= 0 && ownedSet.has(slots[index])) {
          const cx = xs[index];
          juice.emit({ x: cx, y: floor - size * 0.45, kind: ParticleKind.Sparkle, count: 18 });
          juice.emit({ x: cx, y: floor - size * 0.45, kind: ParticleKind.Ring, count: 2 });
          sfx.play('sparkle', 0.6);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    },
    [W, H, page, slots, ownedSet, floor, size, xs, juice, onBack],
  );
  const tap = useTapGesture({ runOnJS: true, onActivate: (event) => onTap(event.x, event.y) });

  return (
    <View style={styles.root}>
      <GestureDetector gesture={tap}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill color="#0B0620" />
          <Rect x={0} y={0} width={W} height={H}>
            <LinearGradient start={vec(0, 0)} end={vec(W, H)} colors={['#20104E', '#0D0630', '#08021C']} />
          </Rect>
          <Rect x={0} y={0} width={W} height={H} blendMode="plus">
            <RadialGradient c={vec(W / 2, H * 0.42)} r={W * 0.85} colors={['rgba(116,87,255,0.38)', 'rgba(116,87,255,0)']} />
          </Rect>
          <Picture picture={juice.back} />

          <RoundedRect x={W * 0.08} y={H * 0.25} width={W * 0.84} height={H * 0.55} r={30} color="rgba(18,9,54,0.66)">
            <LinearGradient start={vec(W / 2, H * 0.25)} end={vec(W / 2, H * 0.8)} colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.02)']} />
          </RoundedRect>
          <Rect x={W * 0.11} y={floor} width={W * 0.78} height={H * 0.025} color="#6E3D7B" />
          <Rect x={W * 0.11} y={floor + H * 0.025} width={W * 0.78} height={H * 0.022}>
            <LinearGradient start={vec(0, floor)} end={vec(0, floor + H * 0.05)} colors={['#B47D86', '#4C2457']} />
          </Rect>

          {slots.map((id, index) => (
            <ShelfCreature
              key={id}
              id={id}
              owned={ownedSet.has(id)}
              staticPose={reduceMotion}
              x={xs[index]}
              ground={floor}
              size={size}
            />
          ))}
          <Picture picture={juice.front} />
          <Picture picture={ui} />
          <Rect x={0} y={0} width={W} height={H}>
            <RadialGradient c={vec(W / 2, H * 0.55)} r={Math.max(W, H) * 0.75} colors={['rgba(0,0,0,0)', 'rgba(5,0,18,0.48)']} positions={[0.55, 1]} />
          </Rect>
          <Rect x={0} y={0} width={W} height={H} color="white" opacity={juice.flash} blendMode="plus" />
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
});
