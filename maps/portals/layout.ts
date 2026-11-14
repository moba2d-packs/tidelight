import { BLUE, MAP_SIZE, RED, type Court, type Pt } from '../../world/layout';
import type { RockSpec } from '../../world/art/reef';
import { band, leftOf, lumps, slab, swapXY } from '../../world/art/coast';

/**
 * Đảo Cổng — four corner islands on a 3200 square, joined by a thin ring of
 * reef (the corridors) and by four whirlpool portals, one per island.
 *
 * Index order of everything below: 0 = NW (Tide's home), 1 = NE, 2 = SE
 * (Ember's home), 3 = SW. The map is point-symmetric: i <-> (i + 2) % 4, so the
 * *walls* of NW and SE are the same shape turned half way round, as are NE and SW.
 * What differs is the biome each island is painted as (`./art.ts`):
 *
 *   NW  coral garden        — staghorn arms and brain-coral heaps (Tide's home)
 *   NE  kelp forest         — holdfast ridges and tall weed beds
 *   SE  black basalt        — the same arms and heaps, as lava dykes and columns (Ember's home)
 *   SW  pearl sandbar       — the forest's ridges, as shell bars and giant clams
 *
 * The centre is one crag: the old cross of three blocks, but with a ragged
 * shore, so the corridors wind a little instead of running on rulers.
 */
const mirror = (p: Pt): Pt => ({ x: MAP_SIZE - p.x, y: MAP_SIZE - p.y });
const turn = (poly: Pt[]): Pt[] => poly.map(mirror);
const P = (x: number, y: number): Pt => ({ x, y });
const rect = (x: number, y: number, w: number, h: number): Pt[] => [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)];

export const ISLAND_MIN = 100;
export const ISLAND_MAX = 900;
export const CORRIDOR_W = 300;

/** Where each island's whirlpool sits: on the inner shoulder, clear of the keep's guns. */
export const PORTAL_SPOTS: readonly Pt[] = [
  { x: 800, y: 800 },
  { x: MAP_SIZE - 800, y: 800 },
  { x: MAP_SIZE - 800, y: MAP_SIZE - 800 },
  { x: 800, y: MAP_SIZE - 800 },
];
export const PORTAL_RADIUS = 70;

export const HOMES: Record<Court, Pt> = {
  [BLUE]: { x: 240, y: 240 },
  [RED]: mirror({ x: 240, y: 240 }),
};
export const KEEPS: Record<Court, Pt> = {
  [BLUE]: { x: 430, y: 430 },
  [RED]: mirror({ x: 430, y: 430 }),
};

/** Solid sea: the frame. Painted as open water, and solid. */
export const PORTALS_SEA: Pt[][] = [
  rect(0, 0, MAP_SIZE, ISLAND_MIN),
  rect(0, MAP_SIZE - ISLAND_MIN, MAP_SIZE, ISLAND_MIN),
  rect(0, ISLAND_MIN, ISLAND_MIN, MAP_SIZE - 2 * ISLAND_MIN),
  rect(MAP_SIZE - ISLAND_MIN, ISLAND_MIN, ISLAND_MIN, MAP_SIZE - 2 * ISLAND_MIN),
];

const AVOID_SPAWNS = [...Object.values(HOMES), ...Object.values(KEEPS)].map(at => ({ at, r: 300 }));
const AVOID_PORTALS = PORTAL_SPOTS.map(at => ({ at, r: 230 }));
const AVOID = [...AVOID_SPAWNS, ...AVOID_PORTALS];

/** The shore of the frame: ragged, never reaching into a lane. */
const SHORE_HALF: Pt[][] = [
  ...band(P(ISLAND_MIN, ISLAND_MIN), P(MAP_SIZE - ISLAND_MIN, ISLAND_MIN), P(0, 1), { depth: 60, reach: [-12, 46], step: [80, 170], seed: 31, avoid: AVOID }),
  ...band(P(MAP_SIZE - ISLAND_MIN, ISLAND_MIN), P(MAP_SIZE - ISLAND_MIN, MAP_SIZE - ISLAND_MIN), P(-1, 0), { depth: 60, reach: [-12, 46], step: [80, 170], seed: 32, avoid: AVOID }),
];
// The south and west shores are the north and east ones turned half way round.
const SHORE: Pt[][] = [...SHORE_HALF, ...SHORE_HALF.map(turn)];

// ------------------------------------------------------------ the centre crag

/** The old cross, clockwise from its north-west corner; each vertex's inward diagonal says which way its inner edge moves. */
const A = 900;
const B = 400;
const C = 2300;
const D = 2800;
const CROSS: { at: Pt; in: Pt }[] = [
  { at: P(A, B), in: P(1, 1) },
  { at: P(C, B), in: P(-1, 1) },
  { at: P(C, A), in: P(-1, 1) },
  { at: P(D, A), in: P(-1, 1) },
  { at: P(D, C), in: P(-1, -1) },
  { at: P(C, C), in: P(-1, -1) },
  { at: P(C, D), in: P(-1, -1) },
  { at: P(A, D), in: P(1, -1) },
  { at: P(A, C), in: P(1, -1) },
  { at: P(B, C), in: P(1, -1) },
  { at: P(B, A), in: P(1, 1) },
  { at: P(A, A), in: P(1, 1) },
];
const CRAG_DEPTH = 110;
const CRAG: Pt[][] = (() => {
  const out: Pt[][] = [];
  // Half of the outline (six edges); the other half is its half-turn.
  CROSS.slice(0, 6).forEach((v, i) => {
    const w = CROSS[(i + 1) % CROSS.length];
    const q = (c: { at: Pt; in: Pt }): Pt => P(c.at.x + c.in.x * CRAG_DEPTH, c.at.y + c.in.y * CRAG_DEPTH);
    out.push(
      ...band(v.at, w.at, leftOf(v.at, w.at), { depth: CRAG_DEPTH, reach: [-52, 46], step: [90, 170], seed: 40 + i, avoid: AVOID_PORTALS, qa: q(v), qb: q(w) })
    );
  });
  out.push(...out.map(turn));
  return out;
})();
/** The inner body: the cross with its edge taken off, as two bars. Painted flat (style `core`), so no ruled line shows. */
const CRAG_CORE: Pt[][] = [rect(A + CRAG_DEPTH, B + CRAG_DEPTH, C - A - 2 * CRAG_DEPTH, D - B - 2 * CRAG_DEPTH), rect(B + CRAG_DEPTH, A + CRAG_DEPTH, D - B - 2 * CRAG_DEPTH, C - A - 2 * CRAG_DEPTH)];

