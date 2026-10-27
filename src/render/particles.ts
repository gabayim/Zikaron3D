import { BlendMode, BlurStyle, PaintStyle, Skia, type SkCanvas } from '@shopify/react-native-skia';

export const ParticleKind = { Sparkle: 0, Confetti: 1, Ring: 2 } as const;
export type ParticleKindId = (typeof ParticleKind)[keyof typeof ParticleKind];

export interface BurstRequest {
  x: number;
  y: number;
  kind: ParticleKindId;
  count: number;
}

export const PALETTE = ['#FFD36E', '#FF7AC8', '#7FE8FF', '#B48CFF', '#8CFFC1', '#FFFFFF'];
const POOL = 320;

export interface ParticlePool {
  x: number[];
  y: number[];
  vx: number[];
  vy: number[];
  age: number[];
  life: number[];
  size: number[];
  color: number[];
  kind: number[];
  spin: number[];
  next: number;
}

export function createPool(): ParticlePool {
  const z = () => new Array<number>(POOL).fill(0);
  return { x: z(), y: z(), vx: z(), vy: z(), age: z(), life: z(), size: z(), color: z(), kind: z(), spin: z(), next: 0 };
}

export function spawnBurst(p: ParticlePool, b: BurstRequest) {
  'worklet';
  for (let n = 0; n < b.count; n++) {
    const i = p.next;
    p.next = (p.next + 1) % POOL;
    const a = Math.random() * Math.PI * 2;
    p.x[i] = b.x;
    p.y[i] = b.y;
    p.age[i] = 0;
    p.kind[i] = b.kind;
    p.color[i] = Math.floor(Math.random() * PALETTE.length);
    p.spin[i] = (Math.random() - 0.5) * 12;
    if (b.kind === ParticleKind.Ring) {
      p.vx[i] = 0;
      p.vy[i] = 0;
      p.life[i] = 0.55 + n * 0.12;
      p.size[i] = 14 + n * 10;
      p.color[i] = 5;
    } else if (b.kind === ParticleKind.Confetti) {
      const speed = 380 + Math.random() * 520;
      p.vx[i] = Math.cos(a) * speed * 0.7;
      p.vy[i] = -Math.abs(Math.sin(a)) * speed - 200;
      p.life[i] = 1.6 + Math.random() * 1.2;
      p.size[i] = 6 + Math.random() * 7;
    } else {
      const speed = 120 + Math.random() * 360;
      p.vx[i] = Math.cos(a) * speed;
      p.vy[i] = Math.sin(a) * speed - 80;
      p.life[i] = 0.6 + Math.random() * 0.7;
      p.size[i] = 3 + Math.random() * 6;
    }
  }
}

export function stepPool(p: ParticlePool, dt: number) {
  'worklet';
  for (let i = 0; i < POOL; i++) {
    if (p.age[i] >= p.life[i]) continue;
    p.age[i] += dt;
    if (p.kind[i] === ParticleKind.Confetti) {
      p.vy[i] += 900 * dt;
      p.vx[i] *= 1 - 1.6 * dt;
      p.vy[i] *= 1 - 1.2 * dt;
    } else if (p.kind[i] === ParticleKind.Sparkle) {
      p.vy[i] += 140 * dt;
      p.vx[i] *= 1 - 2.5 * dt;
      p.vy[i] *= 1 - 2.5 * dt;
    }
    p.x[i] += p.vx[i] * dt;
    p.y[i] += p.vy[i] * dt;
  }
}

function sparklePath(cx: number, cy: number, r: number) {
  'worklet';
  const k = r * 0.22;
  return Skia.PathBuilder.Make()
    .moveTo(cx, cy - r)
    .quadTo(cx + k, cy - k, cx + r, cy)
    .quadTo(cx + k, cy + k, cx, cy + r)
    .quadTo(cx - k, cy + k, cx - r, cy)
    .quadTo(cx - k, cy - k, cx, cy - r)
    .close()
    .build();
}

