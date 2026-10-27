import React from 'react';
import { Group, Image, LinearGradient, Rect, Shader, useImage, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { lightRays, skyAtmosphere } from './shaders';

interface Props {
  W: number;
  H: number;
  still: number;
  time: SharedValue<number>;
  boost: SharedValue<number>;
  /** Light source as a fraction of the 9:16 source art. */
  light: { x: number; y: number };
}

/** Shared world look for game scenes: breathing still, mist/stars, god-rays and a readability grade. Draw inside a Canvas. */
export function WorldBackdrop({ W, H, still, time, boost, light }: Props) {
  const image = useImage(still);
  const bgW = Math.max(W, H * (9 / 16));
  const bgH = bgW * (16 / 9);
  const bgX = (W - bgW) / 2;
  const bgY = (H - bgH) / 2;
  const origin = [bgX + light.x * bgW, bgY + light.y * bgH];

  const bgTransform = useDerivedValue(() => [
    { translateX: Math.sin(time.value * 0.11) * 6 },
    { translateY: Math.sin(time.value * 0.07) * 4 },
    { scale: 1.06 + Math.sin(time.value * 0.09) * 0.015 },
  ]);
  const atmosphere = useDerivedValue(() => ({ res: [W, H], time: time.value }));
  const rays = useDerivedValue(() => ({ res: [W, H], origin, time: time.value, strength: 0.17 + boost.value * 0.1 }));

  return (
    <>
      <Group transform={bgTransform} origin={vec(W / 2, H / 2)}>
        <Image image={image} x={bgX} y={bgY} width={bgW} height={bgH} fit="cover" />
      </Group>
      <Rect x={0} y={0} width={W} height={H} blendMode="screen">
        <Shader source={skyAtmosphere} uniforms={atmosphere} />
      </Rect>
      <Rect x={0} y={0} width={W} height={H} blendMode="screen">
        <Shader source={lightRays} uniforms={rays} />
      </Rect>
      <Rect x={0} y={0} width={W} height={H}>
        <LinearGradient start={vec(0, 0)} end={vec(0, H)} colors={['rgba(12,4,40,0.5)', 'rgba(12,4,40,0.25)', 'rgba(6,2,20,0.55)']} />
      </Rect>
    </>
  );
}
