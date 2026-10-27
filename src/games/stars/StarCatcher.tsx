import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Oval,
  Path,
  Picture,
  RadialGradient,
  Rect,
  RoundedRect,
  Skia,
  useImage,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { CAST } from '../../render/castRegistry';
import { ParticleKind } from '../../render/particles';
import { WorldBackdrop } from '../../render/WorldBackdrop';
import { SpriteCharacter, useSpritePlayer } from '../../render/SpriteCharacter';
import { sfx, useMusic } from '../../fx/sound';
import { useJuice } from '../../fx/useJuice';
import { SeededRNG } from '../../engine/SeededRNG';
import { dailyKey } from '../../engine/daily';
import { SkillTracker } from '../../engine/dda';
import { useProfile, type CreatureId } from '../../store/profile';
import { getWorld } from '../../worlds';
import { ModeIcon } from '../../ui/ModeIcon';
import { ParentalGate } from '../../ui/ParentalGate';
import { ShieldIcon } from '../../ui/ShieldIcon';
import { useParentalModeCycle } from '../../ui/useParentalModeCycle';
import { drawObjects } from './draw';
import { FEVER_SECONDS, FEVER_STREAK, GOLD, StarSim, type SimEvent } from './sim';

const WORLD = getWorld('candy');
const HUD_Y = 78;
const STEP = 1 / 120;

