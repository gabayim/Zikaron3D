import { BlendMode, BlurStyle, PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas } from '@shopify/react-native-skia';

/** Star colours for the colour channel; gold when colour is not in play. */
export const STAR_COLORS = ['#FF5C5C', '#FFB833', '#FFF15C', '#5CFF8A', '#5CC8FF', '#C77DFF'];
export const STAR_GOLD = '#FFE7A0';
/** One hue per tone, used by the lanterns when the echo hint is on. */
export const TONE_COLORS = ['#FF5C8A', '#FF9F43', '#FFD700', '#7CFF6B', '#48E5C2', '#4FC3FF', '#9C7BFF', '#FF7AF2'];
/** Button tint per channel: position, sound, colour. */
export const CHANNEL_COLORS = ['#C7A8FF', '#7FE8FF', '#FFD36B'];

/** Snapshot per peak: [x, yBase, size, glow 0..1, red 0..1]. */
export const PEAK_STRIDE = 5;
/** Snapshot per star: [x, y, r, alpha, colour (-1 gold), ghost, ring]. */
export const STAR_STRIDE = 7;
/** Snapshot per button: [x, y, w, h, icon, press, good, bad]. */
export const BUTTON_STRIDE = 8;
/** Snapshot per lantern: [x, y, colour (-1 plain), lit]. */
export const LANTERN_STRIDE = 4;

const starColor = (c: number) => {
  'worklet';
  if (c >= 0) return STAR_COLORS[c % STAR_COLORS.length];
  return STAR_GOLD;
};

function starPath(r: number) {
  'worklet';
  const b = Skia.PathBuilder.Make();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) b.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else b.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return b.close().build();
}

/** Night sky: twinkling stars and a soft aurora band. */
export function drawSky(canvas: SkCanvas, W: number, H: number, time: number) {
  'worklet';
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  for (let i = 0; i < 46; i++) {
    const s = Math.sin(i * 78.233) * 43758.5453;
    const r = s - Math.floor(s);
    const s2 = Math.sin(i * 12.9898) * 24634.6345;
    const r2 = s2 - Math.floor(s2);
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * (1 + r * 2) + i));
    fill.setColor(Skia.Color('#FFFFFF'));
    fill.setAlphaf(0.55 * tw);
    canvas.drawCircle(r * W, r2 * H * 0.62, 0.8 + r * 1.4, fill);
  }
  const aurora = Skia.Paint();
  aurora.setAntiAlias(true);
  aurora.setStyle(PaintStyle.Stroke);
  aurora.setStrokeWidth(H * 0.05);
  aurora.setBlendMode(BlendMode.Plus);
  aurora.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 26, true));
  const b = Skia.PathBuilder.Make();
  for (let k = 0; k <= 12; k++) {
    const x = (k / 12) * W;
    const y = H * (0.16 + 0.04 * Math.sin(k * 0.8 + time * 0.3));
    if (k === 0) b.moveTo(x, y);
    else b.lineTo(x, y);
  }
  aurora.setColor(Skia.Color('#7CFFCB'));
  aurora.setAlphaf(0.16);
  canvas.drawPath(b.build(), aurora);
}

