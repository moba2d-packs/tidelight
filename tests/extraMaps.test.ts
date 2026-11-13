/**
 * The two small maps: Mê Cung Rong (maze) and Vòng Đấu Tay Đôi (duel). Geometry
 * must install and be playable; the round rules and the objects that own them
 * must do what their banners say.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApi, createGame, indexObjects, stubGameGlobals, validatePackData, type TestGame } from '@moba2d/core/testing';
import { data } from '../pack';
import { BLUE, RED } from '../world/layout';
import { geometry as mazeGeometry } from '../maps/maze/geometry';
import { LANE_Y, MAZE_BASES, MAZE_KEEPS, MAZE_KELP, MAZE_SIZE, MAZE_WARDENS, MAZE_WALLS } from '../maps/maze/layout';
import { convexOverlap, distToPoly, isConvex } from '../world/art/shapes';
import { mazeWinner } from '../maps/maze/rules';
import { createReferee } from '../maps/maze/object';
import { geometry as duelGeometry } from '../maps/duel/map';
import { map as duelMap, NO_REVIVE_MS } from '../maps/duel/map';
import { DUEL_SIZE, DUEL_SPAWNS } from '../maps/duel/layout';
import { COUNTDOWN_MS, ROUNDS_TO_WIN, initialRounds, stepRounds, type RoundState, type Tally } from '../maps/duel/rules';
import { bannerView, createDuel } from '../maps/duel/object';
import { ensureMapObject } from '../maps';

const withGeometry = (id: string, geometry: unknown) => ({
  ...data,
  maps: (data.maps ?? []).map(m => (m.id === id ? { ...m, geometry } : m)),
});

describe('both maps are registered and install', () => {
  it('lists maze and duel beside the reef', () => {
    const ids = (data.maps ?? []).map(m => m.id);
    expect(ids[0]).toBe('driftglass');
    expect(ids).toEqual(expect.arrayContaining(['maze', 'duel']));
    expect(new Set(ids).size, 'two maps share an id').toBe(ids.length);
  });

  it.each([
    ['maze', mazeGeometry],
    ['duel', duelGeometry],
  ])('%s: resolved geometry passes core validation', (id, geometry) => {
    const checked = validatePackData(withGeometry(id, geometry));
    expect(checked.ok === true ? [] : checked.errors).toEqual([]);
  });

  it('an invalid slot is actually caught (the check is not vacuous)', () => {
    const bad = { ...mazeGeometry, slots: { ...mazeGeometry.slots, structure: [{ faction: 'nobody', kind: 'turret', x: 1, y: 1 }] } };
    const checked = validatePackData(withGeometry('maze', bad));
    expect(checked.ok).toBe(false);
  });
});

describe('maze layout', () => {
  const GRID = 25;
  const CLEAR = 28; // a hero's body
  const N = MAZE_SIZE / GRID;
  const boxes = MAZE_WALLS.map(poly => ({
    poly,
    x0: Math.min(...poly.map(p => p.x)) - CLEAR,
    x1: Math.max(...poly.map(p => p.x)) + CLEAR,
    y0: Math.min(...poly.map(p => p.y)) - CLEAR,
    y1: Math.max(...poly.map(p => p.y)) + CLEAR,
  }));
  const blocked = (x: number, y: number) =>
    boxes.some(b => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && distToPoly(b.poly, x, y) < CLEAR);
  const flood = (from: { x: number; y: number }) => {
    const seen = new Set<number>();
    const stack = [[Math.floor(from.x / GRID), Math.floor(from.y / GRID)]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cy < 0 || cx >= N || cy >= N || seen.has(cy * N + cx)) continue;
      if (blocked(cx * GRID + GRID / 2, cy * GRID + GRID / 2)) continue;
      seen.add(cy * N + cx);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    return (p: { x: number; y: number }) => seen.has(Math.floor(p.y / GRID) * N + Math.floor(p.x / GRID));
  };

  it('is point-symmetric, so neither court has the better maze', () => {
    const key = (poly: { x: number; y: number }[]) =>
      poly
        .map(p => `${p.x},${p.y}`)
        .sort()
        .join(' ');
    const walls = new Set(MAZE_WALLS.map(key));
    for (const poly of MAZE_WALLS) {
      expect(walls.has(key(poly.map(p => ({ x: MAZE_SIZE - p.x, y: MAZE_SIZE - p.y }))))).toBe(true);
    }
  });

  it('is built of convex pieces only: core collides convex polygons', () => {
    const bad = MAZE_WALLS.filter(poly => !isConvex(poly));
    expect(bad).toEqual([]);
    const lumpy = MAZE_KELP.filter(poly => !isConvex(poly));
    expect(lumpy).toEqual([]);
  });

  it('is not boxes: most of the wall pieces are not axis-aligned rectangles', () => {
    const rects = MAZE_WALLS.filter(poly => poly.length === 4 && new Set(poly.map(p => p.x)).size === 2 && new Set(poly.map(p => p.y)).size === 2);
    expect(rects).toHaveLength(4); // only the sea frame
    expect(MAZE_WALLS.length).toBeGreaterThan(200);
  });

  it('lets a hero walk from dock to dock, along the lane, with room for a body', () => {
    const reach = flood(MAZE_BASES[BLUE]);
    expect(reach(MAZE_BASES[RED])).toBe(true);
    for (let x = MAZE_BASES[BLUE].x; x <= MAZE_BASES[RED].x; x += GRID) expect(reach({ x, y: LANE_Y })).toBe(true);
  });

  it('keeps every kelp bed reachable and clear of walls', () => {
    const reach = flood(MAZE_BASES[BLUE]);
    for (const k of MAZE_KELP) {
      const cx = k.reduce((a, p) => a + p.x, 0) / k.length;
      const cy = k.reduce((a, p) => a + p.y, 0) / k.length;
      expect(reach({ x: cx, y: cy })).toBe(true);
      for (const w of MAZE_WALLS) expect(convexOverlap(k, w)).toBe(false);
    }
    expect(MAZE_KELP.length).toBeGreaterThanOrEqual(10);
  });

  /**
   * Reported: "đường hơi hẹp … đường chính giữa còn bị trụ che mất, tướng to
   * tý là bị kẹt". The warden stood in a 200px corridor, leaving a 46px
   * half-width beside it, and the hull's mouth was 43px; core lets a body be
   * up to 40px for terrain (`NAV_MAX_TERRAIN_RADIUS`). This floods with the
   * turrets as solid discs and a body of that cap plus a margin.
   */
  it('lets the biggest hero round the warden, into the galleon and into every kelp bed', () => {
    const BIG = 52; // core's 40px terrain cap + room to be shoved
    const turrets = [
      ...Object.values(MAZE_WARDENS).map(p => ({ ...p, r: 46 })),
      ...Object.values(MAZE_KEEPS).map(p => ({ ...p, r: 60 })),
    ];
    const wallBoxes = MAZE_WALLS.map(poly => ({
      poly,
      x0: Math.min(...poly.map(p => p.x)) - BIG,
      x1: Math.max(...poly.map(p => p.x)) + BIG,
      y0: Math.min(...poly.map(p => p.y)) - BIG,
      y1: Math.max(...poly.map(p => p.y)) + BIG,
    }));
    const G = 10;
    const n = MAZE_SIZE / G;
    const solid = (x: number, y: number) =>
      turrets.some(t => Math.hypot(x - t.x, y - t.y) < t.r + BIG) ||
      wallBoxes.some(b => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && distToPoly(b.poly, x, y) < BIG);
    const seen = new Uint8Array(n * n);
    const stack = [[Math.floor(MAZE_BASES[BLUE].x / G), Math.floor(MAZE_BASES[BLUE].y / G)]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cy < 0 || cx >= n || cy >= n || seen[cy * n + cx]) continue;
      if (solid(cx * G + G / 2, cy * G + G / 2)) continue;
      seen[cy * n + cx] = 1;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    const reach = (p: { x: number; y: number }) => seen[Math.floor(p.y / G) * n + Math.floor(p.x / G)] === 1;
    expect(reach(MAZE_BASES[RED])).toBe(true);
    expect(reach({ x: MAZE_SIZE / 2, y: LANE_Y })).toBe(true);
    const missed = MAZE_KELP.map(k => ({
      x: Math.round(k.reduce((a, p) => a + p.x, 0) / k.length),
      y: Math.round(k.reduce((a, p) => a + p.y, 0) / k.length),
    })).filter(c => !reach(c));
    expect(missed).toEqual([]);
  });

  it('puts the galleon on the lane: the lane runs through its hull, not around it', () => {
    // A hero standing anywhere along the hull's length on the lane is reachable (above) and
    // there are wall pieces both north and south of the lane at the hull's middle.
    const mid = MAZE_SIZE / 2;
    const above = MAZE_WALLS.filter(poly => poly.some(p => Math.abs(p.x - mid) < 40 && p.y < LANE_Y - 60 && p.y > LANE_Y - 260));
    const below = MAZE_WALLS.filter(poly => poly.some(p => Math.abs(p.x - mid) < 40 && p.y > LANE_Y + 60 && p.y < LANE_Y + 260));
    expect(above.length).toBeGreaterThan(0);
    expect(below.length).toBeGreaterThan(0);
  });

  it('has one lane, one warden and one keep per side', () => {
    expect(mazeGeometry.lanes).toHaveLength(1);
    for (const faction of ['tide', 'ember']) {
      const mine = mazeGeometry.slots.structure.filter(s => s.faction === faction);
      expect(mine).toHaveLength(2);
      expect(mine.filter(s => s.stats && 'attackRange' in s.stats && s.stats.size === 120)).toHaveLength(1);
    }
    expect(MAZE_WARDENS[BLUE].x).toBeLessThan(MAZE_BASES[RED].x);
  });
});

