import { BLUE, RED, type Court, type Pt } from '../../world/layout';
import type { FloorPatch, RockSpec } from '../../world/art/reef';
import { blob, flipX, hull, ribbon } from '../../world/art/shapes';

/**
 * Mặt Băng — "Vịnh Băng Trôi", a frozen lagoon. Two lanes run dock to dock: the
 * north one crosses a chain of ice floes (you slide), the south one is packed
 * snow and boulders (you do not), and the gap through the middle is a small ice
 * pond between two halves of a pressure ridge. Cracks, spurs and snow hummocks
 * stand on the floes as cover; frosted reeds are the bush.
 *
 * Which ground is ice is data: `ICE_FLOES` are the polygons of the map's one ice
 * zone (`TerrainZone.ice`), and `./art.ts` paints exactly them as floes — the
 * same list, so a floe that looks slippery is one and the other way round.
 *
 * The map is built from its west half and mirrored left to right (`flipX`), so
 * both courts have the same ground: north lane ice, south lane snow, for each.
 * Every wall piece is convex (core collides convex polygons only): ridges and
 * cracks are chains of quads (`ribbon`), heaps are hulls of lumps (`blob`).
 */
export const ICE_SIZE = 2400;
export const ICE_MAP_ID = 'ice';
export const ICE_ROLE = 'tidelight-ice';
/** Core's `IceTuning` for the map: a floe lets go of you slowly enough to read, quickly enough to play. */
export const ICE_TUNING = { accelMs: 320, frictionMs: 750 } as const;

const S = ICE_SIZE;
const FRAME = 100;
const CUT = 520;
const P = (x: number, y: number): Pt => ({ x, y });
const rect = (x: number, y: number, w: number, h: number): Pt[] => [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)];
const flipXs = (polys: Pt[][]): Pt[][] => polys.map(p => flipX(S, p));
/** A shape symmetric about the middle line: the hull of a half and its reflection. */
const sym = (half: Pt[]): Pt[] => hull([...half, ...flipX(S, half)]);
/** A west-half list and its reflection. */
const both = (west: Pt[][]): Pt[][] => [...west, ...flipXs(west)];

export const ICE_BASES: Record<Court, Pt> = { [BLUE]: P(300, 1200), [RED]: P(S - 300, 1200) };
export const ICE_KEEPS: Record<Court, Pt> = { [BLUE]: P(150, 1200), [RED]: P(S - 150, 1200) };
export const ICE_WARDENS: Record<Court, Pt> = { [BLUE]: P(620, 1200), [RED]: P(S - 620, 1200) };

// ------------------------------------------------------------ the frozen sea round the lagoon

const CORNER_TL: Pt[] = [P(FRAME, FRAME), P(CUT, FRAME), P(FRAME, CUT)];
const CORNER_BL: Pt[] = [P(FRAME, S - CUT), P(FRAME, S - FRAME), P(CUT, S - FRAME)];
/** Open water beyond the pack ice: solid, painted dark. */
export const ICE_SEA: Pt[][] = [
  rect(0, 0, S, FRAME),
  rect(0, S - FRAME, S, FRAME),
  rect(0, FRAME, FRAME, S - 2 * FRAME),
  rect(S - FRAME, FRAME, FRAME, S - 2 * FRAME),
  ...both([CORNER_TL, CORNER_BL]),
];

// ------------------------------------------------------------ the west half