/** The ring of peaks around Luna, the stars on them and the echo ghosts. */
export function drawPeaks(
  canvas: SkCanvas,
  cx: number,
  cy: number,
  ringR: number,
  peaks: number[],
  stars: number[],
  time: number,
) {
  'worklet';
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const line = Skia.Paint();
  line.setAntiAlias(true);
  line.setStyle(PaintStyle.Stroke);
  line.setStrokeJoin(StrokeJoin.Round);
  line.setStrokeCap(StrokeCap.Round);
  const glow = Skia.Paint();
  glow.setAntiAlias(true);
  glow.setBlendMode(BlendMode.Plus);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 12, true));

  // Glowing orbit the peaks float on.
  line.setColor(Skia.Color('#C7A8FF'));
  line.setAlphaf(0.22 + 0.06 * Math.sin(time * 1.4));
  line.setStrokeWidth(2);
  canvas.drawOval(Skia.XYWHRect(cx - ringR, cy - ringR * 0.92, ringR * 2, ringR * 1.84), line);

  // Back peaks first so nearer ones overlap them.
  const order: number[] = [];
  for (let i = 0; i < peaks.length; i += PEAK_STRIDE) order.push(i);
  order.sort((a, b) => peaks[a + 1] - peaks[b + 1]);
  for (const i of order) {
    const x = peaks[i];
    const y = peaks[i + 1];
    const s = peaks[i + 2];
    const lit = peaks[i + 3];
    const red = peaks[i + 4];
    const hw = s * 0.62;
    const h = s * 1.15;
    if (lit > 0.02 || red > 0.02) {
      glow.setColor(Skia.Color(red > lit ? '#FF3B5C' : '#FFE7A0'));
      glow.setAlphaf(Math.max(lit, red) * 0.85);
      canvas.drawCircle(x, y - h * 0.5, s * 0.9, glow);
    }
    const body = Skia.PathBuilder.Make()
      .moveTo(x - hw, y)
      .lineTo(x - hw * 0.25, y - h * 0.72)
      .lineTo(x, y - h)
      .lineTo(x + hw * 0.35, y - h * 0.66)
      .lineTo(x + hw, y)
      .close()
      .build();
    fill.setColor(Skia.Color('#3B2F6B'));
    fill.setAlphaf(1);
    canvas.drawPath(body, fill);
    // Shaded right face.
    const face = Skia.PathBuilder.Make()
      .moveTo(x, y - h)
      .lineTo(x + hw * 0.35, y - h * 0.66)
      .lineTo(x + hw, y)
      .lineTo(x + hw * 0.1, y)
      .close()
      .build();
    fill.setColor(Skia.Color('#251C4A'));
    canvas.drawPath(face, fill);
    // Snow cap with a jagged edge.
    const cap = Skia.PathBuilder.Make()
      .moveTo(x - hw * 0.25, y - h * 0.72)
      .lineTo(x, y - h)
      .lineTo(x + hw * 0.35, y - h * 0.66)
      .lineTo(x + hw * 0.16, y - h * 0.7)
      .lineTo(x + hw * 0.02, y - h * 0.62)
      .lineTo(x - hw * 0.12, y - h * 0.71)
      .close()
      .build();
    fill.setColor(Skia.Color('#F2F6FF'));
    canvas.drawPath(cap, fill);
    if (red > 0.02) {
      fill.setColor(Skia.Color('#FF3B5C'));
      fill.setAlphaf(red * 0.45);
      canvas.drawPath(body, fill);
    }
    line.setColor(Skia.Color('#C7A8FF'));
    line.setAlphaf(0.35 + lit * 0.6);
    line.setStrokeWidth(1.6);
    canvas.drawPath(body, line);
  }

  for (let i = 0; i < stars.length; i += STAR_STRIDE) {
    const x = stars[i];
    const y = stars[i + 1];
    const r = stars[i + 2];
    const a = stars[i + 3];
    if (a <= 0.01) continue;
    const colour = Skia.Color(starColor(stars[i + 4]));
    const ghost = stars[i + 5] > 0;
    canvas.save();
    canvas.translate(x, y);
    if (ghost) {
      line.setColor(colour);
      line.setAlphaf(a);
      line.setStrokeWidth(1.6);
      canvas.drawPath(starPath(r), line);
    } else {
      canvas.rotate(Math.sin(time * 3) * 8, 0, 0);
      glow.setColor(colour);
      glow.setAlphaf(a);
      canvas.drawCircle(0, 0, r * 1.8, glow);
      fill.setColor(colour);
      fill.setAlphaf(a);
      canvas.drawPath(starPath(r), fill);
      fill.setColor(Skia.Color('#FFFFFF'));
      fill.setAlphaf(a * 0.85);
      canvas.drawCircle(0, 0, r * 0.28, fill);
    }
    canvas.restore();
    if (stars[i + 6] > 0) {
      // The star from exactly n steps back gets a ring: this is the one to compare against.
      line.setColor(Skia.Color('#FFFFFF'));
      line.setAlphaf(a * 0.9);
      line.setStrokeWidth(1.5);
      canvas.drawCircle(x, y, r * 1.5 + Math.sin(time * 5) * 1.5, line);
    }
  }
}

/** A row of lanterns: one per step back. With the hint on they carry the tone colours of past steps. */
export function drawLanterns(canvas: SkCanvas, lanterns: number[], size: number, time: number) {
  'worklet';
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const glow = Skia.Paint();
  glow.setAntiAlias(true);
  glow.setBlendMode(BlendMode.Plus);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 8, true));
  const line = Skia.Paint();
  line.setAntiAlias(true);
  line.setStyle(PaintStyle.Stroke);
  line.setStrokeWidth(1.5);
  for (let i = 0; i < lanterns.length; i += LANTERN_STRIDE) {
    const x = lanterns[i];
    const y = lanterns[i + 1] + Math.sin(time * 2 + i) * 2;
    const c = lanterns[i + 2];
    const lit = lanterns[i + 3];
    const colour = Skia.Color(c >= 0 ? TONE_COLORS[c % TONE_COLORS.length] : '#FFD9A0');
    line.setColor(Skia.Color('#E8E0FF'));
    line.setAlphaf(0.5);
    canvas.drawLine(x, y - size * 1.1, x, y - size * 0.6, line);
    glow.setColor(colour);
    glow.setAlphaf(0.3 + lit * 0.6);
    canvas.drawCircle(x, y, size * 1.2, glow);
    fill.setColor(colour);
    fill.setAlphaf(0.55 + lit * 0.45);
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - size * 0.5, y - size * 0.6, size, size * 1.2), size * 0.4, size * 0.4), fill);
    line.setColor(Skia.Color('#3B2F6B'));
    line.setAlphaf(0.8);
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - size * 0.5, y - size * 0.6, size, size * 1.2), size * 0.4, size * 0.4), line);
  }
}

