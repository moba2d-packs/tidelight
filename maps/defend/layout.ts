/**
 * Thủ Đèn (the Lantern Watch) — every coordinate of the co-op defence map.
 * Plain data: geometry.ts, the director and the tests all read this one file.
 */
import type { RockSpec } from '../../world/art/reef';
import { arc, blob, hull, ribbon } from '../../world/art/shapes';
import { band, lumps, post, slab, wobble } from '../../world/art/coast';

export interface Pt {
  x: number;
  y: number;
}

export const DEFEND_MAP_ID = 'lantern-watch';
export const DEFEND_ROLE = 'tidelight-defend';
export const DEFEND_SIZE = 2400;
export const LANTERN: Pt = { x: 1200, y: 1200 };
/** How close a blue turret must stand to LANTERN to be the Great Lantern. */
export const LANTERN_MATCH_PX = 40;

export const FACTION_TIDE = 'tide';
export const FACTION_EMBER = 'ember';

/** The team ids core bridges from `factions` order: [0] blue, [1] red. */
export const DEFENDERS = 'team-blue';
export const RAIDERS = 'team-red';

/** The defenders' harbour: where everyone spawns, a short walk south of the lantern. */
export const HARBOUR: Pt = { x: 1200, y: 1700 };
/** Raiders have no champions; their fountain sits sealed inside the rock, in the north-west corner. */
export const SEALED_COVE: Pt = { x: 60, y: 60 };

export interface Gate {
  id: string;
  /** Where a wave forms up. */
  muster: Pt;
  /** Where its path ends, a few steps from the lantern. */
  arrive: Pt;
  via: Pt[];
}

/** Three sea gates. Wave 1-2 use the first two, wave 3 onward all three. */
export const GATES: Gate[] = [
  { id: 'west', muster: { x: 240, y: 1200 }, arrive: { x: 1060, y: 1200 }, via: [{ x: 640, y: 1200 }] },
  { id: 'north-east', muster: { x: 2000, y: 360 }, arrive: { x: 1290, y: 1090 }, via: [{ x: 1650, y: 740 }] },
  { id: 'south-east', muster: { x: 2000, y: 2040 }, arrive: { x: 1290, y: 1310 }, via: [{ x: 1650, y: 1660 }] },
];

const S = DEFEND_SIZE;
const P = (x: number, y: number): Pt => ({ x, y });
const rect = (x: number, y: number, w: number, h: number): Pt[] => [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)];

const EDGE = 120;
/** The open sea around the island: solid, painted as deep water. */
export const SEA_WALLS: Pt[][] = [
  rect(0, 0, S, EDGE),
  rect(0, S - EDGE, S, EDGE),
  rect(0, EDGE, EDGE, S - 2 * EDGE),
  rect(S - EDGE, EDGE, EDGE, S - 2 * EDGE),
];

// ------------------------------------------------------------ the island's ground plan
//
//   N   ridge ─ headland (lighthouse) ─ ·· ·      broken pier (NE gate) ╲
//   W   stone causeway ══════════► lantern  ◄── kelp inlet between two banks ╲ (SE gate)
//   S                 breakwater-ringed harbour (the defenders land here)
//
// Every wall piece is convex. Rocks are grouped into things (`RockSpec`) so the
// art can ink a cliff, a masonry parapet, a wooden pile or a coral bank each in its
// own way; the picture (`./art.ts`) reads these same lists.

const MUSTERS = GATES.map(g => g.muster);
const AVOID = [...MUSTERS, HARBOUR].map(at => ({ at, r: 260 }));

/** The shore: ragged coast along all four sides of the sea frame. Never bulges near a gate or the harbour. */
const SHORE: Pt[][] = [
  ...band(P(EDGE, EDGE), P(S - EDGE, EDGE), P(0, 1), { depth: 70, reach: [-14, 56], step: [70, 150], seed: 11, avoid: AVOID }),
  ...band(P(S - EDGE, EDGE), P(S - EDGE, S - EDGE), P(-1, 0), { depth: 70, reach: [-14, 56], step: [70, 150], seed: 12, avoid: AVOID }),
  ...band(P(S - EDGE, S - EDGE), P(EDGE, S - EDGE), P(0, -1), { depth: 70, reach: [-14, 56], step: [70, 150], seed: 13, avoid: AVOID }),
  ...band(P(EDGE, S - EDGE), P(EDGE, EDGE), P(1, 0), { depth: 70, reach: [-14, 56], step: [70, 150], seed: 14, avoid: AVOID }),
];

