import type { Mode } from '../../engine/dda';
import type { SeededRNG } from '../../engine/SeededRNG';

export const STAR = 0;
export const GOLD = 1;
export const HAZARD = 2;
export type ObjKind = typeof STAR | typeof GOLD | typeof HAZARD;

export interface Obj {
  id: number;
  kind: ObjKind;
  x: number;
  y: number;
  vy: number;
  r: number;
  rot: number;
  spin: number;
  age: number;
}

export type SimEvent =
  | { type: 'catch'; kind: ObjKind; x: number; y: number; streak: number }
  | { type: 'miss'; x: number }
  | { type: 'hit'; x: number; y: number; lives: number }
  | { type: 'shield'; x: number; y: number; reason: 'hit' | 'miss' }
  | { type: 'fever'; on: boolean }
  | { type: 'over' };

export interface SimConfig {
  W: number;
  H: number;
  /** Centre and catch radius of the player. */
  playerY: number;
  playerR: number;
  mode: Mode;
}

export const FEVER_STREAK = 8;
export const FEVER_SECONDS = 6;
const INVULN = 1.1;
/** A miss only burns the shield when there is a streak worth protecting. */
const SHIELD_MIN_STREAK = 3;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Falling-object simulation for Star Catcher. Pure TypeScript (Node-testable).
 * Stars and gold stars are caught, hazards are dodged. Spawns come in patterns (lines, arcs, stairs, hazard walls with a gap).
 */
export class StarSim {
  objs: Obj[] = [];
  time = 0;
  playerX: number;
  targetX: number;
  lives: number;
  streak = 0;
  fever = 0;
  caught = 0;
  /** Skill rating 0-100 fed by the game; shapes difficulty. */
  psr = 50;
  over = false;
  /** Arcade streak shield: absorbs the next hazard hit or streak-breaking miss, then is spent. */
  shield = false;
  private spawnIn = 0.5;
  private invuln = 0;
  private nextId = 1;

  constructor(
    private cfg: SimConfig,
    private rng: SeededRNG,
  ) {
    this.playerX = cfg.W / 2;
    this.targetX = cfg.W / 2;
    this.lives = cfg.mode === 'ARCADE' ? 3 : 99;
  }

  /** 0 (gentle) .. 1 (hard). */
  get difficulty() {
    return clamp((this.time / 100) * 0.6 + (this.psr / 100) * 0.5 - 0.15, 0, 1);
  }

  get invulnerable() {
    return this.invuln > 0;
  }

  private get speedScale() {
    return this.cfg.mode === 'SANCTUARY' ? 0.6 : this.cfg.mode === 'TOYBOX' ? 0.8 : 1;
  }

  private spawn(kind: ObjKind, x: number, y: number) {
    const { W, H } = this.cfg;
    const d = this.difficulty;
    const r = (kind === GOLD ? 0.058 : kind === HAZARD ? 0.05 : 0.043) * W * (this.cfg.mode === 'TOYBOX' ? 1.15 : 1);
    this.objs.push({
      id: this.nextId++,
      kind,
      x: clamp(x, r, W - r),
      y,
      vy: H * (0.3 + 0.3 * d) * this.speedScale * (kind === HAZARD ? 0.92 : 1),
      r,
      rot: this.rng.next() * 6.28,
      spin: (this.rng.next() - 0.5) * (kind === HAZARD ? 3 : 2.4),
      age: 0,
    });
  }