/** Big icon buttons: peak (position), waves (sound), three dots (colour). */
export function drawButtons(canvas: SkCanvas, buttons: number[], time: number) {
  'worklet';
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const line = Skia.Paint();
  line.setAntiAlias(true);
  line.setStyle(PaintStyle.Stroke);
  line.setStrokeCap(StrokeCap.Round);
  line.setStrokeJoin(StrokeJoin.Round);
  const glow = Skia.Paint();
  glow.setAntiAlias(true);
  glow.setBlendMode(BlendMode.Plus);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 14, true));
  for (let i = 0; i < buttons.length; i += BUTTON_STRIDE) {
    const x = buttons[i];
    const y = buttons[i + 1];
    const w = buttons[i + 2];
    const h = buttons[i + 3];
    const icon = buttons[i + 4];
    const press = buttons[i + 5];
    const good = buttons[i + 6];
    const bad = buttons[i + 7];
    const tint = Skia.Color(CHANNEL_COLORS[icon]);
    canvas.save();
    const wob = bad > 0 ? Math.sin(time * 60) * 5 * bad : 0;
    canvas.translate(x + wob, y);
    const s = 1 - press * 0.08;
    canvas.scale(s, s);
    const rect = Skia.RRectXY(Skia.XYWHRect(-w / 2, -h / 2, w, h), h * 0.35, h * 0.35);
    glow.setColor(bad > good ? Skia.Color('#FF3B5C') : good > 0 ? Skia.Color('#FFE7A0') : tint);
    glow.setAlphaf(0.25 + Math.max(good, bad) * 0.7);
    canvas.drawRRect(rect, glow);
    fill.setColor(Skia.Color('#1A1240'));
    fill.setAlphaf(0.92);
    canvas.drawRRect(rect, fill);
    line.setColor(tint);
    line.setAlphaf(0.95);
    line.setStrokeWidth(3);
    canvas.drawRRect(rect, line);

    const u = h * 0.26;
    line.setStrokeWidth(3.2);
    fill.setColor(tint);
    fill.setAlphaf(1);
    if (icon === 0) {
      const p = Skia.PathBuilder.Make()
        .moveTo(-u * 1.4, u * 0.9)
        .lineTo(-u * 0.3, -u * 0.6)
        .lineTo(u * 0.2, 0)
        .lineTo(u * 0.6, -u * 0.3)
        .lineTo(u * 1.4, u * 0.9)
        .close()
        .build();
      canvas.drawPath(p, fill);
      fill.setColor(Skia.Color(STAR_GOLD));
      canvas.drawPath(starPath(u * 0.45), fill);
      canvas.save();
      canvas.translate(-u * 0.3, -u * 1.15);
      canvas.drawPath(starPath(u * 0.45), fill);
      canvas.restore();
    } else if (icon === 1) {
      canvas.drawCircle(-u * 0.9, 0, u * 0.32, fill);
      for (let k = 1; k <= 3; k++) {
        const r = u * 0.55 * k;
        line.setAlphaf(1 - k * 0.2);
        canvas.drawArc(Skia.XYWHRect(-u * 0.9 - r, -r, r * 2, r * 2), -45, 90, false, line);
      }
    } else {
      const cols = [STAR_COLORS[0], STAR_COLORS[3], STAR_COLORS[4]];
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 3;
        fill.setColor(Skia.Color(cols[k]));
        fill.setAlphaf(0.9);
        canvas.drawCircle(Math.cos(a) * u * 0.45, Math.sin(a) * u * 0.45, u * 0.55, fill);
      }
    }
    canvas.restore();
  }
}

/** Focus battery on the left edge (Arcade). */
export function drawBattery(canvas: SkCanvas, x: number, y: number, h: number, level: number, danger: boolean, time: number) {
  'worklet';
  const w = 18;
  const frame = Skia.Paint();
  frame.setAntiAlias(true);
  frame.setStyle(PaintStyle.Stroke);
  frame.setStrokeWidth(2.5);
  frame.setColor(Skia.Color('#E8E0FF'));
  frame.setAlphaf(0.8);
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), 6, 6), frame);
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const pulse = danger ? 0.55 + 0.45 * Math.sin(time * 14) : 1;
  fill.setColor(Skia.Color(level > 0.5 ? '#C7A8FF' : level > 0.25 ? '#FFB833' : '#FF3B5C'));
  fill.setAlphaf(pulse);
  const fh = Math.max(0, (h - 6) * level);
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x + 3, y + h - 3 - fh, w - 6, fh), 4, 4), fill);
}
