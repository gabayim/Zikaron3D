import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ParentalGate } from '../ui/ParentalGate';
import { useParentalModeCycle } from '../ui/useParentalModeCycle';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gem, Sparkles } from 'lucide-react-native';
import { useEconomy } from '../store/economy';
import { useInventory } from '../store/inventory';
import { ACCESSORY_ASSETS } from '../data/shopAssets';
import {
  BlurMask,
  Canvas,
  Circle,
  Fill,
  Group,
  Image,
  Path,
  LinearGradient,
  Oval,
  Picture,
  RadialGradient,
  Rect,
  RoundedRect,
  Shader,
  Skia,
  SweepGradient,
  useImage,
  vec,
  PaintStyle,
  type SkImage,
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
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { GestureDetector, useExclusiveGestures, useLongPressGesture, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { PIP, getCharacter } from '../render/sprites';
import { SpriteCharacter, useClipImages, useSpritePlayer } from '../render/SpriteCharacter';
import { createPool, drawFireflies, drawPool, ParticleKind, spawnBurst, stepPool, type BurstRequest } from '../render/particles';
import { lightRays, skyAtmosphere } from '../render/shaders';
import { drawBootLogo, drawHalo, drawIcon, easeOutBack } from '../render/hubDraw';
import { sfx, useCrossfadeMusic } from '../fx/sound';
import { useProfile, type GameId } from '../store/profile';
import { levelForXp, levelProgress } from '../store/progression';
import { WORLDS, type WorldDef, type WorldId } from '../worlds';

const WORLD_GAME_MAP: Record<WorldId, GameId> = {
  meadow: 'burrows',
  crystal: 'orbs',
  candy: 'stars',
  deep_sea: 'burrows',
  grove: 'stars',
  circuit: 'orbs',
  summit: 'stars',
};

/** Character shown standing in each world's portal (same order as WORLDS). */
const FEATURED = ['fuzz', 'frost', 'zap', 'coral', 'moss', 'bolt', 'luna'];
const ACCENTS = WORLDS.map((w) => w.accent);
const MUSIC_SOURCES = WORLDS.map((w) => w.music);
const MASCOT_CLIPS = ['idle', 'hop', 'wave', 'celebrate'] as const;
const FEATURED_CLIPS = ['idle'] as const;
const SPRING = { damping: 17, stiffness: 150, mass: 0.9 };
const LOCK_SHACKLE = Skia.PathBuilder.Make()
  .moveTo(-13, -4)
  .lineTo(-13, -16)
  .addArc(Skia.XYWHRect(-13, -32, 26, 32), 180, 180)
  .moveTo(13, -16)
  .lineTo(13, -4)
  .build();

// Boot timeline (seconds).
const BOOT_FLASH = 1.75;
const BOOT_REVEAL_DELAY_MS = 2100;

// Module-level so returning from a world skips the logo intro.
let hasBooted = false;

interface Geo {
  W: number;
  H: number;
  pw: number;
  ph: number;
  cx: number;
  cy: number;
  spacing: number;
  cover: number;
}

const clamp01 = (v: number) => {
  'worklet';
  return Math.max(0, Math.min(1, v));
};

interface BackdropProps {
  still: SkImage | null;
  index: number;
  pos: SharedValue<number>;
  reveal: SharedValue<number>;
  warp: SharedValue<number>;
  parallax: SharedValue<{ x: number; y: number }>;
  time: SharedValue<number>;
  W: number;
  H: number;
}

/** Full-screen world still that crossfades as the carousel moves. */
function Backdrop({ still, index, pos, reveal, warp, parallax, time, W, H }: BackdropProps) {
  const bgW = Math.max(W, H * (9 / 16));
  const bgH = bgW * (16 / 9);
  const opacity = useDerivedValue(() => Math.max(0, 1 - Math.abs(pos.get() - index)) * (0.35 + 0.65 * reveal.get()));
  const transform = useDerivedValue(() => [
    { translateX: -parallax.get().x * 16 + Math.sin(time.get() * 0.11 + index) * 6 - (pos.get() - index) * 40 },
    { translateY: -parallax.get().y * 10 + Math.sin(time.get() * 0.07) * 4 },
    { scale: 1.1 + Math.sin(time.get() * 0.09) * 0.015 + warp.get() * 0.4 },
  ]);
  return (
    <Group opacity={opacity} transform={transform} origin={vec(W / 2, H / 2)}>
      <Image image={still} x={(W - bgW) / 2} y={(H - bgH) / 2} width={bgW} height={bgH} fit="cover" />
    </Group>
  );
}

interface PortalProps {
  index: number;
  world: WorldDef;
  still: SkImage | null;
  featuredId: string;
  geo: Geo;
  pos: SharedValue<number>;
  reveal: SharedValue<number>;
  warp: SharedValue<number>;
  time: SharedValue<number>;
  locked: boolean;
}

/** One animated world portal: a glowing window into the world with a resident standing in front. */
function Portal({ index, world, still, featuredId, geo, pos, reveal, warp, time, locked }: PortalProps) {
  const { H, pw, ph, cx, cy, spacing, cover } = geo;
  const sheet = getCharacter(featuredId);
  const images = useClipImages(sheet, FEATURED_CLIPS);
  const player = useSpritePlayer(sheet);

  const state = useDerivedValue(() => {
    const d = index - pos.get();
    const ad = Math.min(Math.abs(d), 2);
    const focus = Math.max(0, 1 - Math.abs(d));
    const rv = clamp01(reveal.get() * 1.5 - index * 0.18);
    const enter = easeOutBack(rv);
    const w = warp.get();
    const f2 = focus * focus * w;
    const base = (1 - 0.26 * ad) * (0.45 + 0.55 * enter);
    return {
      d,
      ad,
      focus,
      f2,
      s: base + (cover - base) * f2,
      x: (cx + d * spacing * (1 - 0.12 * ad)) * (1 - f2) + cx * f2,
      y: (cy + ad * 22 + (1 - enter) * 60) * (1 - f2) + (H / 2) * f2,
      opacity: (1 - 0.3 * ad) * clamp01(rv * 2) * (1 - w * (1 - focus)),
    };
  });

  const transform = useDerivedValue(() => {
    const st = state.get();
    return [{ translateX: st.x }, { translateY: st.y }, { rotate: st.d * 0.06 * (1 - st.f2) }, { scale: st.s }];
  });
  const opacity = useDerivedValue(() => state.get().opacity);
  const dimOpacity = useDerivedValue(() => 0.5 * (1 - state.get().focus));
  const residentOpacity = useDerivedValue(() => 1 - warp.get() * 1.4);
  const innerTransform = useDerivedValue(() => [{ translateX: -state.get().d * pw * 0.1 }, { scale: 1.18 }]);
  const glowOpacity = useDerivedValue(() => (0.28 + 0.12 * Math.sin(time.get() * 2.2 + index)) * state.get().focus);
  const sweepTransform = useDerivedValue(() => [{ rotate: time.get() * 0.9 }]);
  const shineStart = useDerivedValue(() => {
    const u = ((time.get() * 0.28 + index * 0.37) % 2.4) / 2.4;
    return vec(-pw * 0.9 + u * pw * 2.6, -ph * 0.5);
  });
  const shineEnd = useDerivedValue(() => {
    const u = ((time.get() * 0.28 + index * 0.37) % 2.4) / 2.4;
    return vec(-pw * 0.9 + u * pw * 2.6 + pw * 0.45, ph * 0.25);
  });
  const halo = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(-pw, -ph, pw * 2, ph * 2));
    const f = state.get().focus * clamp01(reveal.get() * 2);
    if (f > 0.02) drawHalo(c, 0, 0, pw / 2, ph / 2, time.get() + index * 3, world.accent, f);
    return rec.finishRecordingAsPicture();
  });

  const r = pw * 0.14;
  const rx = -pw / 2;
  const ry = -ph / 2;
  const charH = ph * 0.46;
  const charW = (charH * sheet.frameWidth) / sheet.frameHeight;

  return (
    <Group transform={transform} opacity={opacity}>
      {/* Outer glow */}
      <RoundedRect x={rx - 10} y={ry - 10} width={pw + 20} height={ph + 20} r={r + 8} color={world.accent} opacity={glowOpacity}>
        <BlurMask blur={30} style="normal" />
      </RoundedRect>

      {/* Window into the world */}
      <Group clip={Skia.RRectXY(Skia.XYWHRect(rx, ry, pw, ph), r, r)}>
        <Fill color="#0B0620" />
        <Group transform={innerTransform}>
          <Image image={still} x={rx} y={ry} width={pw} height={ph} fit="cover" />
        </Group>
        <Rect x={rx} y={ry} width={pw} height={ph}>
          <LinearGradient start={vec(0, ry)} end={vec(0, -ry)} colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.0)', 'rgba(8,2,28,0.55)']} positions={[0, 0.55, 1]} />
        </Rect>
        <Rect x={rx} y={ry} width={pw} height={ph} color="#0B0620" opacity={dimOpacity} />
        {locked && <Rect x={rx} y={ry} width={pw} height={ph} color="#0B0620" opacity={0.62} />}
        <Rect x={rx} y={ry} width={pw} height={ph} blendMode="plus">
          <LinearGradient start={shineStart} end={shineEnd} colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} />
        </Rect>
      </Group>

      {/* Animated rim */}
      <RoundedRect x={rx} y={ry} width={pw} height={ph} r={r} style="stroke" strokeWidth={5}>
        <SweepGradient c={vec(0, 0)} colors={[world.accent, '#FFFFFF', world.accent2, world.accent]} transform={sweepTransform} />
      </RoundedRect>
      <RoundedRect x={rx + 4} y={ry + 4} width={pw - 8} height={ph - 8} r={r - 3} style="stroke" strokeWidth={1.5} color="rgba(255,255,255,0.28)" />

      <Picture picture={halo} />

      {/* Resident peeks out over the rim */}
      <Group opacity={locked ? 0.2 : residentOpacity}>
        <Oval x={-charW * 0.3} y={ph / 2 - charH * 0.12} width={charW * 0.6} height={charH * 0.12} color="rgba(10,0,30,0.5)">
          <BlurMask blur={8} style="normal" />
        </Oval>
        <SpriteCharacter sheet={sheet} images={images} clip={player.clip} frame={player.frame} x={-charW / 2} y={ph / 2 - charH * 0.9} height={charH} />
      </Group>
      {locked && (
        <Group opacity={residentOpacity}>
          <Circle cx={0} cy={0} r={pw * 0.2} color="rgba(11,6,32,0.7)" />
          <Circle cx={0} cy={0} r={pw * 0.2} color={world.accent} style="stroke" strokeWidth={3} />
          <Group transform={[{ scale: pw / 260 }]}>
            <Path path={LOCK_SHACKLE} color="#FFE9A8" style="stroke" strokeWidth={7} strokeCap="round" />
            <RoundedRect x={-22} y={-6} width={44} height={36} r={9} color="#FFE9A8" />
            <Circle cx={0} cy={10} r={5} color="#2A1457" />
            <RoundedRect x={-2.2} y={12} width={4.4} height={9} r={2} color="#2A1457" />
          </Group>
        </Group>
      )}
    </Group>
  );
}

