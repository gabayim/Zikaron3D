import { useAchievements } from '../../store/achievements';
import { useEconomy } from '../../store/economy';
import { useSeasonPass } from '../../store/seasonPass';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { BlurMask, Canvas, Circle, Group, Oval, Path, Picture, RadialGradient, Rect, RoundedRect, Skia, vec } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { GestureDetector, useManualGesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { CAST } from '../../render/castRegistry';
import { ParticleKind } from '../../render/particles';
import { WorldBackdrop } from '../../render/WorldBackdrop';
import { SpriteCharacter, useClipImages } from '../../render/SpriteCharacter';
import { sfx } from '../../fx/sound';
import { notes } from '../../fx/notes';
import { useJuice } from '../../fx/useJuice';
import { SeededRNG } from '../../engine/SeededRNG';
import { dailyKey } from '../../engine/daily';
import { SkillTracker } from '../../engine/dda';
import { getPeakLevel, type PeakChannel } from '../../engine/levelTables';
import { useProfile } from '../../store/profile';
import { getWorld, type WorldId } from '../../worlds';
import { ModeIcon } from '../../ui/ModeIcon';
import { ParentalGate } from '../../ui/ParentalGate';
import { ShieldIcon } from '../../ui/ShieldIcon';
import { useParentalModeCycle } from '../../ui/useParentalModeCycle';
import { LevelSplash } from '../../ui/LevelSplash';
import { drawBattery, drawButtons, drawLanterns, drawPeaks, drawSky } from './draw';
import { buildRound, PEAK_COUNT, PeakRun, peakRules, TONES, type PeakEvent, type PeakRound } from './logic';

const HUD_Y = 78;
const HEARTS = 3;
const LUNA_CLIPS = ['idle', 'pop', 'celebrate', 'sad'] as const;
const CHANNEL_ORDER: PeakChannel[] = ['pos', 'sound', 'color'];
const LEAD_IN_MS = 900;
const FALL_MS = 220;
const RED_MS = 600;

type LunaClip = (typeof LUNA_CLIPS)[number];
type Phase = 'play' | 'result';

interface RoundState {
  round: PeakRound;
  run: PeakRun;
  startAt: number;
  phase: Phase;
  /** Next step whose tone hasn't played yet. */
  stepIdx: number;
  /** Per channel (pos, sound, colour): button press, hit glow and error wobble, all 0..1. */
  press: number[];
  good: number[];
  bad: number[];
  /** Per peak: red flash 0..1 after a missed position match. */
  red: number[];
  shieldUsed: boolean;
}

export default function EchoPeaks({
  daily = false,
  startLevel = 1,
  worldId = 'summit',
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
  const juice = useJuice(W, H, 16);
  // Juice is a new object every render; a ref keeps the level/round callbacks stable.
  const juiceRef = useRef(juice);
  useEffect(() => {
    juiceRef.current = juice;
  }, [juice]);

  // ---- level progression --------------------------------------------------
  const level = useRef(startLevel);
  const [currentLevel, setCurrentLevel] = useState(startLevel);
  const [splashTrigger, setSplashTrigger] = useState(0);
  const [hearts, setHearts] = useState(HEARTS);
  const [shieldArmed, setShieldArmed] = useState(false);

  // ---- layout ---------------------------------------------------------------
  const cx = W / 2;
  const cy = H * 0.5;
  const ringR = Math.min(W * 0.4, H * 0.25);
  const peakS = ringR * 0.36;
  const ch = Math.min(W * 0.3, H * 0.15);
  const lunaFeet = cy + ch * 0.5;
  const lanternY = H * 0.19;
  const buttonY = H * 0.88;
  const buttonH = Math.min(84, H * 0.1);

  const peakBase = useCallback(
    (i: number, rot: number) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / PEAK_COUNT + rot;
      return [cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR * 0.92 + peakS * 0.5] as const;
    },
    [cx, cy, ringR, peakS],
  );
  /** Where a star lands: a peak tip, or above Luna when position is not in play. */
  const starSpot = useCallback(
    (pos: number, rot: number) => {
      if (pos < 0) return [cx, cy - ch * 0.75] as const;
      const [x, y] = peakBase(pos, rot);
      return [x, y - peakS * 1.15 - peakS * 0.12] as const;
    },
    [peakBase, cx, cy, ch, peakS],
  );
  const buttonRects = useCallback(
    (count: number) => {
      const w = Math.min(W * 0.28, (W * 0.9) / count - 12);
      return Array.from({ length: count }, (_, k) => ({ x: W / 2 + (k - (count - 1) / 2) * (w + 14), y: buttonY, w, h: buttonH }));
    },
    [W, buttonY, buttonH],
  );

  // ---- Luna -----------------------------------------------------------------
  const lunaSheet = CAST.luna;
  const lunaImages = useClipImages(lunaSheet, LUNA_CLIPS);
  const lunaClip = useSharedValue(0);
  const lunaFrame = useSharedValue(0);
  const luna = useRef<{ clip: LunaClip; t0: number }>({ clip: 'idle', t0: 0 });
  const playLuna = useCallback((clip: LunaClip) => {
    luna.current = { clip, t0: performance.now() };
  }, []);

  // ---- shared render state ------------------------------------------------
  const peakSnap = useSharedValue<number[]>([]);
  const starSnap = useSharedValue<number[]>([]);
  const buttonSnap = useSharedValue<number[]>([]);
  const lanternSnap = useSharedValue<number[]>([]);
  const battery = useSharedValue(0.7);
  const showBattery = useSharedValue(0);
  const danger = useSharedValue(0);
  const progress = useSharedValue(0);
  const glowK = useSharedValue(0);
  const lunaY = useSharedValue(0);
  const sqx = useSharedValue(1);
  const sqy = useSharedValue(1);
  const hurt = useSharedValue(0);

  // ---- game state ---------------------------------------------------------
  const skill = useRef(new SkillTracker());
  const [rng] = useState(() => new SeededRNG(daily ? `peaks-${dailyKey()}` : `${Date.now()}`));
  const game = useRef<RoundState | null>(null);
  const heartsLeft = useRef(HEARTS);
  const shield = useRef(false);
  const prevSignature = useRef<string | undefined>(undefined);
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

  const squash = useCallback(
    (amount: number) => {
      sqx.set(withSequence(withTiming(1 + amount, { duration: 60 }), withSpring(1, { damping: 5, stiffness: 320 })));
      sqy.set(withSequence(withTiming(1 - amount, { duration: 60 }), withSpring(1, { damping: 5, stiffness: 320 })));
    },
    [sqx, sqy],
  );

  /** Starts a fresh round (a retry gets a new sequence so it can't be memorised). */
  const startRound = useCallback(() => {
    const rules = peakRules(getPeakLevel(level.current), useProfile.getState().mode, skill.current.psr);
    const round = buildRound(rng, rules, prevSignature.current);
    prevSignature.current = round.signature;
    notes.prepare(TONES);
    game.current = {
      round,
      run: new PeakRun(round),
      startAt: performance.now() + LEAD_IN_MS,
      phase: 'play',
      stepIdx: 0,
      press: [0, 0, 0],
      good: [0, 0, 0],
      bad: [0, 0, 0],
      red: new Array<number>(PEAK_COUNT).fill(0),
      shieldUsed: false,
    };
    notes.beat('tick', 0.5);
    playLuna('idle');
  }, [rng, playLuna]);

  const newLevel = useCallback(
    (targetLvl?: number) => {
      const lvl = targetLvl ?? level.current;
      level.current = lvl;
      setCurrentLevel(lvl);
      setSplashTrigger((k) => k + 1);
      epoch.current += 1;
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
      const m = useProfile.getState().mode;
      heartsLeft.current = HEARTS;
      setHearts(HEARTS);
      shield.current = m === 'ARCADE' && useProfile.getState().shields > 0;
      setShieldArmed(shield.current);
      game.current = null;
      playLuna('pop');
      later(() => startRound(), 1400);
    },
    [later, startRound, playLuna],
  );

  useEffect(() => {
    const start = setTimeout(() => newLevel(level.current), 0);
    return () => {
      clearTimeout(start);
      epoch.current += 1;
      timeouts.current.forEach(clearTimeout);
    };
  }, [mode, daily, newLevel]);

  useEffect(() => () => notes.release(), []);

  // ---- outcomes -----------------------------------------------------------
  const levelClear = useCallback(
    (s: RoundState) => {
      const lvl = level.current;
      const cfg = getPeakLevel(lvl);
      const run = s.run;
      const k = useProfile.getState().mode === 'SANCTUARY' ? 0.35 : 1;
      const profile = useProfile.getState();
      const isFirstClear = lvl > profile.peaksLevel;
      const tier = run.score >= 0.95 ? 2 : run.score >= 0.8 ? 1 : 0;
      profile.setPeaksLevel(lvl);
      profile.awardXp(35 + lvl * 8 + tier * 15);
      useEconomy.getState().earnStardust(Math.round(cfg.stardustReward * (1 + tier * 0.5)) + (isFirstClear ? cfg.firstClearBonus : 0));
      useSeasonPass.getState().addSeasonXp(20 + lvl * 2);
      const ach = useAchievements.getState();
      ach.setMetricMax('peaks_level', lvl + 1);
      if (s.round.rules.n >= 4) ach.setMetricMax('peaks_n4', 1);
      if (daily && profile.completeDaily('peaks')) profile.awardXp(80);

      const j = juiceRef.current;
      playLuna('celebrate');
      squash(0.16);
      j.emit({ x: W / 2, y: H * 0.4, kind: ParticleKind.Confetti, count: (k < 1 ? 90 : 200) + tier * 60 });
      j.emit({ x: cx, y: lunaFeet - ch * 0.5, kind: ParticleKind.Ring, count: 3 + tier });
      j.doShake(10 * k, 400);
      j.doFlash(0.35 * k, 600);
      j.doBoost(1.5, 1200);
      sfx.play('chime', 1, 1.2);
      sfx.play('sparkle', 0.8);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      later(() => newLevel(Math.min(30, lvl + 1)), 3000);
    },
    [daily, W, H, cx, lunaFeet, ch, squash, playLuna, later, newLevel],
  );

  /** Round drained or finished below the bar: Arcade costs a heart, then a new round. */
  const roundLost = useCallback(
    (s: RoundState) => {
      const k = useProfile.getState().mode === 'SANCTUARY' ? 0.35 : 1;
      s.phase = 'result';
      playLuna('sad');
      squash(-0.12);
      sfx.play('sad', 0.7);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      juiceRef.current.doShake(9 * k, 380);
      if (s.round.rules.hearts) {
        heartsLeft.current -= 1;
        setHearts(heartsLeft.current);
        hurt.set(withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 500 })));
        if (heartsLeft.current <= 0) {
          sfx.play('sad', 0.9);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          juiceRef.current.doShake(14, 700);
          later(() => newLevel(level.current), 2600);
          return;
        }
      }
      later(() => startRound(), 2200);
    },
    [playLuna, squash, hurt, later, newLevel, startRound],
  );

  const roundEnded = useCallback(
    (s: RoundState) => {
      s.phase = 'result';
      const run = s.run;
      skill.current.record(run.passed(), 1000);
      skill.current.record(run.score >= 0.85, 1000);
      if (run.passed()) levelClear(s);
      else roundLost(s);
    },
    [levelClear, roundLost],
  );

  const onDrain = useCallback(
    (s: RoundState) => {
      if (shield.current && !s.shieldUsed) {
        s.shieldUsed = true;
        shield.current = false;
        setShieldArmed(false);
        useProfile.getState().spendShield();
        s.run.failed = false;
        s.run.battery = 0.5;
        sfx.play('chime', 0.6, 1.3);
        juiceRef.current.emit({ x: W - 42, y: HUD_Y + 50, kind: ParticleKind.Ring, count: 3 });
        return;
      }
      skill.current.record(false, 1000);
      roundLost(s);
    },
    [W, roundLost],
  );

  // ---- feedback ---------------------------------------------------------------
  const feedback = useCallback(
    (s: RoundState, ev: PeakEvent) => {
      const c = CHANNEL_ORDER.indexOf(ev.channel);
      const j = juiceRef.current;
      const step = s.round.steps[ev.step];
      const t = performance.now() - s.startAt;
      const [sx, sy] = starSpot(step.pos, s.round.drift * Math.max(0, t));
      const rects = buttonRects(s.round.rules.channels.length);
      const b = rects[s.round.rules.channels.indexOf(ev.channel)];
      if (ev.kind === 'miss') {
        s.bad[c] = 1;
        if (ev.channel === 'pos' && step.pos >= 0) s.red[step.pos] = 1;
        notes.beat('buzz', 0.3);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }
      if (ev.kind === 'false') {
        s.bad[c] = 1;
        notes.beat('buzz', 0.22);
        Haptics.selectionAsync();
        return;
      }
      s.good[c] = 1;
      sfx.play('chime', calm ? 0.45 : 0.6, 1 + Math.min(0.5, s.run.streak / 20));
      j.emit({ x: sx, y: sy, kind: ParticleKind.Sparkle, count: calm ? 8 : 16 });
      if (b) j.emit({ x: b.x, y: b.y, kind: ParticleKind.Ring, count: 1 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (luna.current.clip === 'idle') playLuna('pop');
      if (s.run.streak > 0 && s.run.streak % 8 === 0) {
        sfx.play('sparkle', 0.5, 1 + Math.min(0.6, s.run.streak / 60));
        j.doBoost(0.8, 500);
        squash(0.1);
      }
    },
    [starSpot, buttonRects, calm, playLuna, squash],
  );

  // ---- input --------------------------------------------------------------
  const touchDown = useCallback(
    (x: number, y: number) => {
      if (Math.hypot(x - (W - 42), y - HUD_Y) < 30) {
        requestCycle();
        sfx.play('sparkle', 0.5);
        Haptics.selectionAsync();
        juiceRef.current.emit({ x: W - 42, y: HUD_Y, kind: ParticleKind.Ring, count: 2 });
        return;
      }
      const s = game.current;
      if (!s || s.phase !== 'play') return;
      const channels = s.round.rules.channels;
      const rects = buttonRects(channels.length);
      const k = rects.findIndex((r) => Math.abs(x - r.x) <= r.w / 2 + 6 && Math.abs(y - r.y) <= r.h / 2 + 10);
      if (k < 0) return;
      const channel = channels[k];
      s.press[CHANNEL_ORDER.indexOf(channel)] = 1;
      const ev = s.run.tap(channel, performance.now() - s.startAt);
      if (ev) feedback(s, ev);
    },
    [W, requestCycle, buttonRects, feedback],
  );

  const touch = useManualGesture({
    runOnJS: true,
    onTouchesDown: (e) => e.changedTouches.forEach((t) => touchDown(t.x, t.y)),
  });

  // ---- loop ---------------------------------------------------------------
  const endRef = useRef(roundEnded);
  const drainRef = useRef(onDrain);
  const feedbackRef = useRef(feedback);
  useEffect(() => {
    endRef.current = roundEnded;
    drainRef.current = onDrain;
    feedbackRef.current = feedback;
  }, [roundEnded, onDrain, feedback]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const fps = lunaSheet.fps;
    const clipIndex = (c: LunaClip) => lunaSheet.order.indexOf(c);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      lunaY.set(Math.sin(now / 520) * 4);

      const l = luna.current;
      const meta = lunaSheet.clips[l.clip];
      const f = Math.floor(((now - l.t0) * fps) / 1000);
      if (meta.loop) {
        lunaClip.set(clipIndex(l.clip));
        lunaFrame.set(f % meta.frames);
      } else if (f >= meta.frames) {
        luna.current = { clip: 'idle', t0: now };
      } else {
        lunaClip.set(clipIndex(l.clip));
        lunaFrame.set(f);
      }

      const s = game.current;
      if (!s) {
        const peaks: number[] = [];
        for (let i = 0; i < PEAK_COUNT; i++) {
          const [x, y] = peakBase(i, 0);
          peaks.push(x, y, peakS, 0, 0);
        }
        peakSnap.set(peaks);
        starSnap.set([]);
        buttonSnap.set([]);
        lanternSnap.set([]);
        progress.set(0);
        showBattery.set(0);
        return;
      }

      const { round, run } = s;
      const { rules, steps } = round;
      const t = now - s.startAt;
      const rot = round.drift * Math.max(0, t);

      if (s.phase === 'play') {
        while (s.stepIdx < steps.length && steps[s.stepIdx].t <= t) {
          const st = steps[s.stepIdx];
          const tone = st.sound >= 0 ? st.sound : st.pos;
          if (tone >= 0) notes.play(TONES[tone], calm ? 0.6 : 0.8);
          s.stepIdx += 1;
        }
        for (const ev of run.update(t)) feedbackRef.current(s, ev);
        if (run.failed) drainRef.current(s);
        else if (run.done) endRef.current(s);
      }

      const cur = run.stepAt(t);
      const step = cur >= 0 ? steps[cur] : null;
      const age = step ? t - step.t : 0;

      // Peaks: the current star's peak glows, missed matches flash red.
      const peaks: number[] = [];
      for (let i = 0; i < PEAK_COUNT; i++) {
        const [x, y] = peakBase(i, rot);
        s.red[i] = Math.max(0, s.red[i] - (dt * 1000) / RED_MS);
        let glow = 0;
        if (step && step.pos === i && age < step.showMs) glow = Math.min(1, age / FALL_MS) * 0.8;
        peaks.push(x, y, peakS, glow, s.red[i]);
      }

      // Stars: the current one falls onto its peak; echo ghosts show the last n while the hint is on.
      const stars: number[] = [];
      const r = peakS * 0.3;
      if (step && s.phase === 'play') {
        const [x, y] = starSpot(step.pos, rot);
        const fall = Math.min(1, age / FALL_MS);
        const ease = 1 - (1 - fall) * (1 - fall);
        const a = age < step.showMs ? 1 : Math.max(0, 1 - (age - step.showMs) / 200);
        const pop = fall < 1 ? 0.7 + 0.3 * fall : 1 + 0.25 * Math.max(0, 1 - (age - FALL_MS) / 160);
        stars.push(x, y - (1 - ease) * 90, r * pop, a, step.color, 0, 0);
        if (cur < rules.hintSteps && step.pos >= 0) {
          for (let k = 1; k <= rules.n; k++) {
            const prev = steps[cur - k];
            if (!prev) break;
            const [gx, gy] = starSpot(prev.pos, rot);
            stars.push(gx, gy, r * 0.85, 0.55 * (1 - (k - 1) / (rules.n + 1)), prev.color, 1, k === rules.n ? 1 : 0);
          }
        }
      }

      // Lanterns: one per step back; the far one (n back) glows brightest.
      const lanterns: number[] = [];
      const hint = cur >= 0 && cur < rules.hintSteps;
      for (let k = rules.n; k >= 1; k--) {
        const x = cx + (rules.n - k - (rules.n - 1) / 2) * 34;
        const prev = cur >= 0 ? steps[cur - k] : undefined;
        const colour = hint && prev && rules.channels.includes('sound') ? prev.sound : -1;
        const beat = step ? Math.max(0, 1 - age / 300) : 0;
        lanterns.push(x, lanternY, colour, (k === rules.n ? 0.8 : 0.25) + beat * 0.2);
      }

      // Buttons.
      const buttons: number[] = [];
      const rects = buttonRects(rules.channels.length);
      rules.channels.forEach((chn, k) => {
        const c = CHANNEL_ORDER.indexOf(chn);
        s.press[c] = Math.max(0, s.press[c] - dt * 6);
        s.good[c] = Math.max(0, s.good[c] - dt * 2.5);
        s.bad[c] = Math.max(0, s.bad[c] - dt * 3);
        const b = rects[k];
        buttons.push(b.x, b.y, b.w, b.h, c, s.press[c], s.good[c], s.bad[c]);
      });

      peakSnap.set(peaks);
      starSnap.set(stars);
      lanternSnap.set(lanterns);
      buttonSnap.set(buttons);
      glowK.set(Math.min(1, run.streak / 12));
      battery.set(run.battery);
      showBattery.set(rules.canFail ? 1 : 0);
      danger.set(rules.canFail && run.battery < 0.3 ? 1 : 0);
      progress.set(Math.max(0, Math.min(1, t / round.endMs)));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lunaSheet, peakBase, starSpot, buttonRects, peakS, cx, lanternY, calm, peakSnap, starSnap, lanternSnap, buttonSnap, glowK, battery, showBattery, danger, progress, lunaClip, lunaFrame, lunaY]);

  // ---- render values ------------------------------------------------------
  const skyPicture = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawSky(c, W, H, juice.time.value);
    drawPeaks(c, cx, cy, ringR, peakSnap.value, [], juice.time.value);
    return rec.finishRecordingAsPicture();
  });
  const frontPicture = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawPeaks(c, cx, cy, ringR, [], starSnap.value, juice.time.value);
    drawLanterns(c, lanternSnap.value, 12, juice.time.value);
    drawButtons(c, buttonSnap.value, juice.time.value);
    if (showBattery.value > 0) drawBattery(c, 14, H * 0.36, H * 0.26, battery.value, danger.value > 0, juice.time.value);
    return rec.finishRecordingAsPicture();
  });
  const pw = (ch * lunaSheet.frameWidth) / lunaSheet.frameHeight;
  const lunaTransform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: lunaY.value },
    { scaleX: sqx.value },
    { scaleY: sqy.value },
  ]);
  const auraR = useDerivedValue(() => ch * (0.35 + glowK.value * 0.35));
  const auraOpacity = useDerivedValue(() => 0.15 + glowK.value * 0.55);
  const progressWidth = useDerivedValue(() => W * 0.42 * progress.value);
  const hurtTint = useDerivedValue(() => hurt.value * 0.35);

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
      <LevelSplash level={currentLevel} gameTitle="ECHO PEAKS" worldName={worldDef.id.replace('_', ' ')} triggerKey={splashTrigger} />
      <GestureDetector gesture={touch}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={juice.worldTransform}>
            <WorldBackdrop W={W} H={H} still={worldDef.still} time={juice.time} boost={juice.boost} light={{ x: 0.5, y: 0.05 }} />
            <Rect x={0} y={0} width={W} height={H} color="rgba(10,6,36,0.5)" />
            <Picture picture={juice.back} />
            <Picture picture={skyPicture} />

            {/* Luna, the host, in the middle of the ring with a streak aura */}
            <Circle cx={cx} cy={lunaFeet - ch * 0.5} r={auraR} color="#C7A8FF" opacity={auraOpacity}>
              <BlurMask blur={24} style="normal" />
            </Circle>
            <Oval x={cx - pw * 0.28} y={lunaFeet - ch * 0.04} width={pw * 0.56} height={ch * 0.08} color="rgba(0,0,20,0.45)">
              <BlurMask blur={9} style="normal" />
            </Oval>
            <Group transform={lunaTransform} origin={vec(0, lunaFeet)}>
              <SpriteCharacter sheet={lunaSheet} images={lunaImages} clip={lunaClip} frame={lunaFrame} x={-pw / 2} y={lunaFeet - ch} height={ch} />
            </Group>

            <Picture picture={frontPicture} />
            <Picture picture={juice.front} />
          </Group>

          {/* HUD: round progress, hearts (Arcade), mode. Icons only. */}
          <RoundedRect x={W * 0.29} y={HUD_Y - 4} width={W * 0.42} height={8} r={4} color="rgba(255,255,255,0.18)" />
          <RoundedRect x={W * 0.29} y={HUD_Y - 4} width={progressWidth} height={8} r={4} color="#C7A8FF" />
          {mode === 'ARCADE' &&
            Array.from({ length: HEARTS }).map((_, i) => (
              <Group key={`h${i}`} transform={[{ translateX: W / 2 + (i - (HEARTS - 1) / 2) * 28 }, { translateY: HUD_Y + 28 }]}>
                <Path path={heart} color={i < hearts ? '#FF5C8A' : 'rgba(255,255,255,0.25)'} />
              </Group>
            ))}
          <Circle cx={W - 42} cy={HUD_Y} r={24} color="rgba(26,15,61,0.6)" />
          <ModeIcon mode={mode} x={W - 42} y={HUD_Y} />
          {mode === 'ARCADE' && <ShieldIcon x={W - 42} y={HUD_Y + 50} armed={shieldArmed} />}

          <Rect x={0} y={0} width={W} height={H}>
            <RadialGradient c={vec(W / 2, H * 0.5)} r={Math.max(W, H) * 0.75} colors={['rgba(0,0,0,0)', 'rgba(6,2,28,0.5)']} positions={[0.55, 1]} />
          </Rect>
          <Rect x={0} y={0} width={W} height={H} color="#FF2D55" opacity={hurtTint} />
          <Rect x={0} y={0} width={W} height={H} color="white" opacity={juice.flash} blendMode="plus" />
          {!lunaImages[0] && <Rect x={0} y={0} width={W} height={H} color="#05010F" opacity={0.85} />}
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
});
