import { useAchievements } from '../../store/achievements';
import { useEconomy } from '../../store/economy';
import { useSeasonPass } from '../../store/seasonPass';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Atlas,
  BlurMask,
  Canvas,
  Circle,
  FilterMode,
  Group,
  MipmapMode,
  Oval,
  Path,
  Picture,
  RadialGradient,
  Rect,
  RoundedRect,
  Skia,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { CAST } from '../../render/castRegistry';
import { ParticleKind } from '../../render/particles';
import { WorldBackdrop } from '../../render/WorldBackdrop';
import { SpriteCharacter, useClipImages, useSpritePlayer } from '../../render/SpriteCharacter';
import type { CharacterSheet } from '../../render/sprites';
import { sfx, useMusic } from '../../fx/sound';
import { useJuice } from '../../fx/useJuice';
import { SeededRNG } from '../../engine/SeededRNG';
import { dailyKey } from '../../engine/daily';
import { SkillTracker } from '../../engine/dda';
import { getShellLevel } from '../../engine/levelTables';
import { useProfile } from '../../store/profile';
import { getWorld, type WorldId } from '../../worlds';
import { ModeIcon } from '../../ui/ModeIcon';
import { ParentalGate } from '../../ui/ParentalGate';
import { ShieldIcon } from '../../ui/ShieldIcon';
import { useParentalModeCycle } from '../../ui/useParentalModeCycle';
import { LevelSplash } from '../../ui/LevelSplash';
import { BUBBLE, drawInk, drawItems, HINT, PEARL, URCHIN } from './draw';
import { buildRound, inkAt, posesAt, shellRules, ShellPicker, slotCell, type ShellRound, type ShellRules } from './logic';

const HUD_Y = 78;
const HEARTS = 3;
const MAX_CLAMS = 6;
/** Snapshot layout per clam: [frameLeft, frameTop, scale, clipIndex, frame]. */
const CLAM_STRIDE = 5;
const CLAM_CLIPS = ['idle', 'pop', 'sad'] as const;
const CORAL_CLIPS = ['idle', 'pop', 'celebrate', 'sad'] as const;
/** Closed clam body in the clam's logical frame; the idle cell is taller because of its rising bubbles. */
const BODY = { x: 22, y: 85, w: 212, h: 175 };
/** Where a pearl rests in the open bottom shell (logical frame y). */
const BOWL_Y = 218;
const DROP_MS = 450;
const RESULT_MS = 1700;

type ClamClip = (typeof CLAM_CLIPS)[number];
type Phase = 'intro' | 'preview' | 'closing' | 'shuffle' | 'pick' | 'result';

interface ClamAnim {
  clip: ClamClip;
  t0: number;
  reverse: boolean;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  age: number;
}

interface Geo {
  slotW: number;
  x0: number;
  feet0: number;
  unitY: number;
  scale: number;
}

interface RoundState {
  rules: ShellRules;
  round: ShellRound;
  picker: ShellPicker;
  phase: Phase;
  phaseAt: number;
  shuffleT: number;
  moveIdx: number;
  anims: ClamAnim[];
  hintSlots: number[];
  hintUntil: number;
  geo: Geo;
}

/** One clam on the reef. Each clam has its own atlas so it can play a different clip than its neighbours. */
function ClamSprite({ sheet, images, snap, index }: { sheet: CharacterSheet; images: (SkImage | null)[]; snap: SharedValue<number[]>; index: number }) {
  const meta = sheet.order.map((n) => sheet.clips[n]);
  const o = index * CLAM_STRIDE;
  const active = useDerivedValue(() => {
    const c = snap.value[o + 3] ?? 0;
    return images[c] ? c : 0;
  });
  const image = useDerivedValue(() => images[active.value] ?? null);
  const sprites = useDerivedValue(() => {
    const m = meta[active.value];
    const f = Math.max(0, Math.min(snap.value[o + 4] ?? 0, m.frames - 1));
    return [Skia.XYWHRect((f % m.cols) * m.w, Math.floor(f / m.cols) * m.h, m.w, m.h)];
  });
  const transforms = useDerivedValue(() => {
    const m = meta[active.value];
    const s = snap.value[o + 2] ?? 0;
    return [Skia.RSXform(s, 0, (snap.value[o] ?? 0) + m.x * s, (snap.value[o + 1] ?? 0) + m.y * s)];
  });
  return <Atlas image={image} sprites={sprites} transforms={transforms} sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.None }} />;
}