  private spawnPattern() {
    const { W, mode } = this.cfg;
    const d = this.difficulty;
    const rng = this.rng;
    const margin = W * 0.1;
    const rand = (a: number, b: number) => a + rng.next() * (b - a);
    const hazardChance = mode === 'SANCTUARY' ? 0 : mode === 'TOYBOX' ? 0.12 : 0.15 + 0.35 * d;
    const gold = () => (rng.next() < 0.1 ? GOLD : STAR);
    const gap = W * 0.07;

    if (rng.next() < hazardChance) {
      // Hazard wall: hazards across the width with a gap at least 2.4 catch radii wide.
      const gapW = this.cfg.playerR * 2.6;
      const gapC = rand(margin + gapW / 2, W - margin - gapW / 2);
      const step = W * 0.2;
      for (let x = step / 2; x < W; x += step) {
        if (Math.abs(x - gapC) < gapW / 2 + W * 0.04) continue;
        if (rng.next() < 0.75) this.spawn(HAZARD, x, -W * 0.06);
      }
      this.spawn(STAR, gapC, -W * 0.06 - W * 0.12);
      return;
    }

    const pick = rng.nextInt(0, 4);
    if (pick === 0) {
      this.spawn(gold(), rand(margin, W - margin), -W * 0.05);
    } else if (pick === 1) {
      const n = rng.nextInt(3, 5);
      const start = rand(margin, W - margin - gap * (n - 1));
      for (let i = 0; i < n; i++) this.spawn(i === 2 ? gold() : STAR, start + i * gap * 1.4, -W * 0.05);
    } else if (pick === 2) {
      const n = 5;
      const cx = rand(W * 0.25, W * 0.75);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        this.spawn(STAR, cx + Math.sin(t * Math.PI) * W * 0.2 + (t - 0.5) * W * 0.3, -W * 0.05 - Math.sin(t * Math.PI) * W * 0.25);
      }
    } else if (pick === 3) {
      const n = 4;
      const dir = rng.next() < 0.5 ? 1 : -1;
      const x0 = dir > 0 ? margin : W - margin;
      for (let i = 0; i < n; i++) this.spawn(STAR, x0 + dir * i * W * 0.17, -W * 0.05 - i * W * 0.16);
    } else {
      const x = rand(margin, W - margin);
      for (let i = 0; i < 3; i++) this.spawn(STAR, x, -W * 0.05 - i * W * 0.14);
    }
  }

  /** Mercy: drops a gold star right above the player. */
  assist() {
    this.spawn(GOLD, this.playerX, -this.cfg.W * 0.05);
  }

  step(dt: number, events: SimEvent[]) {
    if (this.over) return;
    const { W, H, playerY, playerR, mode } = this.cfg;
    this.time += dt;
    this.invuln = Math.max(0, this.invuln - dt);

    const prevFever = this.fever;
    this.fever = Math.max(0, this.fever - dt);
    if (prevFever > 0 && this.fever === 0) events.push({ type: 'fever', on: false });

    this.playerX += (this.targetX - this.playerX) * Math.min(1, dt * 18);
    this.playerX = clamp(this.playerX, playerR * 0.4, W - playerR * 0.4);

    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawnPattern();
      const base = (1.35 - 0.75 * this.difficulty) * (mode === 'SANCTUARY' ? 1.4 : 1) * (this.fever > 0 ? 0.65 : 1);
      this.spawnIn = base;
    }

    const survivors: Obj[] = [];
    for (const o of this.objs) {
      o.age += dt;
      o.rot += o.spin * dt;
      o.y += o.vy * dt;

      if (this.fever > 0 && o.kind !== HAZARD) {
        const dx = this.playerX - o.x;
        const dy = playerY - o.y;
        const dist = Math.hypot(dx, dy);
        if (dist < playerR * 3.2 && dist > 1) {
          const pull = (1 - dist / (playerR * 3.2)) * 900 * dt;
          o.x += (dx / dist) * pull;
          o.y += (dy / dist) * pull * 0.6;
        }
      }

      const dist = Math.hypot(o.x - this.playerX, o.y - playerY);
      if (o.kind === HAZARD) {
        if (!this.invulnerable && dist < o.r * 0.85 + playerR * 0.7) {
          this.invuln = INVULN;
          if (this.shield && mode === 'ARCADE') {
            this.shield = false;
            events.push({ type: 'shield', x: o.x, y: o.y, reason: 'hit' });
            continue;
          }
          this.streak = 0;
          if (this.cfg.mode === 'ARCADE') this.lives -= 1;
          events.push({ type: 'hit', x: o.x, y: o.y, lives: this.lives });
          if (this.lives <= 0) {
            this.over = true;
            events.push({ type: 'over' });
          }
          continue;
        }
      } else if (dist < o.r + playerR) {
        this.streak += 1;
        this.caught += o.kind === GOLD ? 3 : 1;
        if (o.kind === GOLD) this.streak += 1;
        events.push({ type: 'catch', kind: o.kind, x: o.x, y: o.y, streak: this.streak });
        if (this.streak >= FEVER_STREAK && this.fever === 0 && mode !== 'SANCTUARY') {
          this.fever = FEVER_SECONDS;
          this.streak = 0;
          events.push({ type: 'fever', on: true });
        }
        continue;
      }

      if (o.y - o.r > H) {
        if (o.kind !== HAZARD) {
          // Missing a star ends the streak in Arcade only; gentle modes forgive it.
          if (mode === 'ARCADE') {
            if (this.shield && this.streak >= SHIELD_MIN_STREAK) {
              this.shield = false;
              events.push({ type: 'shield', x: o.x, y: H - playerR, reason: 'miss' });
            } else {
              this.streak = 0;
            }
          }
          events.push({ type: 'miss', x: o.x });
        }
        continue;
      }
      survivors.push(o);
    }
    this.objs = survivors;
  }
}
