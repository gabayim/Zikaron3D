import { BlendMode, BlurStyle, PaintStyle, Skia, type SkCanvas } from '@shopify/react-native-skia';

/** Deterministic pseudo-random in [0,1) from an integer seed. */
export function rand(seed: number) {
  'worklet';
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function easeInOutCubic(t: number) {
  'worklet';
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutBack(t: number) {
  'worklet';
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Point on a soft four-point star outline for particle i of n. */
function starPoint(i: number, n: number, radius: number) {
  'worklet';
  // Astroid: a sharp four-point sparkle. Every third particle sits on a smaller inner copy for body.
  const a = (i / n) * Math.PI * 2 * 1.0;
  const k = i % 3 === 0 ? 0.55 : 1;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: c * c * c * radius * k, y: s * s * s * radius * k };
}

/**
 * Boot logo: particles fly in from the edges, snap into a four-point star around a glowing core.
 * `t` is boot time in seconds; convergence ends near 1.5s, flash at ~1.7s.
 */
export function drawBootLogo(canvas: SkCanvas, cx: number, cy: number, w: number, h: number, t: number, radius: number) {
  'worklet';
  const N = 150;
  const glow = Skia.Paint();
  glow.setBlendMode(BlendMode.Plus);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 5, true));
  const core = Skia.Paint();
  core.setBlendMode(BlendMode.Plus);

  for (let i = 0; i < N; i++) {
    const delay = rand(i + 1) * 0.55;
    const dur = 0.85 + rand(i + 50) * 0.35;
    const p = Math.max(0, Math.min(1, (t - 0.15 - delay) / dur));
    if (p <= 0) continue;
    const e = easeInOutCubic(p);
    const ang = rand(i + 7) * Math.PI * 2;
    const far = Math.max(w, h) * (0.6 + rand(i + 9) * 0.4);
    const sx = cx + Math.cos(ang) * far;
    const sy = cy + Math.sin(ang) * far;
    const tp = starPoint(i, N, radius);
    // Slight swirl while travelling.
    const swirl = (1 - e) * 0.9;
    const dx = sx - cx;
    const dy = sy - cy;
    const rx = (dx * Math.cos(swirl) - dy * Math.sin(swirl)) * (1 - e) + tp.x * e;
    const ry = (dx * Math.sin(swirl) + dy * Math.cos(swirl)) * (1 - e) + tp.y * e;
    const x = cx + rx;
    const y = cy + ry;
    const hue = i % 3 === 0 ? '#FFD36E' : i % 3 === 1 ? '#FF9AE0' : '#8FE9FF';
    const col = Skia.Color(hue);
    const twinkle = 0.6 + 0.4 * Math.sin(t * 14 + i);
    glow.setColor(col);
    glow.setAlphaf(Math.min(1, p * 1.5) * 0.8 * twinkle);
    canvas.drawCircle(x, y, 5 + rand(i + 3) * 4, glow);
    core.setColor(Skia.Color('#FFFFFF'));
    core.setAlphaf(Math.min(1, p * 1.5) * twinkle);
    canvas.drawCircle(x, y, 1.4 + rand(i + 5) * 1.2, core);
  }

  // Core orb swells as particles arrive.
  const swell = Math.max(0, Math.min(1, (t - 0.9) / 0.8));
  if (swell > 0) {
    const pulse = 1 + Math.sin(t * 9) * 0.04;
    const r = radius * 0.28 * easeOutBack(swell) * pulse;
    glow.setColor(Skia.Color('#FFE9A8'));
    glow.setAlphaf(0.9);
    glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 18, true));
    canvas.drawCircle(cx, cy, r * 1.8, glow);
    core.setColor(Skia.Color('#FFFFFF'));
    core.setAlphaf(1);
    canvas.drawCircle(cx, cy, r * 0.6, core);
  }
}

/** Soft rotating sparkle halo around a rect centre, used behind the focused portal. */
export function drawHalo(canvas: SkCanvas, cx: number, cy: number, rx: number, ry: number, t: number, color: string, intensity: number) {
  'worklet';
  const glow = Skia.Paint();
  glow.setBlendMode(BlendMode.Plus);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 9, true));
  const col = Skia.Color(color);
  const core = Skia.Paint();
  core.setBlendMode(BlendMode.Plus);
  core.setColor(Skia.Color('#FFFFFF'));
  const n = 34;
  for (let i = 0; i < n; i++) {
    const phase = rand(i + 11);
    const speed = 0.18 + rand(i + 21) * 0.22;
    const u = (t * speed + phase) % 1;
    // Orbit around the portal edge, drifting outward as the particle ages.
    const ang = phase * Math.PI * 2 + t * 0.35 * (i % 2 === 0 ? 1 : -1);
    const out = 1 + 0.06 + u * 0.16;
    const x = cx + Math.cos(ang) * rx * out;
    const y = cy + Math.sin(ang) * ry * out - u * 18;
    const a = Math.sin(u * Math.PI) * intensity;
    glow.setColor(col);
    glow.setAlphaf(a * 0.9);
    canvas.drawCircle(x, y, 4 + rand(i + 31) * 4, glow);
    core.setAlphaf(a);
    canvas.drawCircle(x, y, 1.3, core);
  }
}