export default function ShellShuffle({
  daily = false,
  startLevel = 1,
  worldId = 'deep_sea',
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
  useMusic(worldDef.music, calm ? 0.3 : 0.42);
  const juice = useJuice(W, H, 16);

  // ---- level progression --------------------------------------------------
  const level = useRef(startLevel);
  const [currentLevel, setCurrentLevel] = useState(startLevel);
  const [splashTrigger, setSplashTrigger] = useState(0);
  const [roundsWon, setRoundsWon] = useState(0);
  const [roundsNeeded, setRoundsNeeded] = useState(getShellLevel(startLevel).rounds);
  const [hearts, setHearts] = useState(HEARTS);
  const [shieldArmed, setShieldArmed] = useState(false);

  // ---- characters ---------------------------------------------------------
  const clamSheet = CAST.clam;
  const clamImages = useClipImages(clamSheet, CLAM_CLIPS);
  const coralSheet = CAST.coral;
  const coralImages = useClipImages(coralSheet, CORAL_CLIPS);
  const coral = useSpritePlayer(coralSheet);
  // The player object is new every render; a ref keeps the level/round callbacks stable.
  const coralRef = useRef(coral);
  useEffect(() => {
    coralRef.current = coral;
  }, [coral]);
  const ch = Math.min(W * 0.32, H * 0.2);
  const coralFeet = H * 0.4;

  // ---- shared render state ------------------------------------------------
  const clamSnap = useSharedValue<number[]>([]);
  const itemSnap = useSharedValue<number[]>([]);
  const ink = useSharedValue(0);
  const inkBand = useSharedValue<[number, number]>([H * 0.5, H * 0.85]);
  const timer = useSharedValue(0);
  const coralY = useSharedValue(0);
  const sqx = useSharedValue(1);
  const sqy = useSharedValue(1);
  const hurt = useSharedValue(0);

  // ---- game state ---------------------------------------------------------
  const skill = useRef(new SkillTracker());
  const [rng] = useState(() => new SeededRNG(daily ? `shells-${dailyKey()}` : `${Date.now()}`));
  const st = useRef<RoundState | null>(null);
  const won = useRef(0);
  const heartsLeft = useRef(HEARTS);
  const shield = useRef(false);
  const streak = useRef(0);
  const prevSignature = useRef<string | undefined>(undefined);
  const bubbles = useRef<Bubble[]>([]);
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

  const geoFor = useCallback(
    (round: ShellRound): Geo => {
      const slotW = (W * 0.92) / round.cols;
      const feet0 = round.rows === 1 ? H * 0.72 : H * 0.62;
      const unitY = round.rows === 1 ? slotW * 0.9 : H * 0.18;
      const maxH = round.rows === 1 ? H * 0.15 : H * 0.12;
      const scale = Math.min((slotW * 0.84) / BODY.w, maxH / BODY.h);
      return { slotW, x0: W * 0.04 + slotW / 2, feet0, unitY, scale };
    },
    [W, H],
  );

  /** Screen placement of a clam pose: centre x, feet y, sprite scale. */
  const place = useCallback(
    (geo: Geo, x: number, y: number, lift: number) => {
      const s = geo.scale * (1 + 0.12 * lift);
      const cx = geo.x0 + x * geo.slotW;
      const feet = geo.feet0 + y * geo.unitY;
      const left = cx - (BODY.x + BODY.w / 2) * s;
      const top = feet - (BODY.y + BODY.h) * s;
      return { cx, feet, s, left, top, mouthY: top + BOWL_Y * s, r: BODY.w * s * 0.12 };
    },
    [],
  );

  const squash = useCallback(
    (amount: number) => {
      sqx.set(withSequence(withTiming(1 + amount, { duration: 60 }), withSpring(1, { damping: 5, stiffness: 320 })));
      sqy.set(withSequence(withTiming(1 - amount, { duration: 60 }), withSpring(1, { damping: 5, stiffness: 320 })));
    },
    [sqx, sqy],
  );

  const startRound = useCallback(() => {
    const now = performance.now();
    const prev = st.current;
    const rules = shellRules(getShellLevel(level.current), useProfile.getState().mode, skill.current.psr);
    const round = buildRound(rng, rules, prevSignature.current);
    prevSignature.current = round.signature;
    // Clams look identical, so the clam in each slot becomes the new clam id for that slot; open ones close in place.
    const anims: ClamAnim[] = Array.from({ length: round.clams }, (_, slot) => {
      const old = prev && prev.round.clams === round.clams ? prev.anims[prev.round.finalClamAt[slot]] : undefined;
      if (old && old.clip === 'pop') return { clip: 'pop', t0: now, reverse: true };
      return { clip: 'idle', t0: now - slot * 170, reverse: false };
    });
    const geo = geoFor(round);
    const band = place(geo, 0, round.rows - 1, 0);
    inkBand.set([geo.feet0 - BODY.h * geo.scale * 1.8, band.feet + 24]);
    st.current = { rules, round, picker: new ShellPicker(round), phase: 'intro', phaseAt: now, shuffleT: 0, moveIdx: 0, anims, hintSlots: [], hintUntil: 0, geo };
    timer.set(0);
    coralRef.current.play('pop');
  }, [rng, geoFor, place, inkBand, timer]);

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
      won.current = 0;
      setRoundsWon(0);
      setRoundsNeeded(getShellLevel(lvl).rounds);
      heartsLeft.current = HEARTS;
      setHearts(HEARTS);
      shield.current = m === 'ARCADE' && useProfile.getState().shields > 0;
      setShieldArmed(shield.current);
      st.current = null;
      later(startRound, 900);
    },
    [later, startRound],
  );

  useEffect(() => {
    const start = setTimeout(() => newLevel(level.current), 0);
    return () => {
      clearTimeout(start);
      epoch.current += 1;
      timeouts.current.forEach(clearTimeout);
    };
  }, [mode, daily, newLevel]);

  // ---- round outcomes -----------------------------------------------------
  const revealPearls = useCallback(
    (s: RoundState) => {
      const now = performance.now();
      for (const slot of s.picker.pearlSlots()) {
        const id = s.round.finalClamAt[slot];
        s.picker.opened.add(id);
        s.anims[id] = { clip: 'pop', t0: now, reverse: false };
      }
    },
    [],
  );

  const levelClear = useCallback(() => {
    const lvl = level.current;
    const cfg = getShellLevel(lvl);
    const k = useProfile.getState().mode === 'SANCTUARY' ? 0.35 : 1;
    const profile = useProfile.getState();
    const isFirstClear = lvl > profile.shellsLevel;
    profile.setShellsLevel(lvl);
    profile.awardXp(35 + lvl * 8);
    useEconomy.getState().earnStardust(cfg.stardustReward + (isFirstClear ? cfg.firstClearBonus : 0));
    useSeasonPass.getState().addSeasonXp(20 + lvl * 2);
    useAchievements.getState().setMetricMax('shells_level', lvl + 1);

    coralRef.current.play('celebrate');
    juice.emit({ x: W / 2, y: H * 0.4, kind: ParticleKind.Confetti, count: k < 1 ? 90 : 220 });
    juice.emit({ x: W / 2, y: coralFeet - ch * 0.4, kind: ParticleKind.Ring, count: 4 });
    juice.doShake(10 * k, 400);
    juice.doFlash(0.35 * k, 600);
    juice.doBoost(1.5, 1200);
    sfx.play('chime', 1, 1.2);
    sfx.play('sparkle', 0.8);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    later(() => newLevel(Math.min(30, lvl + 1)), 2600);
  }, [juice, W, H, coralFeet, ch, later, newLevel]);

  const roundWon = useCallback(
    (s: RoundState, decisionMs: number) => {
      s.phase = 'result';
      s.phaseAt = performance.now();
      skill.current.record(true, decisionMs);
      streak.current += 1;
      won.current += 1;
      setRoundsWon(won.current);
      squash(0.14);
      const profile = useProfile.getState();
      if (daily && streak.current >= 3 && profile.completeDaily('shells')) profile.awardXp(80);
      if (won.current >= s.rules.rounds) {
        levelClear();
        return;
      }
      coralRef.current.play('celebrate');
      juice.emit({ x: W / 2, y: H * 0.45, kind: ParticleKind.Confetti, count: calm ? 40 : 90 });
      later(startRound, RESULT_MS);
    },
    [squash, daily, levelClear, juice, W, H, calm, later, startRound],
  );

  const roundLost = useCallback(
    (s: RoundState, decisionMs: number) => {
      const m = useProfile.getState().mode;
      const k = m === 'SANCTUARY' ? 0.35 : 1;
      s.phase = 'result';
      s.phaseAt = performance.now();
      skill.current.record(false, decisionMs);
      streak.current = 0;
      timer.set(0);
      coralRef.current.play('sad');
      sfx.play('sad', 0.7);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      juice.doShake(9 * k, 380);
      squash(-0.12);

      if (s.rules.hintAfterMiss) {
        s.hintSlots = s.picker.pearlSlots();
        s.hintUntil = s.phaseAt + 900;
        later(() => revealPearls(s), 900);
      } else {
        later(() => revealPearls(s), 450);
      }

      if (s.rules.hearts) {
        if (shield.current) {
          shield.current = false;
          setShieldArmed(false);
          useProfile.getState().spendShield();
          sfx.play('chime', 0.6, 1.3);
          juice.emit({ x: W - 42, y: HUD_Y + 50, kind: ParticleKind.Ring, count: 3 });
        } else {
          heartsLeft.current -= 1;
          setHearts(heartsLeft.current);
          hurt.set(withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 500 })));
          if (heartsLeft.current <= 0) {
            sfx.play('sad', 0.9);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            juice.doShake(14, 700);
            later(() => newLevel(level.current), 2600);
            return;
          }
        }
      }
      later(startRound, RESULT_MS + 500);
    },
    [timer, juice, squash, later, revealPearls, W, hurt, newLevel, startRound],
  );

  // ---- input --------------------------------------------------------------
  const onTap = useCallback(
    (x: number, y: number) => {
      if (Math.hypot(x - (W - 42), y - HUD_Y) < 30) {
        requestCycle();
        sfx.play('sparkle', 0.5);
        Haptics.selectionAsync();
        juice.emit({ x: W - 42, y: HUD_Y, kind: ParticleKind.Ring, count: 2 });
        return;
      }
      const s = st.current;
      if (!s || s.phase !== 'pick') return;
      let best = -1;
      let bestD = Infinity;
      for (let slot = 0; slot < s.round.clams; slot++) {
        const c = slotCell(s.round, slot);
        const p = place(s.geo, c.x, c.y, 0);
        const visualH = BODY.h * p.s;
        const dx = Math.abs(x - p.cx);
        const dy = Math.abs(y - (p.feet - visualH * 0.5));
        if (dx < s.geo.slotW * 0.5 && dy < visualH * 0.9 && dx + dy < bestD) {
          best = slot;
          bestD = dx + dy;
        }
      }
      if (best < 0) return;
      const res = s.picker.pick(best);
      if (res.type === 'ignored') return;
      const now = performance.now();
      const id = s.round.finalClamAt[best];
      const c = slotCell(s.round, best);
      const p = place(s.geo, c.x, c.y, 0);
      const decisionMs = now - s.phaseAt;

      if (res.type === 'pearl') {
        s.anims[id] = { clip: 'pop', t0: now, reverse: false };
        const profile = useProfile.getState();
        profile.awardXp(3);
        useEconomy.getState().earnStardust(1);
        useSeasonPass.getState().addSeasonXp(5);
        useAchievements.getState().incrementMetric('pearls_found', 1);
        sfx.play('chime', 0.8, Math.min(1.7, 1 + s.picker.found * 0.12 + streak.current * 0.05));
        sfx.play('pop', 0.5);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        juice.emit({ x: p.cx, y: p.mouthY, kind: ParticleKind.Sparkle, count: 20 });
        juice.emit({ x: p.cx, y: p.mouthY, kind: ParticleKind.Ring, count: 2 });
        juice.doBoost(0.8, 600);
        if (res.done) roundWon(s, decisionMs);
        return;
      }
      if (res.type === 'urchin') {
        s.anims[id] = { clip: 'pop', t0: now, reverse: false };
        sfx.play('boing', 0.8, 0.8);
        juice.emit({ x: p.cx, y: p.mouthY, kind: ParticleKind.Ring, count: 2 });
      } else {
        s.anims[id] = { clip: 'sad', t0: now, reverse: false };
      }
      roundLost(s, decisionMs);
    },
    [W, requestCycle, juice, place, roundWon, roundLost],
  );

  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: (e) => onTap(e.x, e.y),
  });

  // ---- loop ---------------------------------------------------------------
  const lostRef = useRef(roundLost);
  useEffect(() => {
    lostRef.current = roundLost;
  }, [roundLost]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const fps = clamSheet.fps;
    const popMs = (clamSheet.clips.pop.frames / fps) * 1000;
    const clipIndex = (c: ClamClip) => clamSheet.order.indexOf(c);

    /** Advances a clam's clip and returns [clipIndex, frame, openness 0..1]. */
    const frameOf = (a: ClamAnim, now: number, i: number): [number, number, number] => {
      const m = clamSheet.clips[a.clip];
      const f = Math.floor(((now - a.t0) * fps) / 1000);
      if (a.clip === 'idle') return [clipIndex('idle'), ((f % m.frames) + m.frames + i * 5) % m.frames, 0];
      if (a.reverse) {
        const r = m.frames - 1 - f;
        if (r < 0) {
          a.clip = 'idle';
          a.reverse = false;
          a.t0 = now;
          return [clipIndex('idle'), 0, 0];
        }
        return [clipIndex(a.clip), r, r / (m.frames - 1)];
      }
      if (f >= m.frames) {
        if (a.clip === 'sad') {
          a.clip = 'idle';
          a.t0 = now;
          return [clipIndex('idle'), 0, 0];
        }
        return [clipIndex('pop'), m.frames - 1, 1];
      }
      const open = a.clip === 'pop' ? f / (m.frames - 1) : Math.sin((Math.PI * f) / m.frames);
      return [clipIndex(a.clip), f, open];
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = st.current;
      coralY.set(Math.sin(now / 420) * 4);
      if (!s) {
        clamSnap.set([]);
        itemSnap.set([]);
        return;
      }
      const { round, rules } = s;
      const since = now - s.phaseAt;

      // Phase machine.
      if (s.phase === 'intro' && since > 550) {
        s.phase = 'preview';
        s.phaseAt = now;
        round.contents.forEach((c, id) => {
          if (c !== 'empty') s.anims[id] = { clip: 'pop', t0: now, reverse: false };
        });
        sfx.play('pop', 0.6);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (s.phase === 'preview' && since > rules.previewMs + DROP_MS) {
        s.phase = 'closing';
        s.phaseAt = now;
        s.anims.forEach((a) => {
          if (a.clip === 'pop') {
            a.reverse = true;
            a.t0 = now;
          }
        });
        sfx.play('whoosh', 0.3, 1.3);
      } else if (s.phase === 'closing' && since > popMs + 150) {
        s.phase = 'shuffle';
        s.phaseAt = now;
      } else if (s.phase === 'shuffle') {
        s.shuffleT += dt * 1000;
        while (s.moveIdx < round.moves.length && round.moves[s.moveIdx].t0 <= s.shuffleT) {
          const mv = round.moves[s.moveIdx];
          sfx.play('whoosh', mv.kind === 'rotate' ? 0.35 : 0.22, 1.1 + ((s.moveIdx * 37) % 5) * 0.08);
          s.moveIdx += 1;
        }
        if (s.shuffleT > round.duration) {
          s.shuffleT = round.duration + 1;
          s.phase = 'pick';
          s.phaseAt = now;
          Haptics.selectionAsync();
        }
      } else if (s.phase === 'pick' && rules.pickTimeMs) {
        const left = 1 - since / rules.pickTimeMs;
        timer.set(Math.max(0, left));
        if (left <= 0) lostRef.current(s, rules.pickTimeMs);
      }

      // Clams.
      const poses = posesAt(round, s.phase === 'shuffle' || s.phase === 'pick' || s.phase === 'result' ? s.shuffleT : 0);
      const clamOut: number[] = [];
      const items: number[] = [];
      const open: number[] = [];
      for (let id = 0; id < MAX_CLAMS; id++) {
        if (id >= round.clams) {
          clamOut.push(0, 0, 0, 0, 0);
          continue;
        }
        const pose = poses[id];
        const p = place(s.geo, pose.x, pose.y, pose.lift);
        const [ci, f, o] = frameOf(s.anims[id], now, id);
        open.push(o);
        clamOut.push(p.left, p.top, p.s, ci, f);
        if (Math.abs(pose.lift) > 0.25 && Math.random() < 0.35) {
          bubbles.current.push({ x: p.cx + (Math.random() - 0.5) * p.r * 4, y: p.feet - p.r * 2, r: 2 + Math.random() * p.r * 0.35, age: 0 });
        }
      }

      // Pearls and the urchin: shown while their clam is open (preview, picks, reveal).
      const showContents = s.phase === 'preview' || s.phase === 'closing' || s.phase === 'pick' || s.phase === 'result';
      if (showContents) {
        round.contents.forEach((c, id) => {
          if (c === 'empty') return;
          const visible = s.phase === 'preview' || s.phase === 'closing' || s.picker.opened.has(id);
          if (!visible) return;
          const pose = poses[id];
          const p = place(s.geo, pose.x, pose.y, pose.lift);
          let y = p.mouthY;
          let a = Math.min(1, Math.max(0, (open[id] - 0.35) / 0.4));
          if (s.phase === 'preview' && c === 'pearl') {
            const u = Math.min(1, since / DROP_MS);
            y = coralFeet - ch * 0.35 + (p.mouthY - (coralFeet - ch * 0.35)) * (u * u);
            a = 1;
          }
          items.push(c === 'pearl' ? PEARL : URCHIN, p.cx, y, p.r * (c === 'urchin' ? 1.1 : 1), a);
        });
      }
      if (s.hintSlots.length && now < s.hintUntil) {
        for (const slot of s.hintSlots) {
          const cell = slotCell(round, slot);
          const p = place(s.geo, cell.x, cell.y, 0);
          items.push(HINT, p.cx, p.mouthY, p.r * 4.2, 1);
        }
      }

      // Bubbles rise and fade.
      const bs = bubbles.current;
      for (let i = bs.length - 1; i >= 0; i--) {
        const b = bs[i];
        b.age += dt;
        b.y -= dt * 90;
        b.x += Math.sin(b.age * 9 + i) * 0.4;
        if (b.age > 0.9) bs.splice(i, 1);
        else items.push(BUBBLE, b.x, b.y, b.r, 1 - b.age / 0.9);
      }
      if (bs.length > 80) bs.splice(0, bs.length - 80);

      clamSnap.set(clamOut);
      itemSnap.set(items);
      ink.set(s.phase === 'shuffle' ? inkAt(round, s.shuffleT) : 0);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clamSheet, place, clamSnap, itemSnap, ink, timer, coralY, coralFeet, ch]);

  // ---- render values ------------------------------------------------------
  const items = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawItems(c, itemSnap.value, juice.time.value);
    return rec.finishRecordingAsPicture();
  });
  const inkPicture = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawInk(c, W, inkBand.value[0], inkBand.value[1], ink.value, juice.time.value);
    return rec.finishRecordingAsPicture();
  });
  const pw = (ch * coralSheet.frameWidth) / coralSheet.frameHeight;
  const coralTransform = useDerivedValue(() => [
    { translateX: W / 2 },
    { translateY: coralY.value },
    { scaleX: sqx.value },
    { scaleY: sqy.value },
  ]);
  const timerWidth = useDerivedValue(() => Math.max(0, W * 0.42 * timer.value));
  const timerOpacity = useDerivedValue(() => (timer.value > 0 ? 1 : 0));
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
      <LevelSplash level={currentLevel} gameTitle="SHELL SHUFFLE" worldName={worldDef.id.replace('_', ' ')} triggerKey={splashTrigger} />
      <GestureDetector gesture={pan}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={juice.worldTransform}>
            <WorldBackdrop W={W} H={H} still={worldDef.still} time={juice.time} boost={juice.boost} light={{ x: 0.5, y: 0.05 }} />
            <Picture picture={juice.back} />

            {/* Coral, the host */}
            <Oval x={W / 2 - pw * 0.28} y={coralFeet - ch * 0.04} width={pw * 0.56} height={ch * 0.08} color="rgba(0,10,40,0.45)">
              <BlurMask blur={9} style="normal" />
            </Oval>
            <Group transform={coralTransform} origin={vec(0, coralFeet)}>
              <SpriteCharacter sheet={coralSheet} images={coralImages} clip={coral.clip} frame={coral.frame} x={-pw / 2} y={coralFeet - ch} height={ch} />
            </Group>

            {Array.from({ length: MAX_CLAMS }).map((_, i) => (
              <ClamSprite key={i} sheet={clamSheet} images={clamImages} snap={clamSnap} index={i} />
            ))}
            <Picture picture={items} />
            <Picture picture={inkPicture} />
            <Picture picture={juice.front} />
          </Group>

          {/* HUD: round pips, pick timer, hearts (Arcade), mode. Icons only. */}
          {Array.from({ length: roundsNeeded }).map((_, i) => (
            <Group key={`pip${i}`}>
              <Circle cx={W / 2 + (i - (roundsNeeded - 1) / 2) * 26} cy={HUD_Y} r={8} color={i < roundsWon ? '#FFF3D6' : 'rgba(255,255,255,0.2)'} />
              {i < roundsWon && (
                <Circle cx={W / 2 + (i - (roundsNeeded - 1) / 2) * 26} cy={HUD_Y} r={14} color="rgba(255,236,200,0.35)">
                  <BlurMask blur={6} style="normal" />
                </Circle>
              )}
            </Group>
          ))}
          <Group opacity={timerOpacity}>
            <RoundedRect x={W * 0.29} y={HUD_Y + 20} width={W * 0.42} height={8} r={4} color="rgba(255,255,255,0.18)" />
            <RoundedRect x={W * 0.29} y={HUD_Y + 20} width={timerWidth} height={8} r={4} color="#7FE8FF" />
          </Group>
          {mode === 'ARCADE' &&
            Array.from({ length: HEARTS }).map((_, i) => (
              <Group key={`h${i}`} transform={[{ translateX: W / 2 + (i - (HEARTS - 1) / 2) * 28 }, { translateY: HUD_Y + 48 }]}>
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
          {!clamImages[0] && <Rect x={0} y={0} width={W} height={H} color="#05010F" opacity={0.85} />}
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
});
