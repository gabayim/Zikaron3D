import { useAchievements } from '../../store/achievements';
import { useEconomy } from '../../store/economy';
import { useSeasonPass } from '../../store/seasonPass';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Atlas,
  Canvas,
  Circle,
  DashPathEffect,
  FilterMode,
  Group,
  Line,
  LinearGradient,
  MipmapMode,
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
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { CAST } from '../../render/castRegistry';
import { CAST_COLOR } from '../../render/castColors';
import { ParticleKind } from '../../render/particles';
import { WorldBackdrop } from '../../render/WorldBackdrop';
import { sfx, useMusic } from '../../fx/sound';
import { useJuice } from '../../fx/useJuice';
import { SeededRNG } from '../../engine/SeededRNG';
import { dailyKey } from '../../engine/daily';
import { SkillTracker } from '../../engine/dda';
import { getOrbLevel } from '../../engine/levelTables';
import { PhysicsWorld, type MergeEvent } from '../../engine/physics';
import { useProfile, type CreatureId } from '../../store/profile';
import { getWorld, type WorldId } from '../../worlds';
import { ModeIcon } from '../../ui/ModeIcon';
import { ParentalGate } from '../../ui/ParentalGate';
import { useParentalModeCycle } from '../../ui/useParentalModeCycle';
import { LevelSplash } from '../../ui/LevelSplash';
import { pickNext, radiiFor, SPRITE_PER_RADIUS, TIERS, TOP_TIER } from './logic';

const STEP = 1 / 120;
const STRIDE = 6;
const HUD_Y = 78;

interface TierProps {
  tier: number;
  image: SkImage | null;
  snap: SharedValue<number[]>;
  time: SharedValue<number>;
  radius: number;
}

/** Draws every orb of one tier with a single Atlas call. Snapshot layout: [tier, x, y, angle, scale, phase] per orb. */
function TierAtlas({ tier, image, snap, time, radius }: TierProps) {
  const sheet = CAST[TIERS[tier]];
  const fh = sheet.frameHeight;
  const { cols, frames, w: cw, h: ch } = sheet.clips.idle;
  // Frame centre expressed in the trimmed cell's local space.
  const ox = sheet.frameWidth / 2 - sheet.clips.idle.x;
  const oy = fh / 2 - sheet.clips.idle.y;
  const fps = sheet.fps;
  const base = (radius * SPRITE_PER_RADIUS) / fh;

  const sprites = useDerivedValue(() => {
    const s = snap.value;
    const out = [];
    for (let i = 0; i < s.length; i += STRIDE) {
      if (s[i] !== tier) continue;
      const f = Math.floor(time.value * fps + s[i + 5]) % frames;
      out.push(Skia.XYWHRect((f % cols) * cw, Math.floor(f / cols) * ch, cw, ch));
    }
    return out;
  });
  const transforms = useDerivedValue(() => {
    const s = snap.value;
    const out = [];
    for (let i = 0; i < s.length; i += STRIDE) {
      if (s[i] !== tier) continue;
      const sc = base * s[i + 4];
      const c = Math.cos(s[i + 3]) * sc;
      const sn = Math.sin(s[i + 3]) * sc;
      out.push(Skia.RSXform(c, sn, s[i + 1] - c * ox + sn * oy, s[i + 2] - sn * ox - c * oy));
    }
    return out;
  });

  if (!image) return null;
  return <Atlas image={image} sprites={sprites} transforms={transforms} sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.None }} />;
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** One fixed hook per tier. Higher tiers decode only once the player is within two merges of them. */
function useTierImages(loadUpTo: number) {
  const images: (SkImage | null)[] = [];
  for (let t = 0; t <= TOP_TIER; t++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    images.push(useImage(t <= loadUpTo ? CAST[TIERS[t]].sources.idle : null));
  }
  return images;
}

