import type { Box, Pt } from '../../world/layout';
import type { Ctx, View } from '../../world/art/draw';
import { TAU, fillEllipse, hash, overlaps, pen, rgba, sees } from '../../world/art/draw';
import type { Palette, ReefDescription, RockArt, RockDetail, RockStyle } from '../../world/art/reef';
import { blob } from '../../world/art/shapes';
import { CRAG_OUTLINE, KELP, PORTALS_ROCKS, PORTALS_SEA, PORTAL_SPOTS } from './layout';
import { MAP_SIZE } from '../../world/layout';
import type { Rgb } from '../../world/palette';

/**
 * Đảo Cổng, painted. The footprints are the polygons of `layout.ts`; what makes
 * each island its own place is paint: a pink-and-white coral garden (NW, Tide's
 * home), a kelp forest (NE), black basalt with glowing cracks (SE, Ember's
 * home) and a pale pearl sandbar (SW). The crag in the middle is a grey cliff
 * with a whirlpool crater sunk into it, where the four portals' water meets.
 */

const STYLES: Record<string, RockStyle> = {
  cliff: { base: [30, 40, 60], top: [78, 92, 114], edge: [140, 164, 180], lift: 12 },
  core: { base: [62, 76, 100], top: [62, 76, 100], edge: [62, 76, 100], lift: 0 },
  basalt: { base: [14, 12, 20], top: [48, 42, 54], edge: [150, 92, 72], lift: 11 },
  kelpwood: { base: [18, 56, 52], top: [36, 100, 80], edge: [120, 206, 140], lift: 10 },
  pearl: { base: [120, 112, 140], top: [214, 206, 224], edge: [252, 246, 255], lift: 9 },
};

const near = (tile: Box, b: Box, pad = 24): boolean => overlaps({ x: tile.x - pad, y: tile.y - pad, w: tile.w + 2 * pad, h: tile.h + 2 * pad }, b);

/** Visit the points of a world grid (cell `step`) that fall in both the tile and the rock's box. */
function grid(tile: Box, rock: RockArt, step: number, visit: (gx: number, gy: number, x: number, y: number) => void): void {
  const gx0 = Math.floor(Math.max(tile.x - 20, rock.box.x) / step);
  const gx1 = Math.ceil(Math.min(tile.x + tile.w + 20, rock.box.x + rock.box.w) / step);
  const gy0 = Math.floor(Math.max(tile.y - 20, rock.box.y) / step);
  const gy1 = Math.ceil(Math.min(tile.y + tile.h + 20, rock.box.y + rock.box.h) / step);
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) visit(gx, gy, gx * step + hash(gx, gy + 5) * step * 0.8, gy * step + hash(gy, gx + 7) * step * 0.8);
}

/** Wavy rock courses across the crag. */
function strata(ctx: Ctx, rock: RockArt, _pal: Palette, tile: Box): void {
  if (!near(tile, rock.box, 20)) return;
  pen(ctx, rgba(rock.style.base, 150), 3);
  ctx.beginPath();
  grid(tile, rock, 34, (gx, gy, x, y) => {
    if (hash(gx, gy) > 0.55) return;
    ctx.moveTo(x - 22, y);
    ctx.quadraticCurveTo(x, y + (hash(gy, gx) - 0.5) * 14, x + 24, y + 2);
  });
  ctx.stroke();
  pen(ctx, rgba(rock.style.edge, 60), 2);
  ctx.beginPath();
  grid(tile, rock, 70, (gx, gy, x, y) => {
    if (hash(gx + 3, gy) > 0.4) return;
    ctx.moveTo(x - 14, y + 7);
    ctx.lineTo(x + 18, y + 4);
  });
  ctx.stroke();
}

