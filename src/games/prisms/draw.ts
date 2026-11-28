import { BlendMode, BlurStyle, PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas } from '@shopify/react-native-skia';

export const CRYSTAL_COLORS = [
  '#5CEBFF', // 0: cyan diamond
  '#B48CFF', // 1: amethyst hex
  '#FF7AC8', // 2: rose star
  '#FFD166', // 3: amber drop
  '#5CFFB0', // 4: mint crescent
  '#5C9CFF', // 5: cobalt shard
  '#FFA0E8', // 6: aurora crown
];

export const CRYSTAL_GLOWS = [
  '#B8F8FF',
  '#E5D4FF',
  '#FFD0EC',
  '#FFF0BD',
  '#C4FFE2',
  '#C7DEFF',
  '#FFE0F8',
];

export const FEVER_RAINBOW = ['#5CEBFF', '#B48CFF', '#FF7AC8', '#FFD166', '#5CFFB0'];

/** [x, y, r, shapeIdx, colorIdx, lit 0..1, press 0..1, bad 0..1, hint 0..1] */
export const CRYSTAL_STRIDE = 9;

/** [x1, y1, x2, y2, colorIdx, alpha 0..1, rainbow 0|1, width] */
export const BEAM_STRIDE = 8;

function polygonPath(sides: number, r: number, rot: number, stretchY = 1.0) {
  'worklet';
  const b = Skia.PathBuilder.Make();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * Math.PI * 2) / sides;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * stretchY;
    if (i === 0) b.moveTo(x, y);
    else b.lineTo(x, y);
  }
  return b.close().build();
}

function crystalShapePath(shapeIdx: number, r: number) {
  'worklet';
  if (shapeIdx === 0) {
    // Diamond
    const b = Skia.PathBuilder.Make();
    b.moveTo(0, -r * 1.15);
    b.lineTo(r * 0.85, 0);
    b.lineTo(0, r * 1.15);
    b.lineTo(-r * 0.85, 0);
    return b.close().build();
  }
  if (shapeIdx === 1) {
    // Hexagon
    return polygonPath(6, r, -Math.PI / 2, 1.04);
  }
  if (shapeIdx === 2) {
    // 4-point star prism
    const b = Skia.PathBuilder.Make();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 4;
      const rr = i % 2 === 0 ? r * 1.14 : r * 0.54;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    }
    return b.close().build();
  }
  if (shapeIdx === 3) {
    // Teardrop / pendant gem
    const b = Skia.PathBuilder.Make();
    b.moveTo(0, -r * 1.15);
    b.cubicTo(r * 0.95, -r * 0.25, r * 0.9, r * 0.95, 0, r * 1.05);
    b.cubicTo(-r * 0.9, r * 0.95, -r * 0.95, -r * 0.25, 0, -r * 1.15);
    return b.close().build();
  }
  if (shapeIdx === 4) {
    // Rounded shield / pentagon
    return polygonPath(5, r * 1.02, -Math.PI / 2, 1.0);
  }
  if (shapeIdx === 5) {
    // Tall obelisk shard
    const b = Skia.PathBuilder.Make();
    b.moveTo(0, -r * 1.2);
    b.lineTo(r * 0.72, -r * 0.42);
    b.lineTo(r * 0.58, r * 0.88);
    b.lineTo(0, r * 1.08);
    b.lineTo(-r * 0.58, r * 0.88);
    b.lineTo(-r * 0.72, -r * 0.42);
    return b.close().build();
  }
  // Crown / octagon prism
  return polygonPath(8, r * 1.0, Math.PI / 8, 1.0);
}

