import type { AttackableUnit } from '@moba2d/core/content/types';
import { api } from '../../packApi';
import { issueCharms } from '../../world/charms';
import { BLUE, RED } from '../../world/layout';
import { INK, courtColor } from '../../world/palette';
import { ensureArt } from '../../world/art/sceneryObject';
import { onMap } from '../onMap';
import { hillArt } from './art';
import { HillHud } from './hud';
import { HILL_ISLANDS, HILL_MAP_ID, HILL_MAP_SIZE, HILL_PEARLS } from './layout';
import {
  PEARL_HEAL,
  PEARL_REACH,
  PEARL_RESPAWN_MS,
  TIME_LIMIT_MS,
  ZONE_RADIUS,
  accrue,
  holderOf,
  scheduleAt,
  winnerOf,
  type HillScore,
  type Side,
} from './rules';

/**
 * Vua Đảo's one object: it counts heads in the ring, scores, rotates the ring,
 * hands out pearls, nudges bots toward the ring and calls the match. The
 * deciding is in `rules.ts`; this file only touches the engine.
 */
export const BOT_NUDGE_MS = 1_500;
/** Bots below this health fraction, or with an enemy champion this close, are left to their own brain. */
export const BOT_NUDGE_MIN_HEALTH = 0.45;
export const BOT_NUDGE_ENEMY_PX = 450;
const TICK_MS = 250;

export interface Hill {
  readonly score: HillScore;
  readonly winner: Side | null;
  readonly holder: Side | null;
  /** Centre of the ring right now. */
  zone(): { x: number; y: number };
  /** Advance the rules by `dtMs` without drawing — what `update()` does each tick. */
  step(dtMs: number): void;
}

const hills = new WeakMap<object, Hill>();
export const getHill = (game: unknown): Hill | null => (game ? hills.get(game as object) : null) ?? null;

const sideOf = (teamId: string | undefined): Side | null =>
  teamId === BLUE ? 'blue' : teamId === RED ? 'red' : null;

