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
import { getVineLevel } from '../../engine/levelTables';
import { useProfile } from '../../store/profile';
import { getWorld, type WorldId } from '../../worlds';
import { ModeIcon } from '../../ui/ModeIcon';
import { ParentalGate } from '../../ui/ParentalGate';
import { ShieldIcon } from '../../ui/ShieldIcon';
import { useParentalModeCycle } from '../../ui/useParentalModeCycle';
import { LevelSplash } from '../../ui/LevelSplash';
import { drawBoard, drawLinks, F_FOG, F_HINT, F_LOCKED, F_WIGGLE, K_BUD, K_EMPTY, K_SPRING, K_THORN, K_TILE } from './draw';
import { buildPuzzle, flow, fogged, hintCell, isSolved, rotatable, rotate, vineRules, type CellKind, type VinePuzzle, type VineRules } from './logic';

const HUD_Y = 78;
const HEARTS = 3;
const MAX_BUDS = 6;
/** Snapshot layout per bud: [frameLeft, frameTop, scale, clipIndex, frame]. */
const BUD_STRIDE = 5;
const BUD_CLIPS = ['idle', 'pop', 'sad'] as const;
const MOSS_CLIPS = ['idle', 'pop', 'celebrate', 'sad'] as const;
/** Closed bud in its logical frame: stem base centre and body height (measured from the idle atlas). */
const BUD = { cx: 125, feet: 281, h: 219 };
const INTRO_MS = 600;
const RESULT_MS = 1700;
const HINT_IDLE_MS = 5000;
const KIND_CODE: Record<CellKind, number> = { empty: K_EMPTY, thorn: K_THORN, tile: K_TILE, spring: K_SPRING, bud: K_BUD };

type BudClip = (typeof BUD_CLIPS)[number];
type Phase = 'intro' | 'play' | 'result';

interface BudAnim {
  clip: BudClip;
  t0: number;
  reverse: boolean;
}

interface Geo {
  cell: number;
  x0: number;
  y0: number;
}

interface PuzzleState {
  rules: VineRules;
  puzzle: VinePuzzle;
  /** Scrambled masks, so a failed attempt resets the same puzzle. */
  start: number[];
  phase: Phase;
  phaseAt: number;
  playAt: number;
  moves: number;
  moveLimit: number | null;
  lit: number[];
  angle: number[];
  spin: number[];
  wiggleUntil: number[];
  linkId: number[];
  buds: BudAnim[];
  lastTapAt: number;
  geo: Geo;
}

