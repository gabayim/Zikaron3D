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
import { getBeatLevel } from '../../engine/levelTables';
import { useProfile } from '../../store/profile';
import { getWorld, type WorldId } from '../../worlds';
import { ModeIcon } from '../../ui/ModeIcon';
import { ParentalGate } from '../../ui/ParentalGate';
import { ShieldIcon } from '../../ui/ShieldIcon';
import { useParentalModeCycle } from '../../ui/useParentalModeCycle';
import { LevelSplash } from '../../ui/LevelSplash';
import { drawBattery, drawBoard, drawLanes, LANE_COLORS } from './draw';
import { generateMelody, pickMelody } from './melodies';
import { BeatRun, buildChart, COUNT_IN, beatRules, laneAtSlot, laneSlot, OffsetTracker, TRAVEL_BEATS, type Chart, type JudgeEvent } from './logic';

const HUD_Y = 78;
const HEARTS = 3;
const BOLT_CLIPS = ['idle', 'pop', 'celebrate', 'sad', 'dance'] as const;
const MISS_MS = 450;

type BoltClip = (typeof BOLT_CLIPS)[number];
type Phase = 'play' | 'result';

interface SongState {
  chart: Chart;
  run: BeatRun;
  startAt: number;
  phase: Phase;
  beatIdx: number;
  hatIdx: number;
  autoIdx: number;
  flash: number[];
  press: number[];
  misses: { lane: number; t0: number }[];
  touches: Map<number, number>;
  chord: Set<number>;
  travelMs: number;
  shieldUsed: boolean;
}

