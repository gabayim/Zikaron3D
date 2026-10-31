import { useAchievements } from '../../store/achievements';
import { useEconomy } from '../../store/economy';
import { useSeasonPass } from '../../store/seasonPass';
import { getBurrowsLevel } from '../../engine/levelTables';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Canvas,
  Circle,
  Fill,
  Group,
  Image,
  LinearGradient,
  Picture,
  RadialGradient,
  Rect,
  RoundedRect,
  Shader,
  useImage,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';
import { cancelAnimation, Easing, interpolateColor, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { CAST } from '../../render/castRegistry';
import { ParticleKind } from '../../render/particles';
import { lightRays, skyAtmosphere } from '../../render/shaders';
import { sfx, useMusic } from '../../fx/sound';
import { useJuice } from '../../fx/useJuice';
import { SeededRNG } from '../../engine/SeededRNG';
import { dailyKey } from '../../engine/daily';
import { SkillTracker, type BurrowsDifficulty } from '../../engine/dda';
import { useProfile, type CreatureId } from '../../store/profile';
import { getWorld, type WorldId } from '../../worlds';
import { ModeIcon } from '../../ui/ModeIcon';
import { ParentalGate } from '../../ui/ParentalGate';
import { ShieldIcon } from '../../ui/ShieldIcon';
import { LevelSplash } from '../../ui/LevelSplash';
import { useParentalModeCycle } from '../../ui/useParentalModeCycle';
import { Burrow, type BurrowApi } from './Burrow';
import { computeLayout, hitTest, makeRound, SPECIES_COLOR, SPECIES_POOL, type Round } from './logic';

const MOON = { x: 0.77, y: 0.12 };
const HUD_Y = 78;

/**
 * One fixed hook per pool species (never conditional), so a species reused in the next round stays decoded
 * and unused ones are released. Celebrate atlases load only once a species has been revealed.
 */
function useSpeciesImages(active: readonly string[], celebrateFor: readonly string[]) {
  const idle: Record<string, SkImage | null> = {};
  const celebrate: Record<string, SkImage | null> = {};
  for (const id of SPECIES_POOL) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    idle[id] = useImage(active.includes(id) ? CAST[id].sources.idle : null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    celebrate[id] = useImage(celebrateFor.includes(id) ? CAST[id].sources.celebrate : null);
  }
  return { idle, celebrate };
}

export default function CritterBurrows({
  daily = false,
  startLevel = 1,
  worldId = 'meadow',
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

  const juice = useJuice(W, H, 22);
  const timer = useSharedValue(1);

  // ---- game state ---------------------------------------------------------
  const [round, setRound] = useState<Round | null>(null);
  const [foundList, setFoundList] = useState<string[]>([]);
  const [combo, setCombo] = useState(0);
  const [celebrateFor, setCelebrateFor] = useState<string[]>([]);
  const [shieldArmed, setShieldArmed] = useState(false);
  const shieldRef = useRef(false);
  const armedMode = useRef<string | null>(null);

  const skill = useRef(new SkillTracker());
  const level = useRef(Math.max(1, startLevel));
  const [displayLevel, setDisplayLevel] = useState(Math.max(1, startLevel));
  const [splashTrigger, setSplashTrigger] = useState(0);
  const roundId = useRef(0);
  const epoch = useRef(0);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const apis = useRef<(BurrowApi | undefined)[]>([]);
  const phase = useRef<'loading' | 'preview' | 'play' | 'between'>('loading');
  const diff = useRef<BurrowsDifficulty | null>(null);
  const first = useRef<number | null>(null);
  const firstAt = useRef(0);
  const lock = useRef(true);
  const matched = useRef<Set<number>>(new Set());
  const comboRef = useRef(0);
  const timerStarted = useRef(false);
  const lastTap = useRef(0);

  const { idle, celebrate } = useSpeciesImages(round?.species ?? [], celebrateFor);
  const allLoaded = !!round && round.species.every((id) => idle[id]);

  // ---- layout -------------------------------------------------------------
  const layout = useMemo(() => (round ? computeLayout(round.board.length, W, 128, H * 0.95) : null), [round, W, H]);
  const layoutRef = useRef(layout);
  const roundRef = useRef(round);
  useEffect(() => {
    layoutRef.current = layout;
    roundRef.current = round;
  }, [layout, round]);

  const bgW = Math.max(W, H * (9 / 16));
  const bgH = bgW * (16 / 9);
  const bgX = (W - bgW) / 2;
  const bgY = (H - bgH) / 2;
  const still = useImage(worldDef.still);
  const moon = vec(bgX + MOON.x * bgW, bgY + MOON.y * bgH);

  const register = useCallback((index: number, api: BurrowApi) => {
    apis.current[index] = api;
  }, []);
  const registers = useMemo(() => Array.from({ length: 32 }, (_, i) => (api: BurrowApi) => register(i, api)), [register]);

  const later = useCallback((fn: () => void, ms: number) => {
    const ep = epoch.current;
    timeouts.current.push(
      setTimeout(() => {
        if (ep === epoch.current) fn();
      }, ms),
    );
  }, []);

  const slotPos = useCallback((i: number) => layoutRef.current?.slots[i] ?? { cx: W / 2, cy: H / 2 }, [W, H]);

  // ---- round lifecycle ----------------------------------------------------
  const beginRound = useCallback(
    (lvl: number) => {
      level.current = lvl;
      setDisplayLevel(lvl);
      setSplashTrigger((k) => k + 1);
      epoch.current += 1;
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
      cancelAnimation(timer);
      timer.set(1);
      timerStarted.current = false;

      const m = useProfile.getState().mode;
      // One shield per Arcade run (re-armed when the mode changes): keeps a combo alive through a single mismatch.
      if (armedMode.current !== m) {
        armedMode.current = m;
        const armed = m === 'ARCADE' && useProfile.getState().shields > 0;
        shieldRef.current = armed;
        setShieldArmed(armed);
      }

      // Read from discrete 30-level progression table
      const cfg = getBurrowsLevel(lvl);

      // Adaptive scaling tuned with mode:
      // Toybox: max 8 pairs (16 burrows) for comfortable touch targets
      // Sanctuary: max 6 pairs (12 burrows) for zen/seniors
      // Arcade: full 12 pairs (up to 24 burrows!)
      const maxPairs = m === 'SANCTUARY' ? 6 : m === 'TOYBOX' ? 8 : 12;
      const pairs = Math.min(maxPairs, cfg.pairs);

      const previewMs = m === 'SANCTUARY' ? cfg.previewMs * 1.4 : m === 'TOYBOX' ? cfg.previewMs * 1.25 : cfg.previewMs;
      const hideDelayMs = m === 'SANCTUARY' ? 1800 : m === 'TOYBOX' ? 1400 : cfg.hideDelayMs;
      const timeLimitMs = m === 'ARCADE' ? cfg.timeLimitMs : null;
      const hintAfterMs = m === 'TOYBOX' ? 5000 : m === 'SANCTUARY' ? 8000 : null;

      const d: BurrowsDifficulty = {
        pairs,
        previewMs,
        hideDelayMs,
        timeLimitMs,
        hintAfterMs,
      };
      diff.current = d;
      roundId.current += 1;
      matched.current = new Set();
      first.current = null;
      comboRef.current = 0;
      lock.current = true;
      phase.current = 'loading';
      apis.current = [];
      setCelebrateFor([]);
      setFoundList([]);
      setCombo(0);
      const seed = daily ? `burrows-${dailyKey()}-${lvl}` : `${Date.now()}-${lvl}`;
      const isTriple = cfg.mechanics.includes('triple') && m === 'ARCADE';
      const decoyCount = m === 'ARCADE' ? cfg.decoyCount : 0;
      setRound(makeRound(new SeededRNG(seed), roundId.current, d.pairs, { isTriple, decoyCount }));
    },
    [timer, daily],
  );

  useEffect(() => {
    beginRound(level.current);
    return () => {
      epoch.current += 1;
      timeouts.current.forEach(clearTimeout);
    };
    // Restart the round whenever the mode changes (and once on mount).
  }, [mode, beginRound]);

  const startPreview = useCallback(() => {
    const r = roundRef.current;
    const d = diff.current;
    if (!r || !d) return;
    phase.current = 'preview';
    const n = r.board.length;
    const order = new SeededRNG(`${Date.now()}`).shuffle(Array.from({ length: n }, (_, i) => i));
    const step = calm ? 150 : 95;
    order.forEach((idx, k) => {
      later(() => {
        apis.current[idx]?.up();
        sfx.play('pop', 0.45, 0.9 + k * 0.05);
      }, 450 + k * step);
    });
    const hideAt = 450 + n * step + d.previewMs;
    order.forEach((idx, k) => later(() => apis.current[idx]?.down(), hideAt + k * 60));
    later(() => {
      phase.current = 'play';
      lock.current = false;
      lastTap.current = Date.now();
      sfx.play('whoosh', 0.3);
    }, hideAt + n * 60 + 500);
  }, [later, calm]);

  useEffect(() => {
    if (round && allLoaded && phase.current === 'loading') startPreview();
  }, [round, allLoaded, startPreview]);

  // ---- round results ------------------------------------------------------
  const winRound = useCallback(() => {
    const r = roundRef.current;
    if (!r) return;
    phase.current = 'between';
    lock.current = true;
    cancelAnimation(timer);
    const k = calm ? 0.4 : 1;
    later(() => {
      juice.emit({ x: W / 2, y: H * 0.4, kind: ParticleKind.Confetti, count: calm ? 60 : 160 });
      juice.emit({ x: W / 2, y: H * 0.45, kind: ParticleKind.Ring, count: 4 });
      juice.doShake(12 * k);
      juice.doFlash(0.35 * k);
      juice.doBoost(1.4);
      sfx.play('chime');
      sfx.play('sparkle', 0.7);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 500);
    level.current += 1;
    const profile = useProfile.getState();
    profile.setBurrowsLevel(level.current);
    profile.awardXp(35 + r.species.length * 10);
    useAchievements.getState().setMetricMax('burrows_level', level.current + 1);
    useEconomy.getState().earnStardust(10 + Math.min(30, level.current * 2));
    useSeasonPass.getState().addSeasonXp(25 + level.current);
    if (level.current >= 10 && Math.random() < 0.5) useEconomy.getState().earnCrystals(1, true);
    if (daily && profile.completeDaily('burrows')) profile.awardXp(80);
    r.board.forEach((_, i) => later(() => apis.current[i]?.down(), 2300 + i * 70));
    later(() => beginRound(level.current), 3200 + r.board.length * 70);
  }, [timer, calm, later, juice, W, H, beginRound, daily]);

  const timeUp = useCallback(() => {
    const r = roundRef.current;
    if (!r || phase.current !== 'play') return;
    phase.current = 'between';
    lock.current = true;
    skill.current.record(false, 6000);
    sfx.play('sad', 0.8);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    r.board.forEach((_, i) => {
      if (matched.current.has(i)) return;
      apis.current[i]?.up();
      later(() => apis.current[i]?.sad(), 350);
    });
    r.board.forEach((_, i) => later(() => apis.current[i]?.down(), 2600 + i * 50));
    later(() => beginRound(level.current), 3400);
  }, [later, beginRound]);

  // ---- input --------------------------------------------------------------
  const reveal = useCallback(
    (i: number) => {
      const r = roundRef.current;
      if (!r) return;
      const id = r.board[i];
      setCelebrateFor((prev) => (prev.includes(id) ? prev : [...prev, id]));
      apis.current[i]?.up();
      sfx.play('pop', 0.8);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const s = slotPos(i);
      juice.emit({ x: s.cx, y: s.cy, kind: ParticleKind.Sparkle, count: 10 });
    },
    [juice, slotPos],
  );

  const onTap = useCallback(
    (x: number, y: number) => {
      // Mode button.
      if (Math.hypot(x - (W - 42), y - HUD_Y) < 30) {
        requestCycle();
        sfx.play('sparkle', 0.5);
        Haptics.selectionAsync();
        juice.emit({ x: W - 42, y: HUD_Y, kind: ParticleKind.Ring, count: 2 });
        return;
      }

      const r = roundRef.current;
      const l = layoutRef.current;
      if (!r || !l) return;
      lastTap.current = Date.now();
      if (phase.current !== 'play' || lock.current) return;
      const i = hitTest(l, x, y);
      if (i < 0 || matched.current.has(i) || first.current === i) return;

      const d = diff.current;
      if (d?.timeLimitMs && !timerStarted.current) {
        timerStarted.current = true;
        timer.set(withTiming(0, { duration: d.timeLimitMs, easing: Easing.linear }));
        later(timeUp, d.timeLimitMs);
      }

      reveal(i);
      const a = first.current;
      if (a === null) {
        first.current = i;
        firstAt.current = Date.now();
        return;
      }

      // Second pick.
      lock.current = true;
      first.current = null;
      const thinkMs = Date.now() - firstAt.current;
      const m = useProfile.getState().mode;

      if (r.board[a] === r.board[i]) {
        skill.current.record(true, thinkMs);
        matched.current.add(a).add(i);
        comboRef.current += 1;
        const c = comboRef.current;
        setCombo(c);
        const species = r.board[i];
        later(() => {
          apis.current[a]?.cheer();
          apis.current[i]?.cheer();
          const sa = slotPos(a);
          const sb = slotPos(i);
          juice.emit({ x: sa.cx, y: sa.cy - 40, kind: ParticleKind.Sparkle, count: 24 });
          juice.emit({ x: sb.cx, y: sb.cy - 40, kind: ParticleKind.Sparkle, count: 24 });
          juice.emit({ x: (sa.cx + sb.cx) / 2, y: (sa.cy + sb.cy) / 2 - 40, kind: ParticleKind.Ring, count: 2 });
          sfx.play('chime', 0.9, Math.min(1.6, 1 + 0.08 * (c - 1)));
          if (m !== 'SANCTUARY') juice.doBoost(0.6 + Math.min(c, 5) * 0.15, 900);
          if (m === 'ARCADE' && c >= 3) juice.doShake(5, 300);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const profile = useProfile.getState();
          const discovered = profile.unlockCreature(species as CreatureId);
          profile.awardXp(8 + (discovered ? 22 : 0));
          setFoundList((prev) => [...prev, species]);
          const targetCount = r.board.filter((b) => b !== "decoy").length;
          if (matched.current.size === targetCount) later(winRound, 700);
        }, 380);
        later(() => {
          if (phase.current === 'play') lock.current = false;
        }, 750);
      } else {
        skill.current.record(false, thinkMs);
        if (shieldRef.current && m === 'ARCADE' && comboRef.current >= 2) {
          shieldRef.current = false;
          setShieldArmed(false);
          useProfile.getState().spendShield();
          later(() => {
            sfx.play('chime', 0.6, 1.3);
            juice.emit({ x: W - 42, y: HUD_Y + 50, kind: ParticleKind.Ring, count: 3 });
            juice.emit({ x: W - 42, y: HUD_Y + 50, kind: ParticleKind.Sparkle, count: 14 });
          }, 380);
        } else {
          comboRef.current = 0;
          setCombo(0);
        }
        const hideDelay = d?.hideDelayMs ?? 1000;
        later(() => {
          apis.current[a]?.sad();
          apis.current[i]?.sad();
          sfx.play('sad', m === 'SANCTUARY' ? 0.35 : 0.55);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }, 380);
        later(() => {
          apis.current[a]?.down();
          apis.current[i]?.down();
        }, 380 + hideDelay);
        later(() => {
          if (phase.current !== 'play') return;
          lock.current = false;
          lastTap.current = Date.now();
          // Mercy: a stuck player gets the partner of the last pick peeking out.
          if (skill.current.needsAssist(m)) {
            const partner = r.board.findIndex((s, j) => j !== a && s === r.board[a] && !matched.current.has(j));
            if (partner >= 0) {
              apis.current[partner]?.nudge();
              sfx.play('sparkle', 0.4);
            }
          }
        }, 380 + hideDelay + 350);
      }
    },
    [W, timer, later, timeUp, reveal, slotPos, juice, winRound, requestCycle],
  );

  // Idle hint (Toybox / Sanctuary).
  useEffect(() => {
    const id = setInterval(() => {
      const d = diff.current;
      const r = roundRef.current;
      if (!d?.hintAfterMs || !r || phase.current !== 'play' || lock.current) return;
      if (Date.now() - lastTap.current < d.hintAfterMs) return;
      lastTap.current = Date.now();
      let target = -1;
      const a = first.current;
      if (a !== null) {
        target = r.board.findIndex((s, j) => j !== a && s === r.board[a] && !matched.current.has(j));
      } else {
        const open = r.board.map((_, j) => j).filter((j) => !matched.current.has(j));
        target = open[Math.floor(Math.random() * open.length)] ?? -1;
      }
      if (target >= 0) {
        apis.current[target]?.nudge();
        sfx.play('sparkle', 0.35);
      }
    }, 800);
    return () => clearInterval(id);
  }, []);

  const tap = useTapGesture({ runOnJS: true, onActivate: (e) => onTap(e.x, e.y) });

  // ---- render values ------------------------------------------------------
  const bgTransform = useDerivedValue(() => [
    { translateX: Math.sin(juice.time.value * 0.11) * 6 },
    { translateY: Math.sin(juice.time.value * 0.07) * 4 },
    { scale: 1.06 + Math.sin(juice.time.value * 0.09) * 0.015 },
  ]);
  const atmosphereUniforms = useDerivedValue(() => ({ res: [W, H], time: juice.time.value }));
  const raysUniforms = useDerivedValue(() => ({ res: [W, H], origin: [moon.x, moon.y], time: juice.time.value, strength: 0.17 + juice.boost.value * 0.1 }));
  const barColor = useDerivedValue(() => interpolateColor(timer.value, [0, 0.35, 1], ['#FF5A5A', '#FFC857', '#6BFFB0']));
  const barWidth = useDerivedValue(() => Math.max(0, W * 0.56 * timer.value));

  const pairs = round?.species.length ?? 0;
  const orbX = (i: number) => W / 2 + (i - (pairs - 1) / 2) * 26;

  return (
    <View style={styles.root}>
      <ParentalGate visible={gateOpen} onSuccess={confirmGate} onCancel={cancelGate} />
      <LevelSplash level={displayLevel} gameTitle="CRITTER BURROWS" worldName={worldDef.id.replace('_', ' ')} triggerKey={splashTrigger} />
      <GestureDetector gesture={tap}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill color="#0B0620" />
          <Group transform={juice.worldTransform}>
            <Group transform={bgTransform} origin={vec(W / 2, H / 2)}>
              <Image image={still} x={bgX} y={bgY} width={bgW} height={bgH} fit="cover" />
            </Group>
            <Rect x={0} y={0} width={W} height={H} blendMode="screen">
              <Shader source={skyAtmosphere} uniforms={atmosphereUniforms} />
            </Rect>
            <Rect x={0} y={0} width={W} height={H} blendMode="screen">
              <Shader source={lightRays} uniforms={raysUniforms} />
            </Rect>
            <Rect x={0} y={0} width={W} height={H}>
              <LinearGradient start={vec(0, 0)} end={vec(0, H)} colors={['rgba(12,4,40,0.5)', 'rgba(12,4,40,0.25)', 'rgba(6,2,20,0.55)']} />
            </Rect>
            <Picture picture={juice.back} />

            {round && layout &&
              layout.slots.map((s, i) => {
                const id = round.board[i];
                return (
                  <Burrow
                    key={`${round.id}-${i}`}
                    cx={s.cx}
                    cy={s.cy}
                    w={layout.w}
                    sheet={CAST[id]}
                    idle={idle[id]}
                    celebrate={celebrate[id]}
                    accent={SPECIES_COLOR[id]}
                    phaseMs={(i * 617) % 3000}
                    calm={calm}
                    register={registers[i]}
                  />
                );
              })}

            <Picture picture={juice.front} />
          </Group>

          {/* HUD: progress orbs, mode button, arcade timer + combo. Icons only. */}
          {Array.from({ length: pairs }).map((_, i) => (
            <Group key={i}>
              <Circle cx={orbX(i)} cy={HUD_Y} r={9} color="rgba(255,255,255,0.35)" style="stroke" strokeWidth={2.5} />
              {i < foundList.length && <Circle cx={orbX(i)} cy={HUD_Y} r={7} color={SPECIES_COLOR[foundList[i]]} />}
            </Group>
          ))}
          <Circle cx={W - 42} cy={HUD_Y} r={24} color="rgba(26,15,61,0.6)" />
          <ModeIcon mode={mode} x={W - 42} y={HUD_Y} />
          {mode === 'ARCADE' && <ShieldIcon x={W - 42} y={HUD_Y + 50} armed={shieldArmed} />}
          {mode === 'ARCADE' && (
            <Group>
              <RoundedRect x={W * 0.22} y={HUD_Y + 28} width={W * 0.56} height={10} r={5} color="rgba(255,255,255,0.18)" />
              <RoundedRect x={W * 0.22} y={HUD_Y + 28} width={barWidth} height={10} r={5} color={barColor} />
              {Array.from({ length: Math.min(combo, 6) }).map((_, i) => (
                <Circle key={i} cx={W / 2 + (i - (Math.min(combo, 6) - 1) / 2) * 16} cy={HUD_Y + 52} r={4.5} color="#FFD84D" />
              ))}
            </Group>
          )}

          <Rect x={0} y={0} width={W} height={H}>
            <RadialGradient c={vec(W / 2, H * 0.55)} r={Math.max(W, H) * 0.75} colors={['rgba(0,0,0,0)', 'rgba(5,0,18,0.5)']} positions={[0.55, 1]} />
          </Rect>
          <Rect x={0} y={0} width={W} height={H} color="white" opacity={juice.flash} blendMode="plus" />
          {!allLoaded && <Rect x={0} y={0} width={W} height={H} color="#05010F" opacity={0.85} />}
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
});