export default function OrbMerge({
  daily = false,
  startLevel = 1,
  worldId = 'crystal',
}: {
  daily?: boolean;
  startLevel?: number;
  worldId?: WorldId;
}) {
  const worldDef = useMemo(() => getWorld(worldId), [worldId]);
  const { width: W, height: H } = useWindowDimensions();
  const { gateOpen, requestCycle, confirmGate, cancelGate } = useParentalModeCycle();
  const mode = useProfile((s) => s.mode);
  const calm = mode === 'SANCTUARY';
  useMusic(worldDef.music, calm ? 0.3 : 0.4);
  const juice = useJuice(W, H, 16);

  // ---- level progression --------------------------------------------------
  const level = useRef(startLevel);
  const [currentLevel, setCurrentLevel] = useState(startLevel);
  const [splashTrigger, setSplashTrigger] = useState(0);
  const levelConfig = useMemo(() => getOrbLevel(currentLevel), [currentLevel]);
  const dropsCount = useRef(0);
  const [dropsLeft, setDropsLeft] = useState<number | null>(levelConfig.maxDrops);
  const targetAchieved = useRef(0);

  // ---- layout -------------------------------------------------------------
  const radii = useMemo(() => radiiFor(W), [W]);
  const bowlFactor = (mode === 'ARCADE' ? levelConfig.bowlWidthPercent : Math.max(90, levelConfig.bowlWidthPercent)) / 100;
  const bowlWidth = W * 0.86 * bowlFactor;
  const left = (W - bowlWidth) / 2;
  const right = (W + bowlWidth) / 2;
  const floor = H * 0.9;
  const lineY = H * 0.27;
  const dropY = H * 0.2;

  // ---- state --------------------------------------------------------------
  const snap = useSharedValue<number[]>([]);
  const danger = useSharedValue(0);
  const aim = useSharedValue(W / 2);
  const [maxTier, setMaxTier] = useState(0);
  const [nextTier, setNextTier] = useState(0);
  const [combo, setCombo] = useState(0);

  const world = useRef<PhysicsWorld | null>(null);
  const [rng] = useState(() => new SeededRNG(daily ? `orbs-${dailyKey()}` : `${Date.now()}`));
  const skill = useRef(new SkillTracker());
  const phase = useRef<'play' | 'over' | 'between'>('play');
  const held = useRef(0);
  const next = useRef(0);
  const aimX = useRef(W / 2);
  const lastDrop = useRef(0);
  const comboRef = useRef({ count: 0, at: 0 });
  const overflow = useRef(0);
  const warned = useRef(false);
  const maxRef = useRef(0);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const epoch = useRef(0);

  const images = useTierImages(Math.max(3, maxTier + 2));

  const present = useCallback(() => Array.from(new Set(world.current?.bodies.map((b) => b.tier) ?? [])), []);

  const later = useCallback((fn: () => void, ms: number) => {
    const ep = epoch.current;
    timeouts.current.push(
      setTimeout(() => {
        if (ep === epoch.current) fn();
      }, ms),
    );
  }, []);

  const newGame = useCallback((targetLvl?: number) => {
    const lvl = targetLvl ?? level.current;
    level.current = lvl;
    setCurrentLevel(lvl);
    setSplashTrigger((k) => k + 1);
    const cfg = getOrbLevel(lvl);
    dropsCount.current = 0;
    setDropsLeft(cfg.maxDrops);
    targetAchieved.current = 0;

    epoch.current += 1;
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];

    const m = useProfile.getState().mode;
    const bFactor = (m === 'ARCADE' ? cfg.bowlWidthPercent : Math.max(90, cfg.bowlWidthPercent)) / 100;
    const bW = W * 0.86 * bFactor;
    const l = (W - bW) / 2;
    const r = (W + bW) / 2;

    world.current = new PhysicsWorld({ left: l, right: r, floor }, radii);
    if (m === 'SANCTUARY') world.current.gravity = 1700;
    phase.current = 'play';
    overflow.current = 0;
    warned.current = false;
    maxRef.current = 0;
    comboRef.current = { count: 0, at: 0 };
    held.current = pickNext(rng, [], skill.current.psr, m);
    next.current = pickNext(rng, [], skill.current.psr, m);
    lastDrop.current = Date.now();
    danger.set(0);
    setMaxTier(0);
    setCombo(0);
    setNextTier(next.current);
  }, [W, floor, radii, danger, rng]);

  useEffect(() => {
    const start = setTimeout(() => newGame(level.current), 0);
    return () => {
      clearTimeout(start);
      epoch.current += 1;
      timeouts.current.forEach(clearTimeout);
    };
    // Restart when the mode changes (and once on mount).
  }, [mode, daily, newGame]);

  // ---- events -------------------------------------------------------------
  const onMerge = useCallback(
    (e: MergeEvent) => {
      const m = useProfile.getState().mode;
      const t = e.tier;
      const now = Date.now();
      const c = comboRef.current;
      c.count = now - c.at < 1300 ? c.count + 1 : 1;
      c.at = now;
      setCombo(c.count);
      skill.current.record(true, 800);

      const rate = Math.min(1.7, 0.95 + t * 0.05 + (c.count - 1) * 0.06);
      sfx.play(t >= 5 ? 'chime' : 'pop', 0.85, rate);
      if (t >= 3) sfx.play('sparkle', 0.4, rate);

      juice.emit({ x: e.x, y: e.y, kind: ParticleKind.Sparkle, count: 8 + t * 4 });
      if (t >= 2) juice.emit({ x: e.x, y: e.y, kind: ParticleKind.Ring, count: t >= 5 ? 3 : 1 });
      if (t >= 7) juice.emit({ x: W / 2, y: H * 0.35, kind: ParticleKind.Confetti, count: 140 });

      const k = m === 'SANCTUARY' ? 0.3 : 1;
      if (t >= 3) juice.doShake(Math.min(10, t * 1.2) * k, 350);
      if (t >= 6) juice.doFlash(0.3 * k);
      if (m !== 'SANCTUARY') juice.doBoost(0.5 + Math.min(c.count, 5) * 0.2, 800);

      if (t >= 6) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else if (t >= 3) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const profile = useProfile.getState();
      const discovered = !e.ultimate && t <= TOP_TIER && profile.unlockCreature(TIERS[t] as CreatureId);
      profile.awardXp(6 + t * 4 + (discovered ? 26 : 0));
      useEconomy.getState().earnStardust(1 + Math.floor(t / 2));
      useSeasonPass.getState().addSeasonXp(10 + t * 2);
      useAchievements.getState().setMetricMax('orb_tier', t);
      if (!e.ultimate && t > maxRef.current) {
        maxRef.current = t;
        setMaxTier(t);
        profile.setOrbBest(t);
      }
      if (daily && t >= 4 && profile.completeDaily('orbs')) {
        profile.awardXp(80);
      }
      if (t === TOP_TIER || e.ultimate) {
        useEconomy.getState().earnCrystals(3, true);
        juice.emit({ x: W / 2, y: H * 0.45, kind: ParticleKind.Confetti, count: 220 });
        juice.doFlash(0.45 * k, 800);
        sfx.play('chime', 1, 1.2);
      }

      // Check level target tier
      if (t >= levelConfig.targetTier && phase.current === 'play') {
        targetAchieved.current += 1;
        if (targetAchieved.current >= levelConfig.targetCount) {
          phase.current = 'between';
          const isFirstClear = currentLevel > profile.orbLevel;
          profile.setOrbLevel(currentLevel);
          profile.awardXp(35 + currentLevel * 8);
          useEconomy.getState().earnStardust(levelConfig.stardustReward + (isFirstClear ? levelConfig.firstClearBonus : 0));
          useSeasonPass.getState().addSeasonXp(20 + currentLevel * 2);
          useAchievements.getState().setMetricMax('orb_level', currentLevel + 1);

          juice.emit({ x: W / 2, y: H * 0.4, kind: ParticleKind.Confetti, count: calm ? 90 : 220 });
          juice.emit({ x: W / 2, y: H * 0.45, kind: ParticleKind.Ring, count: 4 });
          juice.doFlash(0.4 * k, 700);
          juice.doShake(10 * k, 400);
          sfx.play('chime', 1, 1.2);
          sfx.play('sparkle', 0.8);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          later(() => {
            const nextLvl = Math.min(30, level.current + 1);
            newGame(nextLvl);
          }, 2400);
        }
      }
    },
    [juice, W, H, daily, levelConfig, currentLevel, calm, later, newGame],
  );

  const gameOver = useCallback(() => {
    const w = world.current;
    if (!w || phase.current !== 'play') return;
    phase.current = 'over';
    sfx.play('sad', 0.8);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    juice.doShake(10, 500);
    const bodies = [...w.bodies].sort((a, b) => a.y - b.y);
    bodies.forEach((b, i) =>
      later(() => {
        world.current?.remove(b.id);
        juice.emit({ x: b.x, y: b.y, kind: ParticleKind.Sparkle, count: 10 });
        if (i % 3 === 0) sfx.play('pop', 0.4, 1.1 + (i % 5) * 0.05);
      }, 600 + i * 60),
    );
    later(newGame, 900 + bodies.length * 60);
  }, [juice, later, newGame]);

  const relieve = useCallback(() => {
    // Gentle modes: bubbles burst to make room instead of ending the game.
    const w = world.current;
    if (!w) return;
    const high = w.bodies.filter((b) => b.y - b.r < lineY).sort((a, b) => a.tier - b.tier);
    high.slice(0, 3).forEach((b) => {
      w.remove(b.id);
      juice.emit({ x: b.x, y: b.y, kind: ParticleKind.Sparkle, count: 18 });
      juice.emit({ x: b.x, y: b.y, kind: ParticleKind.Ring, count: 1 });
    });
    sfx.play('sparkle', 0.6);
    Haptics.selectionAsync();
  }, [juice, lineY]);

  // ---- simulation loop ----------------------------------------------------
  const handlers = useRef({ onMerge, gameOver, relieve });
  useEffect(() => {
    handlers.current = { onMerge, gameOver, relieve };
  }, [onMerge, gameOver, relieve]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const events: MergeEvent[] = [];

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = world.current;
      if (!w) return;
      acc += dt;
      while (acc >= STEP) {
        w.step(STEP, events);
        acc -= STEP;
      }
      for (const e of events) handlers.current.onMerge(e);
      events.length = 0;

      // Overflow: settled creatures above the line for a while.
      if (phase.current === 'play') {
        const m = useProfile.getState().mode;
        const over = w.bodies.some((b) => b.age > 1.6 && b.y - b.r < lineY && Math.hypot(b.vx, b.vy) < 60);
        overflow.current = over ? overflow.current + dt : Math.max(0, overflow.current - dt * 2);
        const limit = m === 'ARCADE' ? 2.4 : 1.6;
        danger.set(Math.min(1, overflow.current / limit));
        if (overflow.current > 0.6 && !warned.current) {
          warned.current = true;
          skill.current.record(false, 5000);
        } else if (overflow.current === 0) {
          warned.current = false;
        }
        if (overflow.current > limit) {
          overflow.current = 0;
          if (m === 'ARCADE') handlers.current.gameOver();
          else handlers.current.relieve();
        }
      }

      // Snapshot for the UI thread: held creature first, then bodies.
      const out: number[] = [];
      if (phase.current === 'play') {
        const sinceDrop = Date.now() - lastDrop.current;
        const sc = Math.min(1, sinceDrop / 420);
        const r = radii[held.current];
        const x = Math.max(left + r, Math.min(right - r, aimX.current));
        out.push(held.current, x, dropY + Math.sin(now / 260) * 3, Math.sin(now / 420) * 0.06, easeOutBack(sc), 0);
      }
      for (const b of w.bodies) {
        const s = b.age < 0.35 ? Math.max(0.2, easeOutBack(b.age / 0.35)) : 1;
        out.push(b.tier, b.x, b.y, b.angle, s, b.id * 7);
      }
      snap.set(out);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [radii, left, right, dropY, lineY, danger, snap]);

  // ---- input --------------------------------------------------------------
  const setAim = useCallback(
    (x: number) => {
      aimX.current = x;
      const r = radii[held.current];
      aim.set(Math.max(left + r, Math.min(right - r, x)));
    },
    [radii, left, right, aim],
  );

  const drop = useCallback(() => {
    const w = world.current;
    if (!w || phase.current !== 'play') return;
    const now = Date.now();
    if (now - lastDrop.current < 420) return;
    const tier = held.current;
    const r = radii[tier];
    const x = Math.max(left + r, Math.min(right - r, aimX.current));
    const b = w.add(tier, x, dropY, 0, 160);
    b.age = 0.4;
    lastDrop.current = now;
    held.current = next.current;
    next.current = pickNext(rng, present(), skill.current.psr, useProfile.getState().mode);
    setNextTier(next.current);
    sfx.play('boing', 0.35, 1.3);
    Haptics.selectionAsync();

    // Drop tracking & limits
    dropsCount.current += 1;
    if (levelConfig.maxDrops !== null) {
      const remaining = Math.max(0, levelConfig.maxDrops - dropsCount.current);
      setDropsLeft(remaining);
      if (remaining === 0 && mode === 'ARCADE' && targetAchieved.current < levelConfig.targetCount) {
        later(() => {
          if (phase.current === 'play' && targetAchieved.current < levelConfig.targetCount) {
            gameOver();
          }
        }, 2200);
      }
    }
  }, [radii, left, right, dropY, present, rng, levelConfig, mode, later, gameOver]);

  const onModeButton = useRef(false);
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: (e) => {
      onModeButton.current = Math.hypot(e.x - (W - 42), e.y - HUD_Y) < 30;
      if (!onModeButton.current) setAim(e.x);
    },
    onUpdate: (e) => {
      if (!onModeButton.current) setAim(e.x);
    },
    onFinalize: () => {
      if (onModeButton.current) {
        onModeButton.current = false;
        requestCycle();
        sfx.play('sparkle', 0.5);
        Haptics.selectionAsync();
        juice.emit({ x: W - 42, y: HUD_Y, kind: ParticleKind.Ring, count: 2 });
      } else {
        drop();
      }
    },
  });

  // ---- render values ------------------------------------------------------
  const jar = useMemo(() => {
    const R = 14;
    const l = left - 7;
    const r = right + 7;
    const top = lineY - 36;
    const f = floor + 7;
    return Skia.PathBuilder.Make()
      .moveTo(l, top)
      .lineTo(l, f - R)
      .quadTo(l, f, l + R, f)
      .lineTo(r - R, f)
      .quadTo(r, f, r, f - R)
      .lineTo(r, top)
      .build();
  }, [left, right, lineY, floor]);
  const jarFill = useMemo(() => Skia.PathBuilder.Make().addPath(jar).close().build(), [jar]);

  const guideP1 = useDerivedValue(() => vec(aim.value, dropY + radii[0] * 1.2));
  const guideP2 = useDerivedValue(() => vec(aim.value, floor));
  const dangerColor = useDerivedValue(() => `rgba(255,${Math.round(210 - danger.value * 150)},${Math.round(230 - danger.value * 190)},${0.35 + danger.value * 0.5})`);

  const orbX = (t: number) => 88 + t * ((W - 176) / TOP_TIER);

  return (
    <View style={styles.root}>
      <ParentalGate visible={gateOpen} onSuccess={confirmGate} onCancel={cancelGate} />
      <LevelSplash level={currentLevel} gameTitle="ORB MERGE" worldName={worldDef.id.replace('_', ' ')} triggerKey={splashTrigger} />
      <GestureDetector gesture={pan}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={juice.worldTransform}>
            <WorldBackdrop W={W} H={H} still={worldDef.still} time={juice.time} boost={juice.boost} light={{ x: 0.5, y: 0.08 }} />
            <Picture picture={juice.back} />

            {/* Glass jar (back) */}
            <Path path={jarFill} style="fill">
              <LinearGradient start={vec(left, lineY)} end={vec(right, floor)} colors={['rgba(190,235,255,0.10)', 'rgba(140,190,255,0.05)', 'rgba(180,140,255,0.12)']} />
            </Path>
            <Line p1={vec(left - 7, lineY)} p2={vec(right + 7, lineY)} color={dangerColor} strokeWidth={3}>
              <DashPathEffect intervals={[10, 10]} />
            </Line>
            <Line p1={guideP1} p2={guideP2} color="rgba(255,255,255,0.22)" strokeWidth={2}>
              <DashPathEffect intervals={[4, 12]} />
            </Line>

            {TIERS.map((_, t) => (
              <TierAtlas key={t} tier={t} image={images[t]} snap={snap} time={juice.time} radius={radii[t]} />
            ))}

            {/* Glass jar (front) */}
            <Path path={jar} style="stroke" strokeWidth={4} strokeCap="round" strokeJoin="round">
              <LinearGradient start={vec(left, lineY)} end={vec(right, floor)} colors={['rgba(255,255,255,0.75)', 'rgba(170,220,255,0.35)', 'rgba(255,200,255,0.6)']} />
            </Path>
            <Rect x={left + 6} y={lineY + 24} width={5} height={(floor - lineY) * 0.45} color="rgba(255,255,255,0.18)" />
            <Picture picture={juice.front} />
          </Group>

          {/* HUD: evolution ladder, next creature, mode. Icons only. */}
          {TIERS.map((id, t) => {
            const isTarget = t === levelConfig.targetTier;
            return (
              <Group key={id}>
                <Circle
                  cx={orbX(t)}
                  cy={HUD_Y}
                  r={isTarget ? 11 : t === maxTier ? 10 : 8}
                  color={isTarget ? '#FFD84D' : 'rgba(255,255,255,0.35)'}
                  style="stroke"
                  strokeWidth={isTarget ? 3 : 2.5}
                />
                {t <= maxTier && <Circle cx={orbX(t)} cy={HUD_Y} r={t === maxTier ? 8 : 6.5} color={CAST_COLOR[id]} />}
                {isTarget && <Circle cx={orbX(t)} cy={HUD_Y - 17} r={3} color="#FFD84D" />}
              </Group>
            );
          })}
          {mode === 'ARCADE' && dropsLeft !== null && levelConfig.maxDrops !== null && (
            <Group transform={[{ translateX: W * 0.5 }, { translateY: HUD_Y + 16 }]}>
              <RoundedRect x={-32} y={-3} width={64} height={6} r={3} color="rgba(255,255,255,0.2)" />
              <RoundedRect
                x={-32}
                y={-3}
                width={Math.max(0, 64 * (dropsLeft / levelConfig.maxDrops))}
                height={6}
                r={3}
                color={dropsLeft <= 5 ? '#FF453A' : '#30D158'}
              />
            </Group>
          )}
          <Circle cx={W - 42} cy={HUD_Y} r={24} color="rgba(26,15,61,0.6)" />
          <ModeIcon mode={mode} x={W - 42} y={HUD_Y} />
          <Circle cx={W - 42} cy={HUD_Y + 56} r={20} color="rgba(26,15,61,0.6)" />
          <Circle cx={W - 42} cy={HUD_Y + 56} r={6 + nextTier * 1.6} color={CAST_COLOR[TIERS[nextTier]]} />
          {mode === 'ARCADE' &&
            Array.from({ length: Math.min(combo, 6) }).map((_, i) => (
              <Circle key={i} cx={W / 2 + (i - (Math.min(combo, 6) - 1) / 2) * 16} cy={HUD_Y + 30} r={4.5} color="#FFD84D" />
            ))}

          <Rect x={0} y={0} width={W} height={H}>
            <RadialGradient c={vec(W / 2, H * 0.55)} r={Math.max(W, H) * 0.75} colors={['rgba(0,0,0,0)', 'rgba(5,0,18,0.5)']} positions={[0.55, 1]} />
          </Rect>
          <Rect x={0} y={0} width={W} height={H} color="white" opacity={juice.flash} blendMode="plus" />
          {!images[0] && <Rect x={0} y={0} width={W} height={H} color="#05010F" opacity={0.85} />}
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
});