/** Basalt: dark column faces and hairline cracks that glow ember. */
function columns(ctx: Ctx, rock: RockArt, _pal: Palette, tile: Box): void {
  if (!near(tile, rock.box, 20)) return;
  pen(ctx, rgba(rock.style.base, 200), 3);
  ctx.beginPath();
  grid(tile, rock, 30, (gx, gy, x, y) => {
    if (hash(gx, gy + 11) > 0.5) return;
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x, y + 12);
    ctx.moveTo(x - 10, y - 6);
    ctx.lineTo(x, y - 12);
    ctx.lineTo(x + 10, y - 6);
  });
  ctx.stroke();
  pen(ctx, rgba([255, 112, 78], 190), 2);
  ctx.beginPath();
  grid(tile, rock, 52, (gx, gy, x, y) => {
    if (hash(gx + 9, gy) > 0.3) return;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 9, y + 6);
    ctx.lineTo(x + 6, y + 15);
    ctx.lineTo(x + 16, y + 21);
  });
  ctx.stroke();
}

/** Kelp holdfasts: tufts of weed on the ridge, and a few dark gaps. */
function holdfast(ctx: Ctx, rock: RockArt, pal: Palette, tile: Box): void {
  if (!near(tile, rock.box, 20)) return;
  [pal.KELP_LIGHT, pal.KELP].forEach((c, ci) => {
    pen(ctx, rgba(c, 210), 3);
    ctx.beginPath();
    grid(tile, rock, 34, (gx, gy, x, y) => {
      if (hash(gx * 3 + ci, gy + 2) > 0.34 || Math.floor(hash(gy, gx) * 2) !== ci) return;
      const h = 12 + hash(gx + gy, 5) * 14;
      ctx.moveTo(x, y + 6);
      ctx.quadraticCurveTo(x - 6, y - h * 0.5, x + 2, y - h);
      ctx.moveTo(x + 5, y + 6);
      ctx.quadraticCurveTo(x + 11, y - h * 0.4, x + 6, y - h * 0.8);
    });
    ctx.stroke();
  });
}

/** Sandbar shell: pearls and the ribs of half-buried scallops. */
function shells(ctx: Ctx, rock: RockArt, pal: Palette, tile: Box): void {
  if (!near(tile, rock.box, 20)) return;
  pen(ctx, rgba(rock.style.base, 120), 2);
  ctx.beginPath();
  grid(tile, rock, 56, (gx, gy, x, y) => {
    if (hash(gx + 1, gy + 4) > 0.3) return;
    for (let k = -2; k <= 2; k++) {
      ctx.moveTo(x, y + 10);
      ctx.lineTo(x + k * 7, y - 6 + Math.abs(k) * 3);
    }
  });
  ctx.stroke();
  ctx.fillStyle = rgba(pal.PEARL, 240);
  ctx.beginPath();
  grid(tile, rock, 40, (gx, gy, x, y) => {
    if (hash(gx, gy + 13) > 0.22) return;
    ctx.moveTo(x + 5, y);
    ctx.arc(x, y, 5, 0, TAU);
  });
  ctx.fill();
}

/** Plain reef rock gets sprigs of coral. */
function sprigs(ctx: Ctx, rock: RockArt, pal: Palette, tile: Box): void {
  if (!near(tile, rock.box, 20)) return;
  pen(ctx, rgba(pal.CORAL, 200), 3);
  ctx.beginPath();
  grid(tile, rock, 52, (gx, gy, x, y) => {
    if (hash(gx + 2, gy) > 0.22) return;
    const h = 9 + hash(gx, gy + 3) * 8;
    ctx.moveTo(x, y + 5);
    ctx.lineTo(x, y - h);
    ctx.moveTo(x, y - h * 0.4);
    ctx.lineTo(x - 6, y - h * 0.9);
    ctx.moveTo(x, y - h * 0.6);
    ctx.lineTo(x + 6, y - h);
  });
  ctx.stroke();
}

const DETAIL: Record<string, RockDetail> = { cliff: strata, basalt: columns, kelpwood: holdfast, pearl: shells, reef: sprigs };

/** Each island's ground: a coloured bed under its rocks. */
const BEDS: { box: Box; fill: [number, number, number]; edge: [number, number, number]; seed: number }[] = [
  { box: { x: 100, y: 100, w: 800, h: 800 }, fill: [226, 168, 160], edge: [255, 214, 200], seed: 1 },
  { box: { x: 2300, y: 100, w: 800, h: 800 }, fill: [26, 92, 70], edge: [70, 150, 100], seed: 2 },
  { box: { x: 2300, y: 2300, w: 800, h: 800 }, fill: [44, 34, 44], edge: [110, 60, 50], seed: 3 },
  { box: { x: 100, y: 2300, w: 800, h: 800 }, fill: [230, 222, 206], edge: [250, 246, 236], seed: 4 },
];

