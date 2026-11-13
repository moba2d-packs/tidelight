/**
 * Thủ Đèn is painted as a lighthouse island, not assembled from blocks. Claims:
 * the art is the geometry; the walls are convex, many and mostly not rectangles;
 * every raider route and the lantern keep room for a hero (28px) and can be walked;
 * the island is painted with the jungle off, once.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import { geometry } from '../maps/defend/geometry';
import { defendArt } from '../maps/defend/art';
import { defendMap } from '../maps/defend/map';
import { createDefence } from '../maps/defend/defence';
import { DEFEND_SIZE, GATES, HARBOUR, LANTERN, gateRoute } from '../maps/defend/layout';
import { hasArt } from '../world/art/sceneryObject';
import { wallsOf } from '../world/art/reef';
import { convexOverlap, distToPoly, isConvex } from '../world/art/shapes';
import type { Pt } from '../world/layout';

const key = (poly: Pt[]) =>
  poly
    .map(p => `${p.x},${p.y}`)
    .sort()
    .join(' ');
const keys = (polys: Pt[][]) => polys.map(key).sort();
const walls = geometry.terrain.wall;
const clearance = (p: Pt) => Math.min(...walls.map(w => distToPoly(w, p.x, p.y)));
const isRect = (poly: Pt[]) => poly.length === 4 && new Set(poly.map(p => p.x)).size === 2 && new Set(poly.map(p => p.y)).size === 2;

describe('Thủ Đèn: the art follows the polygons', () => {
  it('paints as wall exactly the polygons that are walls, and as kelp exactly the bushes', () => {
    expect(keys(wallsOf(defendArt()))).toEqual(keys(walls));
    expect(keys(defendArt().kelp)).toEqual(keys(geometry.terrain.bush));
  });
  it('declares that it paints its own terrain, sized to the map', () => {
    expect(defendMap.paintsOwnTerrain).toBe(true);
    expect(defendArt().size).toBe(DEFEND_SIZE);
  });
  it('is made of convex pieces only', () => {
    expect(walls.filter(p => !isConvex(p))).toEqual([]);
  });
  it('is a coastline, not boxes: 150+ wall pieces, only the four sea frames are rectangles', () => {
    expect(walls.length).toBeGreaterThan(150);
    expect(walls.filter(isRect).length).toBeLessThanOrEqual(4);
  });
  it('keeps kelp off the walls', () => {
    for (const k of geometry.terrain.bush) for (const w of walls) expect(convexOverlap(k, w)).toBe(false);
  });
});

describe('Thủ Đèn: the routes', () => {
  it.each(GATES)('$id: the raiders walk a path with room for a body the whole way', gate => {
    const r = gateRoute(gate);
    let min = Infinity;
    for (let i = 0; i + 1 < r.length; i++)
      for (let t = 0; t <= 1; t += 0.01) min = Math.min(min, clearance({ x: r[i].x + (r[i + 1].x - r[i].x) * t, y: r[i].y + (r[i + 1].y - r[i].y) * t }));
    expect(min).toBeGreaterThan(48);
    expect(clearance(gate.muster)).toBeGreaterThan(60);
    expect(clearance(gate.arrive)).toBeGreaterThan(60);
  });
  it('leaves the harbour and the lantern open', () => {
    expect(clearance(HARBOUR)).toBeGreaterThan(150);
    expect(clearance(LANTERN)).toBeGreaterThan(150);
  });
  it('can be walked by a 28px hero from the harbour to every muster, arrival and the lantern', () => {
    const G = 20;
    const N = DEFEND_SIZE / G;
    const seen = new Set<number>();
    const stack = [[Math.floor(HARBOUR.x / G), Math.floor(HARBOUR.y / G)]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cy < 0 || cx >= N || cy >= N || seen.has(cy * N + cx)) continue;
      if (clearance({ x: cx * G + G / 2, y: cy * G + G / 2 }) < 28) continue;
      seen.add(cy * N + cx);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    const reach = (p: Pt) => seen.has(Math.floor(p.y / G) * N + Math.floor(p.x / G));
    for (const g of GATES) {
      expect(reach(g.muster)).toBe(true);
      expect(reach(g.arrive)).toBe(true);
    }
    expect(reach(LANTERN)).toBe(true);
  });
});

describe('Thủ Đèn: scenery with the jungle off', () => {
  let game: TestGame;
  beforeEach(() => {
    stubGameGlobals();
    vi.stubGlobal('deltaTime', 16);
    game = createGame(DEFEND_SIZE);
    (game as any).turrets = [];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it('the director makes the art on the qualified map id, once', () => {
    (game as any).activeMapId = 'tidelight:lantern-watch';
    expect(hasArt(game, 'lantern-watch')).toBe(false);
    createDefence(game);
    expect(hasArt(game, 'lantern-watch')).toBe(true);
    const count = (game as any).objectManager._objectToBeAdd.length + (game as any).objectManager.objects.length;
    createDefence(game);
    expect((game as any).objectManager._objectToBeAdd.length + (game as any).objectManager.objects.length).toBeLessThanOrEqual(count + 1);
  });
  it('does nothing on another map', () => {
    (game as any).activeMapId = 'tidelight:hill';
    createDefence(game);
    expect(hasArt(game, 'lantern-watch')).toBe(false);
  });
});