/** Icon-only HUD glyphs (no text anywhere). All drawn centred on (cx, cy) with half-size s. */
export function drawIcon(canvas: SkCanvas, kind: 'avatar' | 'star' | 'gear' | 'back' | 'cup' | 'door' | 'trash', cx: number, cy: number, s: number, color: string, alpha: number) {
  'worklet';
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  p.setAlphaf(alpha);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(s * 0.2);
  p.setStrokeCap(1);
  p.setStrokeJoin(1);
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  fill.setColor(Skia.Color(color));
  fill.setAlphaf(alpha);

  if (kind === 'avatar') {
    canvas.drawCircle(cx, cy - s * 0.28, s * 0.3, fill);
    const body = Skia.PathBuilder.Make()
      .moveTo(cx - s * 0.62, cy + s * 0.7)
      .quadTo(cx - s * 0.62, cy + s * 0.12, cx, cy + s * 0.12)
      .quadTo(cx + s * 0.62, cy + s * 0.12, cx + s * 0.62, cy + s * 0.7)
      .close()
      .build();
    canvas.drawPath(body, fill);
  } else if (kind === 'star') {
    const b = Skia.PathBuilder.Make();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? s * 0.95 : s * 0.42;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    }
    canvas.drawPath(b.close().build(), fill);
  } else if (kind === 'gear') {
    canvas.drawCircle(cx, cy, s * 0.5, p);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      canvas.drawLine(cx + Math.cos(a) * s * 0.72, cy + Math.sin(a) * s * 0.72, cx + Math.cos(a) * s * 1.0, cy + Math.sin(a) * s * 1.0, p);
    }
  } else if (kind === 'cup') {
    const bowl = Skia.PathBuilder.Make()
      .moveTo(cx - s * 0.62, cy - s * 0.7)
      .lineTo(cx + s * 0.62, cy - s * 0.7)
      .quadTo(cx + s * 0.62, cy + s * 0.3, cx, cy + s * 0.3)
      .quadTo(cx - s * 0.62, cy + s * 0.3, cx - s * 0.62, cy - s * 0.7)
      .close()
      .build();
    canvas.drawPath(bowl, fill);
    canvas.drawLine(cx, cy + s * 0.3, cx, cy + s * 0.65, p);
    canvas.drawLine(cx - s * 0.4, cy + s * 0.78, cx + s * 0.4, cy + s * 0.78, p);
    canvas.drawArc(Skia.XYWHRect(cx - s * 1.0, cy - s * 0.62, s * 0.7, s * 0.7), 90, 180, false, p);
    canvas.drawArc(Skia.XYWHRect(cx + s * 0.3, cy - s * 0.62, s * 0.7, s * 0.7), -90, 180, false, p);
  } else if (kind === 'door') {
    canvas.drawPath(
      Skia.PathBuilder.Make().moveTo(cx - s * 0.2, cy - s * 0.8).lineTo(cx - s * 0.8, cy - s * 0.8).lineTo(cx - s * 0.8, cy + s * 0.8).lineTo(cx - s * 0.2, cy + s * 0.8).build(),
      p,
    );
    canvas.drawLine(cx - s * 0.2, cy, cx + s * 0.8, cy, p);
    canvas.drawLine(cx + s * 0.8, cy, cx + s * 0.4, cy - s * 0.4, p);
    canvas.drawLine(cx + s * 0.8, cy, cx + s * 0.4, cy + s * 0.4, p);
  } else if (kind === 'trash') {
    canvas.drawLine(cx - s * 0.8, cy - s * 0.55, cx + s * 0.8, cy - s * 0.55, p);
    canvas.drawLine(cx - s * 0.3, cy - s * 0.55, cx - s * 0.3, cy - s * 0.85, p);
    canvas.drawLine(cx + s * 0.3, cy - s * 0.55, cx + s * 0.3, cy - s * 0.85, p);
    canvas.drawPath(
      Skia.PathBuilder.Make().moveTo(cx - s * 0.6, cy - s * 0.55).lineTo(cx - s * 0.5, cy + s * 0.85).lineTo(cx + s * 0.5, cy + s * 0.85).lineTo(cx + s * 0.6, cy - s * 0.55).build(),
      p,
    );
  } else {
    const path = Skia.PathBuilder.Make().moveTo(cx + s * 0.35, cy - s * 0.7).lineTo(cx - s * 0.4, cy).lineTo(cx + s * 0.35, cy + s * 0.7).build();
    canvas.drawPath(path, p);
  }
}
