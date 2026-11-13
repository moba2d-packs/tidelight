/**
 * Mặt Băng: the ice is data (map `ice` + the `floes` zone) and the picture is
 * that same data; the map is a fair, walkable mix of slippery floes and normal
 * ground, with a referee that calls the match when a keep falls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApi, createGame, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import { data } from '../../pack';
import { geometry } from '../../maps/ice/geometry';
import { map } from '../../maps/ice/map';
import { iceArt } from '../../maps/ice/art';
import { createIceArena } from '../../maps/ice/object';
import { ensureMapObject } from '../../maps';
import {
  ICE_BASES,
  ICE_FLOES,
  ICE_KEEPS,
  ICE_LANES,
  ICE_SIZE,
  ICE_TUNING,
  ICE_WARDENS,
} from '../../maps/ice/layout';
import { hasArt } from '../../world/art/sceneryObject';
import { ReefLayer, wallsOf } from '../../world/art/reef';
import { convexOverlap, distToPoly, flipX, inPoly, isConvex } from '../../world/art/shapes';
import { BLUE, RED, type Pt } from '../../world/layout';

const key = (poly: Pt[]) =>
  poly
    .map(p => `${p.x},${p.y}`)
    .sort()
    .join(' ');
const walls = geometry.terrain.wall;
const near = (p: Pt) => Math.min(...walls.map(w => distToPoly(w, p.x, p.y)));
const onIce = (p: Pt) => ICE_FLOES.some(f => inPoly(f, p.x, p.y));

describe('registered and installable', () => {
  it('is listed in the pack as Mặt Băng, with its ice numbers', () => {
    const listed = data.maps?.find(m => m.id === 'ice');
    expect(listed?.name).toBe('Mặt Băng');
    expect(listed?.ice).toEqual(ICE_TUNING);
    expect(listed?.paintsOwnTerrain).toBe(true);
    expect(map.size).toBe(ICE_SIZE);
  });
});

describe('the ice is the floes', () => {
  it('is one ice zone whose polygons are exactly the floes the art paints', () => {
    expect(geometry.zones).toHaveLength(1);
    const zone = geometry.zones![0];
    expect(zone.ice).toBe(true);
    expect(zone.polygons.map(key).sort()).toEqual(ICE_FLOES.map(key).sort());
    // `everywhere` would make the whole map ice and the zone pointless.
    expect((map.ice as { everywhere?: boolean }).everywhere).toBeUndefined();
  });

  it('paints every floe in the baked floor, and nothing outside what the zone says', () => {
    let clips = 0;
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, prop: string) => (prop in t ? t[prop] : (..._a: unknown[]) => void (prop === 'clip' && clips++)),
      set: (t, prop: string, v) => ((t[prop] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    const art = new ReefLayer(iceArt()).art;
    art.desc.bakeFloor!(ctx, { x: 0, y: 0, w: ICE_SIZE, h: ICE_SIZE }, art.pal);
    expect(clips).toBe(ICE_FLOES.length);
  });

  it('is slippery where a good part of the north lane is and only a little of the south lane', () => {
    const share = (lane: readonly Pt[]) => {
      let on = 0;
      let all = 0;
      for (let i = 0; i + 1 < lane.length; i++) {
        for (let k = 0; k < 20; k++) {
          const p = { x: lane[i].x + ((lane[i + 1].x - lane[i].x) * k) / 20, y: lane[i].y + ((lane[i + 1].y - lane[i].y) * k) / 20 };
          all++;
          if (onIce(p)) on++;
        }
      }
      return on / all;
    };
    expect(share(ICE_LANES.floe)).toBeGreaterThan(0.5);
    expect(share(ICE_LANES.snow)).toBeGreaterThan(0.03);
    expect(share(ICE_LANES.snow)).toBeLessThan(0.4);
    expect(share(ICE_LANES.floe)).toBeGreaterThan(share(ICE_LANES.snow) + 0.2);
  });

  it('leaves the docks, wardens and keeps on normal ground (a spawn is not a skating rink)', () => {
    for (const court of [BLUE, RED] as const) {
      for (const p of [ICE_BASES[court], ICE_KEEPS[court], ICE_WARDENS[court]]) {
        expect(ICE_FLOES.some(f => distToPoly(f, p.x, p.y) < 130)).toBe(false);
      }
    }
  });
});

describe('the art follows the polygons', () => {
  it('paints as wall exactly the walls and as reeds exactly the bush', () => {
    expect(wallsOf(iceArt()).map(key).sort()).toEqual(walls.map(key).sort());
    expect(iceArt().kelp.map(key).sort()).toEqual(geometry.terrain.bush.map(key).sort());
    expect(iceArt().size).toBe(map.size);
  });
  it('has no floor patch that is a wall', () => {
    const w = new Set(walls.map(key));
    for (const patch of iceArt().floor ?? []) expect(w.has(key(patch.points))).toBe(false);
  });
  it('balances every save with a restore while painting', () => {
    const log: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, prop: string) => (prop in t ? t[prop] : (..._a: unknown[]) => void log.push(prop)),
      set: (t, prop: string, v) => ((t[prop] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    const layer = new ReefLayer(iceArt());
    layer.art.bakeTile(ctx, { x: 512, y: 512, w: 512, h: 512 });
    layer.art.desc.live!(ctx, { x: 0, y: 0, w: 900, h: 600 }, 1234, layer.art.pal);
    expect(log.filter(c => c === 'save').length).toBe(log.filter(c => c === 'restore').length);
  });
});

describe('the lagoon', () => {
  it('is convex pieces only (walls, reeds and floes)', () => {
    expect([...walls, ...geometry.terrain.bush, ...ICE_FLOES].filter(p => !isConvex(p))).toEqual([]);
  });

  it('is mirror-symmetric left to right, so both courts skate on the same ground', () => {
    for (const list of [walls, geometry.terrain.bush, ICE_FLOES]) {
      const set = new Set(list.map(key));
      for (const p of list) expect(set.has(key(flipX(ICE_SIZE, p)))).toBe(true);
    }
  });

  it('is not boxes: ridges, cracks and heaps stand on it', () => {
    const rects = walls.filter(p => p.length === 4 && new Set(p.map(q => q.x)).size === 2 && new Set(p.map(q => q.y)).size === 2);
    expect(rects).toHaveLength(4); // only the sea frame
    expect(walls.length).toBeGreaterThan(40);
  });

  it('keeps reeds off the walls and spawn pads', () => {
    for (const k of geometry.terrain.bush) {
      for (const w of walls) expect(convexOverlap(k, w)).toBe(false);
      for (const court of [BLUE, RED] as const) expect(distToPoly(k, ICE_BASES[court].x, ICE_BASES[court].y)).toBeGreaterThan(120);
    }
  });

  it('has room for a 28 px hero along both lanes and at every structure', () => {
    for (const lane of Object.values(ICE_LANES)) {
      for (let i = 0; i + 1 < lane.length; i++) {
        for (let k = 0; k <= 20; k++) {
          const p = { x: lane[i].x + ((lane[i + 1].x - lane[i].x) * k) / 20, y: lane[i].y + ((lane[i + 1].y - lane[i].y) * k) / 20 };
          expect(near(p)).toBeGreaterThan(28);
        }
      }
    }
    for (const s of geometry.slots.structure) expect(near(s)).toBeGreaterThan(40);
    for (const s of geometry.slots.spawn) expect(near(s)).toBeGreaterThan(s.r + 10);
  });

  it('can be walked dock to dock three ways: both lanes and the pond between the ridges (28 px body)', () => {
    const GRID = 20;
    const CLEAR = 28;
    const N = ICE_SIZE / GRID;
    const boxes = walls.map(poly => ({
      poly,
      x0: Math.min(...poly.map(p => p.x)) - CLEAR,
      x1: Math.max(...poly.map(p => p.x)) + CLEAR,
      y0: Math.min(...poly.map(p => p.y)) - CLEAR,
      y1: Math.max(...poly.map(p => p.y)) + CLEAR,
    }));
    const solid = (x: number, y: number) => boxes.some(b => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && distToPoly(b.poly, x, y) < CLEAR);
    const reach = (from: Pt, to: Pt, ban: (x: number, y: number) => boolean) => {
      const seen = new Set<number>();
      const stack = [[Math.floor(from.x / GRID), Math.floor(from.y / GRID)]];
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        if (cx < 0 || cy < 0 || cx >= N || cy >= N || seen.has(cy * N + cx)) continue;
        const x = cx * GRID + GRID / 2;
        const y = cy * GRID + GRID / 2;
        if (solid(x, y) || ban(x, y)) continue;
        seen.add(cy * N + cx);
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      return seen.has(Math.floor(to.y / GRID) * N + Math.floor(to.x / GRID));
    };
    const a = ICE_BASES[BLUE];
    const b = ICE_BASES[RED];
    expect(reach(a, b, () => false)).toBe(true);
    // The pond's gap shut (a box across it): the lanes still join the docks...
    const midBand = (x: number, y: number) => x > 1000 && x < 1400 && y > 1100 && y < 1300;
    expect(reach(a, b, midBand)).toBe(true);
    // ...and with the whole south half shut, the north (ice) lane alone does.
    expect(reach(a, b, (_x, y) => y > 1300 || midBand(_x, y))).toBe(true);
    // ...and with the north half shut, so does the south (snow) one.
    expect(reach(a, b, (_x, y) => y < 1100 || midBand(_x, y))).toBe(true);
  });

  it('has two lanes dock to dock and one warden and one keep per side', () => {
    expect(geometry.lanes?.map(l => l.id)).toEqual(['floe', 'snow']);
    for (const l of geometry.lanes ?? []) {
      expect(l.waypoints[0]).toEqual(ICE_BASES[BLUE]);
      expect(l.waypoints.at(-1)).toEqual(ICE_BASES[RED]);
    }
    for (const faction of ['tide', 'ember']) expect(geometry.slots.structure.filter(s => s.faction === faction)).toHaveLength(2);
  });
});

describe('the referee in a (headless) match', () => {
  let game: TestGame;
  beforeEach(() => {
    stubGameGlobals();
    vi.stubGlobal('deltaTime', 16);
    game = createGame(ICE_SIZE);
    (game as any).turrets = [];
    const unit = new (buildTestApi().units.Champion)({ game, teamId: BLUE }) as any;
    unit.position.set(-5_000, -5_000);
    game.setPlayer(unit);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ensureMapObject builds the referee and the lagoon on tidelight:ice only', () => {
    expect(ensureMapObject(game)).toBe(false);
    (game as any).activeMapId = 'tidelight:ice';
    expect(hasArt(game, 'ice')).toBe(false);
    expect(ensureMapObject(game)).toBe(true);
    expect(hasArt(game, 'ice')).toBe(true);
    const count = () => (game as any).objectManager._objectToBeAdd.length + (game as any).objectManager.objects.length;
    const n = count();
    ensureMapObject(game);
    expect(count()).toBe(n);
  });

  it('calls the match when a keep falls', () => {
    const arena = createIceArena(game);
    arena.step(16);
    expect(arena.winner).toBeNull();
    (game as any).turrets = [{ teamId: RED, isDead: true, position: ICE_KEEPS[RED] }];
    arena.step(16);
    expect(arena.winner).toBe(BLUE);
  });
});