export default function BeatCircuit({
  daily = false,
  startLevel = 1,
  worldId = 'circuit',
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
  // Juice is a new object every render; a ref keeps the level/song callbacks stable.
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
  const ch = Math.min(W * 0.28, H * 0.16);
  const boltFeet = H * 0.25;
  const topY = H * 0.3;
  const padY = H * 0.82;
  const laneX = useCallback(
    (slot: number, lanes: number, p: number) => {
      const slotW = (W * 0.84) / lanes;
      const pad = W * 0.08 + (slot + 0.5) * slotW;
      const top = W / 2 + (pad - W / 2) * 0.4;
      return top + (pad - top) * p;
    },
    [W],
  );
  const padRFor = useCallback((lanes: number) => Math.min(((W * 0.84) / lanes) * 0.36, 34), [W]);

  // ---- Bolt -----------------------------------------------------------------
  const boltSheet = CAST.bolt;
  const boltImages = useClipImages(boltSheet, BOLT_CLIPS);
  const boltClip = useSharedValue(0);
  const boltFrame = useSharedValue(0);
  const bolt = useRef<{ clip: BoltClip; t0: number }>({ clip: 'idle', t0: 0 });
  const playBolt = useCallback((clip: BoltClip) => {
    bolt.current = { clip, t0: performance.now() };
  }, []);

  // ---- shared render state ------------------------------------------------
  const laneSnap = useSharedValue<number[]>([]);
  const pulseSnap = useSharedValue<number[]>([]);
  const missSnap = useSharedValue<number[]>([]);
  const geom = useSharedValue<[number, number]>([padRFor(3), 3]);
  const power = useSharedValue(0);
  const battery = useSharedValue(0.7);
  const danger = useSharedValue(0);
  const progress = useSharedValue(0);
  const boltY = useSharedValue(0);
  const sqx = useSharedValue(1);
  const sqy = useSharedValue(1);
  const hurt = useSharedValue(0);

  // ---- game state ---------------------------------------------------------
  const skill = useRef(new SkillTracker());
  const tracker = useRef(new OffsetTracker());
  const [rng] = useState(() => new SeededRNG(daily ? `beats-${dailyKey()}` : `${Date.now()}`));
  const song = useRef<SongState | null>(null);
  const heartsLeft = useRef(HEARTS);
  const shield = useRef(false);
  const prevSignature = useRef<string | undefined>(undefined);
  const prevMelody = useRef<string | undefined>(undefined);
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

  /** Starts a song: a fresh chart, or the same chart again after a failed attempt. */
  const startSong = useCallback(
    (fresh: boolean) => {
      let chart = song.current?.chart;
      if (fresh || !chart) {
        const rules = beatRules(getBeatLevel(level.current), useProfile.getState().mode, skill.current.psr);
        const eighths = rules.mechanics.includes('eighths');
        const melody = pickMelody(level.current, rng, eighths, prevMelody.current);
        chart = buildChart(rng, rules, melody, () => generateMelody(rng, { eighths, id: `fb${rng.nextInt(0, 1e9)}` }), prevSignature.current);
        prevSignature.current = chart.signature;
        prevMelody.current = chart.melodyId;
      }
      notes.prepare(new Set(chart.notes.map((n) => n.midi)));
      const live = chart.notes.filter((n) => !n.auto);
      const chord = new Set<number>();
      for (const n of live) if (live.some((m) => m.id !== n.id && Math.abs(m.t - n.t) < 1)) chord.add(n.id);
      const lanes = chart.rules.lanes;
      geom.set([padRFor(lanes), lanes]);
      song.current = {
        chart,
        run: new BeatRun(chart, tracker.current),
        startAt: performance.now() + 250,
        phase: 'play',
        beatIdx: 0,
        hatIdx: COUNT_IN,
        autoIdx: 0,
        flash: new Array<number>(lanes).fill(0),
        press: new Array<number>(lanes).fill(0),
        misses: [],
        touches: new Map(),
        chord,
        travelMs: (60000 / chart.rules.bpm) * TRAVEL_BEATS,
        shieldUsed: false,
      };
      playBolt('dance');
    },
    [rng, geom, padRFor, playBolt],
  );

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
      song.current = null;
      playBolt('pop');
      later(() => startSong(true), 1300);
    },
    [later, startSong, playBolt],
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
    (s: SongState) => {
      const lvl = level.current;
      const cfg = getBeatLevel(lvl);
      const run = s.run;
      const k = useProfile.getState().mode === 'SANCTUARY' ? 0.35 : 1;
      const profile = useProfile.getState();
      const isFirstClear = lvl > profile.beatsLevel;
      const tier = run.accuracy >= 0.95 ? 2 : run.accuracy >= 0.85 ? 1 : 0;
      profile.setBeatsLevel(lvl);
      profile.awardXp(35 + lvl * 8 + tier * 15);
      useEconomy.getState().earnStardust(Math.round(cfg.stardustReward * (1 + tier * 0.5)) + (isFirstClear ? cfg.firstClearBonus : 0));
      useSeasonPass.getState().addSeasonXp(20 + lvl * 2);
      const ach = useAchievements.getState();
      ach.setMetricMax('beats_level', lvl + 1);
      if (run.miss === 0) ach.incrementMetric('beats_fullcombo', 1);
      if (daily && profile.completeDaily('beats')) profile.awardXp(80);

      const j = juiceRef.current;
      playBolt('celebrate');
      squash(0.16);
      j.emit({ x: W / 2, y: H * 0.4, kind: ParticleKind.Confetti, count: (k < 1 ? 90 : 200) + tier * 60 });
      j.emit({ x: W / 2, y: boltFeet - ch * 0.4, kind: ParticleKind.Ring, count: 3 + tier });
      j.doShake(10 * k, 400);
      j.doFlash(0.35 * k, 600);
      j.doBoost(1.5, 1200);
      sfx.play('chime', 1, 1.2);
      sfx.play('sparkle', 0.8);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      later(() => newLevel(Math.min(30, lvl + 1)), 3000);
    },
    [daily, W, H, boltFeet, ch, squash, playBolt, later, newLevel],
  );

  /** Song failed or finished below the bar: Arcade costs a heart, then the same chart plays again. */
  const songLost = useCallback(
    (s: SongState) => {
      const k = useProfile.getState().mode === 'SANCTUARY' ? 0.35 : 1;
      s.phase = 'result';
      playBolt('sad');
      squash(-0.12);
      sfx.play('sad', 0.7);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      juiceRef.current.doShake(9 * k, 380);
      if (s.chart.rules.hearts) {
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
      later(() => startSong(false), 2000);
    },
    [playBolt, squash, hurt, later, newLevel, startSong],
  );

  const songEnded = useCallback(
    (s: SongState) => {
      s.phase = 'result';
      const run = s.run;
      skill.current.record(run.passed(), 1000);
      skill.current.record(run.accuracy >= 0.9, 1000);
      if (run.passed()) levelClear(s);
      else songLost(s);
    },
    [levelClear, songLost],
  );

  const onDrain = useCallback(
    (s: SongState) => {
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
      songLost(s);
    },
    [W, songLost],
  );

  // ---- feedback ---------------------------------------------------------------
  const feedback = useCallback(
    (s: SongState, ev: JudgeEvent, t: number) => {
      const lanes = s.chart.rules.lanes;
      const slot = laneSlot(s.chart, ev.note.lane, t);
      const x = laneX(slot, lanes, 1);
      const j = juiceRef.current;
      if (ev.kind === 'miss') {
        s.misses.push({ lane: ev.note.lane, t0: performance.now() });
        notes.beat('buzz', 0.35);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }
      if (ev.tail) {
        j.emit({ x, y: padY, kind: ParticleKind.Sparkle, count: 10 });
        return;
      }
      s.flash[ev.note.lane] = 1;
      if (ev.kind === 'perfect') {
        j.emit({ x, y: padY, kind: ParticleKind.Sparkle, count: calm ? 8 : 16 });
        j.emit({ x, y: padY, kind: ParticleKind.Ring, count: 1 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        j.emit({ x, y: padY, kind: ParticleKind.Sparkle, count: 6 });
        Haptics.selectionAsync();
      }
      const combo = s.run.combo;
      if (combo > 0 && combo % 16 === 0) {
        sfx.play('sparkle', 0.5, 1 + Math.min(0.6, combo / 160));
        j.doBoost(0.8, 500);
        squash(0.1);
      }
    },
    [laneX, padY, calm, squash],
  );

  // ---- input --------------------------------------------------------------
  const touchDown = useCallback(
    (id: number, x: number, y: number) => {
      if (Math.hypot(x - (W - 42), y - HUD_Y) < 30) {
        requestCycle();
        sfx.play('sparkle', 0.5);
        Haptics.selectionAsync();
        juiceRef.current.emit({ x: W - 42, y: HUD_Y, kind: ParticleKind.Ring, count: 2 });
        return;
      }
      const s = song.current;
      if (!s || s.phase !== 'play' || y < topY) return;
      const lanes = s.chart.rules.lanes;
      const t = performance.now() - s.startAt;
      const slot = Math.max(0, Math.min(lanes - 1, Math.floor((x - W * 0.08) / ((W * 0.84) / lanes))));
      const lane = laneAtSlot(s.chart, slot, t);
      s.touches.set(id, lane);
      s.press[lane] = 1;
      const ev = s.run.press(lane, t);
      if (!ev) return;
      notes.play(ev.note.midi, 0.9);
      feedback(s, ev, t);
    },
    [W, topY, requestCycle, feedback],
  );

  const touchUp = useCallback(
    (id: number) => {
      const s = song.current;
      if (!s) return;
      const lane = s.touches.get(id);
      if (lane === undefined) return;
      s.touches.delete(id);
      if ([...s.touches.values()].includes(lane)) return;
      s.press[lane] = 0;
      if (s.phase !== 'play') return;
      const ev = s.run.release(lane, performance.now() - s.startAt);
      if (ev) feedback(s, ev, performance.now() - s.startAt);
    },
    [feedback],
  );

  const touch = useManualGesture({
    runOnJS: true,
    onTouchesDown: (e) => e.changedTouches.forEach((t) => touchDown(t.id, t.x, t.y)),
    onTouchesUp: (e) => e.changedTouches.forEach((t) => touchUp(t.id)),
    onTouchesCancel: (e) => e.changedTouches.forEach((t) => touchUp(t.id)),
  });

  // ---- loop ---------------------------------------------------------------
  const endRef = useRef(songEnded);
  const drainRef = useRef(onDrain);
  const feedbackRef = useRef(feedback);
  useEffect(() => {
    endRef.current = songEnded;
    drainRef.current = onDrain;
    feedbackRef.current = feedback;
  }, [songEnded, onDrain, feedback]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const fps = boltSheet.fps;
    const clipIndex = (c: BoltClip) => boltSheet.order.indexOf(c);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      boltY.set(Math.sin(now / 460) * 3);
      const s = song.current;

      // Beat position for Bolt's dance (one dance cycle per 4 beats).
      let beatFloat = now / 600;
      if (s) {
        const t = now - s.startAt;
        const bt = s.chart.beatTimes;
        let i = 0;
        while (i + 1 < bt.length && bt[i + 1] <= t) i++;
        const span = (bt[i + 1] ?? bt[i] + 600) - bt[i];
        beatFloat = i + Math.max(0, Math.min(1, (t - bt[i]) / span));
      }
      const b = bolt.current;
      const meta = boltSheet.clips[b.clip];
      if (b.clip === 'dance') {
        boltClip.set(clipIndex('dance'));
        boltFrame.set(Math.floor((((beatFloat % 4) + 4) % 4) / 4 * meta.frames) % meta.frames);
      } else {
        const f = Math.floor(((now - b.t0) * fps) / 1000);
        if (meta.loop) {
          boltClip.set(clipIndex(b.clip));
          boltFrame.set(f % meta.frames);
        } else if (f >= meta.frames) {
          bolt.current = { clip: s && s.phase === 'play' ? 'dance' : 'idle', t0: now };
        } else {
          boltClip.set(clipIndex(b.clip));
          boltFrame.set(f);
        }
      }

      if (!s) {
        const lanes: number[] = [];
        for (let l = 0; l < 3; l++) lanes.push(laneX(l, 3, 0), laneX(l, 3, 1), 0, 0, l);
        laneSnap.set(lanes);
        pulseSnap.set([]);
        missSnap.set([]);
        progress.set(0);
        return;
      }

      const { chart, run } = s;
      const lanes = chart.rules.lanes;
      const t = now - s.startAt;
      const calmK = calm ? 0.6 : 1;

      if (s.phase === 'play') {
        // Beat bed: count-in ticks, then kick on the beat and hat off the beat.
        const bt = chart.beatTimes;
        while (s.beatIdx < bt.length - 1 && bt[s.beatIdx] <= t) {
          if (s.beatIdx < COUNT_IN) {
            notes.beat('tick', 0.55);
            sqy.set(withSequence(withTiming(0.94, { duration: 50 }), withSpring(1, { damping: 6, stiffness: 300 })));
          } else {
            notes.beat('kick', 0.5 * calmK);
            for (let l = 0; l < lanes; l++) s.flash[l] = Math.max(s.flash[l], 0.18);
          }
          s.beatIdx += 1;
        }
        while (s.hatIdx < bt.length - 1 && (bt[s.hatIdx] + bt[s.hatIdx + 1]) / 2 <= t) {
          notes.beat('hat', 0.3 * calmK);
          s.hatIdx += 1;
        }
        // Bolt plays the notes you don't (and calls the echo phrases).
        const list = chart.notes;
        while (s.autoIdx < list.length && list[s.autoIdx].t <= t) {
          const n = list[s.autoIdx];
          if (n.auto) {
            notes.play(n.midi, n.call ? 0.8 : 0.5);
            if (n.call) s.flash[n.lane] = 1;
          }
          s.autoIdx += 1;
        }
        for (const ev of run.update(t)) feedbackRef.current(s, ev, t);
        if (run.failed) drainRef.current(s);
        else if (t > chart.endMs) endRef.current(s);
      }

      // Lanes.
      const laneOut: number[] = [];
      for (let l = 0; l < lanes; l++) {
        const slot = laneSlot(chart, l, t);
        s.flash[l] = Math.max(0, s.flash[l] - dt * 3.2);
        laneOut.push(laneX(slot, lanes, 0), laneX(slot, lanes, 1), s.flash[l], s.press[l], l);
      }

      // Pulses.
      const pulses: number[] = [];
      const padR = padRFor(lanes);
      const { goodMs } = chart.rules;
      for (const n of chart.notes) {
        if (n.auto) continue;
        const st = run.state[n.id];
        if (st === 2) continue;
        const ahead = n.t - t;
        if (ahead > s.travelMs) break;
        let p = 1 - ahead / s.travelMs;
        let a = 1;
        if (st === 3) {
          a = 1 - (t - n.t - goodMs) / 220;
          if (a <= 0) continue;
          a *= 0.5;
        }
        if (st === 1) p = 1;
        if (n.ghost && st === 0) a *= Math.max(0, Math.min(1, 1 - (p - 0.45) / 0.15));
        if (n.late && st === 0) a *= Math.max(0, Math.min(1, (p - 0.55) / 0.1));
        const slot = laneSlot(chart, n.lane, t);
        const x = laneX(slot, lanes, Math.min(1.1, p));
        const y = topY + (padY - topY) * Math.min(1.1, p);
        const r = padR * 0.42 * (0.55 + 0.45 * Math.min(1, p));
        let tx = -1;
        let ty = -1;
        if (n.holdEnd) {
          const pe = Math.max(0, Math.min(1, 1 - (n.holdEnd - t) / s.travelMs));
          tx = laneX(slot, lanes, pe);
          ty = topY + (padY - topY) * pe;
        }
        pulses.push(x, y, r, a, n.lane, tx, ty, st === 1 ? 1 : 0, s.chord.has(n.id) ? 1 : 0);
      }

      const missOut: number[] = [];
      s.misses = s.misses.filter((m) => now - m.t0 < MISS_MS);
      for (const m of s.misses) missOut.push(laneX(laneSlot(chart, m.lane, t), lanes, 1), padY, (now - m.t0) / MISS_MS);

      laneSnap.set(laneOut);
      pulseSnap.set(pulses);
      missSnap.set(missOut);
      power.set(Math.min(1, run.combo / 24));
      battery.set(run.battery);
      danger.set(chart.rules.canFail && run.battery < 0.3 ? 1 : 0);
      progress.set(Math.max(0, Math.min(1, t / chart.endMs)));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [boltSheet, laneX, padRFor, topY, padY, calm, laneSnap, pulseSnap, missSnap, power, battery, danger, progress, boltClip, boltFrame, boltY, sqy]);

  // ---- render values ------------------------------------------------------
  const boardPicture = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawBoard(c, W, H, power.value, juice.time.value);
    drawLanes(c, laneSnap.value, pulseSnap.value, missSnap.value, topY, padY, geom.value[0], juice.time.value);
    drawBattery(c, 14, H * 0.4, H * 0.28, battery.value, danger.value > 0, juice.time.value);
    return rec.finishRecordingAsPicture();
  });
  const pw = (ch * boltSheet.frameWidth) / boltSheet.frameHeight;
  const boltTransform = useDerivedValue(() => [
    { translateX: W / 2 },
    { translateY: boltY.value },
    { scaleX: sqx.value },
    { scaleY: sqy.value },
  ]);
  const auraR = useDerivedValue(() => ch * (0.35 + power.value * 0.35));
  const auraOpacity = useDerivedValue(() => 0.15 + power.value * 0.6);
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
      <LevelSplash level={currentLevel} gameTitle="BEAT CIRCUIT" worldName={worldDef.id.replace('_', ' ')} triggerKey={splashTrigger} />
      <GestureDetector gesture={touch}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={juice.worldTransform}>
            <WorldBackdrop W={W} H={H} still={worldDef.still} time={juice.time} boost={juice.boost} light={{ x: 0.5, y: 0.05 }} />
            <Rect x={0} y={0} width={W} height={H} color="rgba(4,6,24,0.45)" />
            <Picture picture={juice.back} />

            {/* Bolt, the host, with a combo aura */}
            <Circle cx={W / 2} cy={boltFeet - ch * 0.45} r={auraR} color={LANE_COLORS[0]} opacity={auraOpacity}>
              <BlurMask blur={24} style="normal" />
            </Circle>
            <Oval x={W / 2 - pw * 0.28} y={boltFeet - ch * 0.04} width={pw * 0.56} height={ch * 0.08} color="rgba(0,0,20,0.5)">
              <BlurMask blur={9} style="normal" />
            </Oval>
            <Group transform={boltTransform} origin={vec(0, boltFeet)}>
              <SpriteCharacter sheet={boltSheet} images={boltImages} clip={boltClip} frame={boltFrame} x={-pw / 2} y={boltFeet - ch} height={ch} />
            </Group>

            <Picture picture={boardPicture} />
            <Picture picture={juice.front} />
          </Group>

          {/* HUD: song progress, hearts (Arcade), mode. Icons only. */}
          <RoundedRect x={W * 0.29} y={HUD_Y - 4} width={W * 0.42} height={8} r={4} color="rgba(255,255,255,0.18)" />
          <RoundedRect x={W * 0.29} y={HUD_Y - 4} width={progressWidth} height={8} r={4} color="#00F0FF" />
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
            <RadialGradient c={vec(W / 2, H * 0.55)} r={Math.max(W, H) * 0.75} colors={['rgba(0,0,0,0)', 'rgba(0,4,24,0.5)']} positions={[0.55, 1]} />
          </Rect>
          <Rect x={0} y={0} width={W} height={H} color="#FF2D55" opacity={hurtTint} />
          <Rect x={0} y={0} width={W} height={H} color="white" opacity={juice.flash} blendMode="plus" />
          {!boltImages[0] && <Rect x={0} y={0} width={W} height={H} color="#05010F" opacity={0.85} />}
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
});