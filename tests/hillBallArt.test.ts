/**
 * Vua Đảo (an atoll with a ruined lighthouse) and Bóng Đá (a tide-pool sandbar with
 * whale-jaw goals), painted with the reef art kit. The walls are the gameplay truth:
 * here they are held to what the rules code assumes (the ball bounces on the PITCH
 * rectangle, the ring is centred on the lighthouse) and to being a real structure,
 * not a handful of boxes and circles.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import { hillGeometry } from '../maps/hill/geometry';
import { hillMap } from '../maps/hill/map';
import { hillArt } from '../maps/hill/art';
import { createHill } from '../maps/hill/hill';
import {
  HILL_BASES,
  HILL_ISLANDS,
  HILL_KELP,
  HILL_MAP_SIZE,
  HILL_PEARLS,
  HILL_ROCKS,
  HILL_TURRETS,
  HILL_WALLS,
} from '../maps/hill/layout';
import { ZONE_RADIUS } from '../maps/hill/rules';
import { geometry as ballGeometry, ballMap } from '../maps/ball/map';
import { ballArt } from '../maps/ball/art';
import { createPitch, ensurePitch } from '../maps/ball/pitch';
import { BALL_KELP, BALL_ROCKS, BALL_SEA, CENTRE, CY, GOAL_HALF, MAP_SIZE, PITCH, POCKET, SPAWNS, BLUE, RED, WALLS } from '../maps/ball/layout';
import { ensureOn } from '../maps/onMap';
import { hasArt } from '../world/art/sceneryObject';
import { convexOverlap, distToPoly, isConvex, mirror } from '../world/art/shapes';
import type { Pt } from '../world/layout';

const key = (poly: Pt[]) =>
  poly
    .map(p => `${p.x},${p.y}`)
    .sort()
    .join(' ');
const isRect = (poly: Pt[]) => poly.length === 4 && new Set(poly.map(p => p.x)).size === 2 && new Set(poly.map(p => p.y)).size === 2;

/** Flood fill on a grid; `clear` is the body radius every cell centre must keep from every wall. */
function reach(walls: Pt[][], size: number, from: Pt, clear: number, grid = 20): (p: Pt) => boolean {
  const n = size / grid;
  const boxes = walls.map(poly => ({
    poly,
    x0: Math.min(...poly.map(p => p.x)) - clear,
    x1: Math.max(...poly.map(p => p.x)) + clear,
    y0: Math.min(...poly.map(p => p.y)) - clear,
    y1: Math.max(...poly.map(p => p.y)) + clear,
  }));
  const blocked = (x: number, y: number): boolean => boxes.some(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && distToPoly(b.poly, x, y) < clear);
  const seen = new Set<number>();
  const stack: number[][] = [[Math.floor(from.x / grid), Math.floor(from.y / grid)]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= n || cy >= n || seen.has(cy * n + cx)) continue;
    if (blocked(cx * grid + grid / 2, cy * grid + grid / 2)) continue;
    seen.add(cy * n + cx);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return p => seen.has(Math.floor(p.y / grid) * n + Math.floor(p.x / grid));
}
const clearOf = (walls: Pt[][], p: Pt): number => Math.min(...walls.map(w => distToPoly(w, p.x, p.y)));

