import { BlendMode, BlurStyle, PaintStyle, Skia, StrokeCap, type SkCanvas } from '@shopify/react-native-skia';

/** Neon colour per logical lane, so a lane keeps its colour while it slides during a switch. */
export const LANE_COLORS = ['#00F0FF', '#FFB833', '#FF4FD8', '#7CFF6B', '#9C7BFF'];

/** Snapshot per lane: [xTop, xPad, flash 0..1, press 0..1, colourIndex]. */
export const LANE_STRIDE = 5;
/** Snapshot per pulse: [x, y, r, alpha, colourIndex, tailX, tailY, held, ring]. */
export const PULSE_STRIDE = 9;
/** Snapshot per miss spark: [x, y, age 0..1]. */
export const MISS_STRIDE = 3;

function hexPath(r: number) {
  'worklet';
  const b = Skia.PathBuilder.Make();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    if (i === 0) b.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else b.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return b.close().build();
}

/** Decorative circuit traces behind the lanes; `power` 0..1 (combo) lights more of them. */
export function drawBoard(canvas: SkCanvas, W: number, H: number, power: number, time: number) {
  'worklet';
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeCap(StrokeCap.Round);
  const glow = Skia.Paint();
  glow.setBlendMode(BlendMode.Plus);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 6, true));
  const n = 14;
  for (let i = 0; i < n; i++) {
    // Deterministic pseudo-random layout per trace.
    const s = Math.sin(i * 12.9898) * 43758.5453;
    const r = s - Math.floor(s);
    const left = i % 2 === 0;
    const x0 = left ? 0 : W;
    const y0 = H * (0.3 + 0.65 * ((i * 0.37 + r) % 1));
    const x1 = left ? W * (0.08 + r * 0.06) : W * (0.92 - r * 0.06);
    const y1 = y0 - H * (0.04 + r * 0.05);
    const lit = i / n < power;
    paint.setColor(Skia.Color(LANE_COLORS[i % LANE_COLORS.length]));
    paint.setAlphaf(lit ? 0.75 : 0.12);
    paint.setStrokeWidth(2);
    const path = Skia.PathBuilder.Make().moveTo(x0, y0).lineTo(x1, y0).lineTo(x1, y1).build();
    canvas.drawPath(path, paint);
    if (lit) {
      // A spark runs along a lit trace.
      const u = (time * 0.7 + r) % 1;
      const total = Math.abs(x1 - x0) + Math.abs(y1 - y0);
      const d = u * total;
      const along = Math.abs(x1 - x0);
      const px = d < along ? x0 + Math.sign(x1 - x0) * d : x1;
      const py = d < along ? y0 : y0 - (d - along);
      glow.setColor(Skia.Color('#FFFFFF'));
      glow.setAlphaf(0.9);
      canvas.drawCircle(px, py, 3, glow);
    }
    paint.setStyle(PaintStyle.Fill);
    canvas.drawCircle(x1, y1, 3.5, paint);
    paint.setStyle(PaintStyle.Stroke);
  }
}

