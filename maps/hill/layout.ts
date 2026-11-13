import type { Pt } from '../../world/layout';
import type { RockSpec } from '../../world/art/reef';
import { arc, blob, hull, mirror, ribbon, rng } from '../../world/art/shapes';

/**
 * Vua Đảo (Island King) — every coordinate, plain data.
 *
 * An atoll, 2400 square. A reef ring (a chain of coral-and-sand sectors with six
 * breaks: two wide channels where the courts come in, four narrow ones to the
 * coves) closes round a lagoon, and in the lagoon stand three ruins, one for each
 * capture ring: the lighthouse at the heart of the atoll (its tower still stands,
 * its gallery wall is broken and its lamp shaft lies toppled across the sand), a
 * gatehouse at the north and its twin at the south. A wrecked hull and a kelp bed
 * on each flank are the cover. Every wall is convex and the whole map is
 * point-symmetric, built from one half and its mirror.
 *
 * The picture is `./art.ts`, fed from `HILL_ROCKS` here: the same polygons.
 */
export const HILL_MAP_SIZE = 2400;
export const HILL_ROLE = 'tidelight-hill';
export const HILL_MAP_ID = 'hill';

export const HILL_BAND_TOP = 360;
export const HILL_BAND_BOTTOM = HILL_MAP_SIZE - HILL_BAND_TOP;
export const HILL_MID_Y = HILL_MAP_SIZE / 2;

/** Capture rings, in schedule order: the first zone of a match is index 0 (centre). */
export const HILL_ISLANDS: readonly Pt[] = [
  { x: 1200, y: 1200 },
  { x: 1200, y: 700 },
  { x: 1200, y: 1700 },
];
export const HILL_ROCK_RADIUS = 64;

export const HILL_BASES = {
  blue: { x: 260, y: HILL_MID_Y },
  red: { x: HILL_MAP_SIZE - 260, y: HILL_MID_Y },
} as const;
export const HILL_TURRETS = {
  blue: { x: 640, y: 1110 },
  red: { x: HILL_MAP_SIZE - 640, y: 1290 },
} as const;

/** Heal pickups: four in the coves outside the ring, two in the lagoon. */
export const HILL_PEARLS: readonly Pt[] = [
  { x: 460, y: 560 },
  { x: 460, y: 1840 },
  { x: 900, y: 1200 },
  { x: 1500, y: 1200 },
  { x: 1940, y: 560 },
  { x: 1940, y: 1840 },
];

const S = HILL_MAP_SIZE;
const C = S / 2;
const P = (x: number, y: number): Pt => ({ x, y });
const rect = (x: number, y: number, w: number, h: number): Pt[] => [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)];
const deg = (d: number): number => (d * Math.PI) / 180;
const polar = (c: Pt, r: number, d: number): Pt => P(Math.round(c.x + Math.cos(deg(d)) * r), Math.round(c.y + Math.sin(deg(d)) * r));

export const hexRock = (c: Pt, r: number): Pt[] =>
  Array.from({ length: 6 }, (_, i) => ({
    x: Math.round(c.x + Math.cos((i / 6) * Math.PI * 2) * r),
    y: Math.round(c.y + Math.sin((i / 6) * Math.PI * 2) * r),
  }));
const octagon = (c: Pt, r: number, spin = 22.5): Pt[] => Array.from({ length: 8 }, (_, i) => polar(c, r, spin + i * 45));

// ------------------------------------------------------------ the open sea above and below

/** Deep water north and south of the atoll: solid, painted as open sea. */
export const HILL_SEA: Pt[][] = [rect(0, 0, S, HILL_BAND_TOP - 40), rect(0, HILL_BAND_BOTTOM + 40, S, HILL_BAND_TOP - 40)];

/** A reef fringe on the sea's edge: lumpy domes standing on the band, the southern one is the northern one's mirror. */
const fringeTop = (): Pt[][] => {
  const r = rng(17);
  const out: Pt[][] = [];
  for (let x = 40; x < S; x += 90 + Math.floor(r() * 70)) {
    const w = 60 + r() * 50;
    const h = 38 + r() * 40;
    out.push(hull(arc(x, HILL_BAND_TOP - 40, w, 0, Math.PI, 8).map(p => P(p.x, HILL_BAND_TOP - 40 + ((p.y - (HILL_BAND_TOP - 40)) / w) * h))));
  }
  return out;
};
const FRINGE_TOP = fringeTop();
const FRINGE = [...FRINGE_TOP, ...FRINGE_TOP.map(p => mirror(S, p))];

// ------------------------------------------------------------ the reef ring

export const RING_RX = 800;
export const RING_RY = 830;
const SECTORS = 72;
/** Sectors of the half-ring left open (5 degrees each); their point-mirrors are the other half's breaks. 0-3 and 32-35 are the two channels (40 degrees wide), 8-9 and 26-27 the coves. */
const BREAK_HALF = new Set([0, 1, 2, 3, 32, 33, 34, 35, 8, 9, 26, 27]);

const ringPoint = (deg_: number, off: number): Pt =>
  P(Math.round(C + (RING_RX + off) * Math.cos(deg(deg_))), Math.round(C + (RING_RY + off) * Math.sin(deg(deg_))));

const ringJitter = (): { inner: number[]; outer: number[] } => {
  const r = rng(23);
  const inner = Array.from({ length: SECTORS / 2 + 1 }, () => -44 + Math.round((r() - 0.5) * 44));
  const outer = Array.from({ length: SECTORS / 2 + 1 }, () => 46 + Math.round((r() - 0.5) * 70));
  inner[SECTORS / 2] = inner[0];
  outer[SECTORS / 2] = outer[0];
  return { inner, outer };
};
const JITTER = ringJitter();

