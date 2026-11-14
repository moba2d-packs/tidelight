import type { Box, Pt } from '../../world/layout';
import type { Ctx, View } from '../../world/art/draw';
import { TAU, arcTo_, fillEllipse, hash, overlaps, pen, rgba, sees } from '../../world/art/draw';
import type { Palette, ReefDescription, RockArt, RockStyle } from '../../world/art/reef';
import { BALL_KELP, BALL_POOLS, BALL_ROCKS, BALL_SEA, CY, GOAL_HALF, MAP_SIZE, PITCH, POCKET } from './layout';

/**
 * Bóng Đá, painted: a tide-pool sandbar with a whale's jaws for goals. The walls,
 * the kelp and the sea are the geometry's own polygons (`layout.ts`); this file
 * adds the ground — wet sand, tide ripples, rock pools, the net pockets and every
 * pitch line — and the bone's growth lines and teeth.
 */
const TINT: Partial<Palette> = {
  ABYSS: [5, 17, 38],
  SHADOW: [3, 9, 22],
  DEEP_WAVE: [18, 52, 92],
  // Damp, low-tide sand rather than dry noon sand: the pitch is most of the
  // screen for a whole match, and the brighter pair read as glare (reported).
  // The pearl stays bright, which is the point — it has to pop against this.
  SAND: [178, 158, 120],
  SAND_DARK: [138, 118, 88],
  KELP: [34, 122, 90],
  KELP_LIGHT: [112, 200, 130],
};

const STYLES: Record<string, RockStyle> = {
  bone: { base: [168, 150, 132], top: [244, 236, 216], edge: [255, 252, 238], lift: 12 },
  boulder: { base: [58, 66, 88], top: [118, 132, 146], edge: [190, 206, 200], lift: 12 },
};

const LINE_W = 7;
const IN = 14;
const L = PITCH.left;
const R = PITCH.right;
const T = PITCH.top;
const B = PITCH.bottom;
const C = (L + R) / 2;
const PITCH_BOX: Box = { x: L - POCKET - 30, y: T - 30, w: R - L + 2 * POCKET + 60, h: B - T + 60 };

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

const poolCentre = (pts: Pt[]): Pt => ({ x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length });

/** The pitch's chalk: shell-white lines inset from the walls so none is half hidden. */
function lines(ctx: Ctx, pal: Palette): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  pen(ctx, rgba(pal.CREAM, 170), LINE_W + 1);
  ctx.beginPath();
  ctx.rect(L + IN, T + IN, R - L - 2 * IN, B - T - 2 * IN);
  ctx.moveTo(C, T + IN);
  ctx.lineTo(C, B - IN);
  ctx.moveTo(C + 120, CY);
  ctx.arc(C, CY, 120, 0, TAU);
  for (const dir of [1, -1]) {
    const x0 = dir > 0 ? L + IN : R - IN;
    // Big box, small box, and the D on the box's outer edge.
    ctx.moveTo(x0, CY - 330);
    ctx.lineTo(x0 + dir * 340, CY - 330);
    ctx.lineTo(x0 + dir * 340, CY + 330);
    ctx.lineTo(x0, CY + 330);
    ctx.moveTo(x0, CY - 190);
    ctx.lineTo(x0 + dir * 130, CY - 190);
    ctx.lineTo(x0 + dir * 130, CY + 190);
    ctx.lineTo(x0, CY + 190);
    const dx = x0 + dir * 340;
    ctx.moveTo(dx + dir * 120 * Math.cos(0.95), CY - 120 * Math.sin(0.95));
    ctx.arc(dx, CY, 120, dir > 0 ? -0.95 : Math.PI - 0.95 + 0.0, dir > 0 ? 0.95 : Math.PI + 0.95, false);
    // Corner arcs.
    for (const sy of [1, -1]) {
      const cx = x0;
      const cy = sy > 0 ? T + IN : B - IN;
      ctx.moveTo(cx + dir * 54, cy);
      ctx.arc(cx, cy, 54, dir > 0 ? (sy > 0 ? 0 : -Math.PI / 2) : sy > 0 ? Math.PI / 2 : Math.PI, dir > 0 ? (sy > 0 ? Math.PI / 2 : 0) : sy > 0 ? Math.PI : Math.PI * 1.5);
    }
  }
  ctx.stroke();
  fillEllipse(ctx, rgba(pal.CREAM, 160), C, CY, 22, 22);
  ctx.lineJoin = 'miter';
}