export function drawPool(canvas: SkCanvas, p: ParticlePool, timeSec: number) {
  'worklet';
  const glow = Skia.Paint();
  glow.setBlendMode(BlendMode.Plus);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 6, true));
  const core = Skia.Paint();
  core.setAntiAlias(true);
  const ring = Skia.Paint();
  ring.setAntiAlias(true);
  ring.setStyle(PaintStyle.Stroke);
  ring.setBlendMode(BlendMode.Plus);

  for (let i = 0; i < POOL; i++) {
    const age = p.age[i];
    const life = p.life[i];
    if (age >= life) continue;
    const t = age / life;
    const color = Skia.Color(PALETTE[p.color[i]]);
    const x = p.x[i];
    const y = p.y[i];
    const kind = p.kind[i];

    if (kind === ParticleKind.Ring) {
      const delay = (p.size[i] - 14) / 10 * 0.08;
      const lt = Math.max(0, (age - delay) / (life - delay));
      if (age < delay) continue;
      const eased = 1 - Math.pow(1 - lt, 3);
      ring.setColor(color);
      ring.setAlphaf((1 - lt) * 0.85);
      ring.setStrokeWidth(5 * (1 - lt) + 1);
      canvas.drawCircle(x, y, 10 + eased * (60 + p.size[i] * 1.6), ring);
    } else if (kind === ParticleKind.Confetti) {
      const alpha = t > 0.75 ? (1 - t) / 0.25 : 1;
      core.setColor(color);
      core.setAlphaf(alpha);
      const s = p.size[i];
      const flutter = Math.abs(Math.cos(timeSec * 9 + i));
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate((p.spin[i] * age * 57.3) % 360, 0, 0);
      canvas.drawRect(Skia.XYWHRect(-s / 2, (-s * 0.6 * flutter) / 2, s, s * 0.6 * flutter + 1), core);
      canvas.restore();
    } else {
      const alpha = (1 - t) * (0.7 + 0.3 * Math.sin(timeSec * 30 + i));
      const r = p.size[i] * (1 - t * 0.5);
      glow.setColor(color);
      glow.setAlphaf(alpha * 0.9);
      canvas.drawCircle(x, y, r * 2.2, glow);
      core.setColor(Skia.Color('#FFFFFF'));
      core.setAlphaf(alpha);
      canvas.drawPath(sparklePath(x, y, r * 1.8), core);
    }
  }
}

/** Ambient fireflies are analytic (position is a pure function of time), so they cost no state. */
export function drawFireflies(canvas: SkCanvas, w: number, h: number, timeSec: number, count: number) {
  'worklet';
  const glow = Skia.Paint();
  glow.setBlendMode(BlendMode.Plus);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 7, true));
  const core = Skia.Paint();
  core.setBlendMode(BlendMode.Plus);
  for (let i = 0; i < count; i++) {
    const s1 = Math.sin(i * 12.9898) * 43758.5453;
    const r1 = s1 - Math.floor(s1);
    const s2 = Math.sin(i * 78.233) * 12543.1234;
    const r2 = s2 - Math.floor(s2);
    const speed = 0.15 + r1 * 0.35;
    const bx = r1 * w;
    const by = h * (0.25 + r2 * 0.7);
    const x = bx + Math.sin(timeSec * speed + i) * (30 + r2 * 50);
    const y = by + Math.cos(timeSec * speed * 1.3 + i * 2.1) * (20 + r1 * 40) - ((timeSec * 6 * speed) % 40);
    const pulse = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(timeSec * (1.2 + r2 * 2.5) + i * 3.7), 3);
    const color = Skia.Color(i % 3 === 0 ? '#BFF6FF' : '#FFE9A8');
    glow.setColor(color);
    glow.setAlphaf(pulse * 0.8);
    canvas.drawCircle(x, y, 6 + r2 * 5, glow);
    core.setColor(color);
    core.setAlphaf(pulse);
    canvas.drawCircle(x, y, 1.6 + r1 * 1.4, core);
  }
}
