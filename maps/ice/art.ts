import type { Box, Pt } from '../../world/layout';
import type { Ctx, View } from '../../world/art/draw';
import { bounds, centroid, hash, inset, overlaps, pen, poly, rgba, sees } from '../../world/art/draw';
import type { Palette, ReefDescription, RockStyle } from '../../world/art/reef';
import { ICE_FLOES, ICE_FLOOR, ICE_REEDS, ICE_ROCKS, ICE_SEA, ICE_SIZE } from './layout';

/**
 * Vịnh Băng Trôi, painted: the reef art kit with a cold palette. Walls, reeds
 * and floors come from `layout.ts` (the polygons the geometry is made of); the
 * set piece is the floes themselves — `ICE_FLOES`, the very polygons of the
 * map's ice zone — painted as pale plates with cracks, so what looks slippery
 * is slippery.
 */
const TINT: Partial<Palette> = {
  ABYSS: [8, 22, 46],
  DEEP_WAVE: [34, 72, 116],
  SEABED: [168, 196, 214],
  SEABED_MARK: [132, 156, 180],
  SHADOW: [20, 34, 62],
  SAND: [246, 250, 253],
  SAND_DARK: [186, 206, 226],
  KELP: [86, 142, 150],
  KELP_LIGHT: [196, 238, 236],
};

const STYLES: Record<string, RockStyle> = {
  // Pressure ridge: slabs of blue ice pushed up on edge.
  ridge: { base: [64, 102, 148], top: [196, 224, 244], edge: [250, 253, 255], lift: 13 },
  crack: { base: [70, 108, 150], top: [172, 206, 232], edge: [236, 246, 255], lift: 4 },
  hummock: { base: [150, 176, 204], top: [242, 249, 255], edge: [255, 255, 255], lift: 8 },
  rock: { base: [50, 58, 80], top: [112, 122, 146], edge: [182, 194, 212], lift: 10 },
};

const FLOE_BOX: Box[] = ICE_FLOES.map(bounds);

/** Jagged line from the floe's middle out towards its rim: a fracture. */
function fracture(ctx: Ctx, c: Pt, to: Pt, seed: number): void {
  ctx.moveTo(c.x, c.y);
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const j = (hash(seed, i) - 0.5) * 26;
    ctx.lineTo(c.x + (to.x - c.x) * k + j, c.y + (to.y - c.y) * k - j * 0.6);
  }
}

function bakeFloes(ctx: Ctx, tile: Box, pal: Palette): void {
  const pad = { x: tile.x - 30, y: tile.y - 30, w: tile.w + 60, h: tile.h + 60 };
  ctx.lineJoin = 'round';
  ICE_FLOES.forEach((pts, i) => {
    if (!overlaps(pad, FLOE_BOX[i])) return;
    ctx.fillStyle = rgba(pal.SHADOW, 120);
    poly(ctx, pts, 6, 10);
    ctx.fill();
    ctx.fillStyle = rgba([170, 214, 232]);
    poly(ctx, pts);
    ctx.fill();
    ctx.fillStyle = rgba([212, 240, 250]);
    poly(ctx, inset(pts, 12));
    ctx.fill();
    ctx.save();
    poly(ctx, pts);
    ctx.clip();
    const c = centroid(pts);
    pen(ctx, rgba([110, 168, 204], 170), 2);
    ctx.beginPath();
    pts.forEach((p, k) => {
      if ((k + i) % 2 === 0) fracture(ctx, c, p, i * 13 + k);
    });
    ctx.stroke();
    // A pale sheen band, the way light lies on a clear plate.
    pen(ctx, rgba([255, 255, 255], 120), 5);
    const b = FLOE_BOX[i];
    ctx.beginPath();
    ctx.moveTo(b.x + b.w * 0.15, b.y + b.h * 0.7);
    ctx.lineTo(b.x + b.w * 0.45, b.y + b.h * 0.3);
    ctx.stroke();
    ctx.restore();
    pen(ctx, rgba([244, 253, 255]), 3);
    poly(ctx, pts);
    ctx.stroke();
  });
  ctx.lineJoin = 'miter';
}

/** Glints on the floes, and snow driven across the view. Cheap: two paths, culled to the view. */
function live(ctx: Ctx, view: View, timeMs: number, pal: Palette): void {
  const t = timeMs / 1000;
  ctx.lineCap = 'round';
  pen(ctx, rgba([255, 255, 255], 210), 2);
  ctx.beginPath();
  ICE_FLOES.forEach((_, i) => {
    const b = FLOE_BOX[i];
    if (!sees(view, b, 0)) return;
    for (let k = 0; k < 3; k++) {
      const a = Math.sin(t * 1.4 + hash(i, k) * 6.28);
      if (a < 0.55) continue;
      const r = 4 + a * 7;
      const x = b.x + b.w * (0.25 + 0.5 * hash(k, i));
      const y = b.y + b.h * (0.25 + 0.5 * hash(i + 3, k));
      ctx.moveTo(x - r, y);
      ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
    }
  });
  ctx.stroke();
  ctx.fillStyle = rgba(pal.SAND, 170);
  ctx.beginPath();
  const n = 26;
  for (let i = 0; i < n; i++) {
    const sp = 24 + hash(i, 1) * 30;
    const x = view.x + (((hash(i, 2) * view.w + t * sp) % view.w) + view.w) % view.w;
    const y = view.y + (((hash(i, 3) * view.h + t * sp * 0.45) % view.h) + view.h) % view.h;
    ctx.moveTo(x + 2.5, y);
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  }
  ctx.fill();
}

/**
 * The floes on the plain ground. Their zone is what makes a hero slide, and
 * core draws it with a clear fill because `bakeFloes` was the picture — so
 * with the art off this is the only thing that says where the ice is. One
 * flat fill and one outline for all of them.
 */
function plain(ctx: Ctx, view: View): void {
  ctx.beginPath();
  ICE_FLOES.forEach((pts, i) => {
    if (!sees(view, FLOE_BOX[i], 0)) return;
    pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  });
  ctx.fillStyle = rgba([170, 214, 232], 200);
  ctx.fill();
  pen(ctx, rgba([244, 253, 255]), 3);
  ctx.stroke();
}

export const iceArt = (): ReefDescription => ({
  size: ICE_SIZE,
  tint: TINT,
  styles: STYLES,
  sea: ICE_SEA,
  rocks: ICE_ROCKS,
  kelp: ICE_REEDS,
  floor: ICE_FLOOR,
  bakeFloor: bakeFloes,
  live,
  plain,
});