function bakeBeds(ctx: Ctx, tile: Box): void {
  for (const bed of BEDS) {
    if (!near(tile, bed.box, 0)) continue;
    const cx = bed.box.x + bed.box.w / 2;
    const cy = bed.box.y + bed.box.h / 2;
    // Three soft layers, so the ground fades into the sea instead of ending on a line.
    for (const [k, alpha] of [[1, 60], [0.78, 70], [0.52, 80]] as const) {
      const ground = blob(cx, cy, 400 * k, 400 * k, bed.seed * 17 + Math.round(k * 10), 22, 0.14, 0.1);
      ctx.beginPath();
      ground.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = rgba(bed.fill, alpha);
      ctx.fill();
    }
  }
}

/** Crevices cut across the crag, dark in the cut and lit on the lip, so the rock reads as broken stone. */
const CREVICES: Pt[][] = [
  [{ x: 1000, y: 700 }, { x: 1120, y: 760 }, { x: 1190, y: 860 }, { x: 1320, y: 900 }, { x: 1380, y: 1010 }],
  [{ x: 1500, y: 560 }, { x: 1560, y: 650 }, { x: 1530, y: 760 }, { x: 1610, y: 840 }],
  [{ x: 2100, y: 640 }, { x: 2020, y: 740 }, { x: 2060, y: 860 }, { x: 1960, y: 960 }, { x: 1990, y: 1060 }],
  [{ x: 760, y: 1500 }, { x: 860, y: 1560 }, { x: 960, y: 1520 }, { x: 1060, y: 1620 }],
  [{ x: 2440, y: 1700 }, { x: 2340, y: 1640 }, { x: 2240, y: 1700 }, { x: 2140, y: 1620 }],
  [{ x: 1300, y: 2300 }, { x: 1380, y: 2220 }, { x: 1340, y: 2120 }, { x: 1440, y: 2040 }],
  [{ x: 1900, y: 2560 }, { x: 1980, y: 2470 }, { x: 1930, y: 2370 }, { x: 2040, y: 2290 }],
  [{ x: 1240, y: 1180 }, { x: 1340, y: 1240 }, { x: 1300, y: 1340 }],
  [{ x: 1960, y: 2010 }, { x: 1860, y: 1950 }, { x: 1900, y: 1850 }],
];
const CREVICE_BOX: Box = { x: 700, y: 540, w: 1800, h: 2080 };

function bakeCrevices(ctx: Ctx, tile: Box, pal: Palette): void {
  if (!overlaps(tile, CREVICE_BOX)) return;
  for (const [w, c, dy] of [[9, rgba(pal.SHADOW, 190), 0], [3, rgba(STYLES.cliff.edge, 120), -4]] as const) {
    pen(ctx, c, w);
    ctx.beginPath();
    for (const path of CREVICES) path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y + dy) : ctx.moveTo(p.x, p.y + dy)));
    ctx.stroke();
  }
}

/** Lava seams that run between the basalt columns, over the ground. */
const LAVA: Pt[][] = [
  [
    { x: 2420, y: 2560 },
    { x: 2560, y: 2600 },
    { x: 2640, y: 2700 },
    { x: 2770, y: 2720 },
  ],
  [
    { x: 2660, y: 2450 },
    { x: 2720, y: 2560 },
    { x: 2860, y: 2600 },
  ],
  [
    { x: 2540, y: 2860 },
    { x: 2640, y: 2820 },
    { x: 2700, y: 2900 },
  ],
];
const LAVA_BOX: Box = { x: 2400, y: 2440, w: 480, h: 480 };

/** The crater at the heart: concentric rims, sunk into the crag. */
const CENTRE: Pt = { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };
const CRATER_BOX: Box = { x: CENTRE.x - 560, y: CENTRE.y - 560, w: 1120, h: 1120 };

const fillPoly = (ctx: Ctx, pts: Pt[], dx: number, dy: number): void => {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x + dx, p.y + dy) : ctx.moveTo(p.x + dx, p.y + dy)));
  ctx.closePath();
};