/** The net pocket: the whale's throat, dark water under a team-coloured net. */
function pocket(ctx: Ctx, x0: number, tint: readonly [number, number, number], pal: Palette): void {
  const y0 = CY - GOAL_HALF;
  ctx.fillStyle = rgba(pal.SHADOW, 250);
  ctx.fillRect(x0, y0, POCKET, GOAL_HALF * 2);
  ctx.fillStyle = rgba(tint as never, 70);
  ctx.fillRect(x0, y0, POCKET, GOAL_HALF * 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, POCKET, GOAL_HALF * 2);
  ctx.clip();
  pen(ctx, rgba(tint as never, 120), 2);
  ctx.beginPath();
  for (let k = -16; k < 24; k++) {
    ctx.moveTo(x0 + k * 18, y0);
    ctx.lineTo(x0 + k * 18 + GOAL_HALF * 2, y0 + GOAL_HALF * 2);
    ctx.moveTo(x0 + k * 18 + GOAL_HALF * 2, y0);
    ctx.lineTo(x0 + k * 18, y0 + GOAL_HALF * 2);
  }
  ctx.stroke();
  ctx.restore();
}

function bakeFloor(ctx: Ctx, tile: Box, pal: Palette): void {
  if (!overlaps({ x: tile.x - 10, y: tile.y - 10, w: tile.w + 20, h: tile.h + 20 }, PITCH_BOX)) return;
  // Wet sand, darker toward the waterline, lighter on the crown.
  const g = ctx.createLinearGradient(0, T, 0, B);
  g.addColorStop(0, rgba(pal.SAND_DARK));
  g.addColorStop(0.2, rgba(pal.SAND));
  g.addColorStop(0.5, rgba([194, 174, 132]));
  g.addColorStop(0.8, rgba(pal.SAND));
  g.addColorStop(1, rgba(pal.SAND_DARK));
  ctx.fillStyle = g;
  ctx.fillRect(L, T, R - L, B - T);
  // Tide bands: the ebb has left long, faint steps across the pitch.
  ctx.fillStyle = rgba(pal.SAND_DARK, 34);
  const band = (R - L) / 8;
  for (let i = 0; i < 8; i += 2) ctx.fillRect(L + i * band, T, band, B - T);
  // Ripple marks, as in the reef's sand.
  ctx.save();
  ctx.beginPath();
  ctx.rect(L, T, R - L, B - T);
  ctx.clip();
  pen(ctx, rgba(pal.SAND_DARK, 120), 3);
  ctx.beginPath();
  for (let gy = Math.floor(T / 70); gy * 70 < B; gy++) {
    for (let gx = Math.floor(L / 110); gx * 110 < R; gx++) {
      if (hash(gx + 5, gy) < 0.45) continue;
      const x = gx * 110 + hash(gy, gx) * 60;
      const y = gy * 70 + hash(gx, gy + 1) * 40;
      if (x < tile.x - 60 || x > tile.x + tile.w + 60 || y < tile.y - 60 || y > tile.y + tile.h + 60) continue;
      arcTo_(ctx, x, y, 70, 16, 0.15, Math.PI - 0.15);
    }
  }
  ctx.stroke();
  ctx.restore();
  // Rock pools: water, a ring of stones, a bright rim.
  for (const pts of BALL_POOLS) {
    const c = poolCentre(pts);
    if (c.x < tile.x - 140 || c.x > tile.x + tile.w + 140 || c.y < tile.y - 140 || c.y > tile.y + tile.h + 140) continue;
    ctx.fillStyle = rgba(pal.SHADOW, 110);
    ctx.save();
    ctx.translate(3, 6);
    smooth(ctx, pts);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = rgba(pal.WATER, 190);
    smooth(ctx, pts);
    ctx.fill();
    ctx.save();
    smooth(ctx, pts);
    ctx.clip();
    ctx.fillStyle = rgba([24, 96, 134], 150);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 4, 30, 14, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    pen(ctx, rgba(pal.FOAM, 200), 3);
    smooth(ctx, pts);
    ctx.stroke();
    pts.forEach((p, i) => {
      const r = 6 + hash(i, Math.round(c.x)) * 6;
      const out = 1.12;
      const sx = c.x + (p.x - c.x) * out;
      const sy = c.y + (p.y - c.y) * out;
      fillEllipse(ctx, rgba([88, 96, 108], 240), sx, sy + 1, r * 2.2, r * 1.6);
      fillEllipse(ctx, rgba([176, 186, 184], 240), sx - 1, sy - 1, r * 1.7, r * 1.2);
    });
  }
  pocket(ctx, L - POCKET, pal.TIDE, pal);
  pocket(ctx, R, pal.EMBER, pal);
  lines(ctx, pal);
  // Goal mouths: a bar of the court's colour on the line, between the posts.
  for (const [x, c] of [
    [L, pal.TIDE],
    [R - 10, pal.EMBER],
  ] as const) {
    ctx.fillStyle = rgba(c, 235);
    ctx.fillRect(x, CY - GOAL_HALF, 10, GOAL_HALF * 2);
  }
}

