import React, { useMemo } from 'react';
import { Circle, Path, Skia } from '@shopify/react-native-skia';

/** Streak-shield HUD glyph. Gold + glow when armed, grey when spent / none left. Draw inside a Canvas. */
export function ShieldIcon({ x, y, armed }: { x: number; y: number; armed: boolean }) {
  const path = useMemo(
    () =>
      Skia.PathBuilder.Make()
        .moveTo(x, y - 12)
        .lineTo(x + 10, y - 8)
        .quadTo(x + 10, y + 7, x, y + 13)
        .quadTo(x - 10, y + 7, x - 10, y - 8)
        .close()
        .build(),
    [x, y],
  );
  return (
    <>
      <Circle cx={x} cy={y} r={20} color="rgba(26,15,61,0.6)" />
      {armed && <Circle cx={x} cy={y} r={20} color="#FFD84D" style="stroke" strokeWidth={2} opacity={0.7} />}
      <Path path={path} color={armed ? '#FFD84D' : 'rgba(255,255,255,0.28)'} />
      {armed && <Path path={path} color="#FFFFFF" style="stroke" strokeWidth={1.5} opacity={0.6} />}
    </>
  );
}