// ------------------------------------------------------------ NW: the coral garden (and SE, turned)

/** Half of the garden: everything on the north-east side of the diagonal; the other half is its reflection. */
const GARDEN_HALF: { arms: Pt[][]; heaps: Pt[][] } = {
  arms: [
    // A staghorn arm with a twig.
    ...lumps([P(640, 440), P(700, 480), P(726, 540)], [54, 52, 42], 71, 0.5),
  ],
  heaps: [],
};
const GARDEN_ARMS: Pt[][] = [...GARDEN_HALF.arms, ...GARDEN_HALF.arms.map(swapXY)];
const GARDEN_HEAPS: Pt[][] = [...GARDEN_HALF.heaps, ...GARDEN_HALF.heaps.map(swapXY)];

// ------------------------------------------------------------ NE: the kelp forest (and SW, turned)

const FOREST_RIDGES: Pt[][] = [
  ...lumps([P(2480, 540), P(2552, 580), P(2640, 556), P(2720, 612), P(2782, 690)], [54, 58, 52, 46, 38], 81, 0.5),
];
const FOREST_HEAPS: Pt[][] = [
];
const FOREST_KELP: Pt[][] = [
  slab(2740, 330, 64, 34, 0.3, 91, 9, 0.1),
  slab(2740, 780, 84, 38, -0.4, 92, 9, 0.1),
  slab(2420, 740, 44, 28, 0.9, 93, 9, 0.1),
  slab(2700, 480, 46, 34, 0.2, 94, 9, 0.1),
  slab(2910, 840, 56, 30, 0.1, 95, 8, 0.1),
  slab(2380, 600, 34, 52, 0.0, 96, 9, 0.1),
  slab(3000, 640, 36, 64, 0.1, 97, 9, 0.1),
  slab(2860, 380, 60, 30, 0.5, 98, 9, 0.1),
];

// ------------------------------------------------------------ the corridors' own stacks

const STACKS: Pt[][] = [
  slab(1180, 168, 50, 30, 0.1, 101, 9, 0.1),
  slab(1900, 340, 54, 28, -0.1, 102, 9, 0.1),
  slab(3054, 1180, 24, 50, 0.1, 103, 9, 0.1),
  slab(3052, 2000, 24, 44, -0.1, 104, 9, 0.1),
];

/** Rock spires standing in the open rooms: real walls, so they are cover. Each has a half-turn twin. */
const SPIRES_HALF: Pt[][] = [
  // Only where the floor is wide: a spire must leave a big hero's body (52 px) on both sides.
  slab(700, 700, 24, 30, 0.5, 111, 8, 0.12),
  slab(2900, 250, 24, 18, 0.3, 112, 7, 0.14),
  slab(650, 2450, 20, 24, 0.2, 113, 7, 0.14),
];
const SPIRES: Pt[][] = [...SPIRES_HALF, ...SPIRES_HALF.map(turn)];

/** Every rock of the map, with the style it is painted in. The art and the walls both read this. */
export const PORTALS_ROCKS: RockSpec[] = [
  { style: 'reef', detail: 'none', parts: SHORE },
  { style: 'cliff', detail: 'none', parts: CRAG },
  { style: 'core', detail: 'none', parts: CRAG_CORE },
  { style: 'reef', detail: 'none', parts: [...STACKS, ...STACKS.map(p => turn(p))] },
  { style: 'cliff', detail: 'none', parts: SPIRES },
  // NW coral garden and its half-turn, the black basalt of SE.
  { style: 'coral', detail: 'coral', parts: GARDEN_ARMS },
  { style: 'coral', detail: 'coral', parts: GARDEN_HEAPS },
  { style: 'basalt', detail: 'none', parts: GARDEN_ARMS.map(turn) },
  { style: 'basalt', detail: 'none', parts: GARDEN_HEAPS.map(turn) },
  // NE kelp forest and its half-turn, the pearl sandbar of SW.
  { style: 'kelpwood', detail: 'none', parts: FOREST_RIDGES },
  { style: 'reef', detail: 'none', parts: FOREST_HEAPS },
  { style: 'pearl', detail: 'none', parts: FOREST_RIDGES.map(turn) },
  { style: 'pearl', detail: 'none', parts: FOREST_HEAPS.map(turn) },
];

/** Kelp on the two neutral islands, to hide in: a whole forest on one, weed beds on the other. */
export const KELP: Pt[][] = [...FOREST_KELP, ...FOREST_KELP.map(turn)];

/** Every wall of the map. */
export const WALLS: Pt[][] = [...PORTALS_SEA, ...PORTALS_ROCKS.flatMap(r => r.parts)];

/** Role of the one neutral slot: the arena object. */
export const PORTALS_ROLE = 'tidelight-portals';

/** Used by the art: the crag's outline, as the cross it grew from. */
export const CRAG_OUTLINE: { at: Pt; in: Pt }[] = CROSS;
export const CRAG_INSET = CRAG_DEPTH;
