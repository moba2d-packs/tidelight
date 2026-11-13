import { BLUE, MAP_SIZE, RED, type Court, type Pt } from '../../world/layout';
import type { FloorPatch, RockSpec } from '../../world/art/reef';
import { blob, mirror as mirrorPoly, rng } from '../../world/art/shapes';

/**
 * Cầu Sập — a 3200 x 1600 band (the rest is solid sea) split down the middle
 * by a deep canyon with three bridges across it, each of a different
 * material: a coral arch (north), a rope-and-plank walk (middle) and a whale's
 * rib-cage (south). The canyon is a cascade: water pours in over the cliff at
 * the north end and drops over two ledges on its way south.
 * Point-symmetric: bridge 0 (north) <-> bridge 2 (south), bridge 1 is the middle.
 *
 * Gameplay truth stays rectangular where it matters: each span is the
 * axis-aligned rect `bridgeSpan(i)` (the `DynamicWall` and the nav blocker),
 * the canyon walls meet those rects edge to edge, and everything organic (cliff
 * lumps, shore rocks, coral heaps) is convex pieces from `world/art/shapes`.
 * `./art.ts` paints these very lists, so picture and walls cannot disagree.
 */
const mirror = (p: Pt): Pt => ({ x: MAP_SIZE - p.x, y: MAP_SIZE - p.y });
const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
const flip = (polys: Pt[][]): Pt[][] => polys.map(p => mirrorPoly(MAP_SIZE, p));

export const BAND_TOP = 800;
export const BAND_BOTTOM = MAP_SIZE - BAND_TOP;
/** The sea frame: solid, and the cliff lumps are laid over its inner edge. */
export const SEA_EDGE = 700;
export const CHANNEL_X0 = 1450;
export const CHANNEL_X1 = 1750;
export const CHANNEL_MID_X = (CHANNEL_X0 + CHANNEL_X1) / 2;
export const BRIDGE_HALF_H = 110;
export const BRIDGE_Y: readonly number[] = [1000, 1600, 2200];
export const BRIDGE_NAMES: readonly string[] = ['Cầu Bắc', 'Cầu Giữa', 'Cầu Nam'];
/** What each bridge is made of: drives both its picture and its collapsed look. */
export type BridgeKind = 'coral' | 'rope' | 'bone';
export const BRIDGE_KINDS: readonly BridgeKind[] = ['coral', 'rope', 'bone'];
/** Ledges the canyon water drops over, between the bridges (y of the lip). */
export const LEDGES: readonly number[] = [1300, 1900];

export interface Span {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export const bridgeSpan = (i: number): Span => ({
  x0: CHANNEL_X0,
  x1: CHANNEL_X1,
  y0: BRIDGE_Y[i] - BRIDGE_HALF_H,
  y1: BRIDGE_Y[i] + BRIDGE_HALF_H,
});

export const HOMES: Record<Court, Pt> = {
  [BLUE]: { x: 300, y: 1600 },
  [RED]: mirror({ x: 300, y: 1600 }),
};
export const KEEPS: Record<Court, Pt> = {
  [BLUE]: { x: 90, y: 1600 },
  [RED]: mirror({ x: 90, y: 1600 }),
};
export const WARDENS: Record<Court, Pt> = {
  [BLUE]: { x: 1250, y: 1180 },
  [RED]: mirror({ x: 1250, y: 1180 }),
};

/**
 * The canyon's water between the bridges (the gaps themselves are the bridges):
 * solid, painted as deep water. Its top and bottom reach into the sea frame.
 */
const channelWater = (): Pt[][] => {
  const cuts = [SEA_EDGE, ...BRIDGE_Y.flatMap((_, i) => [bridgeSpan(i).y0, bridgeSpan(i).y1]), MAP_SIZE - SEA_EDGE];
  const out: Pt[][] = [];
  for (let i = 0; i < cuts.length; i += 2) out.push(rect(CHANNEL_X0, cuts[i], CHANNEL_X1 - CHANNEL_X0, cuts[i + 1] - cuts[i]));
  return out;
};

export const BRIDGE_SEA: Pt[][] = [rect(0, 0, MAP_SIZE, SEA_EDGE), rect(0, MAP_SIZE - SEA_EDGE, MAP_SIZE, SEA_EDGE), ...channelWater()];

// ------------------------------------------------------------ the rocks

/** The north cliff: a row of overlapping lumps, so the shoreline scallops instead of running straight. */
const CLIFF_N: Pt[][] = (() => {
  const r = rng(5);
  const out: Pt[][] = [];
  for (let cx = 0; cx <= MAP_SIZE + 80; cx += 160) out.push(blob(cx, 735, 120, 100 + r() * 30, cx + 3, 10, 0.1));
  return out;
})();

/**
 * Shore rocks along the canyon walls between the bridges (north half; the south
 * is its point-mirror). Each pokes a little way into the water: a rocky shore.
 */
const SHORE_N: Pt[][] = (() => {
  const r = rng(9);
  const out: Pt[][] = [];
  // The fall's cap (y 700-890) and the stretch down to the middle bridge (y 1110-1490); each lump
  // is kept clear of the spans, whose edges the water meets exactly.
  for (const [y, ry] of [[760, 44], [815, 40], [1205, 50], [1310, 54], [1415, 50]] as const) {
    out.push(blob(1440, y, 34, ry + r() * 4, y + 1, 9, 0.1));
    out.push(blob(1760, y + (r() < 0.5 ? -5 : 5), 34, ry + r() * 4, y + 2, 9, 0.1));
  }
  return out;
})();

const HEAPS_WEST: Pt[][] = [blob(775, 1280, 82, 66, 21, 10, 0.16), blob(775, 1920, 82, 66, 22, 10, 0.16), blob(1065, 1600, 52, 160, 23, 12, 0.1)];

export const BRIDGE_ROCKS: RockSpec[] = [
  { style: 'reef', detail: 'none', parts: [...CLIFF_N, ...flip(CLIFF_N)] },
  { style: 'terrace', detail: 'none', lift: 7, parts: [...SHORE_N, ...flip(SHORE_N)] },
  { style: 'coral', detail: 'coral', parts: [...HEAPS_WEST, ...flip(HEAPS_WEST)] },
];

export const WALLS: Pt[][] = [...BRIDGE_SEA, ...BRIDGE_ROCKS.flatMap(r => r.parts)];

const KELP_W = blob(600, 940, 110, 52, 31, 9, 0.12);
export const KELP: Pt[][] = [KELP_W, mirrorPoly(MAP_SIZE, KELP_W)];

/** Walkable ground art: dry sand at the docks, wet sand where each bridge lands. */
const SAND_W: Pt[][] = [blob(300, 1600, 170, 130, 51, 10, 0.15), blob(1350, 1000, 95, 70, 52, 9, 0.15), blob(1350, 1600, 95, 70, 53, 9, 0.15), blob(1350, 2200, 95, 70, 54, 9, 0.15)];
export const BRIDGE_FLOOR: FloorPatch[] = [
  ...SAND_W.map(points => ({ kind: 'sand' as const, points })),
  ...flip(SAND_W).map(points => ({ kind: 'sand' as const, points })),
  ...[blob(900, 1650, 70, 42, 61, 10, 0.12), blob(1180, 1950, 56, 36, 62, 10, 0.12)].flatMap(p => [
    { kind: 'pool' as const, points: p },
    { kind: 'pool' as const, points: mirrorPoly(MAP_SIZE, p) },
  ]),
];

/** Role of the one neutral slot: the arena object. */
export const BRIDGE_ROLE = 'tidelight-bridge';