describe('maze win condition', () => {
  const full = { [BLUE]: 2, [RED]: 2 };
  it('nobody wins while both courts have structures', () => {
    expect(mazeWinner(full, full)).toBeNull();
    expect(mazeWinner({ [BLUE]: 1, [RED]: 0 + 1 }, full)).toBeNull();
  });
  it('the court that loses its last structure loses', () => {
    expect(mazeWinner({ [BLUE]: 2, [RED]: 0 }, full)).toBe(BLUE);
    expect(mazeWinner({ [BLUE]: 0, [RED]: 1 }, full)).toBe(RED);
  });
  it('a court that never had structures cannot lose by having none', () => {
    expect(mazeWinner({ [BLUE]: 0, [RED]: 0 }, { [BLUE]: 0, [RED]: 0 })).toBeNull();
  });
});

const T = (ba: number, bt: number, ra: number, rt: number): Tally => ({
  [BLUE]: { alive: ba, total: bt },
  [RED]: { alive: ra, total: rt },
});
const fighting = (over: Partial<RoundState> = {}): RoundState => ({ ...initialRounds(), phase: 'fight', countdownMs: 0, ...over });

describe('duel round rules', () => {
  it('opens with a 2 s countdown, then fights', () => {
    let s = initialRounds();
    expect(s.countdownMs).toBe(COUNTDOWN_MS);
    s = stepRounds(s, T(2, 2, 2, 2), COUNTDOWN_MS - 1).state;
    expect(s.phase).toBe('countdown');
    s = stepRounds(s, T(2, 2, 2, 2), 1).state;
    expect(s.phase).toBe('fight');
  });

  it('a round goes on while both courts have someone standing', () => {
    const step = stepRounds(fighting(), T(1, 2, 1, 2), 16);
    expect(step.state.phase).toBe('fight');
    expect(step.resetRound).toBe(false);
  });

  it('the last court standing takes the round and everyone is reset for the next', () => {
    const step = stepRounds(fighting(), T(0, 2, 1, 2), 16);
    expect(step.state.wins).toEqual({ [BLUE]: 0, [RED]: 1 });
    expect(step.state.phase).toBe('countdown');
    expect(step.state.round).toBe(2);
    expect(step.state.lastWinner).toBe(RED);
    expect(step.resetRound).toBe(true);
  });

  it('a mutual wipe scores nobody', () => {
    const step = stepRounds(fighting(), T(0, 2, 0, 2), 16);
    expect(step.state.wins).toEqual({ [BLUE]: 0, [RED]: 0 });
    expect(step.state.lastWinner).toBeNull();
    expect(step.resetRound).toBe(true);
  });

  it('first to three rounds wins the match, and then it stays over', () => {
    const near = fighting({ wins: { [BLUE]: ROUNDS_TO_WIN - 1, [RED]: 2 }, round: 5 });
    const done = stepRounds(near, T(1, 1, 0, 1), 16);
    expect(done.state.phase).toBe('over');
    expect(done.state.matchWinner).toBe(BLUE);
    expect(done.resetRound).toBe(false);
    expect(stepRounds(done.state, T(0, 1, 1, 1), 16).state).toBe(done.state);
  });

  it('an empty side is not a win for the other', () => {
    expect(stepRounds(fighting(), T(0, 0, 1, 1), 16).state.phase).toBe('fight');
  });

  it('banner speaks Vietnamese and shows the countdown', () => {
    expect(bannerView(initialRounds()).center).toBe('2');
    expect(bannerView({ ...fighting(), phase: 'over', wins: { [BLUE]: 3, [RED]: 1 }, matchWinner: BLUE }).end?.title).toBe('Triều Lam thắng trận!');
  });
});

