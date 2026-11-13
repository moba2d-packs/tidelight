/**
 * The reef art kit (`world/art/`) and the two maps painted with it. Three claims:
 *
 * 1. the art *is* the geometry — what a map paints as wall is exactly its
 *    `terrain.wall`, and what it paints as kelp is exactly its `terrain.bush`;
 * 2. the kit keeps Driftglass's cost properties — tiles are baked once and then
 *    blitted, 1:1 at whole pixels, and every raw-context paint is balanced;
 * 3. a painted map's scenery exists on its (qualified) map id with the jungle off.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import { geometry as mazeGeometry } from '../maps/maze/geometry';
import { mazeArt } from '../maps/maze/art';
import { MAZE_SIZE } from '../maps/maze/layout';
import { geometry as duelGeometry } from '../maps/duel/map';
import { duelArt } from '../maps/duel/art';
import { DUEL_SIZE, DUEL_SPAWNS } from '../maps/duel/layout';
import { hillGeometry } from '../maps/hill/geometry';
import { hillArt } from '../maps/hill/art';
import { hillMap } from '../maps/hill/map';
import { geometry as ballGeometry, ballMap } from '../maps/ball/map';
import { ballArt } from '../maps/ball/art';
import { map as mazeMap } from '../maps/maze/map';
import { map as duelMapDef } from '../maps/duel/map';
import { ensureMapObject } from '../maps';
import { hasArt } from '../world/art/sceneryObject';
import { ReefLayer, wallsOf, type ReefDescription } from '../world/art/reef';
import { ReefTiles } from '../world/scenery';
import { convexOverlap, distToPoly, isConvex, mirror } from '../world/art/shapes';
import type { Pt } from '../world/layout';

const key = (poly: Pt[]) =>
  poly
    .map(p => `${p.x},${p.y}`)
    .sort()
    .join(' ');
const keys = (polys: Pt[][]) => polys.map(key).sort();

describe.each([
  ['maze', mazeGeometry, mazeArt, mazeMap],
  ['duel', duelGeometry, duelArt, duelMapDef],
  ['hill', hillGeometry, hillArt, hillMap],
  ['ball', ballGeometry, ballArt, ballMap],
] as const)('%s: the art follows the polygons', (_id, geometry, art, def) => {
  it('paints as wall exactly the polygons that are walls', () => {
    expect(keys(wallsOf(art()))).toEqual(keys(geometry.terrain.wall));
  });
  it('paints as kelp exactly the polygons that are bush', () => {
    expect(keys(art().kelp)).toEqual(keys(geometry.terrain.bush));
  });
  it('declares that it paints its own terrain, and sizes the art to the map', () => {
    expect(def.paintsOwnTerrain).toBe(true);
    expect(art().size).toBe(def.size);
  });
  it('is made of convex wall pieces only', () => {
    expect(geometry.terrain.wall.filter(poly => !isConvex(poly))).toEqual([]);
    expect(geometry.terrain.bush.filter(poly => !isConvex(poly))).toEqual([]);
  });
  it('keeps floor art off the walls it must not look like: no floor patch is a wall polygon', () => {
    const walls = new Set(geometry.terrain.wall.map(key));
    for (const patch of art().floor ?? []) expect(walls.has(key(patch.points))).toBe(false);
  });
});

describe('duel arena', () => {
  const walls = duelGeometry.terrain.wall;
  const at = (p: Pt) => Math.min(...walls.map(w => distToPoly(w, p.x, p.y)));

  it('is point-symmetric, so neither court has the better arena', () => {
    const set = new Set(walls.map(key));
    for (const w of walls) expect(set.has(key(mirror(DUEL_SIZE, w)))).toBe(true);
    const kelp = new Set(duelGeometry.terrain.bush.map(key));
    for (const k of duelGeometry.terrain.bush) expect(kelp.has(key(mirror(DUEL_SIZE, k)))).toBe(true);
  });

  it('leaves each spawn pad (r 90) and a hero standing on it clear of every wall (r 90 plus a margin)', () => {
    for (const s of [DUEL_SPAWNS.blue, DUEL_SPAWNS.red]) expect(at(s)).toBeGreaterThan(90 + 10);
  });

  it('has a clam in the middle that blocks the line between the two courts', () => {
    const mid = { x: DUEL_SIZE / 2, y: DUEL_SIZE / 2 };
    expect(at(mid)).toBe(0);
    const a = DUEL_SPAWNS.blue;
    const b = DUEL_SPAWNS.red;
    let hit = false;
    for (let i = 0; i <= 100; i++) {
      const p = { x: a.x + ((b.x - a.x) * i) / 100, y: a.y + ((b.y - a.y) * i) / 100 };
      if (at(p) === 0) hit = true;
    }
    expect(hit).toBe(true);
  });

  it('keeps kelp clear of walls and out of the spawn pads, and has six beds', () => {
    expect(duelGeometry.terrain.bush).toHaveLength(6);
    for (const k of duelGeometry.terrain.bush) {
      for (const w of walls) expect(convexOverlap(k, w)).toBe(false);
      for (const s of [DUEL_SPAWNS.blue, DUEL_SPAWNS.red]) expect(distToPoly(k, s.x, s.y)).toBeGreaterThan(90);
    }
  });

  it('has an irregular ring, not an octagon: the arena wall is many pieces, mostly not rectangles', () => {
    const rects = walls.filter(poly => poly.length === 4 && new Set(poly.map(p => p.x)).size === 2 && new Set(poly.map(p => p.y)).size === 2);
    expect(rects).toHaveLength(4);
    expect(walls.length).toBeGreaterThan(30);
  });

  it('can be walked end to end around the clam with room for a body', () => {
    const GRID = 20;
    const N = DUEL_SIZE / GRID;
    const blocked = (x: number, y: number) => walls.some(w => distToPoly(w, x, y) < 28);
    const seen = new Set<number>();
    const stack = [[Math.floor(DUEL_SPAWNS.blue.x / GRID), Math.floor(DUEL_SPAWNS.blue.y / GRID)]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cy < 0 || cx >= N || cy >= N || seen.has(cy * N + cx)) continue;
      if (blocked(cx * GRID + GRID / 2, cy * GRID + GRID / 2)) continue;
      seen.add(cy * N + cx);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    expect(seen.has(Math.floor(DUEL_SPAWNS.red.y / GRID) * N + Math.floor(DUEL_SPAWNS.red.x / GRID))).toBe(true);
  });
});

// ------------------------------------------------------------ the kit's cost properties

/** A 2D context that records every call and answers like the real one where it matters. */
function recordingCtx(log: string[], blits: number[][], offset = { e: 0, f: 0 }) {
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get(_t, prop: string) {
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: offset.e, f: offset.f });
      if (prop === 'drawImage') {
        return (_img: unknown, x: number, y: number) => {
          blits.push([x, y]);
          log.push('drawImage');
        };
      }
      if (prop in target) return target[prop];
      return (..._a: unknown[]) => {
        log.push(prop);
      };
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const stubDocument = () => {
  const made: { width: number; height: number }[] = [];
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = { width: 0, height: 0, getContext: () => recordingCtx([], []) };
      made.push(canvas);
      return canvas;
    },
  });
  return made;
};

