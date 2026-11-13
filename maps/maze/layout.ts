import { BLUE, KEEP_STATS, RED, type Court, type Pt } from '../../world/layout';
import type { RockSpec } from '../../world/art/reef';
import { blob, flipX, flipY, mirror, ribbon } from '../../world/art/shapes';

/**
 * Mê Cung Rong — "Nghĩa Địa Tàu Đắm", a shipwreck graveyard. One straight lane
 * runs between the docks; on both sides of it the walls are what a drowned fleet
 * left: ship's ribs, broken keels, and coral heaps grown over them. Kelp fills
 * the dead ends and the passages between the wrecks, so the lane is where waves
 * walk and the kelp is where fights start. In the middle, a capsized galleon lies
 * along the lane and the lane runs *through* its hull.
 *
 * Every wall piece is convex (core's collision wants that): a rib is a chain of
 * quads (`ribbon`), a heap is a hull of lumps (`blob`). The map is built from its
 * north-west quarter, mirrored across both axes, so it is point-symmetric (and
 * more) by construction.
 *
 * The picture is `./art.ts`, fed from `MAZE_ROCKS` here: the same polygons, so
 * the art cannot disagree with the walls.
 */
export const MAZE_SIZE = 2400;
export const MAZE_MAP_ID = 'maze';
export const MAZE_ROLE = 'tidelight-maze';
export const LANE_Y = MAZE_SIZE / 2;

const S = MAZE_SIZE;
const FRAME = 100;
const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

/** The outer sea. Painted as open water, and solid. */
export const MAZE_SEA: Pt[][] = [
  rect(0, 0, S, FRAME),
  rect(0, S - FRAME, S, FRAME),
  rect(0, FRAME, FRAME, S - 2 * FRAME),
  rect(S - FRAME, FRAME, FRAME, S - 2 * FRAME),
];

const P = (x: number, y: number): Pt => ({ x, y });

// ------------------------------------------------------------ the north-west quarter

const rib = (x: number, y: number): Pt[][] =>
  ribbon([P(x, y), P(x + 28, y - 10), P(x + 60, y - 6), P(x + 86, y + 16), P(x + 100, y + 46)], [26, 22, 18, 14, 10]);

// No wreck walls the lane any more, and the lone coral heaps in the open
// quarters are gone: a 40px body (core's terrain cap) could not pass the
// warden, and the hull's mouth left a 43px half-width. See tests/extraMaps.
const NW_ROCKS: RockSpec[] = [
  // A ship's spine and three ribs standing out of it, east.
  {
    style: 'wood',
    detail: 'planks',
    parts: [
      ...ribbon([P(592, 96), P(586, 260), P(598, 420), P(590, 560), P(596, 700)], [54, 48, 46, 50, 44]),
      ...rib(612, 240),
      ...rib(610, 380),
      ...rib(612, 506),
    ],
  },
  // A hull bottom, keel up, over the kelp pocket.
  {
    style: 'wood',
    detail: 'planks',
    parts: ribbon([P(566, 902), P(640, 880), P(720, 868), P(810, 874), P(880, 892), P(922, 908)], [58, 56, 54, 54, 52, 44]),
  },
  // A fallen mast.
  { style: 'wood', detail: 'planks', parts: ribbon([P(830, 296), P(826, 420), P(836, 560), P(832, 706)], [58, 54, 52, 46]) },
  // Coral heaps grown over the wrecks.
  {
    style: 'coral',
    detail: 'coral',
    parts: [blob(1030, 130, 48, 54, 1), blob(1036, 262, 42, 66, 2), blob(1030, 396, 38, 70, 3), blob(1034, 500, 34, 40, 4)],
  },
  { style: 'coral', detail: 'coral', parts: [blob(1046, 810, 40, 118, 5)] },
  { style: 'coral', detail: 'coral', parts: [blob(230, 520, 62, 90, 6), blob(250, 440, 46, 52, 16)] },
  // The shore: lumps of reef along the sea wall, so the edge of the world is not a ruler.
  {
    style: 'reef',
    detail: 'sprigs',
    parts: [
      ...[150, 270, 390, 510, 630, 750, 870, 990, 1110, 1200].map((x, i) =>
        blob(x + ((i * 37) % 31), 96, 66 + ((i * 29) % 26), 28 + ((i * 17) % 20), 20 + i)
      ),
      ...[200, 320, 440, 560, 680, 800, 920].map((y, i) => blob(96, y + ((i * 41) % 29), 28 + ((i * 13) % 18), 62 + ((i * 23) % 24), 40 + i)),
    ],
  },
];

/** Kelp between the wrecks: dead ends, pockets and the flank of the lane. */
const NW_KELP: Pt[][] = [
  blob(935, 495, 50, 160, 11, 10, 0.08),
  blob(708, 660, 76, 58, 12),
  blob(842, 985, 126, 40, 13),
  blob(1205, 775, 90, 50, 14),
  blob(470, 985, 80, 54, 15),
];

// ------------------------------------------------------------ the galleon