/** A raised tier: the dark south face, then the lit top and its lip. */
function tier(ctx: Ctx, pts: Pt[], lift: number, top: Rgb, face: Rgb, lip: Rgb): void {
  ctx.fillStyle = rgba(face, 255);
  fillPoly(ctx, pts, 0, lift);
  ctx.fill();
  ctx.fillStyle = rgba(top, 255);
  fillPoly(ctx, pts, 0, 0);
  ctx.fill();
  pen(ctx, rgba(lip, 150), 3);
  ctx.stroke();
}

/** An outline with its straight edges broken into short, wandering ones (a rock terrace is never ruled). */
function rough(pts: Pt[], step: number, amp: number, seed: number): Pt[] {
  const out: Pt[] = [];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / step));
    const nx = (b.y - a.y) / len;
    const ny = -(b.x - a.x) / len;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const off = k === 0 ? 0 : (hash(seed + i, k) - 0.5) * 2 * amp;
      out.push({ x: a.x + (b.x - a.x) * t + nx * off, y: a.y + (b.y - a.y) * t + ny * off });
    }
  });
  return out;
}
const insetCross = (t: number, seed: number): Pt[] =>
  rough(CRAG_OUTLINE.map(v => ({ x: v.at.x + v.in.x * t, y: v.at.y + v.in.y * t })), 70, 26, seed);
const TIERS: { pts: Pt[]; lift: number; top: Rgb }[] = [
  { pts: insetCross(150, 11), lift: 14, top: [62, 76, 100] },
  { pts: insetCross(225, 23), lift: 12, top: [76, 90, 114] },
  { pts: blob(CENTRE.x, CENTRE.y, 540, 540, 301, 28, 0.06, 0.1), lift: 16, top: [88, 100, 124] },
  { pts: blob(CENTRE.x, CENTRE.y, 400, 400, 302, 26, 0.06, 0.1), lift: 16, top: [102, 114, 138] },
  { pts: blob(CENTRE.x, CENTRE.y, 290, 290, 303, 24, 0.05, 0.1), lift: 18, top: [118, 128, 150] },
];
/** Tide pools on the western tiers, and the pearl-white spokes the four portals send to the crater. */
const POOLS_AT: Pt[] = [{ x: 1180, y: 760 }, { x: 1010, y: 1180 }, { x: 1260, y: 1010 }, { x: 2020, y: 2440 }, { x: 2190, y: 2020 }, { x: 1940, y: 2190 }];