/** Capes that push into the corners, so the coast is not a frame. */
const CAPES: Pt[][] = [
  blob(300, 300, 170, 120, 21, 11, 0.12, 0.4),
  blob(190, 470, 100, 90, 22),
  blob(470, 200, 110, 70, 23, 9, 0.12),
  blob(260, 2130, 180, 120, 24, 11, 0.12, 0.2),
  blob(150, 1930, 90, 80, 25),
  blob(2210, 2200, 150, 100, 26, 10, 0.12),
  blob(2200, 150, 110, 60, 27, 9, 0.1),
];

// -- the headland: the lighthouse stands on it, the lantern at its foot

const HEADLAND: Pt[][] = [
  blob(1190, 872, 175, 120, 201, 11, 0.1),
  blob(1050, 930, 95, 70, 202, 9),
  blob(1290, 915, 62, 55, 203, 9),
  blob(1200, 800, 130, 84, 204, 9),
  blob(1110, 760, 90, 60, 205, 9),
];
/** A spur of the headland running out to the north-west coast. */
const SPUR: Pt[][] = lumps([P(1010, 876), P(900, 836), P(800, 796), P(700, 742), P(610, 694)], [80, 72, 64, 56, 46], 41);
const STACKS_NW: Pt[][] = [blob(560, 640, 58, 68, 211, 9, 0.16), blob(470, 724, 48, 46, 212, 8), blob(520, 560, 36, 44, 213, 8)];

// -- the stone causeway (west gate)

const CAUSEWAY_X0 = 340;
const CAUSEWAY_X1 = 940;
/** The causeway's centre line: it sways a little, so it reads as built on a bar of rock, not ruled. */
export const causewayY = (x: number): number => 1200 + 16 * Math.sin((x - CAUSEWAY_X0) / 120);
const PARAPET_OFF = 101;
const causewayPath = (side: -1 | 1): Pt[] => {
  const out: Pt[] = [];
  for (let x = CAUSEWAY_X0; x <= CAUSEWAY_X1; x += 60) out.push(P(x, Math.round(causewayY(x) + side * PARAPET_OFF)));
  return out;
};
/** Quads of the parapet that fell into the sea: the causeway is breached there. */
const BREACH_N = [5, 6];
const BREACH_S = [2, 3, 8];
const parapet = (side: -1 | 1, breach: number[]): Pt[][] => ribbon(causewayPath(side), 34).filter((_q, i) => !breach.includes(i));
const GATEHOUSE_N: Pt[] = hull([P(372, 1050), P(446, 1040), P(462, 1096), P(430, 1120), P(380, 1112)]);
const GATEHOUSE_S: Pt[] = hull([P(376, 1292), P(432, 1284), P(466, 1310), P(452, 1360), P(384, 1352)]);
/** Fallen drums of a column lying in the breach, so even the gap is not clean. */
const DRUMS: Pt[][] = [post(700, 1060, 30, 24, 0.5, 301), post(540, 1346, 28, 30, 1.1, 302), post(852, 1342, 26, 22, 0.2, 303)];

// -- the broken pier (north-east gate)

const MUSTER_NE = GATES[1].muster;
const VIA_NE = GATES[1].via[0];
const PIER_DIR = (() => {
  const l = Math.hypot(VIA_NE.x - MUSTER_NE.x, VIA_NE.y - MUSTER_NE.y);
  return P((VIA_NE.x - MUSTER_NE.x) / l, (VIA_NE.y - MUSTER_NE.y) / l);
})();
/** A point on the pier's centre line, `s` px from the muster toward the lane's bend (negative: out to sea). */
export const pierAt = (s: number): Pt => P(MUSTER_NE.x + PIER_DIR.x * s, MUSTER_NE.y + PIER_DIR.y * s);
export const PIER_OUT = -150;
/** The deck ends here; past it only the stumps remain. */
export const PIER_BROKEN = 400;
const PIER_ROW = 96;
const PIER_NORMAL = P(-PIER_DIR.y, PIER_DIR.x);
/** Piles of the two rails, by row (+1 = south-east side), with the stretches that were torn out. */
const PILES: Pt[][] = [];
for (const side of [-1, 1] as const) {
  for (let k = 0, s = PIER_OUT; s <= 480; k++, s += 62) {
    const torn = side === 1 ? s > 130 && s < 260 : s > 250 && s < 340;
    if (torn) continue;
    const c = pierAt(s);
    const lean = (k % 3) - 1;
    PILES.push(post(c.x + PIER_NORMAL.x * side * PIER_ROW + lean * 3, c.y + PIER_NORMAL.y * side * PIER_ROW + lean * 3, 32, 30, 0.4 + k * 0.3, 400 + k * 3 + (side > 0 ? 1 : 0)));
  }
}
/** The longboat the raiders came in, run aground at the pier's foot. */
const LONGBOAT: Pt[][] = ribbon([P(2150, 200), P(2205, 245), P(2236, 320), P(2216, 400), P(2170, 456)], [18, 44, 54, 44, 16]);
const BOAT_RIBS: Pt[][] = [P(2210, 262), P(2232, 332), P(2208, 400)].flatMap((p, i) => ribbon([p, P(p.x - 38, p.y + (i - 1) * 8)], [10, 7]));
const CRATES: Pt[][] = [post(1990, 220, 46, 36, 0.3, 311), post(1930, 250, 34, 30, 0.9, 312)];

