import type { RockSpec } from '../../world/art/reef';
import { arc, blob, hull, mirror, ribbon, rng } from '../../world/art/shapes';

/**
 * Bóng Đá Rạn San Hô — every coordinate of the pitch, in one place.
 *
 * Plain data, no engine: `geometry.ts` turns it into walls, `rules.ts` bounces
 * the ball on it and `pitch.ts` paints it, so the picture, the collision the
 * champions feel and the collision the ball feels cannot drift apart.
 *
 * The pitch is a tide-pool sandbar. Its two goals are the open jaws of a whale:
 * the mouth is the goal, the rami curve away from it like an arch of bone, and
 * the skull is the back of the net. Boulders and coral heads ring the touchlines.
 * The ball bounces on the PITCH rectangle (`rules.ts`), so every wall edge that
 * faces the pitch lies exactly on it; only the far sides of the walls are shaped.
 *
 * Blue (the Tide Court) defends the LEFT goal and attacks to the right.
 */
export interface Pt {
  x: number;
  y: number;
}

export const BALL_MAP_ID = 'ball';
export const BALL_ROLE = 'pearl-ball';
export const MAP_SIZE = 2400;

export const BLUE = 'team-blue';
export const RED = 'team-red';
export type Side = typeof BLUE | typeof RED;

/** Inner edge of the touchlines and goal lines (the walkable pitch). */
export const PITCH = { left: 300, right: 2100, top: 800, bottom: 1600 } as const;
export const CY = (PITCH.top + PITCH.bottom) / 2;
export const CENTRE: Pt = { x: (PITCH.left + PITCH.right) / 2, y: CY };

/** Half the goal mouth, and how deep the net pocket behind the line is. */
export const GOAL_HALF = 150;
export const POCKET = 140;

/** Where each side's fountain stands, and the centre of the goal it defends. */
export const SPAWNS: Record<Side, Pt> = {
  [BLUE]: { x: 520, y: CY },
  [RED]: { x: MAP_SIZE - 520, y: CY },
};
export const GOAL_CENTRE: Record<Side, Pt> = {
  [BLUE]: { x: PITCH.left, y: CY },
  [RED]: { x: PITCH.right, y: CY },
};

const P = (x: number, y: number): Pt => ({ x, y });
const rect = (x: number, y: number, w: number, h: number): Pt[] => [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)];

const MOUTH_TOP = CY - GOAL_HALF;
const MOUTH_BOTTOM = CY + GOAL_HALF;
const BACK_X = PITCH.left - POCKET;

/**
 * The deep water round the sandbar: solid, and where the bones lie. These eight
 * rectangles are exactly the old walls, so the walkable ground (pitch plus the two
 * net pockets) is unchanged.
 */
export const BALL_SEA: Pt[][] = [
  rect(0, 0, MAP_SIZE, PITCH.top),
  rect(0, PITCH.bottom, MAP_SIZE, MAP_SIZE - PITCH.bottom),
  rect(0, PITCH.top, PITCH.left, MOUTH_TOP - PITCH.top),
  rect(0, MOUTH_BOTTOM, PITCH.left, PITCH.bottom - MOUTH_BOTTOM),
  rect(0, MOUTH_TOP, BACK_X, MOUTH_BOTTOM - MOUTH_TOP),
  rect(PITCH.right, PITCH.top, MAP_SIZE - PITCH.right, MOUTH_TOP - PITCH.top),
  rect(PITCH.right, MOUTH_BOTTOM, MAP_SIZE - PITCH.right, PITCH.bottom - MOUTH_BOTTOM),
  rect(PITCH.right + POCKET, MOUTH_TOP, MAP_SIZE - PITCH.right - POCKET, MOUTH_BOTTOM - MOUTH_TOP),
];

// ------------------------------------------------------------ the whale jaw (left goal; the right is its point-mirror)

/**
 * The upper ramus: a bone that starts as a post at the mouth's upper corner (its
 * inner edge lies on the mouth line, y = MOUTH_TOP) and sweeps back and up into
 * the corner like one half of an arch. The lower ramus is its mirror in y.
 */
