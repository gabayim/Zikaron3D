import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Canvas, Fill, Group, Image, LinearGradient, Oval, BlurMask, useImage, vec, type SkImage } from '@shopify/react-native-skia';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { CAST, CAST_IDS } from '../render/castRegistry';
import { SpriteCharacter, useSpritePlayer } from '../render/SpriteCharacter';
import { sfx, useMusic } from '../fx/sound';
import type { WorldDef } from '../worlds';

const COLS = 3;

interface TileApi {
  trigger: () => void;
}

interface TileProps {
  id: string;
  x: number;
  y: number;
  size: number;
  register: (id: string, api: TileApi) => void;
}

/** Loads only idle up front; the celebrate atlas is loaded on first tap to keep memory low. */
function Tile({ id, x, y, size, register }: TileProps) {
  const sheet = CAST[id];
  const [wantCelebrate, setWantCelebrate] = useState(false);
  const idle = useImage(sheet.sources.idle);
  const celebrate = useImage(wantCelebrate ? sheet.sources.celebrate : null);
  const images: (SkImage | null)[] = sheet.order.map((n) => (n === 'idle' ? idle : n === 'celebrate' ? celebrate : null));
  const player = useSpritePlayer(sheet);
  const queued = useRef(false);

  const trigger = useCallback(() => {
    if (!wantCelebrate) {
      queued.current = true;
      setWantCelebrate(true);
    } else {
      player.play('celebrate');
    }
  }, [wantCelebrate, player]);

  useEffect(() => {
    register(id, { trigger });
  }, [id, trigger, register]);

  // Once the celebrate atlas arrives, play the queued tap.
  useEffect(() => {
    if (celebrate && queued.current) {
      queued.current = false;
      player.play('celebrate');
    }
  }, [celebrate, player]);

  const h = size;
  const w = (size * sheet.frameWidth) / sheet.frameHeight;
  return (
    <>
      <Oval x={x - w * 0.3} y={y + h * 0.82} width={w * 0.6} height={h * 0.1} color="rgba(20,0,40,0.5)">
        <BlurMask blur={8} style="normal" />
      </Oval>
      <SpriteCharacter sheet={sheet} images={images} clip={player.clip} frame={player.frame} x={x - w / 2} y={y} height={h} />
    </>
  );
}

export default function CastShowcase({ world }: { world: WorldDef }) {
  const { width: W, height: H } = useWindowDimensions();
  useMusic(world.music, 0.4);
  const still = useImage(world.still);
  const apis = useRef<Record<string, TileApi>>({});
  const register = useCallback((id: string, api: TileApi) => {
    apis.current[id] = api;
  }, []);

  const rows = Math.ceil(CAST_IDS.length / COLS);
  const cellW = W / COLS;
  const size = Math.min(cellW * 1.05, (H * 0.8) / rows);
  const top = (H - rows * size) / 2;

  const bgW = Math.max(W, H * (9 / 16));
  const bgH = bgW * (16 / 9);

  const onTap = useCallback(
    (px: number, py: number) => {
      const col = Math.floor(px / cellW);
      const row = Math.floor((py - top) / size);
      const index = row * COLS + col;
      if (row < 0 || row >= rows || index >= CAST_IDS.length) return;
      sfx.play('pop');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      apis.current[CAST_IDS[index]]?.trigger();
    },
    [cellW, top, size, rows],
  );
  const tap = useTapGesture({ runOnJS: true, onActivate: (e) => onTap(e.x, e.y) });

  return (
    <View style={styles.root}>
      <GestureDetector gesture={tap}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill color="#0B0620" />
          <Image image={still} x={(W - bgW) / 2} y={(H - bgH) / 2} width={bgW} height={bgH} fit="cover" />
          <Fill>
            <LinearGradient start={vec(0, 0)} end={vec(0, H)} colors={['rgba(12,4,40,0.55)', 'rgba(12,4,40,0.25)', 'rgba(6,2,20,0.65)']} />
          </Fill>
          <Group>
            {CAST_IDS.map((id, i) => (
              <Tile key={id} id={id} x={(i % COLS) * cellW + cellW / 2} y={top + Math.floor(i / COLS) * size} size={size * 0.92} register={register} />
            ))}
          </Group>
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
});