/** Ambient crystal sparkles, prism charge ring, and mirror reverse orbital ribbon. */
export function drawCavernOverlay(
  canvas: SkCanvas,
  W: number,
  H: number,
  cx: number,
  cy: number,
  ringR: number,
  charge: number,
  fever: number,
  mirrorCue: number,
  time: number,
) {
  'worklet';
  const fill = Skia.Paint();
  fill.setAntiAlias(true);

  // Subtle floating crystal dust motes
  for (let i = 0; i < 28; i++) {
    const sx = ((Math.sin(i * 45.164) * 43758.5453) % 1 + 1) % 1;
    const sy = ((Math.sin(i * 93.989) * 23421.631) % 1 + 1) % 1;
    const driftY = ((sy - time * (0.015 + (i % 4) * 0.004)) % 1 + 1) % 1;
    const pulse = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(time * 2.2 + i * 1.3));
    const col = fever > 0.1 ? FEVER_RAINBOW[i % FEVER_RAINBOW.length] : i % 2 === 0 ? '#7FE8FF' : '#B48CFF';
    fill.setColor(Skia.Color(col));
    fill.setAlphaf((0.2 + fever * 0.28) * pulse);
    canvas.drawCircle(sx * W, driftY * H * 0.88, 1.2 + (i % 3) * 0.9, fill);
  }

  // Outer crystal ring guide
  const ring = Skia.Paint();
  ring.setAntiAlias(true);
  ring.setStyle(PaintStyle.Stroke);
  ring.setStrokeWidth(2);
  ring.setColor(Skia.Color(fever > 0.1 ? '#FFD166' : '#7FE8FF'));
  ring.setAlphaf(0.14 + fever * 0.22);
  canvas.drawCircle(cx, cy, ringR, ring);

  // Inner Prism Charge Ring around the resident mascot
  const chargeR = Math.min(ringR * 0.44, W * 0.17);
  const track = Skia.Paint();
  track.setAntiAlias(true);
  track.setStyle(PaintStyle.Stroke);
  track.setStrokeWidth(5);
  track.setColor(Skia.Color('#FFFFFF'));
  track.setAlphaf(0.1);
  canvas.drawCircle(cx, cy, chargeR, track);

  if (charge > 0.01 || fever > 0.05) {
    const arcPaint = Skia.Paint();
    arcPaint.setAntiAlias(true);
    arcPaint.setStyle(PaintStyle.Stroke);
    arcPaint.setStrokeCap(StrokeCap.Round);
    arcPaint.setStrokeWidth(fever > 0.1 ? 7 : 5.5);
    const feverIdx = Math.floor(time * 6) % FEVER_RAINBOW.length;
    arcPaint.setColor(Skia.Color(fever > 0.1 ? FEVER_RAINBOW[feverIdx] : '#7FE8FF'));
    arcPaint.setAlphaf(0.85);
    const sweep = fever > 0.1 ? 360 : Math.min(359, charge * 360);
    const arc = Skia.PathBuilder.Make();
    arc.addArc(Skia.XYWHRect(cx - chargeR, cy - chargeR, chargeR * 2, chargeR * 2), -90, sweep);
    canvas.drawPath(arc.build(), arcPaint);

    if (fever > 0.1) {
      const glow = Skia.Paint();
      glow.setAntiAlias(true);
      glow.setStyle(PaintStyle.Stroke);
      glow.setStrokeWidth(14);
      glow.setBlendMode(BlendMode.Plus);
      glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 10, true));
      glow.setColor(Skia.Color(FEVER_RAINBOW[(feverIdx + 2) % FEVER_RAINBOW.length]));
      glow.setAlphaf(0.42 * fever);
      canvas.drawCircle(cx, cy, chargeR, glow);
    }
  }

  // Mirror Echo cue: counter-clockwise violet orbital arrows around center
  if (mirrorCue > 0.02) {
    const mr = chargeR + 18;
    const mPaint = Skia.Paint();
    mPaint.setAntiAlias(true);
    mPaint.setStyle(PaintStyle.Stroke);
    mPaint.setStrokeCap(StrokeCap.Round);
    mPaint.setStrokeWidth(4);
    mPaint.setColor(Skia.Color('#D896FF'));
    mPaint.setAlphaf(0.85 * mirrorCue);

    for (let k = 0; k < 2; k++) {
      const baseDeg = ((-time * 130) % 360) + k * 180;
      const b = Skia.PathBuilder.Make();
      b.addArc(Skia.XYWHRect(cx - mr, cy - mr, mr * 2, mr * 2), baseDeg, -110);
      canvas.drawPath(b.build(), mPaint);

      // Arrowhead pointing counter-clockwise at the arc tip
      const tipRad = ((baseDeg - 110) * Math.PI) / 180;
      const tx = cx + Math.cos(tipRad) * mr;
      const ty = cy + Math.sin(tipRad) * mr;
      const tangent = tipRad - Math.PI / 2;
      const arrow = Skia.PathBuilder.Make();
      arrow.moveTo(tx + Math.cos(tangent + 2.4) * 9, ty + Math.sin(tangent + 2.4) * 9);
      arrow.lineTo(tx, ty);
      arrow.lineTo(tx + Math.cos(tangent - 2.4) * 9, ty + Math.sin(tangent - 2.4) * 9);
      canvas.drawPath(arrow.build(), mPaint);
    }
  }
}

