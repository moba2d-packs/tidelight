import type { Box, Pt } from '../../world/layout';
import type { Ctx, View } from '../../world/art/draw';
import { TAU, arcTo_, fillEllipse, overlaps, pen, rgba, sees } from '../../world/art/draw';
import type { Palette, ReefDescription, RockArt } from '../../world/art/reef';
import { blob } from '../../world/art/shapes';
import { CLAM, DUEL_KELP, DUEL_POOLS, DUEL_ROCKS, DUEL_SEA, DUEL_SIZE, TERRACE_INNER } from './layout';

/**
 * Đấu Trường Vỏ Sò, painted: the reef art kit fed with this map's lists. Walls,
 * rocks and kelp are the geometry's own polygons (`layout.ts`); added here are
 * the amphitheatre's raked sand, the terraces' steps, the clam's ribs and mouth,
 * and a pearl that glints.
 */
const TINT: Partial<Palette> = {
  ABYSS: [8, 14, 38],
  SEABED: [30, 52, 82],
  SEABED_MARK: [44, 74, 108],
  SAND: [214, 188, 150],
  SAND_DARK: [168, 138, 110],
  KELP: [40, 132, 100],
  KELP_LIGHT: [110, 204, 138],
};

const C = DUEL_SIZE / 2;

const ringAt = (k: number, extra: number): Pt => {
  const a = (k / TERRACE_INNER.length) * TAU;
  return { x: C + Math.cos(a) * (TERRACE_INNER[k] + extra), y: C + Math.sin(a) * (TERRACE_INNER[k] + extra) };
};

/** The terrace ring: one step up, a darker upper tier, a lit lip where they meet. Inside the clip: wall only. */
function terraceDetail(ctx: Ctx, rock: RockArt, pal: Palette): void {
  const n = TERRACE_INNER.length;
  const step = (extra: number): void => {
    ctx.beginPath();
    for (let k = 0; k <= n; k++) {
      const p = ringAt(k % n, extra);
      if (k === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  };
  // The upper tier: everything beyond the first step, darker.
  ctx.fillStyle = rgba(rock.style.base, 120);
  step(54);
  ctx.rect(-400, -400, DUEL_SIZE + 800, DUEL_SIZE + 800);
  ctx.fill('evenodd');
  ctx.lineJoin = 'round';
  pen(ctx, rgba(rock.style.edge, 220), 4);
  step(54);
  ctx.stroke();
  pen(ctx, rgba(pal.SHADOW, 90), 3);
  step(112);
  ctx.stroke();
  // Pitting in the coral.
  ctx.fillStyle = rgba(rock.style.base, 140);
  ctx.beginPath();
  for (let i = 0; i < 150; i++) {
    const a = hashf(i, 1) * TAU;
    const r = 520 + hashf(i, 2) * 180;
    const x = C + Math.cos(a) * r;
    const y = C + Math.sin(a) * r;
    ctx.moveTo(x + 5, y);
    ctx.arc(x, y, 3 + hashf(i, 3) * 4, 0, TAU);
  }
  ctx.fill();
  ctx.lineJoin = 'miter';
}

const hashf = (a: number, b: number): number => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A valve's ribs fan out from its hinge, with growth rings across them. */
const valve = (hingeY: number, dir: 1 | -1, radius: number) => (ctx: Ctx, rock: RockArt, pal: Palette): void => {
  pen(ctx, rgba(rock.style.base, 190), 3);
  ctx.beginPath();
  for (let i = -5; i <= 5; i++) {
    const a = (dir > 0 ? Math.PI / 2 : -Math.PI / 2) + i * 0.27;
    ctx.moveTo(C, hingeY);
    ctx.lineTo(C + Math.cos(a) * radius, hingeY + Math.sin(a) * radius);
  }
  ctx.stroke();
  pen(ctx, rgba(rock.style.edge, 160), 3);
  ctx.beginPath();
  for (const k of [0.5, 0.72, 0.92]) arcTo_(ctx, C, hingeY, radius * 2 * k, radius * 2 * k, dir > 0 ? 0.1 : Math.PI + 0.1, dir > 0 ? Math.PI - 0.1 : TAU - 0.1);
  ctx.stroke();
  void pal;
};

const CLAM_BOX: Box = { x: C - 190, y: C - 190, w: 380, h: 380 };

/** The clam's open mouth and its pearl, over both valves. Wall footprint only: the valves cover all of it. */
function bakeClam(ctx: Ctx, tile: Box, pal: Palette): void {
  if (!overlaps({ x: tile.x - 10, y: tile.y - 10, w: tile.w + 20, h: tile.h + 20 }, CLAM_BOX)) return;
  fillEllipse(ctx, rgba(pal.SHADOW, 240), C, CLAM.y, 276, 40);
  fillEllipse(ctx, rgba([236, 124, 138], 240), C, CLAM.y + 3, 250, 22);
  fillEllipse(ctx, rgba(pal.SHADOW, 110), C + 3, CLAM.y + 6, 50, 50);
  fillEllipse(ctx, rgba(pal.PEARL), C, CLAM.y - 1, 44, 44);
  fillEllipse(ctx, rgba([255, 255, 255], 230), C - 8, CLAM.y - 10, 12, 12);
}

function bakeFloor(ctx: Ctx, tile: Box, pal: Palette): void {
  // The amphitheatre's raked rings, on the sand: ground, thin and low.
  if (!overlaps({ x: tile.x - 10, y: tile.y - 10, w: tile.w + 20, h: tile.h + 20 }, { x: C - 520, y: C - 520, w: 1040, h: 1040 })) return;
  pen(ctx, rgba(pal.SAND_DARK, 120), 3);
  for (const r of [250, 340, 430]) {
    ctx.beginPath();
    ctx.ellipse(C, C, r, r, 0, 0, TAU);
    ctx.stroke();
  }
}

function live(ctx: Ctx, view: View, timeMs: number, pal: Palette): void {
  if (!sees(view, CLAM_BOX, 40)) return;
  const glint = 0.5 + 0.5 * Math.sin(timeMs / 500);
  fillEllipse(ctx, rgba(pal.PEARL, 22 + 36 * glint), C, CLAM.y, 90 + 28 * glint, 90 + 28 * glint);
  fillEllipse(ctx, rgba(pal.PEARL), C, CLAM.y - 1, 44, 44);
  fillEllipse(ctx, rgba([255, 255, 255], 230), C - 8, CLAM.y - 10, 12, 12);
}

export const duelArt = (): ReefDescription => ({
  size: DUEL_SIZE,
  tint: TINT,
  sea: DUEL_SEA,
  rocks: DUEL_ROCKS.map((r, i) => {
    if (i === 0) return { ...r, detail: terraceDetail };
    return { ...r, detail: valve(CLAM.y + (i === 1 ? -13 : 13), i === 1 ? 1 : -1, 145) };
  }),
  kelp: DUEL_KELP,
  floor: [{ kind: 'sand', points: blob(C, C, 560, 540, 51, 24, 0.04) }, ...DUEL_POOLS],
  bakeFloor,
  bake: bakeClam,
  live,
});