function build() {
  const { Champion } = api.units;

  class HillObject extends api.GameObject implements Hill {
    zIndex = api.layers.OBJECTIVE_Z_INDEX ?? 3.5;
    alwaysVisible = true;
    score: HillScore = { blue: 0, red: 0 };
    winner: Side | null = null;
    holder: Side | null = null;
    private contested = true;
    private clockMs = 0;
    private tickClock = 0;
    private nudgeClock = 0;
    private hudClock = 0;
    private seed: number;
    private hud = new HillHud();
    private pearlReadyAt: number[] = HILL_PEARLS.map(() => 0);

    constructor(game: any, x: number, y: number) {
      super({ game, position: createVector(x, y) });
      const seed = Number(game.matchSeed);
      this.seed = Number.isFinite(seed) ? Math.floor(seed) : 0;
      hills.set(game, this);
    }

    private get now(): number {
      return Number((this.game as any).matchTimeMs) || 0;
    }

    zone() {
      return HILL_ISLANDS[scheduleAt(this.now, this.seed).island];
    }

    private champions(): any[] {
      return (this.game as any).objectManager.queryObjects({
        area: new api.utils.Quadtree.Circle({ x: HILL_MAP_SIZE / 2, y: HILL_MAP_SIZE / 2, r: HILL_MAP_SIZE }),
        filters: [api.combat.PredefinedFilters.canTakeDamage],
      }).filter((unit: AttackableUnit) => unit instanceof Champion);
    }

    step(dtMs: number): void {
      this.clockMs += dtMs;
      if (this.winner) return;
      const zone = this.zone();
      const champions = this.champions();
      let blue = 0;
      let red = 0;
      for (const unit of champions) {
        if (Math.hypot(unit.position.x - zone.x, unit.position.y - zone.y) > ZONE_RADIUS) continue;
        const side = sideOf(unit.teamId);
        if (side === 'blue') blue++;
        else if (side === 'red') red++;
      }
      this.holder = holderOf(blue, red);
      this.contested = this.holder === null;
      this.score = accrue(this.score, this.holder, dtMs);

      this.tickClock += dtMs;
      if (this.tickClock >= TICK_MS) {
        this.tickClock = 0;
        this.pearls(champions);
        for (const unit of champions) issueCharms(unit);
      }
      this.nudgeClock += dtMs;
      if (this.nudgeClock >= BOT_NUDGE_MS) {
        this.nudgeClock = 0;
        this.nudgeBots(champions, zone);
      }
      this.winner = winnerOf(this.score, this.now);
    }

    private pearls(champions: any[]): void {
      const now = this.now;
      for (const unit of champions) {
        for (let i = 0; i < HILL_PEARLS.length; i++) {
          const pearl = HILL_PEARLS[i];
          if (this.pearlReadyAt[i] > now) continue;
          if (Math.hypot(unit.position.x - pearl.x, unit.position.y - pearl.y) > PEARL_REACH) continue;
          this.pearlReadyAt[i] = now + PEARL_RESPAWN_MS;
          unit.takeHeal(PEARL_HEAL, unit);
        }
      }
    }

    /**
     * No pack hook steers bots toward an objective, so the hill walks them
     * there itself: a healthy bot with no enemy champion close is sent to a
     * point inside the ring. Everyone else keeps the shared brain.
     */
    private nudgeBots(champions: any[], zone: { x: number; y: number }): void {
      const player = (this.game as any).player;
      champions.forEach((unit, index) => {
        if (unit === player || typeof unit.navigateToWalkable !== 'function') return;
        const max = unit.stats?.maxHealth?.value ?? 0;
        if (max > 0 && unit.stats.health.value / max < BOT_NUDGE_MIN_HEALTH) return;
        if (Math.hypot(unit.position.x - zone.x, unit.position.y - zone.y) < ZONE_RADIUS * 0.6) return;
        const enemyNear = champions.some(
          other =>
            other.teamId !== unit.teamId &&
            Math.hypot(other.position.x - unit.position.x, other.position.y - unit.position.y) < BOT_NUDGE_ENEMY_PX
        );
        if (enemyNear) return;
        const a = index * 2.4;
        unit.navigateToWalkable(zone.x + Math.cos(a) * ZONE_RADIUS * 0.4, zone.y + Math.sin(a) * ZONE_RADIUS * 0.4);
      });
    }

    update(): void {
      this.step(deltaTime);
      this.hudClock += deltaTime;
      if (this.hudClock < 90) return;
      this.hudClock = 0;
      const schedule = scheduleAt(this.now, this.seed);
      const player: any = (this.game as any).player;
      this.hud.render({
        score: this.score,
        holder: this.holder,
        contested: this.contested,
        secondsLeft: Math.ceil(schedule.msLeft / 1000),
        announcing: schedule.announcing,
        secondsToLimit: Math.max(0, Math.ceil((TIME_LIMIT_MS - this.now) / 1000)),
        winner: this.winner,
        playerSide: sideOf(player?.teamId) ?? 'blue',
      });
    }

    /** Core's restart/exit does not remove objects one by one: let go of the DOM here too. */
    onMatchTeardown(): void {
      this.onRemoved();
    }

    onRemoved(): void {
      this.hud.destroy();
    }

    /** One ring path per call, batched through the raw context; a marker, a few pearls. */
    private ring(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, dashes: number, spin: number): void {
      ctx.beginPath();
      for (let i = 0; i < dashes; i++) {
        const a0 = spin + (i / dashes) * Math.PI * 2;
        ctx.moveTo(at.x + Math.cos(a0) * ZONE_RADIUS, at.y + Math.sin(a0) * ZONE_RADIUS);
        ctx.arc(at.x, at.y, ZONE_RADIUS, a0, a0 + Math.PI / dashes);
      }
      ctx.stroke();
    }

    draw(): void {
      const t = this.clockMs / 1000;
      const schedule = scheduleAt(this.now, this.seed);
      const at = HILL_ISLANDS[schedule.island];
      const lead = this.holder ? courtColor(this.holder === 'blue' ? BLUE : RED) : INK.LANTERN;
      const ctx = drawingContext as CanvasRenderingContext2D;
      ctx.save();
      ctx.fillStyle = `rgba(${lead[0]},${lead[1]},${lead[2]},${this.contested ? 0.07 : 0.14})`;
      ctx.beginPath();
      ctx.arc(at.x, at.y, ZONE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${lead[0]},${lead[1]},${lead[2]},0.75)`;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      this.ring(ctx, at, 32, t * 0.25);

      if (schedule.announcing && !this.winner) {
        const next = HILL_ISLANDS[schedule.next];
        const pulse = 0.5 + 0.5 * Math.sin(t * 6);
        ctx.strokeStyle = `rgba(${INK.LANTERN[0]},${INK.LANTERN[1]},${INK.LANTERN[2]},${0.45 + 0.4 * pulse})`;
        ctx.lineWidth = 6;
        this.ring(ctx, next, 20, -t * 0.4);
        ctx.fillStyle = `rgba(${INK.LANTERN[0]},${INK.LANTERN[1]},${INK.LANTERN[2]},${0.55 + 0.3 * pulse})`;
        ctx.beginPath();
        ctx.moveTo(next.x, next.y - 150 - 8 * pulse);
        ctx.lineTo(next.x - 26, next.y - 190 - 8 * pulse);
        ctx.lineTo(next.x + 26, next.y - 190 - 8 * pulse);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = `rgba(${INK.PEARL[0]},${INK.PEARL[1]},${INK.PEARL[2]},0.95)`;
      ctx.beginPath();
      for (let i = 0; i < HILL_PEARLS.length; i++) {
        if (this.pearlReadyAt[i] > this.now) continue;
        const p = HILL_PEARLS[i];
        ctx.moveTo(p.x + 13, p.y - 10);
        ctx.arc(p.x, p.y - 10 + Math.sin(t * 3 + i) * 3, 13, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }

    getDisplayBoundingBox() {
      return this.squareDisplayBoundingBox(HILL_MAP_SIZE * 2);
    }
  }
  return HillObject;
}

let HillClass: ReturnType<typeof build> | null = null;

/** Build the hill at its slot. `pack.ts` wires this to `HILL_ROLE`. */
export function createHill(game: any, x = HILL_MAP_SIZE / 2, y = HILL_MAP_SIZE / 2) {
  if (onMap(game, HILL_MAP_ID)) ensureArt(game, HILL_MAP_ID, HILL_MAP_SIZE, hillArt);
  HillClass ??= build();
  const existing = hills.get(game);
  if (existing) return existing as InstanceType<typeof HillClass>;
  return new HillClass(game, x, y);
}