describe('hill: an atoll with a ruined lighthouse', () => {
  const walls = hillGeometry.terrain.wall;

  it('is one set of polygons for the art and the collision, all convex', () => {
    expect(walls).toEqual(HILL_WALLS);
    expect(walls.filter(p => !isConvex(p))).toEqual([]);
    expect(hillGeometry.terrain.bush.filter(p => !isConvex(p))).toEqual([]);
    expect(hillMap.paintsOwnTerrain).toBe(true);
    expect(hillArt().size).toBe(hillMap.size);
  });

  it('has a real structure: a reef ring, ruins and wreckage, not rectangles and hexagons', () => {
    expect(walls.length).toBeGreaterThan(100);
    expect(walls.filter(isRect)).toHaveLength(2); // only the two stretches of open sea
    expect(HILL_ROCKS.length).toBeGreaterThanOrEqual(6);
    expect(walls.filter(p => p.length === 8).length).toBeGreaterThan(8); // octagonal towers and coral heads
  });

  it('is point-symmetric, so neither court has the better half', () => {
    const set = new Set(walls.map(key));
    for (const w of walls) expect(set.has(key(mirror(HILL_MAP_SIZE, w)))).toBe(true);
    const kelp = new Set(HILL_KELP.map(key));
    for (const k of HILL_KELP) expect(kelp.has(key(mirror(HILL_MAP_SIZE, k)))).toBe(true);
  });

  it('keeps the lighthouse standing at the centre ring, a ruin in the other two, and the rings walkable', () => {
    const [light, north, south] = HILL_ISLANDS;
    expect(clearOf(walls, light)).toBe(0); // the tower itself
    for (const at of HILL_ISLANDS) {
      const near = walls.filter(w => distToPoly(w, at.x, at.y) < ZONE_RADIUS);
      expect(near.length, `a ruin stands in the ring at ${at.x},${at.y}`).toBeGreaterThanOrEqual(3);
    }
    for (const at of [north, south]) expect(clearOf(walls, at)).toBeGreaterThan(28);
  });

  it('keeps every base, tower, pearl and ring reachable by a hero (28 px of clearance)', () => {
    const can = reach(walls, HILL_MAP_SIZE, HILL_BASES.blue, 28);
    for (const p of [HILL_BASES.red, HILL_TURRETS.blue, HILL_TURRETS.red, ...HILL_PEARLS, HILL_ISLANDS[1], HILL_ISLANDS[2], { x: HILL_ISLANDS[0].x + 130, y: HILL_ISLANDS[0].y }]) {
      expect(clearOf(walls, p), `${p.x},${p.y} stands clear of every wall`).toBeGreaterThan(28);
      expect(can(p), `${p.x},${p.y} is reachable from the blue base`).toBe(true);
    }
    for (const base of [HILL_BASES.blue, HILL_BASES.red]) expect(clearOf(walls, base)).toBeGreaterThan(140 + 28);
  });

  it('has a closed reef ring with breaks: a hero can leave the lagoon only through them', () => {
    // Four heads on the compass round the lagoon: each is reachable, and the ring is made of many separate pieces.
    const ringPieces = HILL_ROCKS[0].parts.filter(p => p.some(q => q.y > 420 && q.y < 1980));
    expect(ringPieces.length).toBeGreaterThan(40);
    const lagoon = { x: 1200, y: 1000 };
    const outside = { x: 300, y: 560 };
    const can = reach(walls, HILL_MAP_SIZE, lagoon, 28);
    expect(can(outside)).toBe(true); // through a break
    // ...and the ring really is there: shut its six breaks and the lagoon is sealed from the coves.
    const ring = HILL_ROCKS[0].parts;
    const plugs = [...[45, 135, 225, 315].flatMap(breakPlug), box(1820, 880, 300, 640), box(280, 880, 300, 640)];
    const sealed = reach([...walls, ...plugs], HILL_MAP_SIZE, lagoon, 28);
    expect(ring.length).toBeGreaterThan(0);
    expect(sealed(outside)).toBe(false);
  });

  it('keeps kelp off every wall and out of the bases', () => {
    for (const k of HILL_KELP) {
      for (const w of walls) expect(convexOverlap(k, w)).toBe(false);
      for (const b of [HILL_BASES.blue, HILL_BASES.red]) expect(distToPoly(k, b.x, b.y)).toBeGreaterThan(140);
    }
  });
});

