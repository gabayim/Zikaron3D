import { BlendMode, BlurStyle, PaintStyle, Skia, type SkCanvas, type SkPath } from '@shopify/react-native-skia';

export const PEARL = 0;
export const URCHIN = 1;
export const HINT = 2;
export const BUBBLE = 3;

/** Snapshot layout per item: [kind, x, y, r, alpha]. */
export const ITEM_STRIDE = 5;

function spikes(points: number, inner: number): SkPath {
  'worklet';
  const b = Skia.PathBuilder.Make();
  const n = points * 2;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const r = i % 2 === 0 ? 1 : inner;
    if (i === 0) b.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else b.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return b.close().build();
}

/** Pearls, the urchin decoy, hint glows and bubble trails. Pure function of (snapshot, time) for the UI thread. */
export function drawItems(canvas: SkCanvas, snap: number[], time: number) {
  'worklet';
  const urchin = spikes(12, 0.62);
  const glow = Skia.Paint();
  glow.setBlendMode(BlendMode.Plus);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 12, true));
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const edge = Skia.Paint();
  edge.setAntiAlias(true);
  edge.setStyle(PaintStyle.Stroke);

  for (let i = 0; i < snap.length; i += ITEM_STRIDE) {
    const kind = snap[i];
    const x = snap[i + 1];
    const y = snap[i + 2];
    const r = snap[i + 3];
    const a = snap[i + 4];
    if (a <= 0.01) continue;
    const pulse = 1 + Math.sin(time * 5 + i) * 0.05;

    if (kind === HINT) {
      glow.setColor(Skia.Color('#9FF6FF'));
      glow.setAlphaf(a * (0.55 + 0.25 * Math.sin(time * 7)));
      canvas.drawCircle(x, y, r * pulse, glow);
      continue;
    }
    if (kind === BUBBLE) {
      edge.setColor(Skia.Color('#DFFBFF'));
      edge.setAlphaf(a * 0.8);
      edge.setStrokeWidth(Math.max(1, r * 0.18));
      canvas.drawCircle(x, y, r, edge);
      fill.setColor(Skia.Color('#FFFFFF'));
      fill.setAlphaf(a * 0.7);
      canvas.drawCircle(x - r * 0.35, y - r * 0.35, r * 0.22, fill);
      continue;
    }

    canvas.save();
    canvas.translate(x, y);
    if (kind === PEARL) {
      glow.setColor(Skia.Color('#FFF3D6'));
      glow.setAlphaf(0.75 * a);
      canvas.drawCircle(0, 0, r * 2 * pulse, glow);
      const shader = Skia.Shader.MakeRadialGradient(
        { x: -r * 0.35, y: -r * 0.4 },
        r * 1.5,
        [Skia.Color('#FFFFFF'), Skia.Color('#FBE7F4'), Skia.Color('#C9B4F2')],
        [0, 0.55, 1],
        0,
      );
      fill.setShader(shader);
      fill.setAlphaf(a);
      canvas.drawCircle(0, 0, r, fill);
      fill.setShader(null);
      fill.setColor(Skia.Color('#FFFFFF'));
      fill.setAlphaf(0.9 * a);
      canvas.drawCircle(-r * 0.36, -r * 0.38, r * 0.22, fill);
    } else if (kind === URCHIN) {
      glow.setColor(Skia.Color('#B44DFF'));
      glow.setAlphaf(0.45 * a);
      canvas.drawCircle(0, 0, r * 1.6, glow);
      canvas.save();
      canvas.rotate(time * 30, 0, 0);
      canvas.scale(r * 1.15, r * 1.15);
      fill.setColor(Skia.Color('#3A1460'));
      fill.setAlphaf(a);
      canvas.drawPath(urchin, fill);
      edge.setColor(Skia.Color('#C77BFF'));
      edge.setAlphaf(a);
      edge.setStrokeWidth(0.07);
      canvas.drawPath(urchin, edge);
      canvas.restore();
      fill.setColor(Skia.Color('#FFFFFF'));
      fill.setAlphaf(a);
      canvas.drawCircle(-r * 0.28, -r * 0.05, r * 0.2, fill);
      canvas.drawCircle(r * 0.28, -r * 0.05, r * 0.2, fill);
      fill.setColor(Skia.Color('#FF3D7F'));
      canvas.drawCircle(-r * 0.26, 0, r * 0.1, fill);
      canvas.drawCircle(r * 0.3, 0, r * 0.1, fill);
    }
    canvas.restore();
  }
}

/** Octopus ink: drifting dark blobs that hide the clam rows while `amount` > 0. */
export function drawInk(canvas: SkCanvas, W: number, top: number, bottom: number, amount: number, time: number) {
  'worklet';
  if (amount <= 0.01) return;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 26, true));
  const h = bottom - top;
  for (let i = 0; i < 9; i++) {
    const fx = (i + 0.5) / 9;
    const x = W * fx + Math.sin(time * 0.9 + i * 1.7) * W * 0.05;
    const y = top + h * (0.5 + Math.sin(time * 1.3 + i * 2.3) * 0.28);
    const r = (W / 9) * (1.5 + 0.35 * Math.sin(time * 1.1 + i)) * (0.6 + 0.4 * amount);
    paint.setColor(Skia.Color(i % 2 ? '#1A0A33' : '#26104A'));
    paint.setAlphaf(0.92 * amount);
    canvas.drawCircle(x, y, r, paint);
  }
}
