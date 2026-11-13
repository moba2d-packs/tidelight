import type { Pt } from '../../world/layout';
import type { FloorPatch, RockSpec } from '../../world/art/reef';
import { arc, blob, hull, mirror, rng } from '../../world/art/shapes';

/**
 * Vòng Đấu Tay Đôi — "Đấu Trường Vỏ Sò", a giant clam amphitheatre. The arena
 * wall is a ring of coral terraces with a ragged inner edge; in the middle a
 * giant clam lies half open, and its shell blocks line of sight; kelp and tide
 * pools sit around it. Every piece is convex, and the whole thing is
 * point-symmetric.
 *
 * The picture is `./art.ts`, fed from `DUEL_ROCKS` here — the same polygons the
 * geometry is made of.
 */
export const DUEL_SIZE = 1600;
export const DUEL_ROLE = 'tidelight-duel';
export const DUEL_MAP_ID = 'duel';
/** Spawn courts face each other across the clam. */
export const DUEL_SPAWNS = { blue: { x: 330, y: 800 }, red: { x: DUEL_SIZE - 330, y: 800 } } as const;

const S = DUEL_SIZE;
const C = S / 2;
const FRAME = 200;
const CUT = 520;
const P = (x: number, y: number): Pt => ({ x, y });

const rect = (x: number, y: number, w: number, h: number): Pt[] => [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)];

const CORNER_TL: Pt[] = [P(FRAME, FRAME), P(CUT, FRAME), P(FRAME, CUT)];
const CORNER_TR: Pt[] = [P(S - CUT, FRAME), P(S - FRAME, FRAME), P(S - FRAME, CUT)];

/**
 * The open sea round the arena, corners included: solid, and painted as deep
 * water. The terrace ring is laid over the part of it nearest the arena.
 */
export const DUEL_SEA: Pt[][] = [
  rect(0, 0, S, FRAME),
  rect(0, S - FRAME, S, FRAME),
  rect(0, FRAME, FRAME, S - 2 * FRAME),
  rect(S - FRAME, FRAME, FRAME, S - 2 * FRAME),
  CORNER_TL,
  mirror(S, CORNER_TL),
  CORNER_TR,
  mirror(S, CORNER_TR),
];

// ------------------------------------------------------------ the terrace ring

const SECTORS = 28;
const OUTER = 700;
/** How far a spawn pad (r 90 at 270 from the wall) needs the ring to stay out: the x axis. */
const REACH = 600;

/**
 * Inner radius of the ring, per sector. Full reach on the spawn axis, deep
 * bites above and below the clam: the first half is drawn at random and the
 * second half is its point-mirror, so both courts fight in the same arena.
 */
const innerRadii = (): number[] => {
  const r = rng(11);
  const half: number[] = [];
  for (let k = 0; k < SECTORS / 2; k++) {
    const theta = ((k + 0.5) / SECTORS) * Math.PI * 2;
    const across = Math.sin(theta) ** 2; // 0 on the spawn axis, 1 on the clam's axis
    half.push(Math.round(REACH - 6 - r() * 14 - across * (50 + r() * 100)));
  }
  return [...half, ...half];
};
export const TERRACE_INNER = innerRadii();

const ringPoint = (k: number, radius: number): Pt => {
  const a = (k / SECTORS) * Math.PI * 2;
  return P(Math.round(C + Math.cos(a) * radius), Math.round(C + Math.sin(a) * radius));
};

/**
 * The terrace ring: a quad per sector, hulled so it is convex whatever the radii
 * do. Half the ring is built and the other half is its point-mirror, literally,
 * so no rounding can make the two courts' arenas differ.
 */
const RING_HALF: Pt[][] = Array.from({ length: SECTORS / 2 }, (_, k) => {
  const k1 = k + 1;
  return hull([ringPoint(k, TERRACE_INNER[k]), ringPoint(k1, TERRACE_INNER[k1]), ringPoint(k1, OUTER), ringPoint(k, OUTER)]);
});
const RING: Pt[][] = [...RING_HALF, ...RING_HALF.map(poly => mirror(S, poly))];

// ------------------------------------------------------------ the clam

/** Hinge of the giant clam: both valves fan out from here. */
export const CLAM = P(C, C);
/** The lower valve is a half-disc under the hinge line; the upper is its point-mirror, so the pair is symmetric. The two overlap by 26 so there is no slit. */
const CLAM_R = 145;
const LOWER = hull(arc(C, C - 13, CLAM_R, 0, Math.PI, 10));
const UPPER = mirror(S, LOWER);

export const DUEL_ROCKS: RockSpec[] = [
  { style: 'terrace', detail: 'none', parts: RING },
  { style: 'shell', detail: 'none', lift: 6, parts: [LOWER] },
  { style: 'shell', detail: 'none', lift: 24, parts: [UPPER] },
];

export const DUEL_WALLS: Pt[][] = [...DUEL_SEA, ...DUEL_ROCKS.flatMap(r => r.parts)];

// ------------------------------------------------------------ cover and ground

const KELP_NW = blob(620, 640, 60, 52, 31);
const KELP_NE = blob(980, 640, 60, 52, 32);
const KELP_N = blob(C, 470, 84, 40, 33);
export const DUEL_KELP: Pt[][] = [KELP_NW, mirror(S, KELP_NW), KELP_NE, mirror(S, KELP_NE), KELP_N, mirror(S, KELP_N)];

const POOL_A = blob(520, 1010, 74, 46, 41, 10, 0.12);
const POOL_B = blob(1150, 560, 58, 40, 42, 10, 0.12);
const POOL_C = blob(C, 1060, 70, 34, 43, 10, 0.12);
/** Tide pools: shallow ground, painted as water but walked straight through. */
export const DUEL_POOLS: FloorPatch[] = [POOL_A, mirror(S, POOL_A), POOL_B, mirror(S, POOL_B), POOL_C, mirror(S, POOL_C)].map(points => ({
  kind: 'pool' as const,
  points,
}));
