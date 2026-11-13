/**
 * Driftglass Reef — every coordinate the map is made of, in one place.
 *
 * Plain data, no engine: `geometry.ts` turns it into the walls and slots core
 * routes against, `scenery.ts` paints it, `rules.ts` plays on it and the tests
 * read it. One source, so the picture, the collision and the rules cannot
 * drift apart.
 *
 * The world is a 3200 square, but only a horizontal band of it is water you
 * can walk: phones are landscape, so the map is too.
 */
export interface Pt {
  x: number;
  y: number;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MAP_SIZE = 3200;
export const CENTER: Pt = { x: 1600, y: 1600 };

export const BLUE = 'team-blue';
export const RED = 'team-red';
export type Court = typeof BLUE | typeof RED;

/** Faction ids on the map. Order matters: core maps [0] to blue, [1] to red. */
export const FACTION_TIDE = 'tide';
export const FACTION_EMBER = 'ember';

/** The lantern's rail: a straight channel through the middle of the reef. */
export const RAIL_Y = 1600;
/** Half-length of the rail. The lantern's coordinate `s` runs -RAIL_HALF…+RAIL_HALF. */
export const RAIL_HALF = 900;
/** Where a court's lock gate holds the lantern while its warden tower stands. */
export const GATE_S = 640;

export const railX = (s: number): number => CENTER.x + s;

export const BASES: Record<Court, Pt> = {
  [BLUE]: { x: 300, y: RAIL_Y },
  [RED]: { x: MAP_SIZE - 300, y: RAIL_Y },
};

/** Warden towers, one per court, standing beside their own gate. */
export const WARDENS: Record<Court, Pt> = {
  [BLUE]: { x: 930, y: 1425 },
  [RED]: { x: MAP_SIZE - 930, y: MAP_SIZE - 1425 },
};

/**
 * Keep towers — one per court, against the back of its own dock, between the
 * fountain and the map edge. A keep guards the
 * harbour, not the lantern: its reach stops short of the berth (x 700 / 2500),
 * so a delivery is never a dive and a keep never holds a gate (`heart.ts`
 * reads only the warden for that).
 */
export const KEEPS: Record<Court, Pt> = {
  [BLUE]: { x: 40, y: RAIL_Y },
  [RED]: { x: MAP_SIZE - 40, y: RAIL_Y },
};
/** Keep numbers. 90–135 HP heroes: two to three shots, one every 0.45 s. */
export const KEEP_STATS = {
  health: 2_400,
  damage: 45,
  attackInterval: 450,
  attackRange: 480,
  size: 120,
  rebuildTime: 90_000,
  repairDelay: 6_000,
  repairRate: 0.5,
} as const;
/** How close a turret must stand to a keep point to be that keep. */
export const KEEP_MATCH_PX = 40;

/** The two tidal shoals: flank routes that flood and drain with the tide. */
export const SHOAL_NORTH: Box = { x: 620, y: 800, w: 1960, h: 360 };
export const SHOAL_SOUTH: Box = { x: 620, y: 2040, w: 1960, h: 360 };

/** Pearl beds: where pearls surface when a shoal runs dry. */
export const PEARL_BEDS_NORTH: Pt[] = [
  { x: 1000, y: 960 },
  { x: 1600, y: 900 },
  { x: 2200, y: 960 },
];
export const PEARL_BEDS_SOUTH: Pt[] = PEARL_BEDS_NORTH.map(p => ({
  x: MAP_SIZE - p.x,
  y: MAP_SIZE - p.y,
}));

const rectPoly = (x: number, y: number, w: number, h: number): Pt[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

const mirror = (poly: Pt[]): Pt[] => poly.map(p => ({ x: MAP_SIZE - p.x, y: MAP_SIZE - p.y }));

/**
 * Reef islands between the lantern channel and the north shoal. Each is a
 * convex hexagon (core's collision wants convex pieces); the south row is the
 * point-mirror of this one, so the map is fair by construction.
 */
const hexIsland = (x0: number, x1: number, y0: number, y1: number, cut = 46): Pt[] => [
  { x: x0 + cut, y: y0 },
  { x: x1 - cut, y: y0 },
  { x: x1, y: (y0 + y1) / 2 },
  { x: x1 - cut, y: y1 },
  { x: x0 + cut, y: y1 },
  { x: x0, y: (y0 + y1) / 2 },
];

export const ISLANDS_NORTH: Pt[][] = [
  hexIsland(760, 1270, 1170, 1320),
  hexIsland(1440, 1760, 1150, 1340, 70),
  hexIsland(1930, 2440, 1170, 1320),
];
export const ISLANDS: Pt[][] = [...ISLANDS_NORTH, ...ISLANDS_NORTH.map(mirror)];

/** The open sea north and south of the playable band — solid, but drawn as deep water. */
export const BAND_TOP = 780;
export const BAND_BOTTOM = MAP_SIZE - BAND_TOP;
export const SEA_WALLS: Pt[][] = [
  rectPoly(0, 0, MAP_SIZE, BAND_TOP),
  rectPoly(0, BAND_BOTTOM, MAP_SIZE, BAND_TOP),
  // Headlands that tuck each base in, so a spawn is a harbour and not a field.
  [
    { x: 0, y: BAND_TOP },
    { x: 560, y: BAND_TOP },
    { x: 470, y: 1180 },
    { x: 0, y: 1300 },
  ],
  [
    { x: 0, y: 1900 },
    { x: 470, y: 2020 },
    { x: 560, y: BAND_BOTTOM },
    { x: 0, y: BAND_BOTTOM },
  ],
].flatMap((poly, i) => (i < 2 ? [poly] : [poly, mirror(poly)]));

/** Kelp beds: brush to hide in, hugging the channel and the far shoal corners. */
export const KELP_NORTH: Pt[][] = [
  rectPoly(1290, 1190, 130, 120),
  rectPoly(1780, 1190, 130, 120),
  rectPoly(1480, 1360, 240, 64),
  rectPoly(660, 830, 180, 110),
];
export const KELP: Pt[][] = [...KELP_NORTH, ...KELP_NORTH.map(mirror)];

export const inBox = (p: Pt, b: Box): boolean =>
  p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

/** Role of the one neutral slot the map declares: the heart that runs the tide. */
export const HEART_ROLE = 'tidelight-heart';
