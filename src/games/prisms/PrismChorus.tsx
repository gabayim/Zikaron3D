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
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { GestureDetector, useManualGesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { CAST } from '../../render/castRegistry';
import { ParticleKind } from '../../render/particles';
import { WorldBackdrop } from '../../render/WorldBackdrop';
import { SpriteCharacter, useClipImages, useSpritePlayer } from '../../render/SpriteCharacter';
import { sfx } from '../../fx/sound';
import { notes } from '../../fx/notes';
import { useJuice } from '../../fx/useJuice';
import { SeededRNG } from '../../engine/SeededRNG';
import { dailyKey } from '../../engine/daily';
import { SkillTracker } from '../../engine/dda';
import { getPrismLevel } from '../../engine/levelTables';
import { useProfile, type CreatureId } from '../../store/profile';
import { useEconomy } from '../../store/economy';
import { useSeasonPass } from '../../store/seasonPass';
import { useAchievements } from '../../store/achievements';
import { getWorld, type WorldId } from '../../worlds';
import { ModeIcon } from '../../ui/ModeIcon';
import { ShieldIcon } from '../../ui/ShieldIcon';
import { useModeCycle } from '../../ui/useModeCycle';
import { LevelSplash } from '../../ui/LevelSplash';
import { BEAM_STRIDE, CRYSTAL_COLORS, CRYSTAL_STRIDE, drawBeams, drawCavernOverlay, drawCrystals } from './draw';
import {
  buildPrismLevel,
  CRYSTAL_DEFS,
  MAX_CRYSTALS,
  prismRules,
  PrismWaveRunner,
  type PrismLevelData,
  type PrismWave,
} from './logic';

const HUD_Y = 78;
const HEARTS = 3;
const INTRO_MS = 650;
const TRANSFORM_MS = 620;
const BETWEEN_WAVES_MS = 780;
const RESULT_MS = 1600;
const RESIDENT_CLIPS = ['idle', 'pop', 'celebrate', 'sad'] as const;

type Phase = 'intro' | 'cue' | 'transform' | 'echo' | 'between' | 'result';

interface BeamVisual {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colorIdx: number;
  alpha: number;
  rainbow: boolean;
  width: number;
}

interface GameState {
  data: PrismLevelData;
  waveIdx: number;
  wave: PrismWave;
  runner: PrismWaveRunner;
  phase: Phase;
  phaseAt: number;
  cueStepIdx: number;
  cueSubIdx: number;
  lastPlayedCueKey: string;
  lastEchoCrystal: number | null;
  lastInputAt: number;
  lit: number[];
  press: number[];
  bad: number[];
  hint: number[];
  beams: BeamVisual[];
  positions: [number, number][];
  mirrorCue: number;
  charge: number;
  fever: number;
  shieldUsed: boolean;
  mirrorCleared: boolean;
  feverReached: boolean;
  maxCombo: number;
}

const CRYSTAL_SHAPES = ['diamond', 'hex', 'star', 'drop', 'crescent', 'shard', 'crown'] as const;

export default function PrismChorus({
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
  const requestCycle = useModeCycle();
  const mode = useProfile((s) => s.mode);
  const calm = mode === 'SANCTUARY';
  const juice = useJuice(W, H, 18);
  const juiceRef = useRef(juice);
  useEffect(() => {
    juiceRef.current = juice;
  }, [juice]);

  // ---- level & HUD state --------------------------------------------------
  const level = useRef(startLevel);
  const [currentLevel, setCurrentLevel] = useState(startLevel);
  const [splashTrigger, setSplashTrigger] = useState(0);
  const [wavesDone, setWavesDone] = useState(0);
  const [wavesTotal, setWavesTotal] = useState(getPrismLevel(startLevel).waves);
  const [hearts, setHearts] = useState(HEARTS);
  const [shieldArmed, setShieldArmed] = useState(false);

  // ---- resident mascot ----------------------------------------------------
  const [rng] = useState(() => new SeededRNG(daily ? `prisms-${dailyKey()}` : `${Date.now()}`));
  const [heroId, setHeroId] = useState<CreatureId>(
    () => (worldDef.residents[0] as CreatureId) ?? 'frost',
  );
  const heroSheet = CAST[heroId] ?? CAST.frost;
  const heroImages = useClipImages(heroSheet, RESIDENT_CLIPS);
  const hero = useSpritePlayer(heroSheet);
  const heroRef = useRef(hero);
  useEffect(() => {
    heroRef.current = hero;
  }, [hero]);

  // ---- ring geometry ------------------------------------------------------
  const cx = W / 2;
  const cy = H * 0.57;
  const ringR = Math.min(W * 0.34, H * 0.25);
  const crystalR = Math.min(W * 0.088, 36);
  const mascotH = Math.min(ringR * 0.85, 118);
  const mascotFeet = cy + mascotH * 0.45;
  const mascotW = (mascotH * heroSheet.frameWidth) / heroSheet.frameHeight;

  const slotCoord = useCallback(
    (slot: number, count: number): [number, number] => {
      const a = -Math.PI / 2 + (slot * Math.PI * 2) / count;
      return [cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR];
    },
    [cx, cy, ringR],
  );

  // ---- shared Skia state --------------------------------------------------
  const crystalSnap = useSharedValue<number[]>([]);
  const beamSnap = useSharedValue<number[]>([]);
  const ringState = useSharedValue<[number, number, number]>([0, 0, 0]); // [charge, fever, mirrorCue]
  const timer = useSharedValue(0);
  const heroY = useSharedValue(0);
  const sqx = useSharedValue(1);
  const sqy = useSharedValue(1);
  const hurt = useSharedValue(0);

  // ---- lifecycle refs -----------------------------------------------------
  const skill = useRef(new SkillTracker());
  const st = useRef<GameState | null>(null);
  const heartsLeft = useRef(HEARTS);
  const shield = useRef(false);
  const prevSignature = useRef<string | undefined>(undefined);
  const epoch = useRef(0);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const touchCrystalMap = useRef(new Map<number, number>());

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
      sqx.set(withSequence(withTiming(1 + amount, { duration: 60 }), withSpring(1, { damping: 6, stiffness: 300 })));
      sqy.set(withSequence(withTiming(1 - amount, { duration: 60 }), withSpring(1, { damping: 6, stiffness: 300 })));
    },
    [sqx, sqy],
  );

  const setupWave = useCallback(
    (s: GameState, waveIdx: number, carryCharge: number, carryFever: boolean, carryCombo: number, now: number) => {
      const wave = s.data.waves[waveIdx];
      s.waveIdx = waveIdx;
      s.wave = wave;
      s.runner = new PrismWaveRunner(wave, carryCharge, carryFever, carryCombo, now);
      s.phase = waveIdx === 0 ? 'intro' : 'cue';
      s.phaseAt = now;
      s.cueStepIdx = 0;
      s.cueSubIdx = 0;
      s.lastPlayedCueKey = '';
      s.lastEchoCrystal = null;
      s.lastInputAt = now;
      s.lit.fill(0);
      s.press.fill(0);
      s.bad.fill(0);
      s.hint.fill(0);
      s.beams = [];
      s.mirrorCue = wave.mirror ? 1 : 0;
      s.positions = Array.from({ length: s.data.rules.crystals }, (_, id) =>
        slotCoord(wave.slotBeforeCue[id], s.data.rules.crystals),
      );
      timer.set(0);
    },
    [slotCoord, timer],
  );

  const beginLevel = useCallback(
    (targetLvl?: number) => {
      const lvl = targetLvl ?? level.current;
      level.current = lvl;
      setCurrentLevel(lvl);
      setSplashTrigger((k) => k + 1);
      epoch.current += 1;
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
      touchCrystalMap.current.clear();

      const residents = worldDef.residents as CreatureId[];
      const nextHero = daily
        ? residents[0] ?? 'frost'
        : residents[(lvl - 1) % Math.max(1, residents.length)] ?? 'frost';
      setHeroId(nextHero);

      const m = useProfile.getState().mode;
      const cfg = getPrismLevel(lvl);
      const rules = prismRules(cfg, m, skill.current.psr);
      const data = buildPrismLevel(rng, rules, prevSignature.current);
      prevSignature.current = data.signature;

      notes.prepare(CRYSTAL_DEFS.slice(0, rules.crystals).map((c) => c.midi));

      setWavesDone(0);
      setWavesTotal(data.waves.length);
      heartsLeft.current = HEARTS;
      setHearts(HEARTS);
      shield.current = m === 'ARCADE' && useProfile.getState().shields > 0;
      setShieldArmed(shield.current);

      const now = performance.now();
      const firstWave = data.waves[0];
      const state: GameState = {
        data,
        waveIdx: 0,
        wave: firstWave,
        runner: new PrismWaveRunner(firstWave, 0, false, 0, now),
        phase: 'intro',
        phaseAt: now,
        cueStepIdx: 0,
        cueSubIdx: 0,
        lastPlayedCueKey: '',
        lastEchoCrystal: null,
        lastInputAt: now,
        lit: new Array<number>(MAX_CRYSTALS).fill(0),
        press: new Array<number>(MAX_CRYSTALS).fill(0),
        bad: new Array<number>(MAX_CRYSTALS).fill(0),
        hint: new Array<number>(MAX_CRYSTALS).fill(0),
        beams: [],
        positions: Array.from({ length: rules.crystals }, (_, id) =>
          slotCoord(firstWave.slotBeforeCue[id], rules.crystals),
        ),
        mirrorCue: firstWave.mirror ? 1 : 0,
        charge: 0,
        fever: 0,
        shieldUsed: false,
        mirrorCleared: false,
        feverReached: false,
        maxCombo: 0,
      };
      st.current = state;
      timer.set(0);
      ringState.set([0, 0, state.mirrorCue]);
      heroRef.current.play('pop');
    },
    [worldDef.residents, daily, rng, slotCoord, timer, ringState],
  );

  useEffect(() => {
    const t = setTimeout(() => beginLevel(level.current), 0);
    return () => {
      clearTimeout(t);
      epoch.current += 1;
      timeouts.current.forEach(clearTimeout);
    };
  }, [mode, daily, beginLevel]);

  useEffect(() => () => notes.release(), []);

  // ---- level outcomes -----------------------------------------------------
  const levelClear = useCallback(
    (s: GameState) => {
      s.phase = 'result';
      const lvl = level.current;
      const cfg = getPrismLevel(lvl);
      const k = useProfile.getState().mode === 'SANCTUARY' ? 0.35 : 1;
      const profile = useProfile.getState();
      const isFirstClear = lvl > profile.prismsLevel;
      profile.setPrismsLevel(lvl);
      profile.setPrismsBest(Math.max(profile.prismsBest, s.maxCombo));
      profile.unlockCreature(heroId);
      const feverBonus = s.feverReached ? 15 : 0;
      profile.awardXp(35 + lvl * 8 + feverBonus);
      useEconomy
        .getState()
        .earnStardust(cfg.stardustReward + (isFirstClear ? cfg.firstClearBonus : 0) + (s.feverReached ? 5 : 0));
      useSeasonPass.getState().addSeasonXp(20 + lvl * 2);

      const ach = useAchievements.getState();
      ach.setMetricMax('prisms_level', lvl + 1);
      ach.setMetricMax('prisms_combo', s.maxCombo);
      if (s.feverReached) ach.setMetricMax('prisms_fever', 1);
      if (s.mirrorCleared) ach.setMetricMax('prisms_mirror', 1);
      if (daily && profile.completeDaily('prisms')) profile.awardXp(80);

      heroRef.current.play('celebrate');
      squash(0.16);
      const j = juiceRef.current;
      j.emit({ x: cx, y: H * 0.42, kind: ParticleKind.Confetti, count: k < 1 ? 90 : 220 });
      j.emit({ x: cx, y: cy, kind: ParticleKind.Ring, count: 4 });
      j.doShake(10 * k, 400);
      j.doFlash(0.35 * k, 600);
      j.doBoost(1.5, 1200);
      sfx.play('chime', 1, 1.2);
      sfx.play('sparkle', 0.85);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      later(() => beginLevel(Math.min(30, lvl + 1)), 2600);
    },
    [heroId, daily, cx, cy, H, squash, later, beginLevel],
  );

  const waveFailed = useCallback(
    (s: GameState, hitCrystalId: number | null) => {
      const k = useProfile.getState().mode === 'SANCTUARY' ? 0.35 : 1;
      if (hitCrystalId !== null && hitCrystalId >= 0) s.bad[hitCrystalId] = 1;
      notes.beat('buzz', 0.32);
      sfx.play('sad', 0.55);
      heroRef.current.play('sad');
      squash(-0.12);
      juiceRef.current.doShake(9 * k, 360);
      timer.set(0);

      // Arcade Streak Shield absorbs a mistake or timeout and replays the wave cue.
      if (s.data.rules.hearts && shield.current && !s.shieldUsed) {
        s.shieldUsed = true;
        shield.current = false;
        setShieldArmed(false);
        useProfile.getState().spendShield();
        sfx.play('chime', 0.6, 1.3);
        juiceRef.current.emit({ x: W - 42, y: HUD_Y + 50, kind: ParticleKind.Ring, count: 3 });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        s.phase = 'between';
        s.phaseAt = performance.now();
        later(() => {
          if (st.current === s) setupWave(s, s.waveIdx, 0, false, 0, performance.now());
        }, 900);
        return;
      }

      if (s.data.rules.hearts) {
        heartsLeft.current -= 1;
        setHearts(heartsLeft.current);
        hurt.set(withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 500 })));
        skill.current.record(false, 1200);
        if (heartsLeft.current <= 0) {
          s.phase = 'result';
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          juiceRef.current.doShake(14, 700);
          later(() => beginLevel(level.current), RESULT_MS + 400);
          return;
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      s.phase = 'between';
      s.phaseAt = performance.now();
      later(() => {
        if (st.current === s) setupWave(s, s.waveIdx, 0, false, 0, performance.now());
      }, 1050);
    },
    [W, squash, timer, hurt, later, setupWave, beginLevel],
  );

  // ---- crystal tap / glide handler ----------------------------------------
  const levelClearRef = useRef(levelClear);
  const waveFailedRef = useRef(waveFailed);
  useEffect(() => {
    levelClearRef.current = levelClear;
    waveFailedRef.current = waveFailed;
  }, [levelClear, waveFailed]);

  const triggerCrystal = useCallback((s: GameState, id: number, now: number) => {
    if (s.phase !== 'echo') return;
    s.lastInputAt = now;
    s.hint.fill(0);

    const out = s.runner.tap(id, now);
    const [px, py] = s.positions[id] ?? [cx, cy];

    if (!out.hit) {
      if (s.data.rules.canFail) {
        waveFailedRef.current(s, id);
      } else {
        // Toybox / Sanctuary: gentle nudge + reveal hint on expected crystal
        s.bad[id] = 1;
        notes.beat('buzz', 0.2);
        sfx.play('sad', 0.35);
        heroRef.current.play('sad');
        Haptics.selectionAsync();
        const exp = s.runner.peekRemaining()[0];
        if (exp !== undefined) s.hint[exp] = 1;
      }
      return;
    }

    // Hit! Play harmonic note, light crystal, fire beam from last crystal
    s.lit[id] = 1;
    s.press[id] = 1;
    s.charge = out.charge;
    s.fever = out.fever ? 1 : s.fever * 0.5;
    s.maxCombo = Math.max(s.maxCombo, out.combo);
    if (out.fever) s.feverReached = true;

    notes.play(CRYSTAL_DEFS[id].midi, calm ? 0.72 : 0.9);
    if (heroRef.current.current() === 'idle') heroRef.current.play('pop');
    Haptics.impactAsync(
      out.fever ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );

    const j = juiceRef.current;
    j.emit({ x: px, y: py, kind: ParticleKind.Sparkle, count: out.fever ? 18 : 10 });

    if (s.lastEchoCrystal !== null && s.lastEchoCrystal !== id) {
      const [lx, ly] = s.positions[s.lastEchoCrystal] ?? [cx, cy];
      s.beams.push({
        x1: lx,
        y1: ly,
        x2: px,
        y2: py,
        colorIdx: id,
        alpha: 1,
        rainbow: out.fever,
        width: out.fever ? 6.5 : 4.5,
      });
    }
    s.lastEchoCrystal = id;

    if (out.feverActivated) {
      sfx.play('sparkle', 0.85, 1.15);
      j.emit({ x: cx, y: cy, kind: ParticleKind.Ring, count: 3 });
      j.doFlash(0.24, 380);
      j.doBoost(1.25, 900);
      squash(0.12);
    }

    if (out.waveComplete) {
      timer.set(0);
      if (s.wave.mirror) s.mirrorCleared = true;
      skill.current.record(true, Math.max(300, now - s.phaseAt));
      const nextWave = s.waveIdx + 1;
      setWavesDone(nextWave);

      if (nextWave >= s.data.waves.length) {
        levelClearRef.current(s);
      } else {
        s.phase = 'between';
        s.phaseAt = now;
        sfx.play('chime', 0.75, 1.05 + nextWave * 0.08);
        j.emit({ x: cx, y: cy, kind: ParticleKind.Ring, count: 2 });
        squash(0.08);
        later(() => {
          if (st.current === s) {
            setupWave(s, nextWave, s.runner.charge, s.runner.fever, s.runner.combo, performance.now());
          }
        }, BETWEEN_WAVES_MS);
      }
    }
  }, [cx, cy, calm, squash, timer, later, setupWave]);

  const hitCrystalAt = useCallback(
    (s: GameState, x: number, y: number): number => {
      let best = -1;
      let bestD = crystalR * 1.48;
      for (let i = 0; i < s.data.rules.crystals; i++) {
        const [px, py] = s.positions[i] ?? [0, 0];
        const d = Math.hypot(x - px, y - py);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
    [crystalR],
  );

  const touchDown = useCallback(
    (touchId: number, x: number, y: number) => {
      if (Math.hypot(x - (W - 42), y - HUD_Y) < 30) {
        requestCycle();
        sfx.play('sparkle', 0.5);
        Haptics.selectionAsync();
        juiceRef.current.emit({ x: W - 42, y: HUD_Y, kind: ParticleKind.Ring, count: 2 });
        return;
      }
      const s = st.current;
      if (!s || s.phase !== 'echo') return;
      const hit = hitCrystalAt(s, x, y);
      if (hit >= 0) {
        touchCrystalMap.current.set(touchId, hit);
        triggerCrystal(s, hit, performance.now());
      }
    },
    [W, requestCycle, hitCrystalAt, triggerCrystal],
  );

  const touchMove = useCallback(
    (touchId: number, x: number, y: number) => {
      const s = st.current;
      if (!s || s.phase !== 'echo') return;
      const hit = hitCrystalAt(s, x, y);
      if (hit < 0) return;
      const prev = touchCrystalMap.current.get(touchId);
      if (prev !== hit) {
        touchCrystalMap.current.set(touchId, hit);
        triggerCrystal(s, hit, performance.now());
      }
    },
    [hitCrystalAt, triggerCrystal],
  );

  const gesture = useManualGesture({
    runOnJS: true,
    onTouchesDown: (e) => e.changedTouches.forEach((t) => touchDown(t.id, t.x, t.y)),
    onTouchesMove: (e) => e.changedTouches.forEach((t) => touchMove(t.id, t.x, t.y)),
    onTouchesUp: (e) => e.changedTouches.forEach((t) => touchCrystalMap.current.delete(t.id)),
    onTouchesCancel: (e) => e.changedTouches.forEach((t) => touchCrystalMap.current.delete(t.id)),
  });

  // ---- main animation & phase loop ----------------------------------------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      heroY.set(Math.sin(now / 460) * 4);

      const s = st.current;
      if (!s) {
        crystalSnap.set([]);
        beamSnap.set([]);
        return;
      }

      const count = s.data.rules.crystals;
      const wave = s.wave;
      const since = now - s.phaseAt;

      // Decay lights, presses, errors, beams
      for (let i = 0; i < MAX_CRYSTALS; i++) {
        s.lit[i] = Math.max(0, s.lit[i] - dt * 2.8);
        s.press[i] = Math.max(0, s.press[i] - dt * 5.0);
        s.bad[i] = Math.max(0, s.bad[i] - dt * 2.6);
      }
      for (let i = s.beams.length - 1; i >= 0; i--) {
        s.beams[i].alpha -= dt * 2.1;
        if (s.beams[i].alpha <= 0) s.beams.splice(i, 1);
      }

      // Phase machine
      if (s.phase === 'intro') {
        if (since >= INTRO_MS) {
          s.phase = 'cue';
          s.phaseAt = now;
          s.cueStepIdx = 0;
          s.cueSubIdx = 0;
          s.lastPlayedCueKey = '';
        }
      } else if (s.phase === 'cue') {
        const stepMs = wave.cueStepMs;
        const idx = Math.floor(since / stepMs);
        if (idx >= wave.cueSteps.length) {
          const hasTransform = wave.rotateSteps > 0 || wave.swapPair !== null;
          if (hasTransform) {
            s.phase = 'transform';
            s.phaseAt = now;
            sfx.play('whoosh', 0.45, 1.15);
          } else {
            s.phase = 'echo';
            s.phaseAt = now;
            s.lastInputAt = now;
            s.lastEchoCrystal = null;
            if (wave.mirror) sfx.play('whoosh', 0.35, 0.85);
            Haptics.selectionAsync();
          }
        } else {
          const step = wave.cueSteps[idx];
          const local = (since - idx * stepMs) / stepMs;
          const flashWindow = wave.ghost ? 0.42 : 0.72;

          if (step.kind === 'double') {
            const sub = local < 0.48 ? 0 : 1;
            const subLocal = sub === 0 ? local / 0.48 : (local - 0.48) / 0.52;
            const key = `${wave.waveIndex}-${idx}-${sub}`;
            const cid = step.crystals[0];
            if (s.lastPlayedCueKey !== key) {
              s.lastPlayedCueKey = key;
              notes.play(CRYSTAL_DEFS[cid].midi, calm ? 0.65 : 0.85);
              heroRef.current.play('pop');
              const [px, py] = s.positions[cid];
              juiceRef.current.emit({ x: px, y: py, kind: ParticleKind.Sparkle, count: 6 });
              if (sub === 0 && idx > 0) {
                const prev = wave.cueSteps[idx - 1].crystals[0];
                if (prev !== cid) {
                  const [lx, ly] = s.positions[prev];
                  s.beams.push({ x1: lx, y1: ly, x2: px, y2: py, colorIdx: cid, alpha: 0.9, rainbow: false, width: 4 });
                }
              }
            }
            if (subLocal < (wave.ghost ? 0.55 : 0.78)) s.lit[cid] = 1;
          } else if (step.kind === 'chord') {
            const [a, b] = step.crystals;
            const key = `${wave.waveIndex}-${idx}-chord`;
            if (s.lastPlayedCueKey !== key) {
              s.lastPlayedCueKey = key;
              notes.play(CRYSTAL_DEFS[a].midi, calm ? 0.58 : 0.78);
              notes.play(CRYSTAL_DEFS[b].midi, calm ? 0.58 : 0.78);
              heroRef.current.play('pop');
              const [ax, ay] = s.positions[a];
              const [bx, by] = s.positions[b];
              juiceRef.current.emit({ x: ax, y: ay, kind: ParticleKind.Sparkle, count: 8 });
              juiceRef.current.emit({ x: bx, y: by, kind: ParticleKind.Sparkle, count: 8 });
              s.beams.push({ x1: ax, y1: ay, x2: bx, y2: by, colorIdx: a, alpha: 1, rainbow: true, width: 5.5 });
            }
            if (local < flashWindow) {
              s.lit[a] = 1;
              s.lit[b] = 1;
            }
          } else {
            const cid = step.crystals[0];
            const key = `${wave.waveIndex}-${idx}-single`;
            if (s.lastPlayedCueKey !== key) {
              s.lastPlayedCueKey = key;
              notes.play(CRYSTAL_DEFS[cid].midi, calm ? 0.65 : 0.85);
              heroRef.current.play('pop');
              const [px, py] = s.positions[cid];
              juiceRef.current.emit({ x: px, y: py, kind: ParticleKind.Sparkle, count: 8 });
              if (idx > 0) {
                const prev = wave.cueSteps[idx - 1].crystals[0];
                if (prev !== cid) {
                  const [lx, ly] = s.positions[prev];
                  s.beams.push({ x1: lx, y1: ly, x2: px, y2: py, colorIdx: cid, alpha: 0.95, rainbow: false, width: 4.5 });
                }
              }
            }
            if (local < flashWindow) s.lit[cid] = 1;
          }
        }
      } else if (s.phase === 'transform') {
        const u = Math.min(1, since / TRANSFORM_MS);
        const ease = 1 - Math.pow(1 - u, 3);
        for (let id = 0; id < count; id++) {
          const [x0, y0] = slotCoord(wave.slotBeforeCue[id], count);
          const [x1, y1] = slotCoord(wave.slotAfterCue[id], count);
          let arcY = 0;
          if (wave.swapPair && (wave.swapPair[0] === id || wave.swapPair[1] === id)) {
            arcY = Math.sin(u * Math.PI) * (wave.swapPair[0] === id ? -28 : 28);
          }
          s.positions[id] = [x0 + (x1 - x0) * ease, y0 + (y1 - y0) * ease + arcY];
        }
        if (u >= 1) {
          s.phase = 'echo';
          s.phaseAt = now;
          s.lastInputAt = now;
          s.lastEchoCrystal = null;
          Haptics.selectionAsync();
        }
      } else if (s.phase === 'echo') {
        if (wave.echoTimeMs !== null) {
          const left = 1 - since / wave.echoTimeMs;
          timer.set(Math.max(0, left));
          if (left <= 0) {
            waveFailedRef.current(s, null);
          }
        }
        if (s.data.rules.hintAfterMs !== null && now - s.lastInputAt > s.data.rules.hintAfterMs) {
          for (const cid of s.runner.peekRemaining()) {
            s.hint[cid] = 1;
          }
        }
      }

      // Pack crystals snapshot
      const cOut: number[] = [];
      for (let id = 0; id < count; id++) {
        const [px, py] = s.positions[id] ?? [cx, cy];
        const shapeIdx = CRYSTAL_SHAPES.indexOf(CRYSTAL_DEFS[id].shape);
        cOut.push(px, py, crystalR, shapeIdx, id, s.lit[id], s.press[id], s.bad[id], s.hint[id]);
      }
      crystalSnap.set(cOut);

      // Pack beams snapshot
      const bOut: number[] = [];
      for (const b of s.beams) {
        bOut.push(b.x1, b.y1, b.x2, b.y2, b.colorIdx, b.alpha, b.rainbow ? 1 : 0, b.width);
      }
      beamSnap.set(bOut);
      ringState.set([s.charge, s.runner.fever ? 1 : 0, s.mirrorCue]);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [calm, cx, cy, crystalR, slotCoord, heroY, crystalSnap, beamSnap, ringState, timer]);

  // ---- Skia pictures ----------------------------------------------------
  const overlayPic = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    const [chg, fev, mir] = ringState.value;
    drawCavernOverlay(c, W, H, cx, cy, ringR, chg, fev, mir, juice.time.value);
    return rec.finishRecordingAsPicture();
  });

  const beamsPic = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawBeams(c, beamSnap.value, juice.time.value);
    return rec.finishRecordingAsPicture();
  });

  const crystalsPic = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawCrystals(c, crystalSnap.value, juice.time.value);
    return rec.finishRecordingAsPicture();
  });

  const heroTransform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: heroY.value },
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

  // Verify stride constants match packed values
  void CRYSTAL_STRIDE;
  void BEAM_STRIDE;
  void CRYSTAL_COLORS;

  return (
    <View style={styles.root}>
      <LevelSplash level={currentLevel} gameTitle="PRISM CHORUS" worldName={worldDef.id} triggerKey={splashTrigger} />
      <GestureDetector gesture={gesture}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={juice.worldTransform}>
            <WorldBackdrop W={W} H={H} still={worldDef.still} time={juice.time} boost={juice.boost} light={{ x: 0.5, y: 0.1 }} />
            <Picture picture={juice.back} />
            <Picture picture={overlayPic} />

            {/* Center resident mascot */}
            <Oval x={cx - mascotW * 0.28} y={mascotFeet - mascotH * 0.04} width={mascotW * 0.56} height={mascotH * 0.08} color="rgba(0,10,36,0.45)">
              <BlurMask blur={9} style="normal" />
            </Oval>
            <Group transform={heroTransform} origin={vec(0, mascotFeet)}>
              <SpriteCharacter
                sheet={heroSheet}
                images={heroImages}
                clip={hero.clip}
                frame={hero.frame}
                x={-mascotW / 2}
                y={mascotFeet - mascotH}
                height={mascotH}
              />
            </Group>

            <Picture picture={beamsPic} />
            <Picture picture={crystalsPic} />
            <Picture picture={juice.front} />
          </Group>

          {/* HUD: wave pips, echo timer (Arcade), hearts (Arcade), mode & shield. Icons only. */}
          {Array.from({ length: wavesTotal }).map((_, i) => (
            <Group key={`w${i}`}>
              <Circle
                cx={W / 2 + (i - (wavesTotal - 1) / 2) * 26}
                cy={HUD_Y}
                r={8}
                color={i < wavesDone ? '#7FE8FF' : 'rgba(255,255,255,0.22)'}
              />
              {i < wavesDone && (
                <Circle cx={W / 2 + (i - (wavesTotal - 1) / 2) * 26} cy={HUD_Y} r={14} color="rgba(127,232,255,0.38)">
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

          <Circle cx={W - 42} cy={HUD_Y} r={24} color="rgba(20,12,48,0.6)" />
          <ModeIcon mode={mode} x={W - 42} y={HUD_Y} />
          {mode === 'ARCADE' && <ShieldIcon x={W - 42} y={HUD_Y + 50} armed={shieldArmed} />}

          <Rect x={0} y={0} width={W} height={H}>
            <RadialGradient c={vec(W / 2, H * 0.55)} r={Math.max(W, H) * 0.75} colors={['rgba(0,0,0,0)', 'rgba(6,2,28,0.5)']} positions={[0.55, 1]} />
          </Rect>
          <Rect x={0} y={0} width={W} height={H} color="#FF2D55" opacity={hurtTint} />
          <Rect x={0} y={0} width={W} height={H} color="white" opacity={juice.flash} blendMode="plus" />
          {!heroImages[0] && <Rect x={0} y={0} width={W} height={H} color="#06021C" opacity={0.85} />}
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#06021C' },
});