const box = (x: number, y: number, w: number, h: number): Pt[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

/** A plug (a fat block) over the ring's break at compass angle `deg`, for the seal test. */
function breakPlug(deg: number): Pt[][] {
  const a = (deg * Math.PI) / 180;
  const cx = 1200 + 800 * Math.cos(a);
  const cy = 1200 + 830 * Math.sin(a);
  return [box(cx - 120, cy - 120, 240, 240)];
}

describe('ball: a tide-pool sandbar with whale-jaw goals', () => {
  const walls = ballGeometry.terrain.wall;
  const open = (p: Pt) => clearOf(walls, p) > 0;
  const pocketL = { x0: PITCH.left - POCKET, x1: PITCH.left, y0: CY - GOAL_HALF, y1: CY + GOAL_HALF };
  const pocketR = { x0: PITCH.right, x1: PITCH.right + POCKET, y0: CY - GOAL_HALF, y1: CY + GOAL_HALF };

  it('is one set of polygons for the art and the collision, all convex', () => {
    expect(walls).toEqual(WALLS);
    expect(walls.filter(p => !isConvex(p))).toEqual([]);
    expect(ballGeometry.terrain.bush).toEqual(BALL_KELP);
    expect(ballMap.paintsOwnTerrain).toBe(true);
    expect(ballArt().size).toBe(ballMap.size);
  });

  it('keeps every wall edge the ball bounces on exactly where the rules put it', () => {
    // Walkable: the whole pitch and both net pockets, right to the inch.
    const inside: Pt[] = [];
    for (let x = PITCH.left + 3; x < PITCH.right - 2; x += 37) for (let y = PITCH.top + 3; y < PITCH.bottom - 2; y += 29) inside.push({ x, y });
    for (const q of [pocketL, pocketR]) for (let x = q.x0 + 3; x < q.x1 - 2; x += 17) for (let y = q.y0 + 3; y < q.y1 - 2; y += 19) inside.push({ x, y });
    expect(inside.filter(p => !open(p))).toEqual([]);
    // Solid: just beyond every edge of that ground.
    const beyond: Pt[] = [];
    for (let x = PITCH.left + 3; x < PITCH.right; x += 41) beyond.push({ x, y: PITCH.top - 3 }, { x, y: PITCH.bottom + 3 });
    for (const q of [pocketL, pocketR]) {
      for (let y = q.y0 + 3; y < q.y1; y += 23) beyond.push({ x: q === pocketL ? q.x0 - 3 : q.x1 + 3, y });
      for (let x = q.x0 + 3; x < q.x1; x += 23) beyond.push({ x, y: q.y0 - 3 }, { x, y: q.y1 + 3 });
    }
    for (const y of [PITCH.top + 20, CY - GOAL_HALF - 3, CY + GOAL_HALF + 3, PITCH.bottom - 20]) beyond.push({ x: PITCH.left - 3, y }, { x: PITCH.right + 3, y });
    expect(beyond.filter(p => open(p))).toEqual([]);
  });

  it('is shaped, not boxed: rim boulders, jaw bones and a skull on top of the eight sea blocks', () => {
    expect(walls.filter(isRect)).toHaveLength(BALL_SEA.length);
    expect(walls.length).toBeGreaterThan(60);
    expect(BALL_ROCKS.some(r => r.style === 'bone')).toBe(true);
  });

  it('is point-symmetric: the same jaw and the same rim at both ends', () => {
    const set = new Set(walls.map(key));
    for (const w of walls) expect(set.has(key(mirror(MAP_SIZE, w)))).toBe(true);
    const kelp = new Set(BALL_KELP.map(key));
    for (const k of BALL_KELP) expect(kelp.has(key(mirror(MAP_SIZE, k)))).toBe(true);
  });

  it('lets a hero walk from either fountain to the other, the centre and into both goal mouths, with a body of clearance', () => {
    const can = reach(walls, MAP_SIZE, SPAWNS[BLUE], 28);
    for (const p of [SPAWNS[RED], CENTRE, { x: PITCH.left - 80, y: CY }, { x: PITCH.right + 80, y: CY }, { x: PITCH.left + 60, y: PITCH.top + 60 }]) expect(can(p)).toBe(true);
  });

  it('keeps kelp on the pitch, clear of the walls and of both fountains and the kick-off spot', () => {
    expect(BALL_KELP).toHaveLength(6);
    for (const k of BALL_KELP) {
      for (const w of walls) expect(convexOverlap(k, w)).toBe(false);
      for (const p of [SPAWNS[BLUE], SPAWNS[RED], CENTRE]) expect(distToPoly(k, p.x, p.y)).toBeGreaterThan(110);
    }
  });
});

describe('the scenery exists in a real match, whatever the jungle says', () => {
  let game: TestGame;
  beforeEach(() => {
    stubGameGlobals();
    vi.stubGlobal('deltaTime', 16);
    game = createGame(2400);
    (game as any).turrets = [];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hill: the qualified map id makes the art (jungle off: ensureOn, as a hero passive calls it; no slot object)', () => {
    (game as any).activeMapId = 'tidelight:hill';
    expect(hasArt(game, 'hill')).toBe(false);
    expect(ensureOn(game, 'hill', createHill)).toBe(true);
    expect(hasArt(game, 'hill')).toBe(true);
    const count = (game as any).objectManager._objectToBeAdd.length + (game as any).objectManager.objects.length;
    ensureOn(game, 'hill', createHill);
    expect((game as any).objectManager._objectToBeAdd.length + (game as any).objectManager.objects.length).toBe(count);
  });

  it('ball: the qualified map id makes the art, from ensurePitch and from the slot object alike', () => {
    (game as any).activeMapId = 'tidelight:ball';
    ensurePitch(game);
    expect(hasArt(game, 'ball')).toBe(true);
    const slot = createGame(2400);
    (slot as any).turrets = [];
    (slot as any).activeMapId = 'tidelight:ball';
    createPitch(slot);
    expect(hasArt(slot, 'ball')).toBe(true);
  });

  it('another map gets neither', () => {
    (game as any).activeMapId = 'tidelight:maze';
    createHill(game);
    createPitch(game);
    expect(hasArt(game, 'hill')).toBe(false);
    expect(hasArt(game, 'ball')).toBe(false);
  });
});