/** One quad per sector, hulled so it is convex whatever the radii do. */
const RING_HALF: Pt[][] = Array.from({ length: SECTORS / 2 }, (_, k) => {
  if (BREAK_HALF.has(k)) return [];
  const a0 = k * (360 / SECTORS);
  const a1 = (k + 1) * (360 / SECTORS);
  return hull([ringPoint(a0, JITTER.inner[k]), ringPoint(a1, JITTER.inner[k + 1]), ringPoint(a1, JITTER.outer[k + 1]), ringPoint(a0, JITTER.outer[k])]);
}).filter(p => p.length > 0);
const RING: Pt[][] = [...RING_HALF, ...RING_HALF.map(p => mirror(S, p))];
/** Which sectors (0..35) stand, for the art's foam line. */
export const RING_STANDS: boolean[] = Array.from({ length: SECTORS }, (_, k) => !BREAK_HALF.has(k % (SECTORS / 2)));

// ------------------------------------------------------------ the three ruins

const LIGHT = HILL_ISLANDS[0];
const NORTH = HILL_ISLANDS[1];

/** The tower's footing: an octagon, taller than the old hex rock was wide. */
const TOWER: Pt[] = octagon(LIGHT, 70);

/** What is left of the gallery wall: four broken arcs round the tower, with gaps where the lanes come through. */
const arcWall = (c: Pt, from: number, to: number, r: number, w: number): Pt[][] => {
  const n = Math.max(2, Math.round((to - from) / 11));
  return ribbon(Array.from({ length: n + 1 }, (_, i) => polar(c, r, from + ((to - from) * i) / n)), w);
};
const GALLERY_A = [...arcWall(LIGHT, 205, 250, 214, 44), ...arcWall(LIGHT, 290, 335, 214, 44)];
const GALLERY: Pt[][] = [...GALLERY_A, ...GALLERY_A.map(p => mirror(S, p))];

/** The lamp shaft, felled to the north-east: a long drum, and the lantern room broken off its end. */
const SHAFT = ribbon([P(1352, 1088), P(1430, 1040), P(1510, 992), P(1580, 950)], [58, 62, 62, 58]);
const LANTERN_ROOM = octagon(P(1612, 930), 40);
/** Its mirror to the south-west is the keeper's house, roofless. */
const HOUSE = [...SHAFT, LANTERN_ROOM].map(p => mirror(S, p));

/** The gatehouse: two squat towers either side of the old gate, and the lintel stone that fell out of it. */
const GATE_TOWERS = [octagon(P(NORTH.x - 150, NORTH.y - 10), 54), octagon(P(NORTH.x + 150, NORTH.y - 10), 54)];
const LINTEL = ribbon([P(NORTH.x - 70, NORTH.y + 150), P(NORTH.x + 20, NORTH.y + 136), P(NORTH.x + 110, NORTH.y + 150)], [40, 46, 38]);
const GATE_A = [...GATE_TOWERS, ...LINTEL];
const GATE: Pt[][] = [...GATE_A, ...GATE_A.map(p => mirror(S, p))];

// ------------------------------------------------------------ wreckage

/** A wrecked hull lying in the lagoon: two gunwales and a stem, open at the stern so a hero can take cover inside. */
const hullAt = (cx: number, cy: number, spin: number): Pt[][] => {
  const turn = (p: Pt): Pt => {
    const c = Math.cos(deg(spin));
    const s = Math.sin(deg(spin));
    return P(Math.round(cx + p.x * c - p.y * s), Math.round(cy + p.x * s + p.y * c));
  };
  const side = (sign: 1 | -1): Pt[] =>
    [-130, -90, -40, 10, 60, 100, 134, 150].map(x => {
      const t = Math.max(0, x / 150);
      return turn(P(x, sign * (88 * (1 - t ** 2.4) + 4)));
    });
  const w = [26, 26, 26, 26, 26, 24, 22, 20];
  return [...ribbon(side(1), w), ...ribbon(side(-1), w)];
};
const WRECK = hullAt(840, 875, 28);

/** Coral heads standing in the lagoon: a few lumps of reef, there to be walked round. */
const HEADS_A = [blob(640, 860, 44, 36, 81), blob(1090, 1560, 40, 34, 82), blob(1060, 1000, 30, 26, 83)];
const HEADS: Pt[][] = [...HEADS_A, ...HEADS_A.map(p => mirror(S, p))];

// ------------------------------------------------------------ the rocks, as things

export const HILL_ROCKS: RockSpec[] = [
  { style: 'atoll', detail: 'none', parts: [...FRINGE, ...RING] },
  { style: 'tower', detail: 'none', lift: 22, parts: [TOWER] },
  { style: 'ruin', detail: 'none', lift: 10, parts: [...GALLERY, ...GATE] },
  { style: 'lamp', detail: 'none', lift: 14, parts: [...SHAFT, LANTERN_ROOM] },
  { style: 'ruin', detail: 'none', lift: 8, parts: HOUSE },
  { style: 'atoll', detail: 'none', lift: 10, parts: HEADS },
  { style: 'wood', detail: 'planks', parts: [...WRECK, ...WRECK.map(p => mirror(S, p))] },
];

export const HILL_WALLS: Pt[][] = [...HILL_SEA, ...HILL_ROCKS.flatMap(r => r.parts)];

// ------------------------------------------------------------ kelp and sand

const KELP_A = blob(850, 1700, 90, 66, 91, 10, 0.12);
/** Two lagoon kelp beds (brush to hide in), point-mirrored so neither court owns one. */
export const HILL_KELP: Pt[][] = [KELP_A, mirror(S, KELP_A)];