/** One bud. Each bud has its own atlas so it can bloom independently. */
function BudSprite({ sheet, images, snap, index }: { sheet: CharacterSheet; images: (SkImage | null)[]; snap: SharedValue<number[]>; index: number }) {
  const meta = sheet.order.map((n) => sheet.clips[n]);
  const o = index * BUD_STRIDE;
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

export default function VineFlow({
  daily = false,
  startLevel = 1,
  worldId = 'grove',
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
  // Juice and the sprite player are new objects every render; refs keep the level/puzzle callbacks stable.
  const juiceRef = useRef(juice);
  useEffect(() => {
    juiceRef.current = juice;
  }, [juice]);

  // ---- level progression --------------------------------------------------
  const level = useRef(startLevel);
  const [currentLevel, setCurrentLevel] = useState(startLevel);
  const [splashTrigger, setSplashTrigger] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [puzzlesNeeded, setPuzzlesNeeded] = useState(getVineLevel(startLevel).puzzles);
  const [hearts, setHearts] = useState(HEARTS);
  const [shieldArmed, setShieldArmed] = useState(false);

  // ---- characters ---------------------------------------------------------
  const budSheet = CAST.bud;
  const budImages = useClipImages(budSheet, BUD_CLIPS);
  const mossSheet = CAST.moss;
  const mossImages = useClipImages(mossSheet, MOSS_CLIPS);
  const moss = useSpritePlayer(mossSheet);
  const mossRef = useRef(moss);
  useEffect(() => {
    mossRef.current = moss;
  }, [moss]);
  const ch = Math.min(W * 0.3, H * 0.17);
  const mossFeet = H * 0.29;

  // ---- shared render state ------------------------------------------------
  const boardSnap = useSharedValue<number[]>([]);
  const linkSnap = useSharedValue<number[]>([]);
  const budSnap = useSharedValue<number[]>([]);
  const wilt = useSharedValue(0);
  const movesLeft = useSharedValue(0);
  const mossY = useSharedValue(0);
  const sqx = useSharedValue(1);
  const sqy = useSharedValue(1);
  const hurt = useSharedValue(0);

  // ---- game state ---------------------------------------------------------
  const skill = useRef(new SkillTracker());
  const [rng] = useState(() => new SeededRNG(daily ? `vines-${dailyKey()}` : `${Date.now()}`));
  const st = useRef<PuzzleState | null>(null);
  const solved = useRef(0);
  const solvedToday = useRef(0);
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

  const geoFor = useCallback(
    (p: VinePuzzle): Geo => {
      const top = H * 0.35;
      const areaH = H * 0.58;
      const cell = Math.min((W * 0.92) / p.cols, areaH / p.rows);
      return { cell, x0: (W - cell * p.cols) / 2, y0: top + (areaH - cell * p.rows) / 2 };
    },
    [W, H],
  );

  const cellCentre = useCallback((geo: Geo, p: VinePuzzle, c: number) => {
    return { x: geo.x0 + ((c % p.cols) + 0.5) * geo.cell, y: geo.y0 + (Math.floor(c / p.cols) + 0.5) * geo.cell };
  }, []);

  const squash = useCallback(
    (amount: number) => {
      sqx.set(withSequence(withTiming(1 + amount, { duration: 60 }), withSpring(1, { damping: 5, stiffness: 320 })));
      sqy.set(withSequence(withTiming(1 - amount, { duration: 60 }), withSpring(1, { damping: 5, stiffness: 320 })));
    },
    [sqx, sqy],
  );

  const startPuzzle = useCallback(() => {
    const now = performance.now();
    const rules = vineRules(getVineLevel(level.current), useProfile.getState().mode, skill.current.psr);
    const puzzle = buildPuzzle(rng, rules, prevSignature.current);
    prevSignature.current = puzzle.signature;
    const n = puzzle.kind.length;
    const linkId = new Array<number>(n).fill(-1);
    let next = 0;
    puzzle.link.forEach((b, a) => {
      if (b > a) {
        linkId[a] = next;
        linkId[b] = next;
        next += 1;
      }
    });
    st.current = {
      rules,
      puzzle,
      start: [...puzzle.mask],
      phase: 'intro',
      phaseAt: now,
      playAt: now + INTRO_MS,
      moves: 0,
      moveLimit: rules.moveSlack === null ? null : puzzle.par + rules.moveSlack,
      lit: flow(puzzle),
      angle: new Array<number>(n).fill(0),
      spin: new Array<number>(n).fill(0),
      wiggleUntil: new Array<number>(n).fill(0),
      linkId,
      buds: puzzle.buds.map((_, i) => ({ clip: 'idle', t0: now - i * 210, reverse: false })),
      lastTapAt: now,
      geo: geoFor(puzzle),
    };
    wilt.set(rules.wiltMs ? 1 : 0);
    movesLeft.set(rules.moveSlack === null ? 0 : 1);
    mossRef.current.play('pop');
    sfx.play('whoosh', 0.35, 0.9);
  }, [rng, geoFor, wilt, movesLeft]);

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
      solved.current = 0;
      setSolvedCount(0);
      setPuzzlesNeeded(getVineLevel(lvl).puzzles);
      heartsLeft.current = HEARTS;
      setHearts(HEARTS);
      shield.current = m === 'ARCADE' && useProfile.getState().shields > 0;
      setShieldArmed(shield.current);
      st.current = null;
      later(startPuzzle, 900);
    },
    [later, startPuzzle],
  );

  useEffect(() => {
    const start = setTimeout(() => newLevel(level.current), 0);
    return () => {
      clearTimeout(start);
      epoch.current += 1;
      timeouts.current.forEach(clearTimeout);
    };
  }, [mode, daily, newLevel]);

  // ---- outcomes -----------------------------------------------------------
  const levelClear = useCallback(() => {
    const lvl = level.current;
    const cfg = getVineLevel(lvl);
    const k = useProfile.getState().mode === 'SANCTUARY' ? 0.35 : 1;
    const profile = useProfile.getState();
    const isFirstClear = lvl > profile.vinesLevel;
    profile.setVinesLevel(lvl);
    profile.awardXp(35 + lvl * 8);
    useEconomy.getState().earnStardust(cfg.stardustReward + (isFirstClear ? cfg.firstClearBonus : 0));
    useSeasonPass.getState().addSeasonXp(20 + lvl * 2);
    useAchievements.getState().setMetricMax('vines_level', lvl + 1);

    const j = juiceRef.current;
    mossRef.current.play('celebrate');
    j.emit({ x: W / 2, y: H * 0.4, kind: ParticleKind.Confetti, count: k < 1 ? 90 : 220 });
    j.emit({ x: W / 2, y: mossFeet - ch * 0.4, kind: ParticleKind.Ring, count: 4 });
    j.doShake(10 * k, 400);
    j.doFlash(0.35 * k, 600);
    j.doBoost(1.5, 1200);
    sfx.play('chime', 1, 1.2);
    sfx.play('sparkle', 0.8);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    later(() => newLevel(Math.min(30, lvl + 1)), 2600);
  }, [W, H, mossFeet, ch, later, newLevel]);

  const puzzleWon = useCallback(
    (s: PuzzleState) => {
      const now = performance.now();
      s.phase = 'result';
      s.phaseAt = now;
      skill.current.record(true, now - s.playAt);
      solved.current += 1;
      solvedToday.current += 1;
      setSolvedCount(solved.current);
      squash(0.14);

      const buds = s.puzzle.buds.length;
      const profile = useProfile.getState();
      profile.awardXp(3 * buds);
      useEconomy.getState().earnStardust(buds);
      useSeasonPass.getState().addSeasonXp(5 * buds);
      if (s.moves <= s.puzzle.par) useAchievements.getState().incrementMetric('vines_perfect', 1);
      if (daily && solvedToday.current >= 2 && profile.completeDaily('vines')) profile.awardXp(80);

      const j = juiceRef.current;
      for (const b of s.puzzle.buds) {
        const p = cellCentre(s.geo, s.puzzle, b);
        j.emit({ x: p.x, y: p.y - s.geo.cell * 0.3, kind: ParticleKind.Sparkle, count: calm ? 10 : 22 });
      }
      j.doBoost(1, 900);
      sfx.play('sparkle', 0.7);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (solved.current >= s.rules.puzzles) {
        levelClear();
        return;
      }
      mossRef.current.play('celebrate');
      j.emit({ x: W / 2, y: H * 0.45, kind: ParticleKind.Confetti, count: calm ? 40 : 90 });
      later(startPuzzle, RESULT_MS);
    },
    [squash, daily, cellCentre, calm, levelClear, W, H, later, startPuzzle],
  );

  const retry = useCallback(
    (s: PuzzleState) => {
      const now = performance.now();
      s.puzzle.mask = [...s.start];
      s.lit = flow(s.puzzle);
      s.moves = 0;
      s.angle.fill(0);
      s.spin.fill(0);
      s.buds = s.puzzle.buds.map((_, i) => ({ clip: 'idle', t0: now - i * 210, reverse: false }));
      s.phase = 'intro';
      s.phaseAt = now;
      s.playAt = now + INTRO_MS;
      s.lastTapAt = now;
      wilt.set(s.rules.wiltMs ? 1 : 0);
      movesLeft.set(s.moveLimit === null ? 0 : 1);
      sfx.play('whoosh', 0.3, 1.1);
    },
    [wilt, movesLeft],
  );

  const puzzleLost = useCallback(
    (s: PuzzleState) => {
      const now = performance.now();
      const k = useProfile.getState().mode === 'SANCTUARY' ? 0.35 : 1;
      s.phase = 'result';
      s.phaseAt = now;
      skill.current.record(false, now - s.playAt);
      s.buds = s.buds.map((a) => (a.clip === 'pop' && !a.reverse ? { clip: 'pop', t0: now, reverse: true } : { clip: 'sad', t0: now, reverse: false }));
      mossRef.current.play('sad');
      sfx.play('sad', 0.7);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const j = juiceRef.current;
      j.doShake(9 * k, 380);
      squash(-0.12);

      if (s.rules.hearts) {
        if (shield.current) {
          shield.current = false;
          setShieldArmed(false);
          useProfile.getState().spendShield();
          sfx.play('chime', 0.6, 1.3);
          j.emit({ x: W - 42, y: HUD_Y + 50, kind: ParticleKind.Ring, count: 3 });
        } else {
          heartsLeft.current -= 1;
          setHearts(heartsLeft.current);
          hurt.set(withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 500 })));
          if (heartsLeft.current <= 0) {
            sfx.play('sad', 0.9);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            j.doShake(14, 700);
            later(() => newLevel(level.current), 2600);
            return;
          }
        }
      }
      later(() => retry(s), RESULT_MS);
    },
    [squash, W, hurt, later, newLevel, retry],
  );

  // ---- input --------------------------------------------------------------
  const onTap = useCallback(
    (x: number, y: number) => {
      if (Math.hypot(x - (W - 42), y - HUD_Y) < 30) {
        requestCycle();
        sfx.play('sparkle', 0.5);
        Haptics.selectionAsync();
        juiceRef.current.emit({ x: W - 42, y: HUD_Y, kind: ParticleKind.Ring, count: 2 });
        return;
      }
      const s = st.current;
      if (!s || s.phase !== 'play') return;
      const { puzzle: p, geo } = s;
      const col = Math.floor((x - geo.x0) / geo.cell);
      const row = Math.floor((y - geo.y0) / geo.cell);
      if (col < 0 || row < 0 || col >= p.cols || row >= p.rows) return;
      const cell = row * p.cols + col;
      const now = performance.now();
      if (p.kind[cell] === 'empty') return;
      if (!rotatable(p, cell) || (p.fog && fogged(p, s.lit, cell))) {
        s.wiggleUntil[cell] = now + 220;
        sfx.play('boing', 0.35, 1.4);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }

      const before = s.lit;
      const turned = rotate(p, cell);
      for (const c of turned) {
        s.angle[c] -= 90;
        s.spin[c] = 0;
      }
      s.moves += 1;
      s.lastTapAt = now;
      s.lit = flow(p);
      sfx.play('pop', 0.45, 0.75 + Math.random() * 0.1);
      Haptics.selectionAsync();

      // Buds bloom when their own sap arrives and fold back when it leaves.
      let bloomed = 0;
      p.buds.forEach((b, i) => {
        const was = before[b] === p.color[b];
        const is = s.lit[b] === p.color[b];
        if (is && !was) {
          s.buds[i] = { clip: 'pop', t0: now, reverse: false };
          bloomed += 1;
          const c = cellCentre(geo, p, b);
          juiceRef.current.emit({ x: c.x, y: c.y - geo.cell * 0.3, kind: ParticleKind.Sparkle, count: 14 });
        } else if (was && !is && s.buds[i].clip === 'pop') {
          s.buds[i] = { clip: 'pop', t0: now, reverse: true };
        }
      });
      if (bloomed) {
        sfx.play('chime', 0.7, 1 + p.buds.filter((b) => s.lit[b] === p.color[b]).length * 0.1);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (s.lit.some((v) => v === 2)) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      if (isSolved(p, s.lit)) {
        puzzleWon(s);
        return;
      }
      if (s.moveLimit !== null) {
        movesLeft.set(Math.max(0, 1 - s.moves / s.moveLimit));
        if (s.moves >= s.moveLimit) puzzleLost(s);
      }
    },
    [W, requestCycle, cellCentre, puzzleWon, puzzleLost, movesLeft],
  );

  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: (e) => onTap(e.x, e.y),
  });

  // ---- loop ---------------------------------------------------------------
  const lostRef = useRef(puzzleLost);
  useEffect(() => {
    lostRef.current = puzzleLost;
  }, [puzzleLost]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const fps = budSheet.fps;
    const clipIndex = (c: BudClip) => budSheet.order.indexOf(c);

    const frameOf = (a: BudAnim, now: number, i: number): [number, number] => {
      const m = budSheet.clips[a.clip];
      const f = Math.floor(((now - a.t0) * fps) / 1000);
      if (a.clip === 'idle') return [clipIndex('idle'), ((f % m.frames) + m.frames + i * 7) % m.frames];
      if (a.reverse) {
        const r = m.frames - 1 - f;
        if (r < 0) {
          a.clip = 'idle';
          a.reverse = false;
          a.t0 = now;
          return [clipIndex('idle'), 0];
        }
        return [clipIndex(a.clip), r];
      }
      if (f >= m.frames) {
        if (a.clip === 'sad') {
          a.clip = 'idle';
          a.t0 = now;
          return [clipIndex('idle'), 0];
        }
        return [clipIndex('pop'), m.frames - 1];
      }
      return [clipIndex(a.clip), f];
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      mossY.set(Math.sin(now / 460) * 4);
      const s = st.current;
      if (!s) {
        boardSnap.set([]);
        linkSnap.set([]);
        budSnap.set([]);
        return;
      }
      const { puzzle: p, geo, rules } = s;

      if (s.phase === 'intro' && now >= s.playAt) {
        s.phase = 'play';
        s.phaseAt = now;
        s.lastTapAt = now;
      } else if (s.phase === 'play' && rules.wiltMs) {
        const left = 1 - (now - s.phaseAt) / rules.wiltMs;
        wilt.set(Math.max(0, left));
        if (left <= 0) lostRef.current(s);
      }

      const hint = s.phase === 'play' && rules.hints && now - s.lastTapAt > HINT_IDLE_MS ? hintCell(p) : -1;
      const introAge = s.phase === 'intro' ? now - (s.playAt - INTRO_MS) : Infinity;

      const board: number[] = [];
      const buds: number[] = [];
      const links: number[] = [];
      for (let c = 0; c < p.kind.length; c++) {
        // Underdamped spring back to 0 gives each quarter turn a small overshoot.
        const acc = -900 * s.angle[c] - 34 * s.spin[c];
        s.spin[c] += acc * dt;
        s.angle[c] += s.spin[c] * dt;
        if (Math.abs(s.angle[c]) < 0.05 && Math.abs(s.spin[c]) < 0.5) {
          s.angle[c] = 0;
          s.spin[c] = 0;
        }
        const col = c % p.cols;
        const row = Math.floor(c / p.cols);
        const appear = Math.min(1, Math.max(0, (introAge - (col + row) * 35) / 260));
        const pop = appear >= 1 ? 1 : 1 + 2.2 * Math.pow(appear - 1, 3) + 1.2 * Math.pow(appear - 1, 2);
        const centre = cellCentre(geo, p, c);
        let flags = 0;
        if (p.locked[c] && p.kind[c] !== 'spring') flags |= F_LOCKED;
        if (p.fog && fogged(p, s.lit, c)) flags |= F_FOG;
        if (c === hint) flags |= F_HINT;
        if (now < s.wiggleUntil[c]) flags |= F_WIGGLE;
        board.push(KIND_CODE[p.kind[c]], p.mask[c], s.lit[c], s.angle[c], flags, centre.x, centre.y, geo.cell * Math.max(0, pop), s.linkId[c]);
        const partner = p.link[c];
        if (partner > c && !(flags & F_FOG)) {
          const o = geo.cell * 0.28;
          const b = cellCentre(geo, p, partner);
          links.push(s.linkId[c], centre.x + o, centre.y - o, b.x + o, b.y - o);
        }
      }

      for (let i = 0; i < MAX_BUDS; i++) {
        const b = p.buds[i];
        if (b === undefined) {
          buds.push(0, 0, 0, 0, 0);
          continue;
        }
        const centre = cellCentre(geo, p, b);
        const col = b % p.cols;
        const row = Math.floor(b / p.cols);
        const appear = Math.min(1, Math.max(0, (introAge - (col + row) * 35 - 120) / 260));
        const sc = ((geo.cell * 0.95) / BUD.h) * appear;
        const [ci, f] = frameOf(s.buds[i], now, i);
        buds.push(centre.x - BUD.cx * sc, centre.y + geo.cell * 0.3 - BUD.feet * sc, sc, ci, f);
      }

      boardSnap.set(board);
      linkSnap.set(links);
      budSnap.set(buds);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [budSheet, cellCentre, boardSnap, linkSnap, budSnap, wilt, mossY]);

  // ---- render values ------------------------------------------------------
  const boardPicture = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawBoard(c, boardSnap.value, juice.time.value);
    drawLinks(c, linkSnap.value, juice.time.value);
    return rec.finishRecordingAsPicture();
  });
  const pw = (ch * mossSheet.frameWidth) / mossSheet.frameHeight;
  const mossTransform = useDerivedValue(() => [
    { translateX: W / 2 },
    { translateY: mossY.value },
    { scaleX: sqx.value },
    { scaleY: sqy.value },
  ]);
  const wiltWidth = useDerivedValue(() => Math.max(0, W * 0.42 * wilt.value));
  const wiltOpacity = useDerivedValue(() => (wilt.value > 0 ? 1 : 0));
  const movesWidth = useDerivedValue(() => Math.max(0, W * 0.42 * movesLeft.value));
  const movesOpacity = useDerivedValue(() => (movesLeft.value > 0 ? 1 : 0));
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
  const leaf = useMemo(
    () =>
      Skia.PathBuilder.Make()
        .moveTo(-9, 0)
        .quadTo(0, -9, 9, 0)
        .quadTo(0, 9, -9, 0)
        .close()
        .build(),
    [],
  );

  return (
    <View style={styles.root}>
      <ParentalGate visible={gateOpen} onSuccess={confirmGate} onCancel={cancelGate} />
      <LevelSplash level={currentLevel} gameTitle="VINE FLOW" worldName={worldDef.id.replace('_', ' ')} triggerKey={splashTrigger} />
      <GestureDetector gesture={pan}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={juice.worldTransform}>
            <WorldBackdrop W={W} H={H} still={worldDef.still} time={juice.time} boost={juice.boost} light={{ x: 0.5, y: 0.05 }} />
            <Picture picture={juice.back} />

            {/* Moss, the host */}
            <Oval x={W / 2 - pw * 0.28} y={mossFeet - ch * 0.04} width={pw * 0.56} height={ch * 0.08} color="rgba(10,20,0,0.45)">
              <BlurMask blur={9} style="normal" />
            </Oval>
            <Group transform={mossTransform} origin={vec(0, mossFeet)}>
              <SpriteCharacter sheet={mossSheet} images={mossImages} clip={moss.clip} frame={moss.frame} x={-pw / 2} y={mossFeet - ch} height={ch} />
            </Group>

            <Picture picture={boardPicture} />
            {Array.from({ length: MAX_BUDS }).map((_, i) => (
              <BudSprite key={i} sheet={budSheet} images={budImages} snap={budSnap} index={i} />
            ))}
            <Picture picture={juice.front} />
          </Group>

          {/* HUD: puzzle pips, wilt timer, leaf moves, hearts (Arcade), mode. Icons only. */}
          {Array.from({ length: puzzlesNeeded }).map((_, i) => (
            <Group key={`pip${i}`}>
              <Circle cx={W / 2 + (i - (puzzlesNeeded - 1) / 2) * 26} cy={HUD_Y} r={8} color={i < solvedCount ? '#FFE9A8' : 'rgba(255,255,255,0.2)'} />
              {i < solvedCount && (
                <Circle cx={W / 2 + (i - (puzzlesNeeded - 1) / 2) * 26} cy={HUD_Y} r={14} color="rgba(255,226,140,0.35)">
                  <BlurMask blur={6} style="normal" />
                </Circle>
              )}
            </Group>
          ))}
          <Group opacity={wiltOpacity}>
            <RoundedRect x={W * 0.29} y={HUD_Y + 20} width={W * 0.42} height={8} r={4} color="rgba(255,255,255,0.18)" />
            <RoundedRect x={W * 0.29} y={HUD_Y + 20} width={wiltWidth} height={8} r={4} color="#FFB347" />
          </Group>
          <Group opacity={movesOpacity}>
            <Group transform={[{ translateX: W * 0.29 - 16 }, { translateY: HUD_Y + 36 }]}>
              <Path path={leaf} color="#9BE37A" />
            </Group>
            <RoundedRect x={W * 0.29} y={HUD_Y + 32} width={W * 0.42} height={8} r={4} color="rgba(255,255,255,0.18)" />
            <RoundedRect x={W * 0.29} y={HUD_Y + 32} width={movesWidth} height={8} r={4} color="#9BE37A" />
          </Group>
          {mode === 'ARCADE' &&
            Array.from({ length: HEARTS }).map((_, i) => (
              <Group key={`h${i}`} transform={[{ translateX: W / 2 + (i - (HEARTS - 1) / 2) * 28 }, { translateY: HUD_Y + 60 }]}>
                <Path path={heart} color={i < hearts ? '#FF5C8A' : 'rgba(255,255,255,0.25)'} />
              </Group>
            ))}
          <Circle cx={W - 42} cy={HUD_Y} r={24} color="rgba(26,15,61,0.6)" />
          <ModeIcon mode={mode} x={W - 42} y={HUD_Y} />
          {mode === 'ARCADE' && <ShieldIcon x={W - 42} y={HUD_Y + 50} armed={shieldArmed} />}

          <Rect x={0} y={0} width={W} height={H}>
            <RadialGradient c={vec(W / 2, H * 0.55)} r={Math.max(W, H) * 0.75} colors={['rgba(0,0,0,0)', 'rgba(8,16,0,0.45)']} positions={[0.55, 1]} />
          </Rect>
          <Rect x={0} y={0} width={W} height={H} color="#FF2D55" opacity={hurtTint} />
          <Rect x={0} y={0} width={W} height={H} color="white" opacity={juice.flash} blendMode="plus" />
          {!budImages[0] && <Rect x={0} y={0} width={W} height={H} color="#05010F" opacity={0.85} />}
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
});
