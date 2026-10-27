import React, { useMemo } from 'react';
import { Circle, Path, Skia } from '@shopify/react-native-skia';
import type { Mode } from '../engine/dda';

export const MODE_COLOR: Record<Mode, string> = { TOYBOX: '#FF8FD0', ARCADE: '#FFD84D', SANCTUARY: '#8CFFC1' };

/** Icon-only mode indicator (smile = Toybox, bolt = Arcade, leaf = Sanctuary). Draw inside a Canvas. */
export function ModeIcon({ mode, x, y }: { mode: Mode; x: number; y: number }) {
  const color = MODE_COLOR[mode];
  const paths = useMemo(() => {
    const mouth = Skia.PathBuilder.Make().addArc(Skia.XYWHRect(x - 6.5, y - 5, 13, 11), 15, 150).build();
    const bolt = Skia.PathBuilder.Make()
      .moveTo(x + 3, y - 13)
      .lineTo(x - 7, y + 2)
      .lineTo(x - 1, y + 2)
      .lineTo(x - 3, y + 13)
      .lineTo(x + 7, y - 3)
      .lineTo(x + 1, y - 3)
      .close()
      .build();
    const leaf = Skia.PathBuilder.Make()
      .moveTo(x - 9, y + 9)
      .quadTo(x - 11, y - 8, x + 9, y - 10)
      .quadTo(x + 11, y + 8, x - 9, y + 9)
      .close()
      .build();
    return { mouth, bolt, leaf };
  }, [x, y]);

  if (mode === 'ARCADE') return <Path path={paths.bolt} color={color} />;
  if (mode === 'SANCTUARY') return <Path path={paths.leaf} color={color} />;
  return (
    <>
      <Circle cx={x} cy={y} r={11.5} color={color} style="stroke" strokeWidth={2.5} />
      <Circle cx={x - 4} cy={y - 3} r={1.9} color={color} />
      <Circle cx={x + 4} cy={y - 3} r={1.9} color={color} />
      <Path path={paths.mouth} color={color} style="stroke" strokeWidth={2.2} strokeCap="round" />
    </>
  );
}