// -- the kelp inlet (south-east gate): two coral banks, kelp between them

const INLET = [P(2000, 2040), P(1650, 1660), P(1290, 1310)];
/** The inlet's banks sit this far either side of the lane. */
const BANK = 205;
const unit = (a: Pt, b: Pt): Pt => {
  const l = Math.hypot(b.x - a.x, b.y - a.y);
  return P((b.x - a.x) / l, (b.y - a.y) / l);
};
const nudge = (p: Pt, d: Pt, k: number): Pt => P(Math.round(p.x - d.y * k), Math.round(p.y + d.x * k));
const d1 = unit(INLET[0], INLET[1]);
const d2 = unit(INLET[1], INLET[2]);
const lerp = (a: Pt, b: Pt, t: number): Pt => P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const bankSouth = (k: number): Pt[] => [
  nudge(lerp(INLET[0], INLET[1], 0), d1, k),
  nudge(lerp(INLET[0], INLET[1], 0.28), d1, k),
  nudge(lerp(INLET[0], INLET[1], 0.55), d1, k),
  nudge(lerp(INLET[0], INLET[1], 0.8), d1, k),
  nudge(INLET[1], d1, k),
];
/** The north-east bank of the lane (positive offsets run to its left, toward the lantern's east). */
const BANK_NE: RockSpec = {
  style: 'coral',
  detail: 'coral',
  parts: [
    ...lumps(bankSouth(BANK).slice(0, 3), [80, 100, 90], 51),
    // a break, then the bank bends round the inlet's elbow
    ...lumps(
      [nudge(lerp(INLET[0], INLET[1], 0.92), d1, BANK), nudge(INLET[1], d1, BANK), nudge(lerp(INLET[1], INLET[2], 0.3), d2, BANK), nudge(lerp(INLET[1], INLET[2], 0.52), d2, BANK - 6)],
      [84, 92, 76, 58],
      52
    ),
    blob(2170, 1930, 70, 60, 321, 9),
  ],
};
/** The south-west bank runs into the harbour's breakwater: one coast. */
const BANK_SW: RockSpec = {
  style: 'coral',
  detail: 'coral',
  parts: [
    ...lumps(bankSouth(-BANK).slice(0, 3), [70, 90, 86], 53),
    // a gap between these two stretches: the bank's break, where the lane can be flanked
    ...lumps([nudge(lerp(INLET[0], INLET[1], 0.88), d1, -BANK), bankSouth(-BANK)[4]], [56, 46], 54),
  ],
};
/** Kelp beds hugging both sides of the inlet's lane. */
const inletKelp = (): Pt[][] => {
  const out: Pt[][] = [];
  const specs: [Pt, Pt, number][] = [
    [INLET[0], INLET[1], 0.35],
    [INLET[0], INLET[1], 0.78],
    [INLET[1], INLET[2], 0.3],
    [INLET[1], INLET[2], 0.72],
  ];
  specs.forEach(([a, b, t], i) => {
    const c = lerp(a, b, t);
    const d = unit(a, b);
    const ang = Math.atan2(d.y, d.x);
    for (const side of [-1, 1] as const) {
      const at = nudge(c, d, 118 * side);
      out.push(slab(at.x, at.y, 118 - i * 8, 36, ang, 520 + i * 2 + (side > 0 ? 1 : 0), 9, 0.1));
    }
  });
  return out;
};

// -- the harbour: breakwaters south of the lantern, a wreck beside it

