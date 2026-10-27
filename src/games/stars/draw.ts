import { BlendMode, BlurStyle, PaintStyle, Skia, StrokeJoin, type SkCanvas, type SkPath } from '@shopify/react-native-skia';
import { GOLD, HAZARD } from './sim';

/** Snapshot layout per object: [kind, x, y, r, rot, age]. */
export const OBJ_STRIDE = 6;

function unitStar(points: number, inner: number): SkPath {
  'worklet';
  const b = Skia.PathBuilder.Make();
  const n = points * 2;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const r = i % 2 === 0 ? 1 : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) b.moveTo(x, y);
    else b.lineTo(x, y);
  }
  return b.close().build();
}

/** Draws stars, gold stars and hazards from the snapshot. Pure function of (snapshot, time) so it can run on the UI thread. */
export function drawObjects(canvas: SkCanvas, snap: number[], time: number) {
  'worklet';
  const star = unitStar(5, 0.52);
  const spiky = unitStar(9, 0.74);
  const glow = Skia.Paint();
  glow.setBlendMode(BlendMode.Plus);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 10, true));
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const edge = Skia.Paint();
  edge.setAntiAlias(true);
  edge.setStyle(PaintStyle.Stroke);

  for (let i = 0; i < snap.length; i += OBJ_STRIDE) {
    const kind = snap[i];
    const x = snap[i + 1];
    const y = snap[i + 2];
    const r = snap[i + 3];
    const rot = snap[i + 4];
    const age = snap[i + 5];
    const pop = age < 0.25 ? Math.max(0.2, 1 + 2.7 * Math.pow(age / 0.25 - 1, 3) + 1.7 * Math.pow(age / 0.25 - 1, 2)) : 1;
    const pulse = 1 + Math.sin(time * 6 + i) * 0.06;

    canvas.save();
    canvas.translate(x, y);
    if (kind === HAZARD) {
      glow.setColor(Skia.Color('#FF3D7F'));
      glow.setAlphaf(0.45);
      canvas.drawCircle(0, 0, r * 1.5 * pop, glow);
      canvas.save();
      canvas.rotate((rot * 180) / Math.PI, 0, 0);
      canvas.scale(r * pop, r * pop);
      fill.setColor(Skia.Color('#3B1250'));
      canvas.drawPath(spiky, fill);
      edge.setColor(Skia.Color('#FF4F8B'));
      edge.setStrokeWidth(0.07);
      canvas.drawPath(spiky, edge);
      canvas.restore();
      // Face stays upright.
      canvas.scale(pop, pop);
      fill.setColor(Skia.Color('#FFFFFF'));
      canvas.drawCircle(-r * 0.26, -r * 0.08, r * 0.17, fill);
      canvas.drawCircle(r * 0.26, -r * 0.08, r * 0.17, fill);
      fill.setColor(Skia.Color('#FF2D6A'));
      canvas.drawCircle(-r * 0.26, -r * 0.04, r * 0.08, fill);
      canvas.drawCircle(r * 0.26, -r * 0.04, r * 0.08, fill);
    } else {
      const gold = kind === GOLD;
      const base = gold ? '#FFC93C' : '#FFF07A';
      const rim = gold ? '#FF9B1F' : '#FFC93C';
      glow.setColor(Skia.Color(gold ? '#FFB020' : '#FFE46B'));
      glow.setAlphaf(gold ? 0.8 : 0.55);
      canvas.drawCircle(0, 0, r * (gold ? 1.9 : 1.5) * pop * pulse, glow);
      canvas.rotate((rot * 180) / Math.PI, 0, 0);
      canvas.scale(r * 1.25 * pop * pulse, r * 1.25 * pop * pulse);
      fill.setColor(Skia.Color(base));
      canvas.drawPath(star, fill);
      edge.setColor(Skia.Color(rim));
      edge.setStrokeWidth(0.09);
      edge.setStrokeJoin(StrokeJoin.Round);
      canvas.drawPath(star, edge);
      canvas.scale(0.5, 0.5);
      canvas.translate(-0.18, -0.2);
      fill.setColor(Skia.Color('#FFFFFF'));
      fill.setAlphaf(0.7);
      canvas.drawPath(star, fill);
      fill.setAlphaf(1);
    }
    canvas.restore();
  }
}
