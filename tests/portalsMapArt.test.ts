/**
 * Đảo Cổng is four biome islands round a broken crag. Claims: the art is the
 * geometry; walls are convex, many, mostly not rectangles; the map is
 * point-symmetric (so neither court has the better islands) while the four
 * biomes are painted in four different styles; every lane and portal keeps room
 * for a 28px hero and the whole map can be walked from home.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import { geometry } from '../maps/portals/geometry';
import { portalsArt } from '../maps/portals/art';
import { portalsMap } from '../maps/portals';
import { createPortalArena } from '../maps/portals/arena';
import { HOMES, KEEPS, PORTALS_ROCKS, PORTAL_SPOTS } from '../maps/portals/layout';
import { hasArt } from '../world/art/sceneryObject';
import { wallsOf } from '../world/art/reef';
import { convexOverlap, distToPoly, isConvex } from '../world/art/shapes';
import { MAP_SIZE, type Pt } from '../world/layout';
import { INK } from '../world/palette';

const key = (poly: Pt[]) =>
  poly
    .map(p => `${Math.round(p.x)},${Math.round(p.y)}`)
    .sort()
    .join(' ');
const keys = (polys: Pt[][]) => polys.map(key).sort();
const walls = geometry.terrain.wall;
const clearance = (p: Pt) => Math.min(...walls.map(w => distToPoly(w, p.x, p.y)));
const isRect = (poly: Pt[]) => poly.length === 4 && new Set(poly.map(p => p.x)).size === 2 && new Set(poly.map(p => p.y)).size === 2;

describe('Đảo Cổng: the art follows the polygons', () => {
  it('paints as wall exactly the polygons that are walls, and as kelp exactly the bushes', () => {
    expect(keys(wallsOf(portalsArt()))).toEqual(keys(walls));
    expect(keys(portalsArt().kelp)).toEqual(keys(geometry.terrain.bush));
  });
  it('declares that it paints its own terrain, sized to the map', () => {
    expect(portalsMap.paintsOwnTerrain).toBe(true);
    expect(portalsArt().size).toBe(MAP_SIZE);
  });
  it('is made of convex pieces only, with kelp off the walls', () => {
    expect(walls.filter(p => !isConvex(p))).toEqual([]);
    for (const k of geometry.terrain.bush) for (const w of walls) expect(convexOverlap(k, w)).toBe(false);
  });
  // 230, not 250: the garden heaps and forest heaps went (a 52 px hero could not get between them).
  it('is rock, not boxes: 230+ pieces; the only rectangles are the four sea frames and the hidden crag core', () => {
    expect(walls.length).toBeGreaterThan(230);
    expect(walls.filter(isRect).length).toBeLessThanOrEqual(8);
  });
  it('gives each island its own look: four distinct biome styles are in use', () => {
    const styles = new Set(PORTALS_ROCKS.map(r => r.style));
    for (const s of ['coral', 'kelpwood', 'basalt', 'pearl', 'cliff']) expect(styles.has(s)).toBe(true);
  });
});

describe('Đảo Cổng: the central crag has structure', () => {
  const small = (poly: Pt[]) => Math.max(...poly.map(p => p.x)) - Math.min(...poly.map(p => p.x)) < 90 && Math.max(...poly.map(p => p.y)) - Math.min(...poly.map(p => p.y)) < 90;
  it('has rock spires standing in the open as real walls (cover), in half-turn pairs', () => {
    const spires = PORTALS_ROCKS.filter(r => r.style === 'cliff').flatMap(r => r.parts).filter(small);
    expect(spires.length).toBeGreaterThanOrEqual(6);
    expect(spires.length % 2).toBe(0);
    for (const sp of spires) expect(walls.some(w => key(w) === key(sp))).toBe(true);
  });
  it('paints raised tiers and a crater, not a flat slab: the bake hook exists and draws on a tile over the crag', () => {
    const desc = portalsArt();
    expect(desc.bake).toBeTypeOf('function');
    const calls: string[] = [];
    const ctx = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? {} : (...a: unknown[]) => { calls.push(String(k)); void a; }), set: () => true });
    desc.bake!(ctx as never, { x: 1200, y: 1200, w: 512, h: 512 }, INK as never);
    expect(calls.filter(c => c === 'fill').length).toBeGreaterThan(8);
  });
});

describe('Đảo Cổng: fair and walkable', () => {
  it('is point-symmetric: every wall has its half-turn twin', () => {
    const turn = (poly: Pt[]) => poly.map(p => ({ x: MAP_SIZE - p.x, y: MAP_SIZE - p.y }));
    const have = new Set(keys(walls));
    for (const w of walls) expect(have.has(key(turn(w)))).toBe(true);
  });
  it('keeps room for a hero at both homes, both keeps and every portal', () => {
    for (const p of [...Object.values(HOMES), ...Object.values(KEEPS), ...PORTAL_SPOTS]) expect(clearance(p)).toBeGreaterThan(90);
  });
  it('keeps both ring lanes at least 48px clear of every wall', () => {
    for (const lane of geometry.lanes!) {
      const r = lane.waypoints;
      for (let i = 0; i + 1 < r.length; i++)
        for (let t = 0; t <= 1; t += 0.01) expect(clearance({ x: r[i].x + (r[i + 1].x - r[i].x) * t, y: r[i].y + (r[i + 1].y - r[i].y) * t })).toBeGreaterThan(48);
    }
  });
  it('can be walked by a 28px hero from Tide\'s home to the keeps, Ember\'s home and all four portals', () => {
    const G = 20;
    const N = MAP_SIZE / G;
    const seen = new Set<number>();
    const stack = [[Math.floor(HOMES['team-blue'].x / G), Math.floor(HOMES['team-blue'].y / G)]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cy < 0 || cx >= N || cy >= N || seen.has(cy * N + cx)) continue;
      if (clearance({ x: cx * G + G / 2, y: cy * G + G / 2 }) < 28) continue;
      seen.add(cy * N + cx);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    const reach = (p: Pt) => seen.has(Math.floor(p.y / G) * N + Math.floor(p.x / G));
    for (const p of [...Object.values(KEEPS), HOMES['team-red'], ...PORTAL_SPOTS]) expect(reach(p)).toBe(true);
  });
});

describe('Đảo Cổng: scenery with the jungle off', () => {
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
  it('the arena makes the art on the qualified map id', () => {
    (game as any).activeMapId = 'tidelight:portals';
    expect(hasArt(game, 'portals')).toBe(false);
    createPortalArena(game);
    expect(hasArt(game, 'portals')).toBe(true);
  });
  it('does nothing on another map', () => {
    (game as any).activeMapId = 'tidelight:hill';
    createPortalArena(game);
    expect(hasArt(game, 'portals')).toBe(false);
  });
});
