import type { AttackableUnit } from '@moba2d/core/content/types';
import { api } from '../../packApi';
import { MAP_SIZE } from '../../world/layout';
import { ensureArt } from '../../world/art/sceneryObject';
import { courtOf, keepWinner } from '../common/keeps';
import { createArenaHud, type ArenaHud } from '../common/ui';
import { bridgeArt } from './art';
import { drawBridge } from './bridgeArt';
import { BRIDGE_KINDS, BRIDGE_NAMES, BRIDGE_Y, KEEPS, bridgeSpan } from './layout';
import { bankPushOut, bridgeStatus, type BridgeState } from './rules';

/**
 * Cầu Sập's engine half. The arena (the map's neutral-slot object) announces
 * the schedule and calls the match; each bridge is a `BridgeSpan` that
 * implements core's `DynamicWall`, so while it is collapsed
 * `wallOutlinesInArea` reports it and every ability that asks about walls
 * (hooks, knockbacks, dashes) treats the gap as the wall it is.
 */
export interface BridgeArena {
  readonly winner: 'team-blue' | 'team-red' | null;
  readonly spans: readonly { blocksMovement: boolean }[];
  step(dtMs: number): void;
}

const arenas = new WeakMap<object, BridgeArena>();
export const getBridgeArena = (game: unknown): BridgeArena | null => arenas.get(game as object) ?? null;

const matchMsOf = (game: any): number => Number(game?.matchTimeMs) || 0;

function build() {
  /** One bridge: a deck while open, a wall while collapsed. */
  class BridgeSpan extends api.GameObject {
    zIndex = -4;
    alwaysVisible = true;

    readonly index: number;

    constructor(game: any, index: number) {
      super({ game, position: createVector((bridgeSpan(index).x0 + bridgeSpan(index).x1) / 2, BRIDGE_Y[index]) });
      this.index = index;
    }

    get state(): BridgeState {
      return bridgeStatus(matchMsOf(this.game), this.index).state;
    }

    /** DynamicWall: terrain exactly while collapsed. */
    get blocksMovement(): boolean {
      return !this.toRemove && this.state === 'collapsed';
    }

    wallVertices() {
      const s = bridgeSpan(this.index);
      return [
        { x: s.x0, y: s.y0 },
        { x: s.x1, y: s.y0 },
        { x: s.x1, y: s.y1 },
        { x: s.x0, y: s.y1 },
      ];
    }

    update(): void {
      this.syncNavigation();
      if (this.blocksMovement) this.pushOut();
    }

    /**
     * Core's route grid is built once at match start, so without this a bot
     * keeps planning over a fallen bridge: shoved back to the bank, it walks
     * in again for the whole collapse. A blocker makes the gap wall to the
     * pathfinder too, and every route through it is re-planned on the spot.
     * `setBlocker` is a no-op when nothing changed, so this is free per frame.
     */
    private syncNavigation(): void {
      const navigation = (this.game as any).navigation;
      if (typeof navigation?.setBlocker !== 'function') return;
      navigation.setBlocker(`tidelight-bridge-${this.index}`, this.blocksMovement ? bridgeSpan(this.index) : null);
    }

    /** Anyone on (or dashing onto) a collapsed span goes to the nearer bank. */
    pushOut(): void {
      const s = bridgeSpan(this.index);
      const units = (this.game as any).objectManager.queryObjects({
        area: new api.utils.Quadtree.Rectangle({ x: s.x0 - 80, y: s.y0 - 80, w: s.x1 - s.x0 + 160, h: s.y1 - s.y0 + 160 }),
        filters: [api.combat.PredefinedFilters.type(api.units.AttackableUnit), api.combat.PredefinedFilters.excludeDead],
      }) as AttackableUnit[];
      for (const unit of units) {
        if (api.utils.hasFlag(unit.stats.actionState, api.enums.ActionState.IS_GHOSTED)) continue;
        const to = bankPushOut(unit.position, unit.stats.size.value / 2, this.index);
        if (!to) continue;
        unit.position.set(to.x, to.y);
        unit.destination?.set?.(to.x, to.y);
        (unit as any).onCollideWall?.();
      }
    }

    draw(): void {
      const s = bridgeSpan(this.index);
      const view = (this.game as any).camera?.getBoundingBox?.();
      if (view && (s.x1 + 80 < view.x || s.x0 - 80 > view.x + view.w || s.y1 + 80 < view.y || s.y0 - 80 > view.y + view.h)) return;
      const { state, msLeft } = bridgeStatus(matchMsOf(this.game), this.index);
      const ctx = drawingContext as CanvasRenderingContext2D;
      ctx.save();
      drawBridge(ctx, BRIDGE_KINDS[this.index], s, this.index, state, msLeft, millis());
      ctx.restore();
    }

    getDisplayBoundingBox() {
      return this.squareDisplayBoundingBox(420);
    }
  }

  class Arena extends api.GameObject implements BridgeArena {
    alwaysVisible = true;
    winner: 'team-blue' | 'team-red' | null = null;
    readonly spans: BridgeSpan[];
    private seen: BridgeState[] = ['open', 'open', 'open'];
    private hud: ArenaHud;

    constructor(game: any, x: number, y: number) {
      super({ game, position: createVector(x, y) });
      ensureArt(game, 'bridge', MAP_SIZE, bridgeArt);
      this.spans = BRIDGE_Y.map((_, i) => new BridgeSpan(game, i));
      for (const span of this.spans) game.objectManager.addObject(span);
      this.hud = createArenaHud(() => {
        if (typeof game.onRestartRequested === 'function') game.onRestartRequested();
        else if (typeof location !== 'undefined') location.reload();
      });
      arenas.set(game, this);
    }

    step(_dtMs: number): void {
      if (this.winner) return;
      for (const span of this.spans) {
        const state = span.state;
        const before = this.seen[span.index];
        if (state !== before) {
          this.seen[span.index] = state;
          const name = BRIDGE_NAMES[span.index];
          if (state === 'warning') this.hud.say(`${name} sắp sập!`, 4500);
          else if (state === 'collapsed') this.hud.say(`${name} đã sập`, 3000);
          else if (before === 'collapsed') this.hud.say(`${name} đã dựng lại`, 2500);
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

    draw(): void {}

    /** Core's restart/exit does not remove objects one by one: let go of the DOM here too. */
    onMatchTeardown(): void {
      this.onRemoved();
    }

    onRemoved(): void {
      this.hud.destroy();
      for (const span of this.spans) span.toRemove = true;
    }

    getDisplayBoundingBox() {
      return this.squareDisplayBoundingBox(MAP_SIZE * 2);
    }
  }
  return Arena;
}

let ArenaClass: ReturnType<typeof build> | null = null;

export function createBridgeArena(game: any, x = MAP_SIZE / 2, y = MAP_SIZE / 2) {
  ArenaClass ??= build();
  const existing = arenas.get(game);
  if (existing) return existing as InstanceType<typeof ArenaClass>;
  return new ArenaClass(game, x, y);
}
