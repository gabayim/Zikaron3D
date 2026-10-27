/**
 * Tiny circle physics for merge games (position-based, fixed timestep). Plain TypeScript so it can run on
 * any thread and be tested in Node. Same-tier circles that touch are merged into the next tier.
 */

export interface Body {
  id: number;
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  av: number;
  /** Seconds since spawn. */
  age: number;
}

export interface Bounds {
  left: number;
  right: number;
  floor: number;
}

export interface MergeEvent {
  x: number;
  y: number;
  /** Tier of the new body (equals radii.length when two top-tier bodies vanish). */
  tier: number;
  /** True when two top-tier bodies annihilated instead of producing a new one. */
  ultimate: boolean;
  /** Relative impact speed, for juice. */
  speed: number;
}

const ITERATIONS = 5;

export class PhysicsWorld {
  bodies: Body[] = [];
  gravity = 2400;
  private nextId = 1;

  constructor(
    public bounds: Bounds,
    public radii: readonly number[],
  ) {}

  add(tier: number, x: number, y: number, vx = 0, vy = 0): Body {
    const body: Body = { id: this.nextId++, tier, x, y, vx, vy, r: this.radii[tier], angle: 0, av: 0, age: 0 };
    this.bodies.push(body);
    return body;
  }

  remove(id: number) {
    this.bodies = this.bodies.filter((b) => b.id !== id);
  }

  clear() {
    this.bodies = [];
  }

  step(dt: number, events: MergeEvent[]) {
    const bodies = this.bodies;
    const { left, right, floor } = this.bounds;
    const px: number[] = new Array(bodies.length);
    const py: number[] = new Array(bodies.length);

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      b.age += dt;
      b.vy += this.gravity * dt;
      px[i] = b.x;
      py[i] = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }

    const mergePairs: [number, number][] = [];
    const used = new Set<number>();

    for (let it = 0; it < ITERATIONS; it++) {
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (b.x - b.r < left) b.x = left + b.r;
        if (b.x + b.r > right) b.x = right - b.r;
        if (b.y + b.r > floor) b.y = floor - b.r;
      }
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        for (let j = i + 1; j < bodies.length; j++) {
          const c = bodies[j];
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const minD = (a.r + c.r) * 0.98;
          const d2 = dx * dx + dy * dy;
          if (d2 >= minD * minD) continue;
          if (a.tier === c.tier && !used.has(a.id) && !used.has(c.id)) {
            used.add(a.id);
            used.add(c.id);
            mergePairs.push([i, j]);
            continue;
          }
          const d = Math.sqrt(d2) || 0.0001;
          const overlap = minD - d;
          const nx = dx / d;
          const ny = dy / d;
          // Heavier (bigger) circles move less.
          const ma = a.r * a.r;
          const mc = c.r * c.r;
          const wa = mc / (ma + mc);
          const wc = ma / (ma + mc);
          a.x -= nx * overlap * wa;
          a.y -= ny * overlap * wa;
          c.x += nx * overlap * wc;
          c.y += ny * overlap * wc;
        }
      }
    }

    // Derive velocities from displacement, add contact friction and spin.
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      b.vx = (b.x - px[i]) / dt;
      b.vy = (b.y - py[i]) / dt;
      const onFloor = b.y + b.r >= floor - 0.5;
      b.vx *= onFloor ? 0.985 : 0.999;
      if (onFloor && Math.abs(b.vx) < 6) b.vx = 0;
      b.av += (b.vx / Math.max(b.r, 1)) * 0.4 * dt * 8;
      b.av *= 0.96;
      b.angle += b.av * dt;
      b.angle *= 0.97; // creatures stay mostly upright
    }

    // Resolve merges after the solver so the stack is consistent.
    if (mergePairs.length) {
      const removed = new Set<number>();
      const created: Body[] = [];
      for (const [i, j] of mergePairs) {
        const a = bodies[i];
        const c = bodies[j];
        removed.add(a.id);
        removed.add(c.id);
        const mx = (a.x + c.x) / 2;
        const my = (a.y + c.y) / 2;
        const speed = Math.hypot(a.vx - c.vx, a.vy - c.vy);
        const next = a.tier + 1;
        if (next >= this.radii.length) {
          events.push({ x: mx, y: my, tier: next, ultimate: true, speed });
        } else {
          const nb: Body = {
            id: this.nextId++,
            tier: next,
            x: mx,
            y: my,
            vx: (a.vx + c.vx) * 0.25,
            vy: (a.vy + c.vy) * 0.25 - 160,
            r: this.radii[next],
            angle: 0,
            av: 0,
            age: 0,
          };
          // Keep inside the jar.
          nb.x = Math.max(left + nb.r, Math.min(right - nb.r, nb.x));
          nb.y = Math.min(floor - nb.r, nb.y);
          created.push(nb);
          events.push({ x: mx, y: my, tier: next, ultimate: false, speed });
        }
      }
      this.bodies = bodies.filter((b) => !removed.has(b.id)).concat(created);
    }
  }
}
