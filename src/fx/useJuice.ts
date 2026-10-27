import { useCallback } from 'react';
import { Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { createPool, drawFireflies, drawPool, spawnBurst, stepPool, type BurstRequest } from '../render/particles';
import { motionScale } from '../store/audioSettings';

/**
 * Shared "juice" runtime for game scenes: particle pool simulated on the UI thread, screen shake,
 * full-screen flash and a glow boost. Scenes draw `back` (ambient) and `front` (particles) pictures
 * and apply `shake`/`flash`.
 */
export function useJuice(W: number, H: number, fireflies = 22) {
  const time = useSharedValue(0);
  const pool = useSharedValue(createPool());
  const bursts = useSharedValue<BurstRequest[]>([]);
  const flash = useSharedValue(0);
  const shake = useSharedValue(0);
  const boost = useSharedValue(0);

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
  });

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

  const doFlash = useCallback(
    (amount: number, ms = 500) => {
      const k = motionScale();
      flash.set(withSequence(withTiming(amount * k, { duration: 80 }), withTiming(0, { duration: ms })));
    },
    [flash],
  );

  const doShake = useCallback(
    (amount: number, ms = 450) => {
      const k = motionScale();
      shake.set(withSequence(withTiming(amount * k, { duration: 40 }), withTiming(0, { duration: ms })));
    },
    [shake],
  );

  const doBoost = useCallback(
    (amount: number, ms = 1200) => {
      boost.set(withSequence(withTiming(amount, { duration: 120 }), withTiming(0, { duration: ms })));
    },
    [boost],
  );

  const back = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawFireflies(c, W, H, time.value, fireflies);
    return rec.finishRecordingAsPicture();
  });

  const front = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    drawPool(c, pool.value, time.value);
    return rec.finishRecordingAsPicture();
  });

  const worldTransform = useDerivedValue(() => {
    const t = time.value * 1000;
    const s = shake.value;
    return [{ translateX: Math.sin(t * 0.09) * s }, { translateY: Math.cos(t * 0.113) * s }];
  });

  return { time, flash, shake, boost, emit, doFlash, doShake, doBoost, back, front, worldTransform };
}