const RAMUS_PATH: Pt[] = [P(295, 1021), P(236, 1019), P(176, 1008), P(118, 982), P(70, 940), P(38, 886), P(24, 826), P(22, 790)];
const RAMUS_W = [58, 60, 64, 66, 60, 50, 38, 24];
const RAMUS_UP = ribbon(RAMUS_PATH, RAMUS_W);
const flipAcross = (poly: Pt[]): Pt[] => poly.map(p => P(p.x, 2 * CY - p.y)).reverse();
const RAMUS_DOWN = RAMUS_UP.map(flipAcross);

/** The post at each mouth corner: a tooth of bone, flush with the goal line and the mouth line. */
const POST_UP = hull(arc(268, 1018, 31, 0, Math.PI * 2, 12).map(p => P(Math.min(p.x, PITCH.left - 1), Math.min(p.y, MOUTH_TOP))));
const POST_DOWN = flipAcross(POST_UP);

/** The skull: the back of the net, a rounded block whose face on the pocket is the line x = BACK_X. */
const SKULL = hull([P(BACK_X, MOUTH_TOP), P(BACK_X, MOUTH_BOTTOM), P(112, MOUTH_BOTTOM + 52), P(40, MOUTH_BOTTOM + 30), P(0, CY + 100), P(0, CY - 100), P(40, MOUTH_TOP - 30), P(112, MOUTH_TOP - 52)]);

const JAW_LEFT: Pt[][] = [...RAMUS_UP, ...RAMUS_DOWN, POST_UP, POST_DOWN, SKULL];

// ------------------------------------------------------------ the rim: boulders and coral heads on the long sides

/** A dome whose flat face lies on the touchline (y = PITCH.top) and whose far side is a lumpy half-ellipse. */
const dome = (cx: number, w: number, h: number): Pt[] =>
  hull(arc(cx, PITCH.top, w, Math.PI, Math.PI * 2, 8).map(p => P(p.x, PITCH.top - ((PITCH.top - p.y) / w) * h)));

const rimTop = (): Pt[][] => {
  const r = rng(5);
  const out: Pt[][] = [];
  for (let x = PITCH.left + 20; x < PITCH.right - 40; x += 70 + Math.floor(r() * 50)) {
    const big = r() < 0.28;
    out.push(dome(x, big ? 92 + r() * 40 : 56 + r() * 30, big ? 120 + r() * 70 : 40 + r() * 44));
  }
  return out;
};
const RIM_TOP = rimTop();
const RIM_BOTTOM = RIM_TOP.map(p => mirror(MAP_SIZE, p));

export const BALL_ROCKS: RockSpec[] = [
  { style: 'bone', detail: 'none', lift: 12, parts: [...JAW_LEFT, ...JAW_LEFT.map(p => mirror(MAP_SIZE, p))] },
  { style: 'boulder', detail: 'coral', parts: [...RIM_TOP, ...RIM_BOTTOM] },
];

/** The walls: what the champions collide with, and what `art.ts` paints. */
export const WALLS: Pt[][] = [...BALL_SEA, ...BALL_ROCKS.flatMap(r => r.parts)];

// ------------------------------------------------------------ cover and ground

const kelpBeds: Pt[][] = [blob(700, 950, 78, 52, 61), blob(980, 1480, 72, 50, 62), blob(1120, 1010, 62, 44, 63)];
/** Kelp beds (brush): three on one half and their point-mirrors, so neither goal has the better hiding place. */
export const BALL_KELP: Pt[][] = [...kelpBeds, ...kelpBeds.map(k => mirror(MAP_SIZE, k))];

/** Rock pools: still water in the sand, walked straight through. Painted with a rim of stones. */
const poolSeeds = [blob(760, 1470, 80, 46, 71, 10, 0.12), blob(860, 1230, 54, 34, 72, 10, 0.12), blob(900, 900, 48, 30, 73, 10, 0.12)];
export const BALL_POOLS: Pt[][] = [...poolSeeds, ...poolSeeds.map(k => mirror(MAP_SIZE, k))];