interface HubProps {
  onEnter: (world: WorldId) => void;
  onDaily: () => void;
  onCollection: () => void;
  onSettings: () => void;
  onLeaderboard: () => void;
  onShop: () => void;
  onSeasonPass: () => void;
  onLevelSelect?: (game: GameId) => void;
  onProfile?: () => void;
}

export default function Hub({
  onEnter,
  onDaily,
  onCollection,
  onSettings,
  onLeaderboard,
  onShop,
  onSeasonPass,
  onLevelSelect,
  onProfile,
}: HubProps) {
  const { width: W, height: H } = useWindowDimensions();
  const [skipBoot] = useState(() => hasBooted);
  const xp = useProfile((state) => state.xp);
  const collectionSize = useProfile((state) => state.collection.length);
  const dailyComplete = useProfile((state) => state.dailyCompleted.length > 0);
  const xpRing = levelProgress(xp);
  const level = levelForXp(xp);
  const unlockedWorlds = useProfile((state) => state.unlockedWorlds);
  const unlockWorld = useProfile((state) => state.unlockWorld);
  const markWorldCelebrated = useProfile((state) => state.markWorldCelebrated);
  const spendStardust = useEconomy((state) => state.spendStardust);
  const spendCrystals = useEconomy((state) => state.spendCrystals);
  const [unlockTarget, setUnlockTarget] = useState<WorldDef | null>(null);

  const lockedFlags = WORLDS.map((w) => !unlockedWorlds.includes(w.id));
  const lockedRef = useRef(lockedFlags);
  useEffect(() => {
    lockedRef.current = lockedFlags;
  });
  const celebrated = useProfile((state) => state.celebratedWorlds);
  const { gateOpen, requestCycle, confirmGate, cancelGate } = useParentalModeCycle();

  // ---- layout -------------------------------------------------------------
  const geo = useMemo<Geo>(() => {
    const ph = Math.min(H * 0.5, (W * 0.66) / 0.62);
    const pw = ph * 0.62;
    return { W, H, pw, ph, cx: W / 2, cy: H * 0.4, spacing: pw * 1.0, cover: Math.max(W / pw, H / ph) * 1.08 };
  }, [W, H]);
  const hud = useMemo(
    () => ({
      avatar: { x: 52, y: 112 },
      pass: { x: W - 232, y: 112 },
      cup: { x: W - 184, y: 112 },
      shop: { x: W - 136, y: 112 },
      star: { x: W - 88, y: 112 },
      gear: { x: W - 40, y: 112 },
      levels: { x: W * 0.73 - 62, y: H * 0.865, r: 24 },
      play: { x: W * 0.73, y: H * 0.865, r: 40 },
      dotsY: H * 0.7,
      pipX: W * 0.22,
      pipGround: H * 0.95,
      pipH: Math.min(H * 0.2, W * 0.5),
    }),
    [W, H],
  );
  const pipW = (hud.pipH * PIP.frameWidth) / PIP.frameHeight;
  const pipY = hud.pipGround - hud.pipH * 0.9;

  // ---- assets -------------------------------------------------------------
  const stills = [
    useImage(WORLDS[0].still),
    useImage(WORLDS[1].still),
    useImage(WORLDS[2].still),
    useImage(WORLDS[3].still),
    useImage(WORLDS[4].still),
    useImage(WORLDS[5].still),
    useImage(WORLDS[6].still),
  ];
  const pipImages = useClipImages(PIP, MASCOT_CLIPS);
  const ready = stills.every(Boolean) && !!pipImages[0];
  const pip = useSpritePlayer(PIP);
  const equippedAccessories = useInventory((state) => state.equippedAccessories);
  const hatImg = useImage(equippedAccessories.hat ? ACCESSORY_ASSETS[equippedAccessories.hat] : null);
  const auraImg = useImage(equippedAccessories.aura ? ACCESSORY_ASSETS[equippedAccessories.aura] : null);
  const trailImg = useImage(equippedAccessories.trail ? ACCESSORY_ASSETS[equippedAccessories.trail] : null);
  const exprImg = useImage(equippedAccessories.expression ? ACCESSORY_ASSETS[equippedAccessories.expression] : null);

  // ---- state --------------------------------------------------------------
  const [focus, setFocus] = useState(0);
  const focusRef = useRef(0);
  const busy = useRef(false);
  const booting = useRef(true);
  useCrossfadeMusic(MUSIC_SOURCES, focus, 0.38);

  const time = useSharedValue(0);
  const go = useSharedValue(0);
  const bootT0 = useSharedValue(-1);
  const pos = useSharedValue(0);
  const panBase = useSharedValue(0);
  const reveal = useSharedValue(0);
  const warp = useSharedValue(0);
  const pipEnter = useSharedValue(0);
  const squashX = useSharedValue(1);
  const squashY = useSharedValue(1);
  const playPulse = useSharedValue(0);
  const flashPulse = useSharedValue(0);
  const pool = useSharedValue(createPool());
  const bursts = useSharedValue<BurstRequest[]>([]);
  const parallax = useSharedValue({ x: 0, y: 0 });
  const gravity = useAnimatedSensor(SensorType.GRAVITY, { interval: 'auto' });

  useFrameCallback((info) => {
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const now = info.timestamp / 1000;
    time.set(now);
    if (go.get() === 1 && bootT0.get() < 0) bootT0.set(skipBoot ? now - 100 : now);
    const pending = bursts.get();
    if (pending.length) bursts.set([]);
    pool.modify((p) => {
      'worklet';
      for (let i = 0; i < pending.length; i++) spawnBurst(p, pending[i]);
      stepPool(p, dt);
      return p;
    });
    const g = gravity.sensor.get();
    const tx = Math.max(-1, Math.min(1, g.x / 9.81));
    const ty = Math.max(-1, Math.min(1, g.y / 9.81 + 0.6));
    const pr = parallax.get();
    parallax.set({ x: pr.x + (tx - pr.x) * 0.06, y: pr.y + (ty - pr.y) * 0.06 });
  });

  // ---- juice --------------------------------------------------------------
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

  // Boot / return sequence.
  useEffect(() => {
    if (!ready) return;
    go.set(1);
    hasBooted = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (skipBoot) {
      reveal.set(withTiming(1, { duration: 900 }));
      pipEnter.set(withDelay(500, withSpring(1, { damping: 13, stiffness: 160 })));
      sfx.play('whoosh', 0.5);
      timers.push(setTimeout(() => (booting.current = false), 900));
    } else {
      sfx.play('whoosh', 0.8);
      timers.push(
        setTimeout(() => {
          sfx.play('chime', 0.9);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          emit({ x: W / 2, y: H * 0.4, kind: ParticleKind.Sparkle, count: 40 });
        }, BOOT_FLASH * 1000),
      );
      reveal.set(withDelay(BOOT_REVEAL_DELAY_MS, withTiming(1, { duration: 1300 })));
      pipEnter.set(withDelay(BOOT_REVEAL_DELAY_MS + 900, withSpring(1, { damping: 13, stiffness: 160 })));
      timers.push(
        setTimeout(() => {
          sfx.play('pop');
          squash(0.16);
          emit({ x: hud.pipX, y: hud.pipGround, kind: ParticleKind.Ring, count: 3 });
          emit({ x: hud.pipX, y: hud.pipGround - 20, kind: ParticleKind.Sparkle, count: 22 });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          pip.play('wave');
          booting.current = false;
        }, BOOT_REVEAL_DELAY_MS + 1300),
      );
    }
    return () => timers.forEach(clearTimeout);
    // Run once when assets are ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Idle: Pip fidgets and the focused portal pulses a ring now and then.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      if (booting.current || busy.current) return;
      if (pip.current() === 'idle' && Math.random() < 0.4) pip.play(Math.random() < 0.5 ? 'wave' : 'hop');
      emit({ x: W / 2, y: geo.cy + geo.ph * 0.5, kind: ParticleKind.Ring, count: 1 });
    }, 4500);
    return () => clearInterval(id);
  }, [ready, pip, emit, W, geo.cy, geo.ph]);

  // ---- actions ------------------------------------------------------------
  const onFocus = useCallback(
    (index: number) => {
      if (index === focusRef.current) return;
      focusRef.current = index;
      setFocus(index);
      Haptics.selectionAsync();
      sfx.play('pop', 0.45);
      emit({ x: W / 2, y: geo.cy, kind: ParticleKind.Sparkle, count: 14 });
      if (pip.current() === 'idle') pip.play('hop');
    },
    [emit, pip, W, geo.cy],
  );

  const goTo = useCallback(
    (index: number) => {
      const i = Math.max(0, Math.min(WORLDS.length - 1, index));
      pos.set(withSpring(i, SPRING));
      onFocus(i);
    },
    [pos, onFocus],
  );

  const enter = useCallback(() => {
    if (busy.current) return;
    if (lockedRef.current[focusRef.current]) {
      const world = WORLDS[focusRef.current];
      setUnlockTarget(world);
      sfx.play('sad', 0.35);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      squash(0.1);
      return;
    }
    busy.current = true;
    const world = WORLDS[focusRef.current].id;
    sfx.play('whoosh', 0.9);
    sfx.play('chime', 0.6);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    pip.play('celebrate');
    emit({ x: W / 2, y: geo.cy, kind: ParticleKind.Ring, count: 4 });
    emit({ x: W / 2, y: geo.cy, kind: ParticleKind.Confetti, count: 90 });
    warp.set(withDelay(250, withTiming(1, { duration: 800 }, (finished) => {
      'worklet';
      if (finished) scheduleOnRN(onEnter, world);
    })));
    flashPulse.set(withDelay(800, withTiming(1, { duration: 280 })));
  }, [pip, emit, warp, flashPulse, onEnter, W, geo.cy, squash]);

  const handleConfirmUnlock = useCallback(
    (currency: 'stardust' | 'crystals') => {
      if (!unlockTarget) return;
      if (currency === 'stardust' && unlockTarget.priceStardust != null) {
        const ok = spendStardust(unlockTarget.priceStardust);
        if (ok) {
          unlockWorld(unlockTarget.id);
          markWorldCelebrated(unlockTarget.id);
          sfx.play('chime', 0.9);
          sfx.play('sparkle', 0.8);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          emit({ x: W / 2, y: geo.cy, kind: ParticleKind.Confetti, count: 120 });
          emit({ x: W / 2, y: geo.cy, kind: ParticleKind.Ring, count: 4 });
          setUnlockTarget(null);
        } else {
          sfx.play('sad', 0.5);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else if (currency === 'crystals' && unlockTarget.priceCrystals != null) {
        const ok = spendCrystals(unlockTarget.priceCrystals);
        if (ok) {
          unlockWorld(unlockTarget.id);
          markWorldCelebrated(unlockTarget.id);
          sfx.play('chime', 0.9);
          sfx.play('sparkle', 0.8);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          emit({ x: W / 2, y: geo.cy, kind: ParticleKind.Confetti, count: 120 });
          emit({ x: W / 2, y: geo.cy, kind: ParticleKind.Ring, count: 4 });
          setUnlockTarget(null);
        } else {
          sfx.play('sad', 0.5);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    },
    [unlockTarget, spendStardust, spendCrystals, unlockWorld, markWorldCelebrated, emit, W, geo.cy],
  );

  // A newly unlocked world: glide to its portal and celebrate once.
  useEffect(() => {
    if (!ready) return;
    const idx = WORLDS.findIndex((w, i) => !lockedFlags[i] && !celebrated.includes(w.id));
    if (idx < 0) return;
    const t = setTimeout(
      () => {
        goTo(idx);
        sfx.play('chime', 0.9);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        emit({ x: W / 2, y: geo.cy, kind: ParticleKind.Confetti, count: 110 });
        emit({ x: W / 2, y: geo.cy, kind: ParticleKind.Ring, count: 4 });
        useProfile.getState().markWorldCelebrated(WORLDS[idx].id);
      },
      skipBoot ? 1200 : BOOT_REVEAL_DELAY_MS + 2600,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, level, celebrated]);

  const skipIntro = useCallback(() => {
    // Jump the logo to the end and reveal the hub immediately.
    bootT0.set(time.get() - 10);
    reveal.set(withTiming(1, { duration: 500 }));
    pipEnter.set(withDelay(200, withSpring(1, { damping: 13, stiffness: 160 })));
    booting.current = false;
  }, [bootT0, time, reveal, pipEnter]);

  const onTap = useCallback(
    (x: number, y: number) => {
      if (busy.current) return;
      if (booting.current) {
        skipIntro();
        return;
      }
      const near = (p: { x: number; y: number }, r: number) => Math.hypot(x - p.x, y - p.y) < r;

      // HUD: avatar ring is daily beacon; pass is season pass; cup is leaderboard; shop is cosmetics; star is collection; gear is mode.
      if (
        near(hud.avatar, 34) ||
        near(hud.pass, 24) ||
        near(hud.cup, 24) ||
        near(hud.shop, 24) ||
        near(hud.star, 24) ||
        near(hud.gear, 24)
      ) {
        const onAvatar = near(hud.avatar, 34);
        const onPass = near(hud.pass, 26);
        const onCup = near(hud.cup, 26);
        const onShopHit = near(hud.shop, 26);
        const onStar = near(hud.star, 26);
        const p = onAvatar
          ? hud.avatar
          : onPass
          ? hud.pass
          : onCup
          ? hud.cup
          : onShopHit
          ? hud.shop
          : onStar
          ? hud.star
          : hud.gear;
        emit({ x: p.x, y: p.y, kind: ParticleKind.Ring, count: 2 });
        emit({ x: p.x, y: p.y, kind: ParticleKind.Sparkle, count: 10 });
        sfx.play('sparkle', 0.5);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onPass) {
          onSeasonPass();
        } else if (onCup) {
          onLeaderboard();
        } else if (onShopHit) {
          onShop();
        } else if (onStar) {
          onCollection();
        } else if (onAvatar) {
          if (onProfile) onProfile();
          else onDaily();
        } else {
          requestCycle();
        }
        return;
      }

      // Level select button -> open 30-level map for current world's game
      if (onLevelSelect && near(hud.levels, 28)) {
        emit({ x: hud.levels.x, y: hud.levels.y, kind: ParticleKind.Ring, count: 1 });
        emit({ x: hud.levels.x, y: hud.levels.y, kind: ParticleKind.Sparkle, count: 8 });
        sfx.play('whoosh', 0.6);
        Haptics.selectionAsync();
        const curWorld = WORLDS[focusRef.current]?.id ?? 'meadow';
        const game = WORLD_GAME_MAP[curWorld] ?? 'burrows';
        onLevelSelect(game);
        return;
      }

      // Play button or focused portal -> dive in.
      const onPlay = near(hud.play, hud.play.r + 18);
      const onPortal = Math.abs(x - geo.cx) < geo.pw / 2 && Math.abs(y - geo.cy) < geo.ph / 2;
      if (onPlay || onPortal) {
        playPulse.set(withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 300 })));
        enter();
        return;
      }

      // Side portals slide in.
      if (y > geo.cy - geo.ph / 2 && y < geo.cy + geo.ph / 2) {
        goTo(focusRef.current + (x < geo.cx ? -1 : 1));
        return;
      }

      // Pip.
      if (Math.abs(x - hud.pipX) < pipW * 0.45 && y > pipY + hud.pipH * 0.15 && y < hud.pipGround) {
        pip.play(Math.random() < 0.5 ? 'wave' : 'hop');
        squash(0.14);
        sfx.play('pop');
        if (Math.random() < 0.5) setTimeout(() => sfx.play('boing', 0.6), 300);
        emit({ x: hud.pipX, y: pipY + hud.pipH * 0.5, kind: ParticleKind.Sparkle, count: 16 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onProfile) onProfile();
        return;
      }

      emit({ x, y, kind: ParticleKind.Ring, count: 1 });
      emit({ x, y, kind: ParticleKind.Sparkle, count: 8 });
      sfx.play('sparkle', 0.35);
    },
    [hud, geo, emit, enter, goTo, onCollection, onDaily, onLeaderboard, onShop, onSeasonPass, onLevelSelect, onProfile, pip, squash, skipIntro, playPulse, pipW, pipY, requestCycle],
  );

  const pan = usePanGesture({
    activeOffsetX: [-10, 10],
    failOffsetY: [-40, 40],
    onBegin: () => {
      'worklet';
      panBase.set(pos.get());
    },
    onUpdate: (e) => {
      'worklet';
      if (reveal.get() < 0.9 || warp.get() > 0) return;
      const raw = panBase.get() - e.translationX / geo.spacing;
      // Rubber-band past the ends.
      const over = raw < 0 ? raw : raw > WORLDS.length - 1 ? raw - (WORLDS.length - 1) : 0;
      pos.set(raw - over * 0.65);
    },
    onDeactivate: (e) => {
      'worklet';
      if (reveal.get() < 0.9 || warp.get() > 0) return;
      const projected = pos.get() - (e.velocityX / geo.spacing) * 0.18;
      const target = Math.max(0, Math.min(WORLDS.length - 1, Math.round(projected)));
      pos.set(withSpring(target, { ...SPRING, velocity: -e.velocityX / geo.spacing }));
      scheduleOnRN(onFocus, target);
    },
  });
  const tap = useTapGesture({ runOnJS: true, maxDuration: 400, onActivate: (e) => onTap(e.x, e.y) });
  const gearHold = useLongPressGesture({
    runOnJS: true,
    minDuration: 480,
    onActivate: (e) => {
      if (Math.hypot(e.x - hud.gear.x, e.y - hud.gear.y) < 34) onSettings();
    },
  });
  const gesture = useExclusiveGestures(pan, gearHold, tap);

  // ---- derived render values ----------------------------------------------
  const atmosphereUniforms = useDerivedValue(() => ({ res: [W, H], time: time.get() }));
  const raysUniforms = useDerivedValue(() => ({ res: [W, H], origin: [W * 0.72, -H * 0.04], time: time.get(), strength: 0.14 }));
  const worldZoom = useDerivedValue(() => [{ scale: 1 + warp.get() * 0.08 }]);

  const backParticles = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawFireflies(c, W, H, time.get(), 26);
    return rec.finishRecordingAsPicture();
  });
  const frontParticles = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawPool(c, pool.get(), time.get());
    return rec.finishRecordingAsPicture();
  });

  const pipTransform = useDerivedValue(() => [
    { translateX: parallax.get().x * 5 },
    { translateY: Math.max(0, 1 - pipEnter.get()) * H * 0.3 },
    { scaleX: squashX.get() * (0.6 + 0.4 * pipEnter.get()) },
    { scaleY: squashY.get() * (0.6 + 0.4 * pipEnter.get()) },
  ]);
  const pipShadowTransform = useDerivedValue(() => [{ scaleX: squashX.get() * pipEnter.get() }, { scaleY: pipEnter.get() }]);
  const pipOpacity = useDerivedValue(() => 1 - clamp01((warp.get() - 0.5) * 2));

  // HUD: icons, XP ring, carousel dots, play button. Icon-only, drawn each frame.
  const uiPicture = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    const a = clamp01(reveal.get() * 1.6 - 0.3) * (1 - warp.get());
    const t = time.get();
    const idx = Math.max(0, Math.min(WORLDS.length - 1, Math.round(pos.get())));
    const accent = lockedFlags[idx] ? '#6B6486' : ACCENTS[idx];

    if (a > 0.01) {
      // Avatar + XP ring.
      const av = hud.avatar;
      const base = Skia.Paint();
      base.setAntiAlias(true);
      base.setColor(Skia.Color('#1A0F3D'));
      base.setAlphaf(0.75 * a);
      c.drawCircle(av.x, av.y, 24, base);
      const ring = Skia.Paint();
      ring.setAntiAlias(true);
      ring.setStyle(PaintStyle.Stroke);
      ring.setStrokeWidth(5);
      ring.setStrokeCap(1);
      ring.setColor(Skia.Color('#FFFFFF'));
      ring.setAlphaf(0.18 * a);
      const oval = Skia.XYWHRect(av.x - 30, av.y - 30, 60, 60);
      c.drawArc(oval, 0, 360, false, ring);
      ring.setColor(Skia.Color(dailyComplete ? '#8CFFC1' : '#FFD36E'));
      ring.setAlphaf(a);
      c.drawArc(oval, -90, 360 * xpRing, false, ring);
      drawIcon(c, 'avatar', av.x, av.y + 1, 15, '#FFFFFF', a * 0.9);

      // Collection + settings.
      const btn = Skia.Paint();
      btn.setAntiAlias(true);
      btn.setColor(Skia.Color('#1A0F3D'));
      btn.setAlphaf(0.6 * a);
      c.drawCircle(hud.pass.x, hud.pass.y, 22, btn);
      c.drawCircle(hud.cup.x, hud.cup.y, 22, btn);
      c.drawCircle(hud.shop.x, hud.shop.y, 22, btn);
      c.drawCircle(hud.star.x, hud.star.y, 24, btn);
      c.drawCircle(hud.gear.x, hud.gear.y, 24, btn);
      drawIcon(c, 'pass', hud.pass.x, hud.pass.y, 11, '#E879F9', a * 0.95);
      drawIcon(c, 'cup', hud.cup.x, hud.cup.y, 11, '#FFD36E', a * 0.95);
      drawIcon(c, 'bag', hud.shop.x, hud.shop.y, 11, '#38BDF8', a * 0.95);
      drawIcon(c, 'star', hud.star.x, hud.star.y, 13, collectionSize >= 9 ? '#8CFFC1' : '#FFD36E', a);
      drawIcon(c, 'gear', hud.gear.x, hud.gear.y, 12, '#FFFFFF', a * 0.9);

      // Carousel dots.
      const dot = Skia.Paint();
      dot.setAntiAlias(true);
      for (let i = 0; i < WORLDS.length; i++) {
        const f = Math.max(0, 1 - Math.abs(pos.get() - i));
        const w = 8 + f * 22;
        const x = W / 2 + (i - 1) * 30;
        dot.setColor(Skia.Color(f > 0.5 ? ACCENTS[i] : '#FFFFFF'));
        dot.setAlphaf((0.3 + 0.7 * f) * a);
        c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - w / 2, hud.dotsY - 4, w, 8), 4, 4), dot);
      }

      // Levels button.
      const lb = hud.levels;
      c.drawCircle(lb.x, lb.y, lb.r, btn);
      drawIcon(c, 'levels', lb.x, lb.y, 11, '#FFFFFF', a * 0.92);

      // Play button.
      const pb = hud.play;
      const pulse = 1 + Math.sin(t * 3.2) * 0.05 + playPulse.get() * 0.18;
      const glow = Skia.Paint();
      glow.setAntiAlias(true);
      glow.setColor(Skia.Color(accent));
      glow.setAlphaf((0.4 + 0.15 * Math.sin(t * 3.2)) * a);
      glow.setMaskFilter(Skia.MaskFilter.MakeBlur(0, 18, true));
      c.drawCircle(pb.x, pb.y, pb.r * 1.15 * pulse, glow);
      const body = Skia.Paint();
      body.setAntiAlias(true);
      body.setShader(
        Skia.Shader.MakeLinearGradient(
          { x: pb.x, y: pb.y - pb.r },
          { x: pb.x, y: pb.y + pb.r },
          [Skia.Color('#FFFFFF'), Skia.Color(accent)],
          null,
          0,
        ),
      );
      body.setAlphaf(a);
      c.drawCircle(pb.x, pb.y, pb.r * pulse, body);
      const tri = Skia.Paint();
      tri.setAntiAlias(true);
      tri.setColor(Skia.Color('#2A1457'));
      tri.setAlphaf(a);
      const s = pb.r * 0.42 * pulse;
      c.drawPath(
        Skia.PathBuilder.Make()
          .moveTo(pb.x - s * 0.6, pb.y - s)
          .lineTo(pb.x + s * 1.05, pb.y)
          .lineTo(pb.x - s * 0.6, pb.y + s)
          .close()
          .build(),
        tri,
      );
    }
    return rec.finishRecordingAsPicture();
  });

  // Boot logo + expanding ring on the flash.
  const bootPicture = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    const t0 = bootT0.get();
    if (t0 >= 0) {
      const t = time.get() - t0;
      if (t < 3.4) {
        const fade = 1 - clamp01((t - 2.0) / 0.8);
        if (fade > 0.01) {
          drawBootLogo(c, W / 2, H * 0.42, W, H, t, Math.min(W, H) * 0.34);
          if (t > BOOT_FLASH) {
            const u = t - BOOT_FLASH;
            const rp = Skia.Paint();
            rp.setAntiAlias(true);
            rp.setStyle(PaintStyle.Stroke);
            rp.setStrokeWidth(6 * (1 - clamp01(u / 1.2)) + 1);
            rp.setColor(Skia.Color('#FFE9A8'));
            rp.setAlphaf(Math.max(0, 1 - u / 1.1) * fade);
            c.drawCircle(W / 2, H * 0.42, u * W * 0.9, rp);
          }
        }
      }
    }
    return rec.finishRecordingAsPicture();
  });
  const bootFlash = useDerivedValue(() => {
    const t0 = bootT0.get();
    const t = t0 >= 0 ? time.get() - t0 : -1;
    const boot = t > BOOT_FLASH && t < 3 ? Math.exp(-(t - BOOT_FLASH) * 4.5) * 0.85 : 0;
    return Math.max(boot, flashPulse.get());
  });
  const cover = useDerivedValue(() => 1 - reveal.get());

  return (
    <View style={styles.root}>
      <ParentalGate
        visible={gateOpen}
        onSuccess={() => {
          confirmGate();
          sfx.play('sparkle', 0.5);
        }}
        onCancel={cancelGate}
      />

      {/* World Unlock Modal */}
      <Modal
        visible={!!unlockTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setUnlockTarget(null)}
      >
        <View style={hubStyles.modalBackdrop}>
          <View style={hubStyles.modalBox}>
            <Text style={hubStyles.modalEmoji}>🌍</Text>
            <Text style={hubStyles.modalTitle}>
              UNLOCK {unlockTarget?.id.replace('_', ' ').toUpperCase()}?
            </Text>
            <Text style={hubStyles.modalSubtitle}>
              Unlock this portal now to play new games and meet exclusive critters!
            </Text>

            <View style={hubStyles.modalActions}>
              {unlockTarget?.priceStardust != null && (
                <Pressable
                  style={[hubStyles.modalBtn, hubStyles.stardustBtn]}
                  onPress={() => handleConfirmUnlock('stardust')}
                >
                  <Sparkles size={16} color="#FFFFFF" />
                  <Text style={hubStyles.modalBtnText}>
                    ★ {unlockTarget.priceStardust.toLocaleString()} STARDUST
                  </Text>
                </Pressable>
              )}
              {unlockTarget?.priceCrystals != null && (
                <Pressable
                  style={[hubStyles.modalBtn, hubStyles.crystalBtn]}
                  onPress={() => handleConfirmUnlock('crystals')}
                >
                  <Gem size={16} color="#FFFFFF" />
                  <Text style={hubStyles.modalBtnText}>
                    💎 {unlockTarget.priceCrystals} CRYSTALS
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={hubStyles.cancelBtn}
                onPress={() => setUnlockTarget(null)}
              >
                <Text style={hubStyles.cancelBtnText}>CANCEL</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <GestureDetector gesture={gesture}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill color="#0B0620" />
          <Group transform={worldZoom} origin={vec(W / 2, H / 2)}>
            {WORLDS.map((w, i) => (
              <Backdrop key={w.id} still={stills[i]} index={i} pos={pos} reveal={reveal} warp={warp} parallax={parallax} time={time} W={W} H={H} />
            ))}
            <Fill>
              <LinearGradient start={vec(0, 0)} end={vec(0, H)} colors={['rgba(12,4,40,0.6)', 'rgba(12,4,40,0.3)', 'rgba(6,2,20,0.7)']} />
            </Fill>
            <Rect x={0} y={0} width={W} height={H} blendMode="screen">
              <Shader source={skyAtmosphere} uniforms={atmosphereUniforms} />
            </Rect>
            <Rect x={0} y={0} width={W} height={H} blendMode="screen">
              <Shader source={lightRays} uniforms={raysUniforms} />
            </Rect>
            <Picture picture={backParticles} />

            {WORLDS.map((w, i) => (
              <Portal key={w.id} index={i} world={w} still={stills[i]} featuredId={FEATURED[i]} geo={geo} pos={pos} reveal={reveal} warp={warp} time={time} locked={lockedFlags[i]} />
            ))}

            {/* Mascot with Equipped Gear */}
            <Group opacity={pipOpacity}>
              <Group transform={pipShadowTransform} origin={vec(hud.pipX, hud.pipGround)}>
                <Oval x={hud.pipX - pipW * 0.32} y={hud.pipGround - hud.pipH * 0.05} width={pipW * 0.64} height={hud.pipH * 0.07} color="rgba(20,0,40,0.55)">
                  <BlurMask blur={10} style="normal" />
                </Oval>
              </Group>

              {/* Equipped Trail at Pip's feet */}
              {trailImg && (
                <Image
                  image={trailImg}
                  x={hud.pipX - pipW * 0.5}
                  y={pipY + hud.pipH * 0.68}
                  width={pipW}
                  height={hud.pipH * 0.32}
                  fit="contain"
                  blendMode="plus"
                  opacity={0.88}
                />
              )}

              {/* Equipped Aura floating around Pip */}
              {auraImg && (
                <Image
                  image={auraImg}
                  x={hud.pipX - hud.pipH * 0.55}
                  y={pipY - hud.pipH * 0.02}
                  width={hud.pipH * 1.1}
                  height={hud.pipH * 1.1}
                  fit="contain"
                  blendMode="plus"
                  opacity={0.88}
                />
              )}

              <Group transform={pipTransform} origin={vec(hud.pipX, hud.pipGround)}>
                <SpriteCharacter sheet={PIP} images={pipImages} clip={pip.clip} frame={pip.frame} x={hud.pipX - pipW / 2} y={pipY} height={hud.pipH} />

                {/* Equipped Expression on Pip's face */}
                {exprImg && (
                  <Image
                    image={exprImg}
                    x={hud.pipX - pipW * 0.22}
                    y={pipY + hud.pipH * 0.31}
                    width={pipW * 0.44}
                    height={hud.pipH * 0.18}
                    fit="contain"
                  />
                )}

                {/* Equipped Hat / Crown perched on Pip's head */}
                {hatImg && (
                  <Image
                    image={hatImg}
                    x={hud.pipX - pipW * 0.29}
                    y={pipY - hud.pipH * 0.04}
                    width={pipW * 0.58}
                    height={hud.pipH * 0.30}
                    fit="contain"
                  />
                )}
              </Group>
            </Group>

            <Picture picture={uiPicture} />
            <Picture picture={frontParticles} />
          </Group>

          {/* Vignette */}
          <Rect x={0} y={0} width={W} height={H}>
            <RadialGradient c={vec(W / 2, H * 0.5)} r={Math.max(W, H) * 0.8} colors={['rgba(0,0,0,0)', 'rgba(5,0,18,0.5)']} positions={[0.55, 1]} />
          </Rect>

          <Rect x={0} y={0} width={W} height={H} color="#05010F" opacity={cover} />
          <Picture picture={bootPicture} />
          <Rect x={0} y={0} width={W} height={H} color="white" opacity={bootFlash} blendMode="plus" />
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05010F' },
});

const hubStyles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 1, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  modalEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  modalActions: {
    width: '100%',
    gap: 10,
  },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
  },
  stardustBtn: {
    backgroundColor: '#D97706',
  },
  crystalBtn: {
    backgroundColor: '#0284C7',
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cancelBtn: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
