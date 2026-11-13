import { api } from '../../packApi';
import { BLUE, RED, type Court } from '../../world/layout';
import { Banner, restartOf } from '../banner';
import { DUEL_SIZE } from './layout';
import { ROUNDS_TO_WIN, initialRounds, stepRounds, type RoundState, type Tally } from './rules';

/**
 * The Duel's round keeper. One per match; it owns the round state and the
 * banner, and brings every champion back to its fountain when a round ends.
 * No revive happens inside a round: the map's revive timer outlasts any round.
 */
export interface Duel {
  readonly state: RoundState;
  step(dtMs: number): void;
}

const duels = new WeakMap<object, Duel>();
export const getDuel = (game: unknown): Duel | null => (game ? duels.get(game as object) : null) ?? null;

const NAME: Record<Court, string> = { [BLUE]: 'Triều Lam', [RED]: 'Triều Lửa' };

export const bannerView = (s: RoundState) => ({
  top: `Hiệp ${s.round}  ·  Lam ${s.wins[BLUE]} - ${s.wins[RED]} Lửa  ·  Thắng ${ROUNDS_TO_WIN} hiệp`,
  center:
    s.phase === 'countdown'
      ? `${s.lastWinner ? `${NAME[s.lastWinner]} thắng hiệp! ` : s.round > 1 ? 'Hoà hiệp! ' : ''}${Math.ceil(s.countdownMs / 1000)}`
      : '',
  end: s.matchWinner
    ? { title: `${NAME[s.matchWinner]} thắng trận!`, line: `Tỉ số ${s.wins[BLUE]} - ${s.wins[RED]}` }
    : null,
});

function build() {
  const { Champion } = api.units;

  class DuelObject extends api.GameObject implements Duel {
    zIndex = api.layers.OBJECTIVE_Z_INDEX ?? 3.5;
    alwaysVisible = true;
    state = initialRounds();
    private banner: Banner;

    constructor(game: any, x: number, y: number) {
      super({ game, position: createVector(x, y) });
      this.banner = new Banner('tidelight-duel', restartOf(game));
      duels.set(game, this);
    }

    private champions(): any[] {
      const objects: any[] = (this.game as any).objectManager?.objects ?? [];
      return objects.filter(o => o instanceof Champion && !o.toRemove);
    }

    private tally(units: any[]): Tally {
      const t: Tally = { [BLUE]: { alive: 0, total: 0 }, [RED]: { alive: 0, total: 0 } };
      for (const u of units) {
        const side = u.teamId === BLUE ? t[BLUE] : u.teamId === RED ? t[RED] : null;
        if (!side) continue;
        side.total += 1;
        if (!u.isDead) side.alive += 1;
      }
      return t;
    }

    step(dtMs: number): void {
      const units = this.champions();
      const next = stepRounds(this.state, this.tally(units), dtMs);
      this.state = next.state;
      // Everyone, the living too: a fresh round starts from the fountain at full health.
      if (next.resetRound) for (const u of units) u.respawn();
    }

    update(): void {
      this.step(deltaTime);
      this.banner.render(bannerView(this.state));
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
      return this.squareDisplayBoundingBox(DUEL_SIZE * 2);
    }
  }
  return DuelObject;
}

let DuelClass: ReturnType<typeof build> | null = null;

export function createDuel(game: any, x = DUEL_SIZE / 2, y = DUEL_SIZE / 2) {
  const existing = duels.get(game);
  if (existing) return existing;
  DuelClass ??= build();
  return new DuelClass(game, x, y);
}