/** Lanes, pads, pulses and miss sparks. Pure function of the snapshots for the UI thread. */
export function drawLanes(
  canvas: SkCanvas,
  lanes: number[],
  pulses: number[],
  misses: number[],
  topY: number,
  padY: number,
  padR: number,
  time: number,
) {
  'worklet';
  const line = Skia.Paint();
  line.setAntiAlias(true);
  line.setStyle(PaintStyle.Stroke);
  line.setStrokeCap(StrokeCap.Round);
  const glow = Skia.Paint();
  glow.setAntiAlias(true);
  glow.setBlendMode(BlendMode.Plus);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 10, true));
  const glowLine = Skia.Paint();
  glowLine.setAntiAlias(true);
  glowLine.setStyle(PaintStyle.Stroke);
  glowLine.setStrokeCap(StrokeCap.Round);
  glowLine.setBlendMode(BlendMode.Plus);
  glowLine.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 8, true));
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const hex = hexPath(padR);
  const inner = hexPath(padR * 0.72);

  // Traces.
  for (let i = 0; i < lanes.length; i += LANE_STRIDE) {
    const xTop = lanes[i];
    const xPad = lanes[i + 1];
    const flash = lanes[i + 2];
    const colour = Skia.Color(LANE_COLORS[lanes[i + 4] % LANE_COLORS.length]);
    line.setColor(colour);
    line.setAlphaf(0.28 + flash * 0.6);
    line.setStrokeWidth(3);
    canvas.drawLine(xTop, topY, xPad, padY, line);
    if (flash > 0.02) {
      glowLine.setColor(colour);
      glowLine.setAlphaf(flash);
      glowLine.setStrokeWidth(10);
      canvas.drawLine(xTop, topY, xPad, padY, glowLine);
    }
    // Beat ticks travelling down each trace.
    for (let k = 0; k < 3; k++) {
      const u = (time * 0.9 + k / 3) % 1;
      fill.setColor(colour);
      fill.setAlphaf(0.25 * (1 - u));
      canvas.drawCircle(xTop + (xPad - xTop) * u, topY + (padY - topY) * u, 2, fill);
    }
  }

  // Pulses (hold tails first so heads draw on top).
  for (let i = 0; i < pulses.length; i += PULSE_STRIDE) {
    const a = pulses[i + 3];
    if (a <= 0.01) continue;
    const tailX = pulses[i + 5];
    const tailY = pulses[i + 6];
    if (tailY >= 0) {
      const colour = Skia.Color(LANE_COLORS[pulses[i + 4] % LANE_COLORS.length]);
      const held = pulses[i + 7] > 0;
      glowLine.setColor(colour);
      glowLine.setAlphaf(a * (held ? 1 : 0.6));
      glowLine.setStrokeWidth(pulses[i + 2] * 1.3);
      canvas.drawLine(tailX, tailY, pulses[i], pulses[i + 1], glowLine);
      line.setColor(colour);
      line.setAlphaf(a * 0.9);
      line.setStrokeWidth(pulses[i + 2] * 0.7);
      canvas.drawLine(tailX, tailY, pulses[i], pulses[i + 1], line);
    }
  }
  for (let i = 0; i < pulses.length; i += PULSE_STRIDE) {
    const x = pulses[i];
    const y = pulses[i + 1];
    const r = pulses[i + 2];
    const a = pulses[i + 3];
    if (a <= 0.01) continue;
    const colour = Skia.Color(LANE_COLORS[pulses[i + 4] % LANE_COLORS.length]);
    glow.setColor(colour);
    glow.setAlphaf(a * 0.9);
    canvas.drawCircle(x, y, r * 1.6, glow);
    fill.setColor(colour);
    fill.setAlphaf(a);
    canvas.drawCircle(x, y, r, fill);
    fill.setColor(Skia.Color('#FFFFFF'));
    fill.setAlphaf(a * 0.9);
    canvas.drawCircle(x, y, r * 0.45, fill);
    if (pulses[i + 8] > 0) {
      // Chord partner: a ring tells you to press two pads together.
      line.setColor(Skia.Color('#FFFFFF'));
      line.setAlphaf(a * 0.8);
      line.setStrokeWidth(2);
      canvas.drawCircle(x, y, r * 1.35, line);
    }
  }

  // Pads.
  for (let i = 0; i < lanes.length; i += LANE_STRIDE) {
    const xPad = lanes[i + 1];
    const flash = lanes[i + 2];
    const press = lanes[i + 3];
    const colour = Skia.Color(LANE_COLORS[lanes[i + 4] % LANE_COLORS.length]);
    canvas.save();
    canvas.translate(xPad, padY);
    const s = 1 - press * 0.12;
    canvas.scale(s, s);
    glow.setColor(colour);
    glow.setAlphaf(0.35 + flash * 0.6 + press * 0.4);
    canvas.drawPath(hex, glow);
    fill.setColor(Skia.Color('#0B0F2A'));
    fill.setAlphaf(0.92);
    canvas.drawPath(hex, fill);
    line.setColor(colour);
    line.setAlphaf(0.9);
    line.setStrokeWidth(3);
    canvas.drawPath(hex, line);
    fill.setColor(colour);
    fill.setAlphaf(0.18 + press * 0.6 + flash * 0.4);
    canvas.drawPath(inner, fill);
    canvas.restore();
  }

  // Misses: red static crackle over the pad.
  for (let i = 0; i < misses.length; i += MISS_STRIDE) {
    const x = misses[i];
    const y = misses[i + 1];
    const age = misses[i + 2];
    line.setColor(Skia.Color('#FF3B5C'));
    line.setAlphaf(1 - age);
    line.setStrokeWidth(2.5);
    for (let k = 0; k < 5; k++) {
      const a0 = k * 1.256 + age * 4;
      const r0 = padR * (0.4 + age * 0.9);
      const zig = Skia.PathBuilder.Make()
        .moveTo(x + Math.cos(a0) * r0 * 0.4, y + Math.sin(a0) * r0 * 0.4)
        .lineTo(x + Math.cos(a0 + 0.3) * r0 * 0.75, y + Math.sin(a0 + 0.3) * r0 * 0.75)
        .lineTo(x + Math.cos(a0 - 0.1) * r0, y + Math.sin(a0 - 0.1) * r0)
        .build();
      canvas.drawPath(zig, line);
    }
  }
}

/** Energy battery on the left edge. */
export function drawBattery(canvas: SkCanvas, x: number, y: number, h: number, level: number, danger: boolean, time: number) {
  'worklet';
  const w = 18;
  const frame = Skia.Paint();
  frame.setAntiAlias(true);
  frame.setStyle(PaintStyle.Stroke);
  frame.setStrokeWidth(2.5);
  frame.setColor(Skia.Color('#E8F6FF'));
  frame.setAlphaf(0.8);
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), 6, 6), frame);
  const cap = Skia.Paint();
  cap.setColor(Skia.Color('#E8F6FF'));
  cap.setAlphaf(0.8);
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x + 5, y - 5, w - 10, 5), 2, 2), cap);
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const pulse = danger ? 0.55 + 0.45 * Math.sin(time * 14) : 1;
  fill.setColor(Skia.Color(level > 0.5 ? '#7CFF6B' : level > 0.25 ? '#FFB833' : '#FF3B5C'));
  fill.setAlphaf(pulse);
  const fh = Math.max(0, (h - 6) * level);
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x + 3, y + h - 3 - fh, w - 6, fh), 4, 4), fill);
}