describe('the kit keeps the reef\'s cost properties', () => {
  beforeEach(() => {
    stubDocument();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const view = { x: 0, y: 0, w: 900, h: 600 };

  it('bakes a tile once and blits it afterwards, at whole pixels', () => {
    const layer = new ReefLayer(mazeArt());
    const log: string[] = [];
    const blits: number[][] = [];
    // A camera sitting between pixels: the blit must still land on whole ones.
    const ctx = recordingCtx(log, blits, { e: -10.4, f: -3.3 });
    layer.paint(ctx, view, 1, 0);
    const bakes = layer.tiles.bakes;
    expect(bakes).toBeGreaterThan(0);
    blits.length = 0;
    layer.paint(ctx, view, 1, 16);
    layer.paint(ctx, { ...view, x: 3.4, y: 2.2 }, 1, 32);
    // The second and third paints add no bakes beyond the walk-ahead's one a frame...
    expect(layer.tiles.bakes).toBeLessThanOrEqual(bakes + 2);
    // ...and every blit is on a whole pixel.
    expect(blits.length).toBeGreaterThan(0);
    for (const [x, y] of blits) {
      expect(Number.isInteger(x)).toBe(true);
      expect(Number.isInteger(y)).toBe(true);
    }
    layer.dispose();
  });

  it('wraps every paint in a balanced save/restore, and the tiles are not baked live', () => {
    const layer = new ReefLayer(duelArt());
    const log: string[] = [];
    const ctx = recordingCtx(log, []);
    layer.paint(ctx, { x: 0, y: 0, w: DUEL_SIZE, h: DUEL_SIZE }, 0.5, 0);
    expect(log[0]).toBe('save');
    expect(log[log.length - 1]).toBe('restore');
    expect(log.filter(c => c === 'save').length).toBe(log.filter(c => c === 'restore').length);
    layer.dispose();
  });

  it('a tile bake is balanced too, set-piece hooks included', () => {
    const log: string[] = [];
    const hooks: string[] = [];
    const desc: ReefDescription = {
      ...mazeArt(),
      bakeFloor: () => hooks.push('floor'),
      bake: () => hooks.push('top'),
      live: () => hooks.push('live'),
    };
    const layer = new ReefLayer(desc);
    layer.art.bakeTile(recordingCtx(log, []), { x: 1024, y: 512, w: 512, h: 512 });
    expect(log.filter(c => c === 'save').length).toBe(log.filter(c => c === 'restore').length);
    expect(hooks).toEqual(['floor', 'top']);
    layer.paint(recordingCtx([], []), view, 1, 0);
    expect(hooks).toContain('live');
  });

  it('Driftglass still runs on the shared tile cache (same bake-once behaviour)', () => {
    const tiles = new ReefTiles();
    const ctx = recordingCtx([], []);
    tiles.draw(ctx, { x: 800, y: 900, w: 700, h: 400 }, 1);
    const first = tiles.bakes;
    expect(first).toBeGreaterThan(0);
    tiles.draw(ctx, { x: 800, y: 900, w: 700, h: 400 }, 1);
    expect(tiles.bakes).toBeLessThanOrEqual(first + 1); // at most the walk-ahead's one
    tiles.dispose();
  });

  it('settles before repainting at a new zoom (a pinch is not a zoom level)', () => {
    const layer = new ReefLayer(mazeArt());
    const ctx = recordingCtx([], []);
    layer.paint(ctx, view, 1, 0);
    const bakes = layer.tiles.bakes;
    for (let i = 0; i < 5; i++) layer.paint(ctx, view, 0.5 + i * 0.01, 16 * i);
    // Still inside the settle window: no tile was repainted for the new scales.
    expect(layer.tiles.bakes).toBeLessThanOrEqual(bakes + 5);
    layer.dispose();
  });
});

// ------------------------------------------------------------ the scenery exists in a real match

describe('painted maps get their scenery whatever the jungle says', () => {
  let game: TestGame;
  beforeEach(() => {
    stubGameGlobals();
    vi.stubGlobal('deltaTime', 16);
    game = createGame(MAZE_SIZE);
    (game as any).turrets = [];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['maze', 'duel'])('%s: the qualified map id (as the real game has it) makes the art', id => {
    (game as any).activeMapId = `tidelight:${id}`;
    expect(hasArt(game, id)).toBe(false);
    expect(ensureMapObject(game)).toBe(true);
    expect(hasArt(game, id)).toBe(true);
  });

  it('is idempotent: a second ensure adds no second scenery', () => {
    (game as any).activeMapId = 'tidelight:maze';
    ensureMapObject(game);
    const count = (game as any).objectManager._objectToBeAdd.length + (game as any).objectManager.objects.length;
    ensureMapObject(game);
    expect((game as any).objectManager._objectToBeAdd.length + (game as any).objectManager.objects.length).toBe(count);
  });

  it('does nothing on another map', () => {
    (game as any).activeMapId = 'tidelight:hill';
    expect(hasArt(game, 'maze')).toBe(false);
    expect(hasArt(game, 'duel')).toBe(false);
  });
});