/** The pressure ridge across the middle, in two halves with the pond between them. */
const RIDGE_W = ribbon([P(780, 1195), P(880, 1228), P(980, 1178), P(1070, 1218)], [44, 46, 44, 40]);
/** Spurs of ice thrown up from the ridge, one north, one south: they make the field either side of it a pair of nooks. */
// Set back from the pillars so a big hero (52 px) fits between: they used to close the pond off.
const SPUR_N = ribbon([P(930, 1150), P(942, 1050), P(926, 950)], [34, 34, 30]);
const SPUR_S = ribbon([P(930, 1250), P(915, 1350), P(935, 1450)], [34, 34, 30]);
/** Cracks: thin ridges in the floes, and one hanging from the northern sea. */
const CRACKS_W = [
  ...ribbon([P(740, 860), P(790, 940), P(764, 1015)], [22, 20, 16]),
  ...ribbon([P(1080, 660), P(1110, 750), P(1070, 830)], [22, 20, 16]),
  ...ribbon([P(900, 100), P(930, 230), P(905, 330)], [30, 26, 22]),
];
/** Snow hummocks on the floes. */
const HUMMOCKS_W: Pt[][] = [blob(700, 430, 70, 52, 81), blob(1030, 470, 62, 58, 82), blob(540, 770, 48, 44, 84)];
/** Rock heaps on the southern snow. */
const BOULDERS_W: Pt[][] = [blob(900, 1560, 60, 70, 91), blob(700, 1950, 80, 55, 92), blob(1050, 1990, 90, 50, 93), blob(520, 1700, 50, 44, 94)];
/** Two free-standing pillars either side of the pond: cover on the short way through. */
const PILLARS: Pt[][] = [sym(blob(1150, 1000, 40, 48, 95)), sym(blob(1150, 1400, 34, 40, 96))];

export const ICE_ROCKS: RockSpec[] = [
  { style: 'ridge', detail: 'planks', parts: both([...RIDGE_W, ...SPUR_N, ...SPUR_S]) },
  { style: 'crack', detail: 'none', lift: 4, parts: both(CRACKS_W) },
  { style: 'hummock', detail: 'none', lift: 8, parts: [...both(HUMMOCKS_W), ...PILLARS] },
  { style: 'rock', detail: 'none', parts: both(BOULDERS_W) },
];

export const ICE_WALLS: Pt[][] = [...ICE_SEA, ...ICE_ROCKS.flatMap(r => r.parts)];

// ------------------------------------------------------------ cover and ground

const REEDS_W: Pt[][] = [blob(840, 1080, 48, 44, 71), blob(820, 1400, 52, 42, 72), blob(1100, 320, 70, 40, 73)];
export const ICE_REEDS: Pt[][] = both(REEDS_W);

/** The slippery ground: floes along the north lane, the pond in the gap, three stepping floes on the south lane. */
const FLOES_W: Pt[][] = [
  blob(660, 880, 150, 120, 101, 9, 0.12),
  blob(900, 690, 200, 140, 102, 10, 0.1),
  blob(1010, 380, 130, 90, 105, 9, 0.12),
  blob(820, 1700, 100, 55, 107, 9, 0.12),
];
const MIDDLE_FLOES: Pt[][] = [sym(blob(1090, 610, 120, 110, 103)), sym(blob(1120, 1200, 110, 95, 104)), sym(blob(1140, 1790, 90, 50, 108))];
export const ICE_FLOES: Pt[][] = [...both(FLOES_W), ...MIDDLE_FLOES];

/** Snow drifts and gravel: walkable ground, painted only. */
export const ICE_FLOOR: FloorPatch[] = [
  ...both([blob(500, 1700, 120, 80, 111), blob(1000, 2060, 130, 70, 112), blob(380, 760, 110, 70, 113)]).map(points => ({ kind: 'sand' as const, points })),
  ...both([blob(600, 1330, 100, 60, 121), blob(560, 1080, 90, 55, 122)]).map(points => ({ kind: 'mud' as const, points })),
];

// ------------------------------------------------------------ lanes

const lane = (pts: [number, number][]): Pt[] => pts.map(([x, y]) => P(x, y));
const FLOE_W = lane([[520, 1000], [700, 780], [900, 650]]);
const SNOW_W = lane([[520, 1400], [720, 1640], [940, 1760]]);
const mirrorLane = (west: Pt[]): Pt[] => [...west.map(p => P(S - p.x, p.y))].reverse();
/** Dock to dock; the first and last points are the docks themselves. */
export const ICE_LANES = {
  floe: [ICE_BASES[BLUE], ...FLOE_W, P(S / 2, 600), ...mirrorLane(FLOE_W), ICE_BASES[RED]],
  snow: [ICE_BASES[BLUE], ...SNOW_W, P(S / 2, 1800), ...mirrorLane(SNOW_W), ICE_BASES[RED]],
} as const;
/** Where each lane's minions appear, per court. */
export const ICE_MUSTERS = { floe: FLOE_W[0], snow: SNOW_W[0] } as const;
