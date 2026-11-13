import type { Box, Pt } from '../../world/layout';
import type { Ctx, View } from '../../world/art/draw';
import { TAU, centroid, fillEllipse, hash, overlaps, pen, rgba, sees } from '../../world/art/draw';
import type { Palette, ReefDescription, RockArt, RockStyle } from '../../world/art/reef';
import { blob } from '../../world/art/shapes';
import {
  HILL_BASES,
  HILL_ISLANDS,
  HILL_KELP,
  HILL_MAP_SIZE,
  HILL_PEARLS,
  HILL_ROCKS,
  HILL_SEA,
  RING_RX,
  RING_RY,
  RING_STANDS,
} from './layout';

/**
 * Vua Đảo, painted: an atoll in a warm sea. The reef ring, the lighthouse and the
 * two gatehouses, the wreck and the kelp are the geometry's own polygons
 * (`layout.ts`); this file adds the lagoon, the sandbars the ruins stand on, the
 * foam on the reef, the paving, and the lighthouse's lamp, which sweeps the lagoon.
 */
const TINT: Partial<Palette> = {
  ABYSS: [6, 22, 52],
  SHADOW: [4, 16, 34],
  DEEP_WAVE: [20, 66, 110],
  SEABED: [30, 112, 128],
  SEABED_MARK: [46, 140, 146],
  CHANNEL: [18, 84, 118],
  SAND: [238, 220, 170],
  SAND_DARK: [196, 168, 118],
  KELP: [36, 126, 92],
  KELP_LIGHT: [116, 204, 132],
};

const STYLES: Record<string, RockStyle> = {
  atoll: { base: [138, 104, 96], top: [232, 214, 170], edge: [255, 246, 220], lift: 12 },
  tower: { base: [150, 54, 52], top: [240, 232, 214], edge: [255, 250, 236], lift: 22 },
  ruin: { base: [84, 82, 90], top: [168, 164, 156], edge: [222, 216, 194], lift: 10 },
  lamp: { base: [160, 56, 52], top: [238, 232, 216], edge: [255, 250, 236], lift: 14 },
};

const C = HILL_MAP_SIZE / 2;
const LIGHT = HILL_ISLANDS[0];
const NORTH = HILL_ISLANDS[1];
const SOUTH = HILL_ISLANDS[2];
const LAGOON: Box = { x: C - RING_RX - 80, y: C - RING_RY - 80, w: 2 * RING_RX + 160, h: 2 * RING_RY + 160 };
const BEAM_BOX: Box = { x: LIGHT.x - 520, y: LIGHT.y - 520, w: 1040, h: 1040 };
const LENS_AT = { x: LIGHT.x, y: LIGHT.y - 22 };

const near = (tile: Box, b: Box): boolean => overlaps({ x: tile.x - 20, y: tile.y - 20, w: tile.w + 40, h: tile.h + 40 }, b);
const partPath = (ctx: Ctx, part: Pt[]): void => {
  ctx.beginPath();
  part.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
};

const smooth = (ctx: Ctx, pts: Pt[]): void => {
  const n = pts.length;
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  ctx.beginPath();
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
  }
  ctx.closePath();
};

// ------------------------------------------------------------ rock detail

/** A palm seen from above: a dark crown and a star of fronds. */
function palm(ctx: Ctx, x: number, y: number, seed: number, pal: Palette): void {
  pen(ctx, rgba([34, 112, 78], 255), 5);
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + hash(seed, i) * 0.5;
    const r = 20 + hash(i, seed) * 6;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5 - 6, x + Math.cos(a) * r, y + Math.sin(a) * r + 3);
  }
  ctx.stroke();
  pen(ctx, rgba(pal.KELP_LIGHT, 255), 2.5);
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + hash(seed, i) * 0.5;
    const r = 15 + hash(i, seed) * 4;
    ctx.moveTo(x, y - 2);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r - 1);
  }
  ctx.stroke();
  fillEllipse(ctx, rgba([88, 58, 40], 255), x, y, 7, 7);
}

