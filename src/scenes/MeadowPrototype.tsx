import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  BlurMask,
  Canvas,
  Fill,
  Group,
  Image,
  LinearGradient,
  Oval,
  Picture,
  RadialGradient,
  Rect,
  Shader,
  Skia,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import {
  SensorType,
  useAnimatedSensor,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GestureDetector, useExclusiveGestures, useLongPressGesture, useTapGesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { PIP, type ClipName } from '../render/sprites';
import { SpriteCharacter, useCharacterImages, useSpritePlayer } from '../render/SpriteCharacter';
import { createPool, drawFireflies, drawPool, ParticleKind, spawnBurst, stepPool, type BurstRequest } from '../render/particles';
import { lightRays, skyAtmosphere, stageGlow } from '../render/shaders';
import { sfx, useMusic } from '../fx/sound';

const WORLD_STILL = require('../../assets/worlds/meadow/still.webp');
const MUSIC = require('../../assets/audio/music/meadow.m4a');

/** Source art is 9:16; the moon sits at this fraction of it. */
const MOON = { x: 0.77, y: 0.12 };
const TAP_REACTIONS: ClipName[] = ['surprised', 'hop', 'wave'];
const COMBO_WINDOW_MS = 1200;

export default function MeadowPrototype() {
  const { width: W, height: H } = useWindowDimensions();
  useMusic(MUSIC, 0.4);

  // ---- layout -------------------------------------------------------------
  const bgW = Math.max(W, H * (9 / 16));
  const bgH = bgW * (16 / 9);
  const bgX = (W - bgW) / 2;
  const bgY = (H - bgH) / 2;
  const moon = vec(bgX + MOON.x * bgW, bgY + MOON.y * bgH);
  const groundY = H * 0.8;
  const pipH = Math.min(H * 0.42, W * 1.05);
  const pipW = (pipH * PIP.frameWidth) / PIP.frameHeight;
  const pipX = W / 2 - pipW / 2;
  const pipY = groundY - pipH * 0.9;
  const pipChest = { x: W / 2, y: pipY + pipH * 0.55 };

  // ---- assets -------------------------------------------------------------
  const still = useImage(WORLD_STILL);
  const images = useCharacterImages(PIP);
  const ready = images.every(Boolean) && !!still;

  // ---- simulation (UI thread) ---------------------------------------------
  const pip = useSpritePlayer(PIP);
  const time = useSharedValue(0);
  const pool = useSharedValue(createPool());
  const bursts = useSharedValue<BurstRequest[]>([]);
  const parallax = useSharedValue({ x: 0, y: 0 });
  const gravity = useAnimatedSensor(SensorType.GRAVITY, { interval: 'auto' });

  useFrameCallback((info) => {
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    time.value = info.timestamp / 1000;
    const pending = bursts.value;
    if (pending.length) bursts.value = [];
    pool.modify((p) => {
      'worklet';
      for (let i = 0; i < pending.length; i++) spawnBurst(p, pending[i]);
      stepPool(p, dt);
      return p;
    });
    const g = gravity.sensor.value;
    const tx = Math.max(-1, Math.min(1, g.x / 9.81));
    const ty = Math.max(-1, Math.min(1, g.y / 9.81 + 0.6));
    parallax.value = { x: parallax.value.x + (tx - parallax.value.x) * 0.06, y: parallax.value.y + (ty - parallax.value.y) * 0.06 };
  });

  // ---- juice --------------------------------------------------------------
  const intro = useSharedValue(0);
  const pipEnter = useSharedValue(0);
  const flash = useSharedValue(0);
  const squashX = useSharedValue(1);
  const squashY = useSharedValue(1);
  const shake = useSharedValue(0);
  const boost = useSharedValue(0);

  const emit = useCallback(
    (b: BurstRequest) => {
      bursts.modify((list) => {
        'worklet';
        list.push(b);
        return list;
      });
    },
    [bursts],
  );

  const squash = useCallback(
    (amount: number) => {
      squashX.set(withSequence(withTiming(1 + amount, { duration: 70 }), withSpring(1, { damping: 5, stiffness: 320 })));
      squashY.set(withSequence(withTiming(1 - amount, { duration: 70 }), withSpring(1, { damping: 5, stiffness: 320 })));
    },
    [squashX, squashY],
  );

  useEffect(() => {
    if (!ready) return;
    sfx.play('whoosh', 0.7);
    intro.set(withTiming(1, { duration: 1400 }));
    pipEnter.set(withDelay(650, withSpring(1, { damping: 13, stiffness: 160 })));
    const land = setTimeout(() => {
      sfx.play('pop');
      flash.set(withSequence(withTiming(0.45, { duration: 90 }), withTiming(0, { duration: 600 })));
      squash(0.18);
      emit({ x: W / 2, y: groundY, kind: ParticleKind.Ring, count: 3 });
      emit({ x: W / 2, y: groundY - 10, kind: ParticleKind.Sparkle, count: 26 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      pip.play('wave');
    }, 1050);
    return () => clearTimeout(land);
    // Run once when assets are ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Pulse a hint ring on Pip until the first tap, and let Pip fidget when left alone.
  const tapped = useRef(false);
  const lastTouch = useRef(0);
  useEffect(() => {
    if (!ready) return;
    lastTouch.current = Date.now();
    const id = setInterval(() => {
      if (!tapped.current) emit({ x: pipChest.x, y: pipChest.y, kind: ParticleKind.Ring, count: 2 });
      if (Date.now() - lastTouch.current > 7000 && pip.current() === 'idle') {
        lastTouch.current = Date.now();
        const clip: ClipName = Math.random() < 0.5 ? 'wave' : 'hop';
        pip.play(clip);
        if (clip === 'hop') setTimeout(() => sfx.play('boing', 0.6), 350);
      }
    }, 2200);
    return () => clearInterval(id);
  }, [ready, emit, pip, pipChest.x, pipChest.y]);

  // ---- input --------------------------------------------------------------
  const combo = useRef({ count: 0, at: 0 });
  const lastReaction = useRef<ClipName>('idle');

  const hitPip = useCallback(
    (x: number, y: number) => x > pipX + pipW * 0.12 && x < pipX + pipW * 0.88 && y > pipY + pipH * 0.22 && y < pipY + pipH * 0.95,
    [pipX, pipW, pipY, pipH],
  );

  const onTap = useCallback(
    (x: number, y: number) => {
      tapped.current = true;
      lastTouch.current = Date.now();
      if (!hitPip(x, y)) {
        emit({ x, y, kind: ParticleKind.Ring, count: 2 });
        emit({ x, y, kind: ParticleKind.Sparkle, count: 12 });
        sfx.play('sparkle', 0.5);
        Haptics.selectionAsync();
        return;
      }

      const now = Date.now();
      combo.current = now - combo.current.at < COMBO_WINDOW_MS ? { count: combo.current.count + 1, at: now } : { count: 1, at: now };
      squash(0.14);
      emit({ x, y, kind: ParticleKind.Sparkle, count: 18 });

      if (combo.current.count >= 3) {
        combo.current = { count: 0, at: 0 };
        pip.play('celebrate');
        sfx.play('chime');
        emit({ x: W / 2, y: pipY + pipH * 0.2, kind: ParticleKind.Confetti, count: 140 });
        emit({ x: pipChest.x, y: pipChest.y, kind: ParticleKind.Ring, count: 4 });
        shake.set(withSequence(withTiming(14, { duration: 40 }), withTiming(0, { duration: 520 })));
        boost.set(withSequence(withTiming(1.6, { duration: 120 }), withTiming(0, { duration: 1400 })));
        flash.set(withSequence(withTiming(0.35, { duration: 80 }), withTiming(0, { duration: 500 })));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      const options = TAP_REACTIONS.filter((c) => c !== lastReaction.current);
      const clip = options[Math.floor(Math.random() * options.length)];
      lastReaction.current = clip;
      pip.play(clip);
      sfx.play('pop');
      if (clip === 'hop') setTimeout(() => sfx.play('boing', 0.7), 300);
      boost.set(withSequence(withTiming(0.6, { duration: 80 }), withTiming(0, { duration: 600 })));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [hitPip, emit, squash, pip, W, pipY, pipH, pipChest.x, pipChest.y, shake, boost, flash],
  );

  const onLongPress = useCallback(
    (x: number, y: number) => {
      if (!hitPip(x, y)) return;
      tapped.current = true;
      lastTouch.current = Date.now();
      pip.play('sad');
      sfx.play('sad', 0.8);
      squash(-0.08);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
    [hitPip, pip, squash],
  );

  const tap = useTapGesture({ runOnJS: true, onActivate: (e) => onTap(e.x, e.y) });
  const longPress = useLongPressGesture({ runOnJS: true, minDuration: 450, onActivate: (e) => onLongPress(e.x, e.y) });
  const gesture = useExclusiveGestures(longPress, tap);

  // ---- derived render values ----------------------------------------------
  const worldTransform = useDerivedValue(() => {
    const t = time.value * 1000;
    const s = shake.value;
    return [{ translateX: Math.sin(t * 0.09) * s }, { translateY: Math.cos(t * 0.113) * s }];
  });
  const bgTransform = useDerivedValue(() => [
    { translateX: -parallax.value.x * 14 + Math.sin(time.value * 0.11) * 6 },
    { translateY: -parallax.value.y * 10 + Math.sin(time.value * 0.07) * 4 },
    { scale: 1.06 + Math.sin(time.value * 0.09) * 0.015 + (1 - intro.value) * 0.12 },
  ]);
  const atmosphereUniforms = useDerivedValue(() => ({ res: [W, H], time: time.value }));
  const pipTransform = useDerivedValue(() => [
    { translateX: parallax.value.x * 6 },
    { translateY: Math.max(0, 1 - pipEnter.value) * H * 0.55 },
    { scaleX: squashX.value * (0.6 + 0.4 * pipEnter.value) },
    { scaleY: squashY.value * (0.6 + 0.4 * pipEnter.value) },
  ]);
  const shadowTransform = useDerivedValue(() => [{ scaleX: squashX.value * pipEnter.value }, { scaleY: pipEnter.value }]);
  const raysUniforms = useDerivedValue(() => ({ res: [W, H], origin: [moon.x, moon.y], time: time.value, strength: 0.17 + boost.value * 0.08 }));
  const glowUniforms = useDerivedValue(() => ({ center: [W / 2, groundY - pipH * 0.25], radius: [W * 0.62, pipH * 0.62], time: time.value, boost: boost.value }));
  const blackout = useDerivedValue(() => 1 - intro.value);

  const backParticles = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawFireflies(c, W, H, time.value, 26);
    return rec.finishRecordingAsPicture();
  });
  const frontParticles = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawPool(c, pool.value, time.value);
    return rec.finishRecordingAsPicture();
  });
  return (
    <View style={styles.root}>
      <GestureDetector gesture={gesture}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill color="#0B0620" />
          <Group transform={worldTransform}>
            {/* World */}
            <Group transform={bgTransform} origin={vec(W / 2, H / 2)}>
              <Image image={still} x={bgX} y={bgY} width={bgW} height={bgH} fit="cover" />
            </Group>
            <Rect x={0} y={0} width={W} height={H} blendMode="screen">
              <Shader source={skyAtmosphere} uniforms={atmosphereUniforms} />
            </Rect>
            <Rect x={0} y={0} width={W} height={H} blendMode="screen">
              <Shader source={lightRays} uniforms={raysUniforms} />
            </Rect>
            <Picture picture={backParticles} />

            {/* Stage */}
            <Rect x={0} y={0} width={W} height={H} blendMode="screen">
              <Shader source={stageGlow} uniforms={glowUniforms} />
            </Rect>
            <Group transform={shadowTransform} origin={vec(W / 2, groundY)}>
              <Oval x={W / 2 - pipW * 0.32} y={groundY - pipH * 0.035} width={pipW * 0.64} height={pipH * 0.07} color="rgba(20,0,40,0.55)">
                <BlurMask blur={10} style="normal" />
              </Oval>
            </Group>

            {/* Pip */}
            <Group transform={pipTransform} origin={vec(W / 2, groundY)}>
              <SpriteCharacter sheet={PIP} images={images} clip={pip.clip} frame={pip.frame} x={pipX} y={pipY} height={pipH} />
            </Group>

            <Picture picture={frontParticles} />
          </Group>

          {/* Grade: top/bottom depth + vignette */}
          <Rect x={0} y={0} width={W} height={H}>
            <LinearGradient start={vec(0, 0)} end={vec(0, H)} colors={['rgba(12,4,40,0.55)', 'rgba(12,4,40,0)', 'rgba(12,4,40,0)', 'rgba(6,2,20,0.6)']} positions={[0, 0.22, 0.78, 1]} />
          </Rect>
          <Rect x={0} y={0} width={W} height={H}>
            <RadialGradient c={vec(W / 2, H * 0.55)} r={Math.max(W, H) * 0.75} colors={['rgba(0,0,0,0)', 'rgba(5,0,18,0.55)']} positions={[0.55, 1]} />
          </Rect>

          <Rect x={0} y={0} width={W} height={H} color="white" opacity={flash} blendMode="plus" />
          <Rect x={0} y={0} width={W} height={H} color="#05010F" opacity={blackout} />
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
});
