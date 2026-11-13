import type { AttackableUnit } from '@moba2d/core/content/types';
import { api } from '../../packApi';
import { onMap } from '../onMap';
import { ensureArt } from '../../world/art/sceneryObject';
import { portalsArt } from './art';
import { MAP_SIZE, type Pt } from '../../world/layout';
import { INK, css } from '../../world/palette';
import { createArenaHud, type ArenaHud } from '../common/ui';
import { courtOf, keepWinner } from '../common/keeps';
import { KEEPS, PORTAL_RADIUS, PORTAL_SPOTS } from './layout';
import {
  PAIRING_WARN_MS,
  PortalTracker,
  msToRotation,
  pairIdOf,
  pairingIndexAt,
  partnerOf,
} from './rules';

/**
 * The portal arena: the one object in the map's neutral slot. Each tick it
 * walks the heroes through `PortalTracker`, teleports whoever finished a
 * wind-up, announces pairing changes, paints the four whirlpools, and calls
 * the match when a keep falls. Rules are in `rules.ts`.
 */
export const PORTAL_TICK_MS = 50;

export interface PortalArena {
  readonly winner: 'team-blue' | 'team-red' | null;
  readonly tracker: PortalTracker;
  step(dtMs: number): void;
}

const arenas = new WeakMap<object, PortalArena>();
export const getPortalArena = (game: unknown): PortalArena | null => arenas.get(game as object) ?? null;

const PAIR_COLORS = [INK.TIDE, INK.CORAL] as const;

function build() {
  const { Champion } = api.units;

  class Arena extends api.GameObject implements PortalArena {
    zIndex = -4;
    alwaysVisible = true;
    winner: 'team-blue' | 'team-red' | null = null;
    readonly tracker = new PortalTracker();
    private clockMs = 0;
    private acc = 0;
    private lastPairing = -1;
    private warnedFor = -1;
    private windups: { at: Pt; progress: number }[] = [];
    private hud: ArenaHud;

    constructor(game: any, x: number, y: number) {
      super({ game, position: createVector(x, y) });
      this.hud = createArenaHud(() => {
        if (typeof game.onRestartRequested === 'function') game.onRestartRequested();
        else if (typeof location !== 'undefined') location.reload();
      });
      arenas.set(game, this);
    }

    private get now(): number {
      return Number((this.game as any).matchTimeMs) || 0;
    }

    private heroes(): AttackableUnit[] {
      return (this.game as any).objectManager
        .queryObjects({
          area: new api.utils.Quadtree.Circle({ x: MAP_SIZE / 2, y: MAP_SIZE / 2, r: MAP_SIZE }),
          filters: [api.combat.PredefinedFilters.canTakeDamage],
        })
        .filter((unit: unknown) => unit instanceof Champion);
    }

    private pulse(at: Pt, owner: AttackableUnit, color: readonly number[]): void {
      const ring = new api.AoePulse(owner);
      ring.position = createVector(at.x, at.y);
      ring.radius = 120;
      ring.lifeTime = 500;
      ring.color = [color[0], color[1], color[2]];
      (this.game as any).objectManager.addObject(ring);
    }

    step(dtMs: number): void {
      this.clockMs += dtMs;
      if (this.winner) return;
      const now = this.now;
      const pairing = pairingIndexAt(now);
      if (pairing !== this.lastPairing) {
        if (this.lastPairing !== -1) this.hud.say('Cổng đã đổi cặp!', 3200);
        this.lastPairing = pairing;
      } else if (msToRotation(now) <= PAIRING_WARN_MS && this.warnedFor !== pairing) {
        this.warnedFor = pairing;
        this.hud.say('Cổng sắp đổi cặp...', PAIRING_WARN_MS);
      }

      this.acc += dtMs;
      if (this.acc >= PORTAL_TICK_MS) {
        this.acc = 0;
        this.windups = [];
        for (const unit of this.heroes()) {
          const event = this.tracker.step(unit, unit.position, now);
          const progress = this.tracker.windup(unit, now);
          if (progress !== null) this.windups.push({ at: { x: unit.position.x, y: unit.position.y }, progress });
          if (event?.kind === 'teleport') {
            const from = PORTAL_SPOTS[event.from];
            const to = PORTAL_SPOTS[event.to];
            this.pulse(from, unit, INK.PEARL);
            unit.position.set(to.x, to.y);
            unit.destination?.set?.(to.x, to.y);
            this.pulse(to, unit, INK.PEARL);
          }
        }
      }

      const winner = keepWinner((this.game as any).turrets, KEEPS);
      if (winner) {
        this.winner = winner;
        const player: any = (this.game as any).player;
        const won = courtOf(player?.teamId) === winner;
        this.hud.end(won, won ? 'Đội bạn đã phá Tháp Lõi địch' : 'Tháp Lõi của bạn đã sụp');
      }
    }

    update(): void {
      this.step(deltaTime);
    }

    draw(): void {
      const ctx = drawingContext as CanvasRenderingContext2D;
      const t = this.clockMs / 1000;
      const pairing = pairingIndexAt(this.now);
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < PORTAL_SPOTS.length; i++) {
        const c = PAIR_COLORS[pairIdOf(pairing, i)] ?? INK.TIDE;
        const p = PORTAL_SPOTS[i];
        ctx.fillStyle = css(INK.ABYSS, 0.55);
        ctx.beginPath();
        ctx.arc(p.x, p.y, PORTAL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        // Three spiral arms in one path: one stroke per whirlpool.
        ctx.strokeStyle = css(c, 0.9);
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const r = PORTAL_RADIUS * (0.35 + 0.25 * k);
          const a = t * (2.2 - k * 0.5) + k * 2;
          ctx.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
          ctx.arc(p.x, p.y, r, a, a + Math.PI * 1.3);
        }
        ctx.stroke();
        // A short dash toward the partner island, so the pairing can be read.
        const q = PORTAL_SPOTS[partnerOf(pairing, i)];
        ctx.strokeStyle = css(c, 0.35);
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 14]);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + (q.x - p.x) * 0.12, p.y + (q.y - p.y) * 0.12);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Wind-up rings over whoever is charging a portal.
      ctx.strokeStyle = css(INK.LANTERN_HOT, 0.95);
      ctx.lineWidth = 5;
      for (const w of this.windups) {
        ctx.beginPath();
        ctx.arc(w.at.x, w.at.y, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * w.progress);
        ctx.stroke();
      }
      ctx.restore();
    }

    /** Core's restart/exit does not remove objects one by one: let go of the DOM here too. */
    onMatchTeardown(): void {
      this.onRemoved();
    }

    onRemoved(): void {
      this.hud.destroy();
    }

    getDisplayBoundingBox() {
      return this.squareDisplayBoundingBox(MAP_SIZE * 2);
    }
  }
  return Arena;
}

let ArenaClass: ReturnType<typeof build> | null = null;

export function createPortalArena(game: any, x = MAP_SIZE / 2, y = MAP_SIZE / 2) {
  // The slot object and `ensureOn` both come through here, so the islands are painted with the jungle on or off.
  if (onMap(game, 'portals')) ensureArt(game, 'portals', MAP_SIZE, portalsArt);
  ArenaClass ??= build();
  const existing = arenas.get(game);
  if (existing) return existing as InstanceType<typeof ArenaClass>;
  return new ArenaClass(game, x, y);
}