function bakeCrater(ctx: Ctx, tile: Box, pal: Palette): void {
  if (!overlaps(tile, { x: 700, y: 540, w: 1800, h: 2120 })) return;
  const lip = STYLES.cliff.edge;
  const face: Rgb = [18, 26, 42];
  for (const t of TIERS) {
    const b = { x: t.pts.reduce((m, p) => Math.min(m, p.x), 1e9), y: t.pts.reduce((m, p) => Math.min(m, p.y), 1e9), w: 0, h: 0 };
    b.w = t.pts.reduce((m, p) => Math.max(m, p.x), 0) - b.x;
    b.h = t.pts.reduce((m, p) => Math.max(m, p.y), 0) - b.y + t.lift;
    if (overlaps(tile, b)) tier(ctx, t.pts, t.lift, t.top, face, lip);
  }
  if (!overlaps(tile, CRATER_BOX)) return;
  // Spokes: each portal's biome colour runs along its diagonal into the crater.
  BEDS.forEach((bed, i) => {
    const sx = i === 0 || i === 3 ? -1 : 1;
    const sy = i < 2 ? -1 : 1;
    const dir = { x: sx * 0.7071, y: sy * 0.7071 };
    for (const [w, a] of [[16, 60], [5, 170]] as const) {
      pen(ctx, rgba(bed.edge, a), w);
      ctx.beginPath();
      ctx.moveTo(CENTRE.x + dir.x * 210, CENTRE.y + dir.y * 210);
      ctx.lineTo(CENTRE.x + dir.x * 520, CENTRE.y + dir.y * 520);
      ctx.stroke();
    }
  });
  // Tide pools on the tiers.
  for (const p of POOLS_AT) {
    fillEllipse(ctx, rgba(lip, 200), p.x, p.y, 52, 34);
    fillEllipse(ctx, rgba(pal.WATER, 255), p.x, p.y + 2, 46, 29);
    fillEllipse(ctx, rgba(pal.DEEP, 255), p.x + 2, p.y + 4, 34, 20);
  }
  // The crater itself: standing stones round the rim, then the sunk water.
  fillEllipse(ctx, rgba(pal.SHADOW, 170), CENTRE.x, CENTRE.y + 10, 214, 200);
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU + hash(k, 3) * 0.2;
    const r = 198 + hash(k, 9) * 14;
    const x = CENTRE.x + Math.cos(a) * r;
    const y = CENTRE.y + Math.sin(a) * r * 0.94;
    fillEllipse(ctx, rgba(pal.SHADOW, 200), x, y + 10, 20 + hash(k, 1) * 8, 12);
    fillEllipse(ctx, rgba(k % 3 ? [112, 126, 150] : lip, 255), x, y, 16 + hash(k, 1) * 8, 18 + hash(k, 2) * 12);
  }
  fillEllipse(ctx, rgba(lip, 230), CENTRE.x, CENTRE.y, 188, 174);
  fillEllipse(ctx, rgba(pal.SEABED, 255), CENTRE.x, CENTRE.y + 4, 170, 156);
  fillEllipse(ctx, rgba(pal.DEEP, 255), CENTRE.x, CENTRE.y + 6, 124, 114);
  fillEllipse(ctx, rgba(pal.ABYSS, 255), CENTRE.x, CENTRE.y + 8, 56, 52);
  pen(ctx, rgba(pal.WATER, 130), 3);
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    ctx.ellipse(CENTRE.x, CENTRE.y + 6, 160 - k * 26, 146 - k * 24, 0, k, k + 4.2);
    ctx.stroke();
  }
}

const PORTAL_BOXES: Box[] = PORTAL_SPOTS.map(p => ({ x: p.x - 150, y: p.y - 150, w: 300, h: 300 }));

function live(ctx: Ctx, view: View, timeMs: number, pal: Palette): void {
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 600);
  // The lava glows and breathes.
  if (sees(view, LAVA_BOX, 40)) {
    pen(ctx, rgba(pal.EMBER, 90 + 80 * pulse), 7);
    ctx.beginPath();
    for (const seam of LAVA) {
      seam.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    }
    ctx.stroke();
    pen(ctx, rgba(pal.LANTERN, 130 + 90 * pulse), 2.5);
    ctx.stroke();
  }
  // The crater turns.
  if (sees(view, CRATER_BOX, 40)) {
    pen(ctx, rgba(pal.FOAM, 120), 3);
    const a = timeMs / 1400;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(CENTRE.x, CENTRE.y + 6, 150 - k * 34, 138 - k * 31, 0, a * (1 + k * 0.4) + k * 1.6, a * (1 + k * 0.4) + k * 1.6 + 1.9);
      ctx.stroke();
    }
    fillEllipse(ctx, rgba(pal.WATER, 16 + 16 * pulse), CENTRE.x, CENTRE.y, 420, 400);
  }
  // A faint halo where each whirlpool sits, in its island's colour.
  PORTAL_BOXES.forEach((b, i) => {
    if (!sees(view, b, 40)) return;
    const c = BEDS[i].edge;
    fillEllipse(ctx, rgba(c, 18 + 14 * pulse), PORTAL_SPOTS[i].x, PORTAL_SPOTS[i].y, 150, 150);
  });
}

export const portalsArt = (): ReefDescription => ({
  size: MAP_SIZE,
  styles: STYLES,
  sea: PORTALS_SEA,
  rocks: PORTALS_ROCKS.map(r => (r.style && r.style in DETAIL ? { ...r, detail: DETAIL[r.style] } : r)),
  kelp: KELP,
  bakeFloor: bakeBeds,
  bake: (ctx, tile, pal) => {
    bakeCrater(ctx, tile, pal);
    bakeCrevices(ctx, tile, pal);
  },
  live,
});
