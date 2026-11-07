import { BlendMode, BlurStyle, PaintStyle, Skia, StrokeCap, type SkCanvas } from '@shopify/react-native-skia';

export const K_EMPTY = 0;
export const K_THORN = 1;
export const K_TILE = 2;
export const K_SPRING = 3;
export const K_BUD = 4;

export const F_LOCKED = 1;
export const F_FOG = 2;
export const F_HINT = 4;
export const F_WIGGLE = 8;

/** Snapshot layout per cell: [kind, mask, lit, angleDeg, flags, cx, cy, size, linkId]. */
export const CELL_STRIDE = 9;

const SAP = ['#FFC94A', '#6FD3FF'];
const SAP_CORE = ['#FFF4C2', '#E2F7FF'];
const CLASH = '#FF4D6D';
const LINKS = ['#FF8FD8', '#B58CFF', '#FFB36B'];

/** The vine board. Pure function of (snapshot, time) for the UI thread. */
export function drawBoard(canvas: SkCanvas, snap: number[], time: number) {
  'worklet';
  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  const edge = Skia.Paint();
  edge.setAntiAlias(true);
  edge.setStyle(PaintStyle.Stroke);
  const vine = Skia.Paint();
  vine.setAntiAlias(true);
  vine.setStyle(PaintStyle.Stroke);
  vine.setStrokeCap(StrokeCap.Round);
  const glow = Skia.Paint();
  glow.setAntiAlias(true);
  glow.setStyle(PaintStyle.Stroke);
  glow.setStrokeCap(StrokeCap.Round);
  glow.setBlendMode(BlendMode.Plus);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 9, true));
  const halo = Skia.Paint();
  halo.setBlendMode(BlendMode.Plus);
  halo.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 14, true));
  const mist = Skia.Paint();
  mist.setAntiAlias(true);
  mist.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 8, true));

  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];

  for (let i = 0; i < snap.length; i += CELL_STRIDE) {
    const kind = snap[i];
    const mask = snap[i + 1];
    const lit = snap[i + 2];
    const angle = snap[i + 3];
    const flags = snap[i + 4];
    const cx = snap[i + 5];
    const cy = snap[i + 6];
    const s = snap[i + 7];
    const link = snap[i + 8];
    const half = s * 0.46;
    const cell = i / CELL_STRIDE;

    // Soil bed.
    const bed = Skia.RRectXY(Skia.XYWHRect(cx - half, cy - half, half * 2, half * 2), s * 0.16, s * 0.16);
    if (kind === K_EMPTY) {
      fill.setColor(Skia.Color('#2A1C14'));
      fill.setAlphaf(0.32);
      canvas.drawRRect(bed, fill);
      continue;
    }
    if (kind === K_THORN) {
      fill.setColor(Skia.Color('#2A1C14'));
      fill.setAlphaf(0.5);
      canvas.drawRRect(bed, fill);
      fill.setColor(Skia.Color('#5B1F3A'));
      fill.setAlphaf(1);
      for (let k = 0; k < 5; k++) {
        const a = k * 1.256 + cell;
        const bx = cx + Math.cos(a) * s * 0.17;
        const by = cy + Math.sin(a) * s * 0.17;
        const spike = Skia.PathBuilder.Make()
          .moveTo(bx + Math.cos(a) * s * 0.2, by + Math.sin(a) * s * 0.2)
          .lineTo(bx + Math.cos(a + 1.9) * s * 0.07, by + Math.sin(a + 1.9) * s * 0.07)
          .lineTo(bx + Math.cos(a - 1.9) * s * 0.07, by + Math.sin(a - 1.9) * s * 0.07)
          .close()
          .build();
        canvas.drawPath(spike, fill);
      }
      fill.setColor(Skia.Color('#8A2E52'));
      canvas.drawCircle(cx, cy, s * 0.16, fill);
      fill.setColor(Skia.Color('#FFFFFF'));
      fill.setAlphaf(0.35);
      canvas.drawCircle(cx - s * 0.05, cy - s * 0.05, s * 0.04, fill);
      continue;
    }

    const locked = (flags & F_LOCKED) !== 0;
    const fog = (flags & F_FOG) !== 0;
    const shader = Skia.Shader.MakeLinearGradient(
      { x: cx, y: cy - half },
      { x: cx, y: cy + half },
      locked ? [Skia.Color('#8D93A3'), Skia.Color('#555B6B')] : [Skia.Color('#6B4A33'), Skia.Color('#3E2A1C')],
      null,
      0,
    );
    fill.setShader(shader);
    fill.setAlphaf(1);
    canvas.drawRRect(bed, fill);
    fill.setShader(null);
    edge.setColor(Skia.Color(locked ? '#C9CEDA' : '#8C6446'));
    edge.setAlphaf(0.6);
    edge.setStrokeWidth(Math.max(1, s * 0.03));
    canvas.drawRRect(bed, edge);
    if (locked) {
      fill.setColor(Skia.Color('#E4E8F0'));
      fill.setAlphaf(0.8);
      const r = s * 0.035;
      canvas.drawCircle(cx - half * 0.72, cy - half * 0.72, r, fill);
      canvas.drawCircle(cx + half * 0.72, cy - half * 0.72, r, fill);
      canvas.drawCircle(cx - half * 0.72, cy + half * 0.72, r, fill);
      canvas.drawCircle(cx + half * 0.72, cy + half * 0.72, r, fill);
    }

    if (flags & F_HINT) {
      halo.setColor(Skia.Color('#FFF6B0'));
      halo.setAlphaf(0.45 + 0.3 * Math.sin(time * 7));
      canvas.drawCircle(cx, cy, s * 0.55, halo);
    }

    if (fog) {
      for (let k = 0; k < 4; k++) {
        const a = time * 0.6 + k * 1.57 + cell;
        mist.setColor(Skia.Color(k % 2 ? '#CBD6EA' : '#E9EEF8'));
        mist.setAlphaf(0.85);
        canvas.drawCircle(cx + Math.cos(a) * s * 0.12, cy + Math.sin(a) * s * 0.1, s * 0.26, mist);
      }
      continue;
    }

    canvas.save();
    canvas.translate(cx, cy);
    const wiggle = flags & F_WIGGLE ? Math.sin(time * 60) * 6 : 0;
    canvas.rotate(angle + wiggle, 0, 0);

    const colour = lit === 2 ? CLASH : lit >= 0 ? SAP[lit] : '#6E5A2E';
    const w = s * 0.2;
    if (lit >= 0) {
      glow.setColor(Skia.Color(colour));
      glow.setAlphaf(0.85);
      glow.setStrokeWidth(w * 1.6);
    }
    for (let d = 0; d < 4; d++) {
      if (!(mask & (1 << d))) continue;
      const ex = DX[d] * half;
      const ey = DY[d] * half;
      if (lit >= 0) canvas.drawLine(0, 0, ex, ey, glow);
      vine.setColor(Skia.Color('#3B2C14'));
      vine.setAlphaf(1);
      vine.setStrokeWidth(w * 1.25);
      canvas.drawLine(0, 0, ex, ey, vine);
      vine.setColor(Skia.Color(colour));
      vine.setStrokeWidth(w);
      canvas.drawLine(0, 0, ex, ey, vine);
      if (lit === 0 || lit === 1) {
        // Sap beads travelling outward from the spring side.
        const t = (time * 1.4 + cell * 0.37 + d * 0.25) % 1;
        fill.setColor(Skia.Color(SAP_CORE[lit]));
        fill.setAlphaf(0.9 * Math.sin(t * Math.PI));
        canvas.drawCircle(ex * t, ey * t, w * 0.34, fill);
      }
    }
    if (kind !== K_SPRING) {
      fill.setColor(Skia.Color(lit >= 0 ? colour : '#7E6834'));
      fill.setAlphaf(1);
      canvas.drawCircle(0, 0, w * 0.75, fill);
      // Leaf on the knot.
      fill.setColor(Skia.Color(lit >= 0 ? '#9BE37A' : '#5E7A3A'));
      canvas.drawOval(Skia.XYWHRect(w * 0.2, -w * 1.1, w * 0.9, w * 0.55), fill);
    }
    canvas.restore();

    if (kind === K_SPRING) {
      const c = lit === 1 ? 1 : 0;
      const pulse = 1 + Math.sin(time * 4 + cell) * 0.08;
      halo.setColor(Skia.Color(SAP[c]));
      halo.setAlphaf(0.8);
      canvas.drawCircle(cx, cy, s * 0.34 * pulse, halo);
      fill.setColor(Skia.Color(SAP[c]));
      fill.setAlphaf(1);
      canvas.drawCircle(cx, cy, s * 0.22, fill);
      fill.setColor(Skia.Color(SAP_CORE[c]));
      canvas.drawCircle(cx - s * 0.05, cy - s * 0.06, s * 0.08, fill);
      const rt = (time * 0.8 + cell * 0.3) % 1;
      edge.setColor(Skia.Color(SAP_CORE[c]));
      edge.setAlphaf(1 - rt);
      edge.setStrokeWidth(2);
      canvas.drawCircle(cx, cy, s * (0.22 + rt * 0.22), edge);
    }

    if (link >= 0) {
      const lx = cx + half * 0.62;
      const ly = cy - half * 0.62;
      fill.setColor(Skia.Color(LINKS[link % LINKS.length]));
      fill.setAlphaf(1);
      canvas.drawCircle(lx, ly, s * 0.09, fill);
      edge.setColor(Skia.Color('#FFFFFF'));
      edge.setAlphaf(0.9);
      edge.setStrokeWidth(Math.max(1.5, s * 0.025));
      canvas.drawCircle(lx, ly, s * 0.09, edge);
    }
  }
}

/** Faint tether lines between linked tiles so pairs read at a glance. */
export function drawLinks(canvas: SkCanvas, pairs: number[], time: number) {
  'worklet';
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeCap(StrokeCap.Round);
  paint.setPathEffect(Skia.PathEffect.MakeDash([6, 8], -time * 30));
  for (let i = 0; i < pairs.length; i += 5) {
    paint.setColor(Skia.Color(LINKS[pairs[i] % LINKS.length]));
    paint.setAlphaf(0.55);
    paint.setStrokeWidth(3);
    canvas.drawLine(pairs[i + 1], pairs[i + 2], pairs[i + 3], pairs[i + 4], paint);
  }
}