/** The jaw's teeth, sockets and sutures: a row of ivory pegs down each ramus, hollow eyes in the skull. */
function boneDetail(ctx: Ctx, rock: RockArt, pal: Palette): void {
  ctx.lineJoin = 'round';
  pen(ctx, rgba(pal.SHADOW, 80), 2);
  for (const part of rock.parts) {
    partPath(ctx, part);
    ctx.stroke();
  }
  for (const part of rock.parts) {
    if (part.length === 4) {
      // Two teeth a quad, set in dark sockets along the middle of the bone.
      const a = { x: (part[0].x + part[3].x) / 2, y: (part[0].y + part[3].y) / 2 };
      const b = { x: (part[1].x + part[2].x) / 2, y: (part[1].y + part[2].y) / 2 };
      for (const k of [0.28, 0.72]) {
        const x = a.x + (b.x - a.x) * k;
        const y = a.y + (b.y - a.y) * k;
        fillEllipse(ctx, rgba(pal.SHADOW, 190), x, y, 17, 17);
        fillEllipse(ctx, rgba([255, 252, 238]), x, y - 1, 11, 11);
        fillEllipse(ctx, rgba([198, 186, 164], 200), x + 1.5, y, 5, 7);
      }
    } else if (part.length > 6) {
      const cx = part.reduce((q, p) => q + p.x, 0) / part.length;
      const out = cx > MAP_SIZE / 2 ? -1 : 1;
      const x0 = out > 0 ? 0 : MAP_SIZE;
      const eye = (dy: number): void => {
        const ex = x0 + out * 96;
        const ey = out > 0 ? CY + dy : CY - dy;
        fillEllipse(ctx, rgba(pal.SHADOW, 235), ex, ey, 34, 26);
        fillEllipse(ctx, rgba([60, 74, 98], 255), ex + out * 2, ey + 2, 22, 16);
      };
      eye(-86);
      eye(86);
      pen(ctx, rgba(pal.SHADOW, 90), 3);
      ctx.beginPath();
      ctx.moveTo(x0 + out * 150, CY - 20);
      ctx.quadraticCurveTo(x0 + out * 90, CY, x0 + out * 150, CY + 20);
      ctx.moveTo(x0 + out * 20, CY);
      ctx.lineTo(x0 + out * 70, CY);
      ctx.stroke();
    }
  }
  ctx.lineJoin = 'miter';
}

function live(ctx: Ctx, view: View, timeMs: number, pal: Palette): void {
  if (!sees(view, PITCH_BOX, 40)) return;
  // A glint travelling across each pool.
  const t = timeMs / 1400;
  ctx.strokeStyle = rgba(pal.FOAM, 150);
  ctx.lineWidth = 2;
  ctx.beginPath();
  BALL_POOLS.forEach((pts, i) => {
    const c = poolCentre(pts);
    const k = (t + i * 0.37) % 1;
    arcTo_(ctx, c.x - 22 + k * 44, c.y - 4, 20, 7, Math.PI * 1.1, Math.PI * 1.9);
  });
  ctx.stroke();
}

export const ballArt = (): ReefDescription => ({
  size: MAP_SIZE,
  tint: TINT,
  styles: STYLES,
  sea: BALL_SEA,
  rocks: BALL_ROCKS.map(r => (r.style === 'bone' ? { ...r, detail: boneDetail } : r)),
  kelp: BALL_KELP,
  bakeFloor,
  live,
});