/** Glowing laser beams & twin chord tethers connecting crystals. */
export function drawBeams(canvas: SkCanvas, beams: number[], time: number) {
  'worklet';
  const glow = Skia.Paint();
  glow.setAntiAlias(true);
  glow.setStyle(PaintStyle.Stroke);
  glow.setStrokeCap(StrokeCap.Round);
  glow.setBlendMode(BlendMode.Plus);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 9, true));

  const core = Skia.Paint();
  core.setAntiAlias(true);
  core.setStyle(PaintStyle.Stroke);
  core.setStrokeCap(StrokeCap.Round);

  for (let i = 0; i + BEAM_STRIDE - 1 < beams.length; i += BEAM_STRIDE) {
    const x1 = beams[i];
    const y1 = beams[i + 1];
    const x2 = beams[i + 2];
    const y2 = beams[i + 3];
    const ci = beams[i + 4];
    const alpha = beams[i + 5];
    const rainbow = beams[i + 6];
    const w = beams[i + 7];
    if (alpha <= 0.01) continue;

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const bend = 0.14;
    const cx = mx - dy * bend;
    const cy = my + dx * bend;

    const p = Skia.PathBuilder.Make();
    p.moveTo(x1, y1);
    p.quadTo(cx, cy, x2, y2);
    const path = p.build();

    const col =
      rainbow > 0.5
        ? FEVER_RAINBOW[Math.floor(time * 9 + i) % FEVER_RAINBOW.length]
        : CRYSTAL_COLORS[Math.abs(Math.round(ci)) % CRYSTAL_COLORS.length];

    glow.setColor(Skia.Color(col));
    glow.setStrokeWidth(w * 2.4);
    glow.setAlphaf(0.7 * alpha);
    canvas.drawPath(path, glow);

    core.setColor(Skia.Color('#FFFFFF'));
    core.setStrokeWidth(w * 0.75);
    core.setAlphaf(0.9 * alpha);
    canvas.drawPath(path, core);
  }
}

/** Draws all faceted glowing crystals in the cavern ring. */
export function drawCrystals(canvas: SkCanvas, crystals: number[], time: number) {
  'worklet';
  const fill = Skia.Paint();
  fill.setAntiAlias(true);

  const stroke = Skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(PaintStyle.Stroke);
  stroke.setStrokeJoin(StrokeJoin.Round);

  const bloom = Skia.Paint();
  bloom.setAntiAlias(true);
  bloom.setBlendMode(BlendMode.Plus);
  bloom.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 14, true));

  for (let i = 0; i + CRYSTAL_STRIDE - 1 < crystals.length; i += CRYSTAL_STRIDE) {
    const x = crystals[i];
    const y = crystals[i + 1];
    const baseR = crystals[i + 2];
    const shapeIdx = Math.round(crystals[i + 3]);
    const colorIdx = Math.abs(Math.round(crystals[i + 4])) % CRYSTAL_COLORS.length;
    const lit = crystals[i + 5];
    const press = crystals[i + 6];
    const bad = crystals[i + 7];
    const hint = crystals[i + 8];
    if (baseR <= 0) continue;

    const bob = Math.sin(time * 2.2 + i * 0.9) * 3;
    const scale = 1 + lit * 0.14 + press * 0.12 - bad * 0.06;
    const r = baseR * scale;
    const col = bad > 0.2 ? '#FF3B5C' : CRYSTAL_COLORS[colorIdx];
    const glowCol = bad > 0.2 ? '#FF8FA3' : CRYSTAL_GLOWS[colorIdx];

    // Hint ring (Toybox / Sanctuary / DDA assist)
    if (hint > 0.02) {
      const pulse = 1 + 0.14 * Math.sin(time * 7);
      stroke.setColor(Skia.Color('#FFF3B0'));
      stroke.setStrokeWidth(3);
      stroke.setAlphaf(0.85 * hint);
      canvas.drawCircle(x, y + bob, r * 1.32 * pulse, stroke);
    }

    // Outer glow aura
    if (lit > 0.02 || bad > 0.02) {
      bloom.setColor(Skia.Color(col));
      bloom.setAlphaf(Math.min(1, 0.22 + lit * 0.72 + bad * 0.65));
      canvas.drawCircle(x, y + bob, r * (1.25 + lit * 0.35), bloom);
    } else {
      fill.setColor(Skia.Color(col));
      fill.setAlphaf(0.14);
      canvas.drawCircle(x, y + bob, r * 1.15, fill);
    }

    canvas.save();
    canvas.translate(x, y + bob);

    // Outer faceted body
    const outer = crystalShapePath(shapeIdx, r);
    fill.setColor(Skia.Color(col));
    fill.setAlphaf(0.45 + lit * 0.55);
    canvas.drawPath(outer, fill);

    // Inner luminous core facet
    const inner = crystalShapePath(shapeIdx, r * (0.56 + lit * 0.14));
    fill.setColor(Skia.Color(lit > 0.35 ? '#FFFFFF' : glowCol));
    fill.setAlphaf(0.32 + lit * 0.65);
    canvas.drawPath(inner, fill);

    // Rim stroke
    stroke.setColor(Skia.Color(lit > 0.4 ? '#FFFFFF' : glowCol));
    stroke.setStrokeWidth(2 + lit * 2);
    stroke.setAlphaf(0.65 + lit * 0.35);
    canvas.drawPath(outer, stroke);

    // Top-left specular catchlight
    fill.setColor(Skia.Color('#FFFFFF'));
    fill.setAlphaf(0.5 + lit * 0.4);
    canvas.drawCircle(-r * 0.25, -r * 0.32, Math.max(2, r * 0.14), fill);

    canvas.restore();
  }
}