const BREAKWATER_R = 345;
const breakwater = (a0: number, a1: number): Pt[][] => {
  const rad = (d: number) => (d * Math.PI) / 180;
  return ribbon(wobble(arc(HARBOUR.x, HARBOUR.y, BREAKWATER_R, rad(a0), rad(a1), 7), 7, a0), [64, 52, 62, 50, 58, 48, 54, 42]);
};
const BREAKWATERS: Pt[][] = [...breakwater(26, 78), ...breakwater(102, 168)];
const WRECK: Pt[][] = [
  ...ribbon([P(470, 1690), P(540, 1646), P(630, 1630), P(720, 1646), P(790, 1684)], [40, 58, 62, 56, 38]),
  ...ribbon([P(540, 1646), P(520, 1580), P(500, 1536)], [16, 12, 8]),
  ...ribbon([P(630, 1630), P(622, 1556), P(630, 1500)], [16, 12, 8]),
  ...ribbon([P(720, 1646), P(736, 1578), P(760, 1530)], [16, 12, 8]),
];
const HARBOUR_BOATS: Pt[][] = [
  ...ribbon([P(1040, 2130), P(1092, 2104), P(1150, 2100), P(1192, 2118)], [26, 38, 38, 22]),
  ...ribbon([P(1250, 2140), P(1300, 2112), P(1360, 2108), P(1408, 2126)], [26, 40, 40, 22]),
];

// -- sea stacks, tide-pool rocks and reef fingers that break the sight lines

const STACKS: Pt[][] = [
  blob(1500, 560, 62, 56, 231, 9, 0.16),
  blob(1566, 612, 46, 54, 232, 8),
  blob(1100, 500, 70, 52, 233, 9, 0.16),
  blob(1260, 450, 48, 44, 234, 8),
  blob(1840, 1180, 58, 88, 235, 10, 0.14),
  blob(1902, 1306, 48, 58, 236, 9),
  blob(2030, 1560, 52, 46, 237, 8),
  blob(620, 2010, 66, 50, 238, 9),
  blob(760, 2120, 46, 40, 239, 8),
  blob(1640, 2220, 60, 40, 240, 8),
];
const FINGERS: Pt[][] = [
  ...lumps([P(720, 380), P(762, 452), P(792, 540), P(780, 622)], [50, 46, 40, 30], 61),
  ...lumps([P(500, 1450), P(560, 1500), P(640, 1522), P(700, 1500)], [44, 48, 42, 28], 62),
  ...lumps([P(1380, 2060), P(1450, 2110), P(1540, 2130)], [40, 44, 32], 63),
];

/** Every rock of the map, with the style it is painted in. The art and the walls both read this. */
export const DEFEND_ROCKS: RockSpec[] = [
  { style: 'reef', detail: 'sprigs', parts: SHORE },
  { style: 'cliff', detail: 'none', parts: CAPES },
  { style: 'cliff', detail: 'none', parts: [...HEADLAND, ...SPUR, ...STACKS_NW] },
  { style: 'stone', detail: 'none', parts: [...parapet(-1, BREACH_N), ...parapet(1, BREACH_S), GATEHOUSE_N, GATEHOUSE_S, ...DRUMS] },
  { style: 'wood', detail: 'planks', parts: [...PILES, ...LONGBOAT, ...BOAT_RIBS, ...CRATES] },
  BANK_NE,
  BANK_SW,
  { style: 'wood', detail: 'planks', parts: [...WRECK, ...HARBOUR_BOATS] },
  { style: 'stone', detail: 'none', parts: BREAKWATERS },
  { style: 'reef', detail: 'sprigs', parts: [...STACKS, ...FINGERS] },
];

export const KELP: Pt[][] = [
  ...inletKelp(),
  slab(700, 1420, 130, 40, 0.1, 601, 9, 0.1),
  slab(560, 1006, 100, 34, -0.1, 602, 9, 0.1),
  slab(980, 600, 100, 46, 0.3, 603, 9, 0.1),
  slab(1790, 352, 90, 34, -0.7, 604, 9, 0.1),
  slab(1960, 1236, 70, 34, 0.4, 605, 8, 0.1),
  slab(1330, 1560, 54, 30, 0, 606, 8, 0.1),
];

/** Tide pools and sand: floor, painted smooth. */
export const SAND_ISLAND: Pt[] = blob(1200, 1180, 360, 280, 701, 24, 0.05);
export const POOLS: Pt[][] = [blob(1930, 1250, 62, 40, 711, 10, 0.1), blob(790, 1560, 54, 38, 712, 10, 0.1), blob(1000, 1060, 40, 28, 713, 9, 0.1)];

/** Every wall of the map. */
export const WALLS: Pt[][] = [...SEA_WALLS, ...DEFEND_ROCKS.flatMap(r => r.parts)];
/** Kept for the tests that name the sea frame and the rocks separately. */
export const ROCKS: Pt[][] = DEFEND_ROCKS.flatMap(r => r.parts);

/** The lane of each gate as one polyline, muster to lantern, for the clearance tests. */
export const gateRoute = (gate: Gate): Pt[] => [gate.muster, ...gate.via, gate.arrive];