/** Sand-and-coral reef: polyps scattered over the ring, and the odd palm where it is wide enough. */
function atollDetail(ctx: Ctx, rock: RockArt, pal: Palette, tile: Box): void {
  rock.parts.forEach((part, i) => {
    const c = centroid(part);
    if (c.x < tile.x - 120 || c.x > tile.x + tile.w + 120 || c.y < tile.y - 120 || c.y > tile.y + tile.h + 120) return;
    for (let k = 0; k < 5; k++) {
      const x = c.x + (hash(i, k) - 0.5) * 70;
      const y = c.y + (hash(k, i + 3) - 0.5) * 70;
      const r = 3 + hash(i + k, k) * 4;
      fillEllipse(ctx, rgba(k % 2 ? pal.CORAL : [196, 120, 112], 215), x, y, r * 2, r * 2);
    }
    if (c.y > 460 && c.y < 1940 && hash(i, 77) > 0.72) palm(ctx, c.x, c.y - 4, i, pal);
  });
}

/** Cut stone: seams on every piece and moss on some. */
function ruinDetail(ctx: Ctx, rock: RockArt, pal: Palette): void {
  ctx.lineJoin = 'round';
  pen(ctx, rgba(pal.SHADOW, 120), 2);
  rock.parts.forEach(part => {
    partPath(ctx, part);
    ctx.stroke();
  });
  rock.parts.forEach((part, i) => {
    const c = centroid(part);
    if (hash(i, 9) > 0.55) {
      fillEllipse(ctx, rgba([66, 128, 84], 170), c.x - 4, c.y - 2, 24 + hash(i, 4) * 14, 14);
      fillEllipse(ctx, rgba([112, 176, 112], 150), c.x - 6, c.y - 4, 12, 7);
    }
    if (part.length === 8) {
      // A tower top: courses of stone as rings, and a black door.
      fillEllipse(ctx, rgba(pal.SHADOW, 90), c.x, c.y, 62, 62);
      fillEllipse(ctx, rgba([132, 128, 126], 255), c.x, c.y, 40, 40);
    }
  });
  ctx.lineJoin = 'miter';
}

/** The lighthouse from above: red and white bands, the gallery ring, the lens. */
function towerDetail(ctx: Ctx, rock: RockArt, pal: Palette): void {
  const c = rock.centre;
  fillEllipse(ctx, rgba([196, 62, 56]), c.x, c.y, 132, 132);
  fillEllipse(ctx, rgba(pal.CREAM), c.x, c.y, 100, 100);
  fillEllipse(ctx, rgba([196, 62, 56]), c.x, c.y, 70, 70);
  fillEllipse(ctx, rgba(pal.SHADOW, 230), c.x, c.y, 44, 44);
  fillEllipse(ctx, rgba(pal.LANTERN), c.x, c.y, 34, 34);
  fillEllipse(ctx, rgba(pal.LANTERN_HOT), c.x - 3, c.y - 3, 14, 14);
}

/** The felled shaft: red and white drum bands; the lantern room's glass. */
function lampDetail(ctx: Ctx, rock: RockArt, pal: Palette): void {
  rock.parts.forEach((part, i) => {
    if (part.length === 8) {
      const c = centroid(part);
      fillEllipse(ctx, rgba(pal.SHADOW, 200), c.x, c.y, 62, 62);
      fillEllipse(ctx, rgba([150, 200, 210], 230), c.x, c.y, 50, 50);
      fillEllipse(ctx, rgba(pal.LANTERN, 160), c.x + 4, c.y + 3, 28, 24);
      return;
    }
    ctx.fillStyle = rgba(i % 2 ? [196, 62, 56] : pal.CREAM, 255);
    partPath(ctx, part);
    ctx.fill();
  });
  ctx.lineJoin = 'round';
  pen(ctx, rgba(pal.SHADOW, 110), 2);
  rock.parts.forEach(part => {
    partPath(ctx, part);
    ctx.stroke();
  });
  ctx.lineJoin = 'miter';
}

// ------------------------------------------------------------ the ground