export default function StarCatcher({ daily = false }: { daily?: boolean }) {
  const { width: W, height: H } = useWindowDimensions();
  const { gateOpen, requestCycle, confirmGate, cancelGate } = useParentalModeCycle();
  const mode = useProfile((s) => s.mode);
  const calm = mode === 'SANCTUARY';
  useMusic(WORLD.music, calm ? 0.3 : 0.42);
  const juice = useJuice(W, H, 18);

  // ---- character ----------------------------------------------------------
  const [heroId] = useState(() => {
    const rng = new SeededRNG(daily ? `stars-hero-${dailyKey()}` : `${Date.now()}`);
    return WORLD.residents[rng.nextInt(0, WORLD.residents.length - 1)];
  });
  const sheet = CAST[heroId];
  const idle = useImage(sheet.sources.idle);
  const celebrate = useImage(sheet.sources.celebrate);
  const sad = useImage(sheet.sources.sad);
  const images: (SkImage | null)[] = sheet.order.map((n) => (n === 'idle' ? idle : n === 'celebrate' ? celebrate : n === 'sad' ? sad : null));
  const player = useSpritePlayer(sheet);

  const ph = W * 0.36;
  const pw = (ph * sheet.frameWidth) / sheet.frameHeight;
  const feetY = H * 0.9;
  const playerY = feetY - ph * 0.5;
  const playerR = ph * 0.36;

  // ---- shared render state ------------------------------------------------
  const snap = useSharedValue<number[]>([]);
  const px = useSharedValue(W / 2);
  const lean = useSharedValue(0);
  const sqx = useSharedValue(1);
  const sqy = useSharedValue(1);
  const blink = useSharedValue(1);
  const meter = useSharedValue(0);
  const feverFx = useSharedValue(0);
  const hurt = useSharedValue(0);
  const [lives, setLives] = useState(3);
  const [shieldArmed, setShieldArmed] = useState(false);

  // ---- game state ---------------------------------------------------------
  const sim = useRef<StarSim | null>(null);
  const skill = useRef(new SkillTracker());
  const [rng] = useState(() => new SeededRNG(daily ? `stars-${dailyKey()}` : `${Date.now()}`));
  const phase = useRef<'play' | 'over'>('play');
  const slow = useRef(1);
  const epoch = useRef(0);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    const ep = epoch.current;
    timeouts.current.push(
      setTimeout(() => {
        if (ep === epoch.current) fn();
      }, ms),
    );
  }, []);

  const newGame = useCallback(() => {
    epoch.current += 1;
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    const m = useProfile.getState().mode;
    sim.current = new StarSim({ W, H, playerY, playerR, mode: m }, rng);
    sim.current.psr = skill.current.psr;
    const armed = m === 'ARCADE' && useProfile.getState().shields > 0;
    sim.current.shield = armed;
    setShieldArmed(armed);
    phase.current = 'play';
    slow.current = 1;
    px.set(W / 2);
    meter.set(0);
    feverFx.set(0);
    setLives(sim.current.lives);
  }, [W, H, playerY, playerR, rng, px, meter, feverFx]);

  useEffect(() => {
    const start = setTimeout(newGame, 0);
    return () => {
      clearTimeout(start);
      epoch.current += 1;
      timeouts.current.forEach(clearTimeout);
    };
  }, [mode, daily, newGame]);

  const squash = useCallback(
    (amount: number) => {
      sqx.set(withSequence(withTiming(1 + amount, { duration: 60 }), withSpring(1, { damping: 5, stiffness: 320 })));
      sqy.set(withSequence(withTiming(1 - amount, { duration: 60 }), withSpring(1, { damping: 5, stiffness: 320 })));
    },
    [sqx, sqy],
  );

  // ---- events -------------------------------------------------------------
  const onEvent = useCallback(
    (e: SimEvent) => {
      const s = sim.current;
      const m = useProfile.getState().mode;
      const k = m === 'SANCTUARY' ? 0.35 : 1;
      if (!s) return;
      switch (e.type) {
        case 'catch': {
          skill.current.record(true, 600);
          s.psr = skill.current.psr;
          const gold = e.kind === GOLD;
          const profile = useProfile.getState();
          const discovered = profile.unlockCreature(heroId as CreatureId);
          profile.awardXp((gold ? 5 : 2) + (discovered ? 22 : 0));
          juice.emit({ x: e.x, y: e.y, kind: ParticleKind.Sparkle, count: gold ? 22 : 9 });
          if (gold) juice.emit({ x: e.x, y: e.y, kind: ParticleKind.Ring, count: 2 });
          sfx.play(gold ? 'chime' : 'sparkle', gold ? 0.8 : 0.5, Math.min(1.7, 1 + e.streak * 0.045));
          Haptics.impactAsync(gold ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
          squash(gold ? 0.16 : 0.09);
          if (gold || (e.streak > 0 && e.streak % 5 === 0)) {
            if (!s.invulnerable) player.play('celebrate');
          }
          break;
        }
        case 'miss': {
          skill.current.record(false, 3000);
          s.psr = skill.current.psr;
          if (skill.current.needsAssist(m)) {
            s.assist();
            sfx.play('whoosh', 0.25, 1.4);
          }
          break;
        }
        case 'hit': {
          skill.current.record(false, 1500);
          s.psr = skill.current.psr;
          setLives(e.lives);
          player.play('sad');
          sfx.play('sad', 0.7);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          juice.emit({ x: e.x, y: e.y, kind: ParticleKind.Ring, count: 2 });
          juice.doShake(12 * k, 400);
          hurt.set(withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 500 })));
          blink.set(withSequence(...Array.from({ length: 5 }, () => [withTiming(0.3, { duration: 90 }), withTiming(1, { duration: 120 })]).flat()));
          squash(-0.14);
          break;
        }
        case 'shield': {
          useProfile.getState().spendShield();
          setShieldArmed(false);
          sfx.play('chime', 0.6, 1.3);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          juice.emit({ x: e.x, y: e.y, kind: ParticleKind.Ring, count: 3 });
          juice.emit({ x: e.x, y: e.y, kind: ParticleKind.Sparkle, count: 18 });
          juice.doFlash(0.15 * k, 300);
          if (e.reason === 'hit') {
            blink.set(withSequence(...Array.from({ length: 3 }, () => [withTiming(0.5, { duration: 90 }), withTiming(1, { duration: 120 })]).flat()));
          }
          break;
        }
        case 'fever': {
          if (e.on) {
            slow.current = 0.45;
            later(() => (slow.current = 1), 350);
            juice.emit({ x: W / 2, y: H * 0.4, kind: ParticleKind.Confetti, count: 120 });
            juice.emit({ x: s.playerX, y: playerY, kind: ParticleKind.Ring, count: 4 });
            juice.doFlash(0.35 * k, 600);
            juice.doBoost(1.6, 1500);
            sfx.play('chime');
            sfx.play('whoosh', 0.5);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            player.play('celebrate');
            const profile = useProfile.getState();
            if (daily && profile.completeDaily('stars')) profile.awardXp(80);
          }
          break;
        }
        case 'over': {
          phase.current = 'over';
          useProfile.getState().setStarBest(s.caught);
          slow.current = 0.3;
          sfx.play('sad', 0.9);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          player.play('sad');
          juice.doShake(14, 700);
          later(() => (slow.current = 1), 1200);
          later(newGame, 2400);
          break;
        }
      }
    },
    [juice, squash, player, hurt, blink, later, newGame, W, H, playerY, heroId, daily],
  );

  // ---- loop ---------------------------------------------------------------
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let prevX = W / 2;
    const events: SimEvent[] = [];

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = sim.current;
      if (!s) return;
      acc += dt * slow.current;
      while (acc >= STEP) {
        s.step(STEP, events);
        acc -= STEP;
      }
      for (const e of events) handler.current(e);
      events.length = 0;

      const vx = (s.playerX - prevX) / Math.max(dt, 0.001);
      prevX = s.playerX;
      px.set(s.playerX);
      lean.set(lean.get() + (Math.max(-0.28, Math.min(0.28, vx / 3200)) - lean.get()) * 0.25);
      meter.set(s.fever > 0 ? s.fever / FEVER_SECONDS : Math.min(1, s.streak / FEVER_STREAK));
      feverFx.set(feverFx.get() + ((s.fever > 0 ? 1 : 0) - feverFx.get()) * 0.1);

      const out: number[] = [];
      for (const o of s.objs) out.push(o.kind, o.x, o.y, o.r, o.rot, o.age);
      snap.set(out);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [W, px, lean, meter, feverFx, snap]);

  // ---- input --------------------------------------------------------------
  const onModeButton = useRef(false);
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: (e) => {
      onModeButton.current = Math.hypot(e.x - (W - 42), e.y - HUD_Y) < 30;
      if (!onModeButton.current && sim.current) sim.current.targetX = e.x;
    },
    onUpdate: (e) => {
      if (!onModeButton.current && sim.current) sim.current.targetX = e.x;
    },
    onFinalize: () => {
      if (onModeButton.current) {
        onModeButton.current = false;
        requestCycle();
        sfx.play('sparkle', 0.5);
        Haptics.selectionAsync();
        juice.emit({ x: W - 42, y: HUD_Y, kind: ParticleKind.Ring, count: 2 });
      }
    },
  });

  // ---- render values ------------------------------------------------------
  const objects = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawObjects(c, snap.value, juice.time.value);
    return rec.finishRecordingAsPicture();
  });
  const heroTransform = useDerivedValue(() => [
    { translateX: px.value },
    { translateY: Math.sin(juice.time.value * 3) * 1.5 },
    { rotate: lean.value },
    { scaleX: sqx.value },
    { scaleY: sqy.value },
  ]);
  const heroOpacity = useDerivedValue(() => blink.value);
  const shadowTransform = useDerivedValue(() => [{ translateX: px.value }]);
  const auraOpacity = useDerivedValue(() => feverFx.value * (0.6 + 0.2 * Math.sin(juice.time.value * 8)));
  const feverTint = useDerivedValue(() => feverFx.value * 0.4);
  const hurtTint = useDerivedValue(() => hurt.value * 0.35);
  const barWidth = useDerivedValue(() => Math.max(0, W * 0.42 * meter.value));
  const barColor = useDerivedValue(() => (feverFx.value > 0.5 ? '#FF8FD0' : '#FFD84D'));

  const heart = useMemo(
    () =>
      Skia.PathBuilder.Make()
        .moveTo(0, 5)
        .cubicTo(-14, -4, -8, -14, 0, -7)
        .cubicTo(8, -14, 14, -4, 0, 5)
        .close()
        .build(),
    [],
  );

  return (
    <View style={styles.root}>
      <ParentalGate visible={gateOpen} onSuccess={confirmGate} onCancel={cancelGate} />
      <GestureDetector gesture={pan}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={juice.worldTransform}>
            <WorldBackdrop W={W} H={H} still={WORLD.still} time={juice.time} boost={juice.boost} light={{ x: 0.5, y: 0.1 }} />
            <Rect x={0} y={0} width={W} height={H} opacity={feverTint}>
              <RadialGradient c={vec(W / 2, H * 0.8)} r={H * 0.7} colors={['rgba(255,143,208,0.9)', 'rgba(255,216,77,0.35)', 'rgba(255,143,208,0)']} />
            </Rect>
            <Picture picture={juice.back} />

            {/* Hero */}
            <Group transform={shadowTransform}>
              <Oval x={-pw * 0.3} y={feetY - ph * 0.04} width={pw * 0.6} height={ph * 0.08} color="rgba(20,0,40,0.5)">
                <BlurMask blur={9} style="normal" />
              </Oval>
              <Group opacity={auraOpacity}>
                <Circle cx={0} cy={playerY} r={playerR * 1.9} blendMode="plus">
                  <RadialGradient c={vec(0, playerY)} r={playerR * 1.9} colors={['rgba(255,230,140,0.9)', 'rgba(255,143,208,0)']} />
                </Circle>
              </Group>
            </Group>
            <Group opacity={heroOpacity}>
              <Group transform={heroTransform} origin={vec(0, feetY)}>
                <SpriteCharacter sheet={sheet} images={images} clip={player.clip} frame={player.frame} x={-pw / 2} y={feetY - ph} height={ph} />
              </Group>
            </Group>

            <Picture picture={objects} />
            <Picture picture={juice.front} />
          </Group>

          {/* HUD: fever meter, lives (Arcade), mode. Icons only. */}
          <RoundedRect x={W * 0.29} y={HUD_Y - 7} width={W * 0.42} height={14} r={7} color="rgba(255,255,255,0.18)" />
          <RoundedRect x={W * 0.29} y={HUD_Y - 7} width={barWidth} height={14} r={7} color={barColor} />
          {mode === 'ARCADE' &&
            Array.from({ length: 3 }).map((_, i) => (
              <Group key={i} transform={[{ translateX: W / 2 + (i - 1) * 34 }, { translateY: HUD_Y + 34 }]}>
                <Path path={heart} color={i < lives ? '#FF5C8A' : 'rgba(255,255,255,0.25)'} />
              </Group>
            ))}
          <Circle cx={W - 42} cy={HUD_Y} r={24} color="rgba(26,15,61,0.6)" />
          <ModeIcon mode={mode} x={W - 42} y={HUD_Y} />
          {mode === 'ARCADE' && <ShieldIcon x={W - 42} y={HUD_Y + 50} armed={shieldArmed} />}

          <Rect x={0} y={0} width={W} height={H}>
            <RadialGradient c={vec(W / 2, H * 0.55)} r={Math.max(W, H) * 0.75} colors={['rgba(0,0,0,0)', 'rgba(5,0,18,0.5)']} positions={[0.55, 1]} />
          </Rect>
          <Rect x={0} y={0} width={W} height={H} color="#FF2D55" opacity={hurtTint} />
          <Rect x={0} y={0} width={W} height={H} color="white" opacity={juice.flash} blendMode="plus" />
          {!idle && <Rect x={0} y={0} width={W} height={H} color="#05010F" opacity={0.85} />}
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
});
