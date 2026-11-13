import { api } from '../../packApi';
import { courtOf, keepWinner } from '../common/keeps';
import { createArenaHud, type ArenaHud } from '../common/ui';
import { ICE_KEEPS, ICE_SIZE } from './layout';

/**
 * Mặt Băng's referee: calls the match when a keep falls (core has no win
 * condition). The ice itself is core's (`MapSummary.ice` + the `floes` zone).
 */
export interface IceArena {
  readonly winner: 'team-blue' | 'team-red' | null;
  step(dtMs: number): void;
}

const arenas = new WeakMap<object, IceArena>();
export const getIceArena = (game: unknown): IceArena | null => (game ? arenas.get(game as object) : null) ?? null;

function build() {
  class Arena extends api.GameObject implements IceArena {
    alwaysVisible = true;
    winner: 'team-blue' | 'team-red' | null = null;
    private hud: ArenaHud;

    constructor(game: any, x: number, y: number) {
      super({ game, position: createVector(x, y) });
      this.hud = createArenaHud(() => {
        if (typeof game.onRestartRequested === 'function') game.onRestartRequested();
        else if (typeof location !== 'undefined') location.reload();
      });
      this.hud.say('Mặt Băng: sàn băng trôi, khó dừng lại!', 4000);
      arenas.set(game, this);
    }

    step(_dtMs: number): void {
      if (this.winner) return;
      const winner = keepWinner((this.game as any).turrets, ICE_KEEPS);
      if (winner) {
        this.winner = winner;
        const won = courtOf((this.game as any).player?.teamId) === winner;
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
    }

    getDisplayBoundingBox() {
      return this.squareDisplayBoundingBox(ICE_SIZE * 2);
    }
  }
  return Arena;
}

let ArenaClass: ReturnType<typeof build> | null = null;

export function createIceArena(game: any, x = ICE_SIZE / 2, y = ICE_SIZE / 2) {
  const existing = arenas.get(game);
  if (existing) return existing;
  ArenaClass ??= build();
  return new ArenaClass(game, x, y);
}