const SANDBARS: Pt[][] = [
  blob(LIGHT.x, LIGHT.y, 262, 250, 51, 14, 0.07),
  blob(NORTH.x, NORTH.y, 290, 215, 52, 14, 0.07),
  blob(SOUTH.x, SOUTH.y, 290, 215, 53, 14, 0.07),
  blob(850, 1700, 140, 100, 54, 12, 0.1),
  blob(1550, 700, 140, 100, 55, 12, 0.1),
  blob(885, 905, 190, 130, 56, 12, 0.1),
  blob(1515, 1495, 190, 130, 57, 12, 0.1),
];

function sandbar(ctx: Ctx, pts: Pt[], pal: Palette, tile: Box): void {
  ctx.fillStyle = rgba(pal.SEABED_MARK, 120);
  ctx.save();
  ctx.translate(0, 0);
  smooth(ctx, pts);
  pen(ctx, rgba(pal.FOAM, 90), 22);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = rgba(pal.SAND_DARK, 215);
  smooth(ctx, pts);
  ctx.fill();
  const c = centroid(pts);
  ctx.fillStyle = rgba(pal.SAND, 255);
  ctx.save();
  smooth(ctx, pts);
  ctx.translate(c.x, c.y);
  ctx.scale(0.9, 0.9);
  ctx.translate(-c.x, -c.y);
  smooth(ctx, pts);
  ctx.fill();
  ctx.restore();
  ctx.save();
  smooth(ctx, pts);
  ctx.clip();
  pen(ctx, rgba(pal.SAND_DARK, 130), 3);
  ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const x = c.x + (hash(i, Math.round(c.x)) - 0.5) * 640;
    const y = c.y + (hash(Math.round(c.y), i) - 0.5) * 520;
    if (x < tile.x - 60 || x > tile.x + tile.w + 60 || y < tile.y - 60 || y > tile.y + tile.h + 60) continue;
    ctx.moveTo(x - 36, y);
    ctx.quadraticCurveTo(x, y + 14, x + 36, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** Flagstones of a courtyard: a ring of paving, drawn pale and low so it never looks like a wall. */
function paveDisc(ctx: Ctx, cx: number, cy: number, r: number, pal: Palette): void {
  fillEllipse(ctx, rgba([150, 146, 138], 150), cx, cy, r * 2, r * 2);
  pen(ctx, rgba(pal.SHADOW, 70), 2);
  ctx.beginPath();
  for (const k of [0.34, 0.56, 0.78]) {
    ctx.moveTo(cx + r * k, cy);
    ctx.arc(cx, cy, r * k, 0, TAU);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    ctx.moveTo(cx + Math.cos(a) * r * 0.34, cy + Math.sin(a) * r * 0.34);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.stroke();
}

function bakeFloor(ctx: Ctx, tile: Box, pal: Palette): void {
  if (near(tile, LAGOON)) {
    // The lagoon: deep blue at the heart, shallow green-white where it meets the reef; feathered, so the channels' mouths just fade.
    ctx.save();
    ctx.translate(C, C);
    ctx.scale(1, RING_RY / RING_RX);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, RING_RX + 20);
    g.addColorStop(0, 'rgba(20,86,138,0.96)');
    g.addColorStop(0.6, 'rgba(34,134,166,0.92)');
    g.addColorStop(0.88, 'rgba(92,206,196,0.85)');
    g.addColorStop(1, 'rgba(150,232,204,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, RING_RX + 20, 0, TAU);
    ctx.fill();
    ctx.restore();
    // Foam where the swell breaks on the reef: only where the ring stands.
    ctx.save();
    pen(ctx, rgba(pal.FOAM, 170), 136);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    RING_STANDS.forEach((stands, k) => {
      if (!stands) return;
      const a0 = (k / RING_STANDS.length) * TAU;
      const a1 = ((k + 1) / RING_STANDS.length) * TAU;
      ctx.moveTo(C + RING_RX * Math.cos(a0), C + RING_RY * Math.sin(a0));
      ctx.ellipse(C, C, RING_RX, RING_RY, 0, a0, a1);
    });
    ctx.stroke();
    ctx.restore();
  }
  for (const s of SANDBARS) {
    const b = { x: Math.min(...s.map(p => p.x)), y: Math.min(...s.map(p => p.y)), w: 0, h: 0 };
    b.w = Math.max(...s.map(p => p.x)) - b.x;
    b.h = Math.max(...s.map(p => p.y)) - b.y;
    if (near(tile, b)) sandbar(ctx, s, pal, tile);
  }
  // Courtyard paving under each ruin.
  if (near(tile, { x: LIGHT.x - 210, y: LIGHT.y - 210, w: 420, h: 420 })) paveDisc(ctx, LIGHT.x, LIGHT.y, 206, pal);
  for (const at of [NORTH, SOUTH]) {
    if (!near(tile, { x: at.x - 260, y: at.y - 200, w: 520, h: 400 })) continue;
    fillEllipse(ctx, rgba([150, 146, 138], 150), at.x, at.y, 380, 250);
    pen(ctx, rgba(pal.SHADOW, 70), 2);
    ctx.beginPath();
    for (let k = -3; k <= 3; k++) {
      ctx.moveTo(at.x + k * 50, at.y - 130);
      ctx.lineTo(at.x + k * 50, at.y + 130);
    }
    ctx.stroke();
  }
  // A shell cradle under each pearl.
  for (const p of HILL_PEARLS) {
    if (!near(tile, { x: p.x - 40, y: p.y - 40, w: 80, h: 80 })) continue;
    fillEllipse(ctx, rgba(pal.SHADOW, 120), p.x + 2, p.y + 6, 50, 24);
    fillEllipse(ctx, rgba([246, 190, 188], 255), p.x, p.y + 3, 46, 26);
    pen(ctx, rgba([200, 120, 124], 255), 2);
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(p.x, p.y + 12);
      ctx.lineTo(p.x + i * 9, p.y - 6);
    }
    ctx.stroke();
  }
}

function live(ctx: Ctx, view: View, timeMs: number, pal: Palette): void {
  if (!sees(view, BEAM_BOX, 60)) return;
  // The lamp turns once every 12 s: a long pale wedge over the sand and the water, and a glow in the lens.
  const a = (timeMs / 12000) * TAU;
  for (const [reach, spread, alpha] of [
    [500, 0.2, 26],
    [330, 0.1, 30],
  ] as const) {
    ctx.fillStyle = rgba(pal.LANTERN_HOT, alpha);
    ctx.beginPath();
    ctx.moveTo(LENS_AT.x, LENS_AT.y);
    ctx.arc(LENS_AT.x, LENS_AT.y, reach, a - spread, a + spread);
    ctx.closePath();
    ctx.fill();
  }
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 420);
  fillEllipse(ctx, rgba(pal.LANTERN, 40 + 40 * pulse), LENS_AT.x, LENS_AT.y, 120, 120);
  fillEllipse(ctx, rgba(pal.LANTERN), LENS_AT.x, LENS_AT.y, 34, 34);
  fillEllipse(ctx, rgba(pal.LANTERN_HOT), LENS_AT.x - 3, LENS_AT.y - 3, 14, 14);
}

export const hillArt = (): ReefDescription => ({
  size: HILL_MAP_SIZE,
  tint: TINT,
  styles: STYLES,
  sea: HILL_SEA,
  rocks: HILL_ROCKS.map(r => {
    if (r.style === 'atoll') return { ...r, detail: atollDetail };
    if (r.style === 'tower') return { ...r, detail: towerDetail };
    if (r.style === 'lamp') return { ...r, detail: lampDetail };
    if (r.style === 'ruin') return { ...r, detail: ruinDetail };
    return r;
  }),
  kelp: HILL_KELP,
  floor: [
    { kind: 'sand', points: blob(HILL_BASES.blue.x, HILL_BASES.blue.y, 230, 270, 61, 12, 0.08) },
    { kind: 'sand', points: blob(HILL_MAP_SIZE - HILL_BASES.blue.x, HILL_BASES.blue.y, 230, 270, 62, 12, 0.08) },
    ...[
      [460, 560],
      [460, 1840],
      [1940, 560],
      [1940, 1840],
    ].map(([x, y], i) => ({ kind: 'sand' as const, points: blob(x, y, 150, 110, 63 + i, 12, 0.1) })),
  ],
  bakeFloor,
  live,
});
