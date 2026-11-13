/** Vua Đảo: who holds the ring, the rotation schedule, scoring, the win, and the object in a headless match. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApi, createGame, indexObjects, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import { BLUE, RED } from '../world/layout';
import { HILL_ISLANDS } from '../maps/hill/layout';
import { createHill, type Hill } from '../maps/hill/hill';
import {
  ROTATE_MS,
  SCORE_PER_SECOND,
  TIME_LIMIT_MS,
  WARN_MS,
  WIN_SCORE,
  ZONE_RADIUS,
  accrue,
  holderOf,
  islandOfEpoch,
  scheduleAt,
  winnerOf,
} from '../maps/hill/rules';

describe('who holds the ring', () => {
  it('needs strictly more champions than the other court', () => {
    expect(holderOf(1, 0)).toBe('blue');
    expect(holderOf(0, 2)).toBe('red');
    expect(holderOf(3, 2)).toBe('blue');
  });
  it('is contested when equal, empty included', () => {
    expect(holderOf(0, 0)).toBeNull();
    expect(holderOf(2, 2)).toBeNull();
  });
  it('scores one point a second for the holder only', () => {
    const s = accrue({ blue: 0, red: 0 }, 'blue', 2_500);
    expect(s).toEqual({ blue: 2.5 * SCORE_PER_SECOND, red: 0 });
    expect(accrue(s, null, 5_000)).toEqual(s);
  });
});

describe('the rotation schedule', () => {
  it('starts on the centre and moves every 60 s to a different island', () => {
    expect(ROTATE_MS).toBe(60_000);
    expect(WARN_MS).toBe(10_000);
    expect(scheduleAt(0).island).toBe(0);
    for (const seed of [0, 1, 7, 12345]) {
      for (let k = 0; k < 8; k++) {
        const here = islandOfEpoch(k, seed);
        const there = islandOfEpoch(k + 1, seed);
        expect(there).not.toBe(here);
        expect([0, 1, 2]).toContain(there);
      }
    }
    expect(scheduleAt(59_999).island).toBe(scheduleAt(0).island);
    expect(scheduleAt(60_000).island).toBe(islandOfEpoch(1));
  });
  it('announces the next island 10 s ahead, and that is where it goes', () => {
    expect(scheduleAt(ROTATE_MS - WARN_MS - 1).announcing).toBe(false);
    const warn = scheduleAt(ROTATE_MS - WARN_MS);
    expect(warn.announcing).toBe(true);
    expect(warn.next).toBe(scheduleAt(ROTATE_MS).island);
    expect(scheduleAt(ROTATE_MS).announcing).toBe(false);
  });
});

describe('the win', () => {
  it('goes to the first court to reach the target', () => {
    expect(winnerOf({ blue: WIN_SCORE - 0.1, red: 40 }, 100_000)).toBeNull();
    expect(winnerOf({ blue: WIN_SCORE, red: 40 }, 100_000)).toBe('blue');
    expect(winnerOf({ blue: 3, red: WIN_SCORE }, 100_000)).toBe('red');
  });
  it('goes to the higher score at the time limit; a tie plays on', () => {
    expect(winnerOf({ blue: 30, red: 20 }, TIME_LIMIT_MS - 1)).toBeNull();
    expect(winnerOf({ blue: 30, red: 20 }, TIME_LIMIT_MS)).toBe('blue');
    expect(winnerOf({ blue: 20, red: 31 }, TIME_LIMIT_MS)).toBe('red');
    expect(winnerOf({ blue: 25, red: 25 }, TIME_LIMIT_MS)).toBeNull();
  });
});

describe('the hill in a headless match', () => {
  const { Champion } = buildTestApi().units;
  let game: TestGame;
  let hill: Hill;
  const hero = (teamId: string, at: { x: number; y: number }) => {
    const unit = new Champion({ game, teamId }) as any;
    unit.position.set(at.x, at.y);
    unit.destination.set(at.x, at.y);
    unit.stats.health.baseValue = 100;
    unit.stats.maxHealth.baseValue = 100;
    return unit;
  };
  const run = (ms: number, units: unknown[]) => {
    for (let t = 0; t < ms; t += 50) {
      indexObjects(game, units as never[]);
      (game as any).matchTimeMs += 50;
      hill.step(50);
    }
  };
  const centre = HILL_ISLANDS[0];

  beforeEach(() => {
    stubGameGlobals();
    vi.stubGlobal('deltaTime', 16);
    game = createGame(2_400);
    (game as any).matchTimeMs = 0;
    (game as any).turrets = [];
    const watcher = new Champion({ game, teamId: BLUE }) as any;
    watcher.position.set(-5_000, -5_000);
    game.setPlayer(watcher);
    hill = createHill(game) as unknown as Hill;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scores a lone champion inside the ring, about 1/s', () => {
    run(10_000, [hero(BLUE, centre)]);
    expect(hill.score.blue).toBeCloseTo(10, 0);
    expect(hill.score.red).toBe(0);
  });
  it('scores nobody when both courts are in it equally, or when it is empty', () => {
    run(5_000, [hero(BLUE, centre), hero(RED, { x: centre.x + 50, y: centre.y })]);
    run(5_000, []);
    expect(hill.score).toEqual({ blue: 0, red: 0 });
  });
  it('ignores a champion just outside the ring', () => {
    run(5_000, [hero(RED, { x: centre.x + ZONE_RADIUS + 40, y: centre.y })]);
    expect(hill.score.red).toBe(0);
  });
  it('follows the ring when it moves', () => {
    const rider = hero(BLUE, centre);
    run(ROTATE_MS - 1_000, [rider]);
    const before = hill.score.blue;
    run(3_000, [rider]); // ring has left the centre; the rider stays
    expect(hill.score.blue).toBeCloseTo(before + 1, 0);
    expect(hill.zone()).toEqual(HILL_ISLANDS[islandOfEpoch(1)]);
  });
  it('calls the match at the target score and then stops scoring', () => {
    const rider = hero(RED, centre);
    for (let i = 0; i < WIN_SCORE + 1 && !hill.winner; i++) {
      rider.position.set(hill.zone().x, hill.zone().y); // ride the ring wherever it goes
      run(1_000, [rider]);
    }
    expect(hill.winner).toBe('red');
    const frozen = hill.score.red;
    run(2_000, [rider]);
    expect(hill.score.red).toBe(frozen);
  });
});
