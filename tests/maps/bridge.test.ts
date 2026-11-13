/**
 * Cầu Sập: the collapse schedule, the push to the bank, and that a collapsed
 * span is a wall to core's `wallOutlinesInArea`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApi, createGame, indexObjects, stubGameGlobals, validatePackData, type TestGame } from '@moba2d/core/testing';
import { mapIssues } from '@moba2d/core/testing/maps';
import { data } from '../../pack';
import { BLUE, RED } from '../../world/layout';
import { createBridgeArena } from '../../maps/bridge/arena';
import { geometry } from '../../maps/bridge/geometry';
import { BRIDGE_Y, CHANNEL_X0, CHANNEL_X1, KEEPS } from '../../maps/bridge/layout';
import {
  BANK_MARGIN,
  COLLAPSE_EVERY_MS,
  COLLAPSE_FOR_MS,
  COLLAPSE_ORDER,
  TELEGRAPH_MS,
  bankPushOut,
  bridgeStatus,
} from '../../maps/bridge/rules';

const states = (t: number) => [0, 1, 2].map(i => bridgeStatus(t, i).state);

describe('schedule', () => {
  it('collapses one bridge every 40 s for 15 s, warned 5 s ahead', () => {
    expect([COLLAPSE_EVERY_MS, COLLAPSE_FOR_MS, TELEGRAPH_MS]).toEqual([40_000, 15_000, 5_000]);
    const first = COLLAPSE_ORDER[0];
    expect(states(0)).toEqual(['open', 'open', 'open']);
    expect(bridgeStatus(34_999, first).state).toBe('open');
    expect(bridgeStatus(35_000, first)).toEqual({ state: 'warning', msLeft: 5_000 });
    expect(bridgeStatus(39_999, first).state).toBe('warning');
    expect(bridgeStatus(40_000, first)).toEqual({ state: 'collapsed', msLeft: 15_000 });
    expect(bridgeStatus(54_999, first).state).toBe('collapsed');
    expect(bridgeStatus(55_000, first).state).toBe('open');
  });

  it('never has two bridges down or warned at once, and walks the whole order', () => {
    const down = new Set<number>();
    for (let t = 0; t < 6 * COLLAPSE_EVERY_MS; t += 250) {
      const s = states(t);
      expect(s.filter(x => x !== 'open').length).toBeLessThanOrEqual(1);
      s.forEach((x, i) => x === 'collapsed' && down.add(i));
    }
    expect([...down].sort()).toEqual([0, 1, 2]);
    // The second collapse is the next one in the order.
    expect(bridgeStatus(2 * COLLAPSE_EVERY_MS + 1, COLLAPSE_ORDER[1]).state).toBe('collapsed');
  });
});

describe('push to the bank', () => {
  it('sends a unit on the span to the nearer side, clear of the channel', () => {
    const west = bankPushOut({ x: CHANNEL_X0 + 60, y: BRIDGE_Y[1] }, 25, 1)!;
    expect(west.x).toBe(CHANNEL_X0 - 25 - BANK_MARGIN);
    const east = bankPushOut({ x: CHANNEL_X1 - 60, y: BRIDGE_Y[1] }, 25, 1)!;
    expect(east.x).toBe(CHANNEL_X1 + 25 + BANK_MARGIN);
  });

  it('leaves units alone who are clear of the span', () => {
    expect(bankPushOut({ x: CHANNEL_X0 - 100, y: BRIDGE_Y[1] }, 25, 1)).toBeNull();
    expect(bankPushOut({ x: 1600, y: BRIDGE_Y[0] }, 25, 1)).toBeNull();
  });
});

describe('the arena in a match', () => {
  const api = buildTestApi();
  const { Champion } = api.units;
  let game: TestGame;
  const first = COLLAPSE_ORDER[0];
  const hero = (x: number, y: number) => {
    const unit = new Champion({ game, teamId: BLUE }) as any;
    unit.position.set(x, y);
    unit.destination.set(x, y);
    unit.stats.health.baseValue = 100;
    unit.stats.maxHealth.baseValue = 100;
    return unit;
  };
  const wallsAt = (y: number) =>
    api.terrain.wallOutlinesInArea(
      game as never,
      new api.utils.Quadtree.Circle({ x: 1600, y, r: 50 }) as never
    );

  beforeEach(() => {
    stubGameGlobals();
    vi.stubGlobal('deltaTime', 16);
    game = createGame(3_200);
    (game as any).turrets = [];
    game.setPlayer(hero(-5_000, -5_000));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a wall to wallOutlinesInArea only while collapsed', () => {
    const arena = createBridgeArena(game);
    const y = BRIDGE_Y[first];
    indexObjects(game, arena.spans as never[]);
    (game as any).matchTimeMs = 39_000; // warned, still walkable
    expect(wallsAt(y)).toHaveLength(0);
    (game as any).matchTimeMs = 41_000;
    expect(wallsAt(y)).toHaveLength(1);
    (game as any).matchTimeMs = 56_000; // rebuilt
    expect(wallsAt(y)).toHaveLength(0);
  });

  it('pushes a hero standing on the span to the bank when it collapses', () => {
    const arena = createBridgeArena(game);
    const h = hero(1_500, BRIDGE_Y[first]);
    const objects = [...arena.spans, h] as never[];
    indexObjects(game, objects);
    (game as any).matchTimeMs = 39_000;
    arena.spans.forEach(s => (s as any).update());
    expect(h.position.x).toBe(1_500); // warned: not yet
    (game as any).matchTimeMs = 40_000;
    arena.spans.forEach(s => (s as any).update());
    expect(h.position.x).toBeLessThan(CHANNEL_X0);
    expect(h.destination.x).toBe(h.position.x);
  });

  it("closes core's route grid over a bridge exactly while it is down", () => {
    const arena = createBridgeArena(game);
    const calls: [string, unknown][] = [];
    (game as any).navigation = { setBlocker: (id: string, rect: unknown) => calls.push([id, rect]) };
    const id = `tidelight-bridge-${first}`;
    const last = () => calls.filter(c => c[0] === id).at(-1)?.[1];
    (game as any).matchTimeMs = 39_000; // warned, still walkable
    arena.spans.forEach(s => (s as any).update());
    expect(last()).toBeNull();
    (game as any).matchTimeMs = 41_000;
    arena.spans.forEach(s => (s as any).update());
    expect(last()).toMatchObject({ x0: CHANNEL_X0, y0: BRIDGE_Y[first] - 110, y1: BRIDGE_Y[first] + 110 });
    (game as any).matchTimeMs = 56_000; // rebuilt
    arena.spans.forEach(s => (s as any).update());
    expect(last()).toBeNull();
  });

  it('calls the match when a keep falls', () => {
    const arena = createBridgeArena(game);
    (game as any).turrets = [{ teamId: BLUE, isDead: true, position: KEEPS[BLUE] }];
    arena.step(50);
    expect(arena.winner).toBe(RED);
  });
});

describe('the map', () => {
  it('is a pack core would install', () => {
    const checked = validatePackData(data);
    expect(checked.ok === true ? [] : checked.errors).toEqual([]);
    expect(data.maps?.map(m => m.id)).toContain('bridge');
  });

  it('has nothing the map editor’s checker would refuse', () => {
    const issues = mapIssues({
      size: 3_200,
      lanes: geometry.lanes!.map(l => ({ id: l.id, points: l.waypoints.map(({ x, y }): [number, number] => [x, y]) })),
      walls: geometry.terrain.wall.map(poly => poly.map(({ x, y }): [number, number] => [x, y])),
      turrets: geometry.slots.structure,
      spawns: geometry.slots.spawn,
      musters: geometry.slots.minion,
      neutrals: geometry.slots.neutral,
    });
    expect(issues.map(i => `${i.text} @ ${i.at.map(Math.round).join(',')}`)).toEqual([]);
  });
});