describe('duel map data', () => {
  it('never revives a hero inside a round', () => {
    const curve = duelMap.tuning?.champions?.reviveCurve;
    expect(curve?.base).toBe(NO_REVIVE_MS);
    expect(curve?.max).toBe(NO_REVIVE_MS);
    expect(NO_REVIVE_MS).toBeGreaterThan(10 * 60_000);
  });
  it('has no lanes, minions or structures: it is an arena', () => {
    expect(duelGeometry.slots.minion).toEqual([]);
    expect(duelGeometry.slots.structure).toEqual([]);
    expect(duelGeometry.lanes).toBeUndefined();
    expect(DUEL_SPAWNS.red.x + DUEL_SPAWNS.blue.x).toBe(DUEL_SIZE);
  });
});

describe('the objects in a real (headless) match', () => {
  const { Champion } = buildTestApi().units;
  let game: TestGame;
  const unit = (teamId: string) => {
    const u = new Champion({ game, teamId }) as any;
    u.stats.maxHealth.baseValue = 100;
    u.stats.health.baseValue = 100;
    return u;
  };

  beforeEach(() => {
    stubGameGlobals();
    vi.stubGlobal('deltaTime', 16);
    game = createGame(1_600);
    (game as any).turrets = [];
    (game as any).randomSpawnPoint = () => ({ x: 7, y: 8 });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('duel: a dead hero stays dead through the round; the next round brings all back', () => {
    const duel = createDuel(game) as any;
    const a = unit(BLUE);
    const b = unit(RED);
    game.setPlayer(a);
    indexObjects(game, [a, b] as never[]);
    duel.step(COUNTDOWN_MS + 1);
    expect(duel.state.phase).toBe('fight');

    a.die({ attacker: b, reviveAfter: NO_REVIVE_MS });
    duel.step(16);
    expect(duel.state.wins[RED]).toBe(1);
    expect(duel.state.phase).toBe('countdown');
    expect(a.isDead).toBe(false);
    expect(a.stats.health.value).toBe(100);
    expect(a.position.x).toBe(7);
  });

  it('duel: ensureMapObject builds the keeper on the duel map only', () => {
    expect(ensureMapObject(game)).toBe(false);
    (game as any).activeMapId = 'duel';
    expect(ensureMapObject(game)).toBe(true);
  });

  it('maze: calls the match when a court has no structure left', () => {
    const ref = createReferee(game) as any;
    const mk = (teamId: string, dead = false) => ({ teamId, isDead: dead });
    const towers = [mk(BLUE), mk(BLUE), mk(RED), mk(RED)];
    (game as any).turrets = towers;
    ref.step();
    expect(ref.winner).toBeNull();
    towers[2].isDead = true;
    ref.step();
    expect(ref.winner).toBeNull();
    towers[3].isDead = true;
    ref.step();
    expect(ref.winner).toBe(BLUE);
  });
});