/** The capsized galleon at the centre. Its hull lies along the lane; the lane passes through it. */
const HULL = { x0: 960, x1: 1440, rise: 125, y: 1090 };
const hullPath = (): { path: Pt[]; width: number[] } => {
  const path: Pt[] = [];
  const width: number[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = Math.sin(Math.PI * t);
    path.push(P(Math.round(HULL.x0 + (HULL.x1 - HULL.x0) * t), Math.round(HULL.y - HULL.rise * Math.pow(s, 0.9))));
    width.push(Math.round(34 + 26 * s));
  }
  // Mirror the west half onto the east exactly, so rounding cannot break the symmetry.
  for (let i = 0; i < n / 2; i++) {
    path[n - i] = P(S - path[i].x, path[i].y);
    width[n - i] = width[i];
  }
  return { path, width };
};
const HULL_PATH = hullPath();

const galleonNorth = (): Pt[][] => {
  const { path, width } = HULL_PATH;
  const at = (t: number): { p: Pt; w: number } => {
    const i = Math.round(t * (path.length - 1));
    return { p: path[i], w: width[i] };
  };
  const parts = ribbon(path, width);
  // Ribs standing out of the outer side, and stubs reaching in over the lane.
  for (const t of [0.21, 0.5, 0.79]) {
    const { p, w } = at(t);
    const o = P(p.x, p.y - w / 2 + 4);
    const dir = t < 0.5 ? -1 : t > 0.5 ? 1 : 0;
    parts.push(...ribbon([o, P(o.x + dir * 6, o.y - 22), P(o.x + dir * 4, o.y - 46), P(o.x - dir * 10, o.y - 66)], [24, 20, 14, 8]));
  }
  for (const t of [0.36, 0.64]) {
    const { p, w } = at(t);
    const o = P(p.x, p.y + w / 2 - 4);
    const dir = t < 0.5 ? 1 : -1;
    parts.push(...ribbon([o, P(o.x, o.y + 20), P(o.x + dir * 8, o.y + 38), P(o.x + dir * 22, o.y + 52)], [22, 18, 13, 8]));
  }
  return parts;
};

const fourFold = (rocks: RockSpec[]): RockSpec[] => {
  const out: RockSpec[] = [];
  for (const r of rocks) {
    out.push(r);
    const fy = { ...r, parts: r.parts.map(p => flipY(S, p)) };
    out.push(fy);
    out.push({ ...r, parts: r.parts.map(p => flipX(S, p)) });
    out.push({ ...fy, parts: fy.parts.map(p => flipX(S, p)) });
  }
  return out;
};

const GALLEON_N = galleonNorth();
/** The galleon: north gunwale and its mirror in the lane's axis, as one rock. */
const GALLEON: RockSpec = {
  style: 'wood',
  detail: 'planks',
  parts: [...GALLEON_N, ...GALLEON_N.map(p => flipY(S, p))],
};

/** Every rock of the map, with the style it is painted in. The art and the walls both read this. */
export const MAZE_ROCKS: RockSpec[] = [...fourFold(NW_ROCKS), GALLEON];
export const MAZE_KELP: Pt[][] = [
  ...NW_KELP,
  ...NW_KELP.map(p => flipY(S, p)),
  ...NW_KELP.map(p => flipX(S, p)),
  ...NW_KELP.map(p => mirror(S, p)),
];
export const MAZE_WALLS: Pt[][] = [...MAZE_SEA, ...MAZE_ROCKS.flatMap(r => r.parts)];

/** Where the galleon's hull interior is: used by the art to lay its deck under the lane. */
export const HULL_X0 = HULL.x0;
export const HULL_X1 = HULL.x1;
/** The north gunwale's centre line at world `x`; the south one is its mirror in the lane. */
export const gunwaleY = (x: number): number => {
  const t = Math.min(1, Math.max(0, (x - HULL.x0) / (HULL.x1 - HULL.x0)));
  return HULL.y - HULL.rise * Math.pow(Math.sin(Math.PI * t), 0.9);
};

export const MAZE_BASES: Record<Court, Pt> = {
  [BLUE]: { x: 340, y: LANE_Y },
  [RED]: { x: MAZE_SIZE - 340, y: LANE_Y },
};
/** One warden per side, at the mouth of the lane corridor. */
export const MAZE_WARDENS: Record<Court, Pt> = {
  [BLUE]: { x: 680, y: LANE_Y },
  [RED]: { x: MAZE_SIZE - 680, y: LANE_Y },
};
/** One keep per side, behind the dock. Shorter reach than the big map's: the maze is small. */
export const MAZE_KEEPS: Record<Court, Pt> = {
  [BLUE]: { x: 190, y: LANE_Y },
  [RED]: { x: MAZE_SIZE - 190, y: LANE_Y },
};
export const MAZE_KEEP_STATS = { ...KEEP_STATS, attackRange: 380, rebuildTime: 3_600_000 } as const;
export const MAZE_WARDEN_STATS = { rebuildTime: 3_600_000 } as const;
