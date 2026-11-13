/**
 * Cầu Sập's picture and shape: the art is the geometry, the canyon is walled
 * edge to edge against the (rectangular) spans, the map is walkable and
 * point-symmetric, and the three bridges are three different things which look
 * different open, about to go and gone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import { geometry } from '../../maps/bridge/geometry';
import { bridgeArt } from '../../maps/bridge/art';
import { drawBridge } from '../../maps/bridge/bridgeArt';
import { createBridgeArena } from '../../maps/bridge/arena';
import { bridgeMap } from '../../maps/bridge';
import {
  BRIDGE_KINDS,
  BRIDGE_Y,
  CHANNEL_X0,
  CHANNEL_X1,
  HOMES,
  KEEPS,
  WARDENS,
  bridgeSpan,
} from '../../maps/bridge/layout';
import { hasArt } from '../../world/art/sceneryObject';
import { wallsOf } from '../../world/art/reef';
import { convexOverlap, distToPoly, isConvex, mirror } from '../../world/art/shapes';
import { BLUE, MAP_SIZE, RED, type Pt } from '../../world/layout';

const key = (poly: Pt[]) =>
  poly
    .map(p => `${p.x},${p.y}`)
    .sort()
    .join(' ');
const walls = geometry.terrain.wall;

describe('the art follows the polygons', () => {
  it('paints as wall exactly the polygons that are walls, and as kelp exactly the bush', () => {
    expect(wallsOf(bridgeArt()).map(key).sort()).toEqual(walls.map(key).sort());
    expect(bridgeArt().kelp.map(key).sort()).toEqual(geometry.terrain.bush.map(key).sort());
  });
  it('declares that it paints its own terrain', () => {
    expect(bridgeMap.paintsOwnTerrain).toBe(true);
    expect(bridgeArt().size).toBe(bridgeMap.size);
  });
  it('has no floor patch that is a wall', () => {
    const w = new Set(walls.map(key));
    for (const patch of bridgeArt().floor ?? []) expect(w.has(key(patch.points))).toBe(false);
  });
});

describe('the canyon', () => {
  it('is convex pieces only, and not boxes: the shore and cliff are lumps', () => {
    expect([...walls, ...geometry.terrain.bush].filter(p => !isConvex(p))).toEqual([]);
    const rects = walls.filter(p => p.length === 4 && new Set(p.map(q => q.x)).size === 2 && new Set(p.map(q => q.y)).size === 2);
    expect(rects.length).toBeLessThanOrEqual(6); // the two seas and the four stretches of canyon water
    expect(walls.length - rects.length).toBeGreaterThan(40);
  });

  it('is point-symmetric, so neither court has the better bank', () => {
    const set = new Set(walls.map(key));
    for (const w of walls) expect(set.has(key(mirror(MAP_SIZE, w)))).toBe(true);
    const kelp = new Set(geometry.terrain.bush.map(key));
    for (const k of geometry.terrain.bush) expect(kelp.has(key(mirror(MAP_SIZE, k)))).toBe(true);
  });

  it('is walled right up to every span, and leaves each span itself open ground', () => {
    BRIDGE_Y.forEach((_, i) => {
      const s = bridgeSpan(i);
      const inside = { x: (s.x0 + s.x1) / 2, y: (s.y0 + s.y1) / 2 };
      // Nothing solid on the span, whatever its material.
      for (const w of walls) expect(convexOverlap(w, [{ x: s.x0 + 1, y: s.y0 + 1 }, { x: s.x1 - 1, y: s.y0 + 1 }, { x: s.x1 - 1, y: s.y1 - 1 }, { x: s.x0 + 1, y: s.y1 - 1 }])).toBe(false);
      expect(Math.min(...walls.map(w => distToPoly(w, inside.x, inside.y)))).toBeGreaterThan(100);
      // Water (wall) fills the canyon on both sides of it along its whole width: no way round.
      for (const y of [s.y0 - 6, s.y1 + 6]) {
        for (let x = CHANNEL_X0 + 4; x < CHANNEL_X1; x += 20) expect(walls.some(w => distToPoly(w, x, y) === 0)).toBe(true);
      }
    });
  });

  it('can be walked dock to dock over each bridge in turn, with room for a 28 px body', () => {
    const GRID = 25;
    const N = MAP_SIZE / GRID;
    const CLEAR = 28;
    const boxes = walls.map(poly => ({
      poly,
      x0: Math.min(...poly.map(p => p.x)) - CLEAR,
      x1: Math.max(...poly.map(p => p.x)) + CLEAR,
      y0: Math.min(...poly.map(p => p.y)) - CLEAR,
      y1: Math.max(...poly.map(p => p.y)) + CLEAR,
    }));
    const solid = (x: number, y: number) => boxes.some(b => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && distToPoly(b.poly, x, y) < CLEAR);
    // Close two spans (as walls) and see that the third alone still joins the docks.
    BRIDGE_Y.forEach((_, open) => {
      const shut = BRIDGE_Y.map((_y, i) => bridgeSpan(i)).filter((_s, i) => i !== open);
      const blocked = (x: number, y: number) => solid(x, y) || shut.some(s => x > s.x0 - CLEAR && x < s.x1 + CLEAR && y > s.y0 - CLEAR && y < s.y1 + CLEAR && x > s.x0 && x < s.x1);
      const seen = new Set<number>();
      const stack = [[Math.floor(HOMES[BLUE].x / GRID), Math.floor(HOMES[BLUE].y / GRID)]];
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        if (cx < 0 || cy < 0 || cx >= N || cy >= N || seen.has(cy * N + cx)) continue;
        if (blocked(cx * GRID + GRID / 2, cy * GRID + GRID / 2)) continue;
        seen.add(cy * N + cx);
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      const reached = (p: Pt) => seen.has(Math.floor(p.y / GRID) * N + Math.floor(p.x / GRID));
      expect(reached(HOMES[RED])).toBe(true);
      expect(reached(WARDENS[BLUE])).toBe(true);
      expect(reached(KEEPS[RED])).toBe(true);
    });
  });
});

describe('three bridges, three materials', () => {
  it('names a different kind for each', () => {
    expect([...new Set(BRIDGE_KINDS)].sort()).toEqual(['bone', 'coral', 'rope']);
  });

  /** A recording 2D context: every call by name, and the calls' first numbers for a fingerprint. */
  const record = () => {
    const log: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, prop: string) => (prop in t ? t[prop] : (..._a: unknown[]) => void log.push(prop)),
      set: (t, prop: string, v) => {
        t[prop] = v;
        if (prop === 'fillStyle' || prop === 'strokeStyle') log.push(`${prop}=${String(v)}`);
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, log };
  };
  const paint = (i: number, state: 'open' | 'warning' | 'collapsed') => {
    const { ctx, log } = record();
    drawBridge(ctx, BRIDGE_KINDS[i], bridgeSpan(i), i, state, 3_000, 1_000);
    return log;
  };

  it('paints each kind differently', () => {
    const [a, b, c] = [0, 1, 2].map(i => paint(i, 'open').join('|'));
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('paints the gone state unlike the open one, with the hazard outline only when gone', () => {
    for (const i of [0, 1, 2]) {
      const open = paint(i, 'open');
      const gone = paint(i, 'collapsed');
      expect(gone.join('|')).not.toBe(open.join('|'));
      expect(gone).toContain('setLineDash');
      expect(open).not.toContain('setLineDash');
      // Wreckage: the gone state draws the drifting pieces (rotated rects) the open one never does.
      expect(gone.filter(c => c === 'rotate').length).toBeGreaterThanOrEqual(5);
      expect(open.filter(c => c === 'rotate').length).toBe(0);
    }
  });

  it('shows fault lines while a span is warned', () => {
    for (const i of [0, 1, 2]) {
      const open = paint(i, 'open').filter(c => c === 'lineTo').length;
      const warn = paint(i, 'warning').filter(c => c === 'lineTo').length;
      expect(warn).toBeGreaterThan(open);
    }
  });
});

describe('in a match the arena brings the painted canyon with it', () => {
  let game: TestGame;
  beforeEach(() => {
    stubGameGlobals();
    vi.stubGlobal('deltaTime', 16);
    game = createGame(MAP_SIZE);
    (game as any).turrets = [];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('makes the scenery once, whether or not the jungle slot filled it', () => {
    expect(hasArt(game, 'bridge')).toBe(false);
    createBridgeArena(game);
    expect(hasArt(game, 'bridge')).toBe(true);
    const count = () => (game as any).objectManager._objectToBeAdd.length + (game as any).objectManager.objects.length;
    const n = count();
    createBridgeArena(game);
    expect(count()).toBe(n);
  });
});
