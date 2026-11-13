import { api } from '../../packApi';
import { BLUE, RED, type Court } from '../../world/layout';
import { Banner, restartOf } from '../banner';
import { MAZE_SIZE } from './layout';
import { mazeWinner, type Standing } from './rules';

/**
 * The maze's referee: counts each court's standing structures, shows them in a
 * strip, and calls the match when one court has none left.
 */
export interface Referee {
  readonly winner: Court | null;
  step(dtMs: number): void;
}

const referees = new WeakMap<object, Referee>();
export const getReferee = (game: unknown): Referee | null => (game ? referees.get(game as object) : null) ?? null;

const NAME: Record<Court, string> = { [BLUE]: 'Triều Lam', [RED]: 'Triều Lửa' };

function build() {
  class RefereeObject extends api.GameObject implements Referee {
    zIndex = api.layers.OBJECTIVE_Z_INDEX ?? 3.5;
    alwaysVisible = true;
    winner: Court | null = null;
    private fielded: Standing | null = null;
    private banner: Banner;

    constructor(game: any, x: number, y: number) {
      super({ game, position: createVector(x, y) });
      this.banner = new Banner('tidelight-maze', restartOf(game));
      referees.set(game, this);
    }

    private count(): Standing {
      const turrets: any[] = (this.game as any).turrets ?? [];
      const left: Standing = { [BLUE]: 0, [RED]: 0 };
      for (const t of turrets) {
        if (t.isDead) continue;
        if (t.teamId === BLUE) left[BLUE] += 1;
        else if (t.teamId === RED) left[RED] += 1;
      }
      return left;
    }

    step(): void {
      if (this.winner) return;
      const left = this.count();
      // The first look is "everything standing": that is what a side fielded.
      this.fielded ??= { ...left };
      this.winner = mazeWinner(left, this.fielded);
    }

    update(): void {
      this.step();
      const left = this.count();
      this.banner.render({
        top: `Tháp còn: Lam ${left[BLUE]}  ·  Lửa ${left[RED]}`,
        center: '',
        end: this.winner ? { title: `${NAME[this.winner]} thắng trận!`, line: 'Đã phá hết công trình đối phương' } : null,
      });
    }

    /** Core's restart/exit does not remove objects one by one: let go of the DOM here too. */
    onMatchTeardown(): void {
      this.onRemoved();
    }

    onRemoved(): void {
      this.banner.destroy();
    }

    draw(): void {}

    getDisplayBoundingBox() {
      return this.squareDisplayBoundingBox(MAZE_SIZE * 2);
    }
  }
  return RefereeObject;
}

let RefereeClass: ReturnType<typeof build> | null = null;

export function createReferee(game: any, x = MAZE_SIZE / 2, y = MAZE_SIZE / 2) {
  const existing = referees.get(game);
  if (existing) return existing;
  RefereeClass ??= build();
  return new RefereeClass(game, x, y);
}
