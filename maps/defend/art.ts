import type { Box, Pt } from '../../world/layout';
import type { Ctx, View } from '../../world/art/draw';
import { TAU, fillEllipse, hash, overlaps, pen, rgba, sees } from '../../world/art/draw';
import type { Palette, ReefDescription, RockArt, RockDetail, RockStyle } from '../../world/art/reef';
import { blob } from '../../world/art/shapes';
import { offsetPath } from '../../world/art/coast';
import {
  DEFEND_ROCKS,
  DEFEND_SIZE,
  HARBOUR,
  KELP,
  LANTERN,
  PIER_BROKEN,
  PIER_OUT,
  POOLS,
  SAND_ISLAND,
  SEA_WALLS,
  causewayY,
  pierAt,
} from './layout';

/**
 * Thủ Đèn, painted: a lighthouse island. The walls, rocks and kelp are the
 * polygons of `layout.ts` (the art cannot disagree with them); what is added here
 * is ground — the causeway's paving, the pier's deck, the quay — and two things
 * that stand on the headland and over the water: the lighthouse and its beam.
 */

const STYLES: Record<string, RockStyle> = {
  cliff: { base: [34, 44, 62], top: [82, 96, 116], edge: [148, 170, 184], lift: 12 },
  stone: { base: [66, 72, 92], top: [146, 152, 162], edge: [224, 220, 206], lift: 9 },
};

const near = (tile: Box, b: Box, pad = 24): boolean => overlaps({ x: tile.x - pad, y: tile.y - pad, w: tile.w + 2 * pad, h: tile.h + 2 * pad }, b);

/** Rock strata: wavy courses across a cliff, on a world grid so tiles agree at their seams. */
function strata(ctx: Ctx, rock: RockArt, _pal: Palette, tile: Box): void {
  if (!near(tile, rock.box, 20)) return;
  const gap = 26;
  const y0 = Math.max(Math.floor((tile.y - 20) / gap) * gap, Math.floor(rock.box.y / gap) * gap);
  const y1 = Math.min(tile.y + tile.h + 20, rock.box.y + rock.box.h + gap);
  const x0 = Math.max(tile.x - 40, rock.box.x - 40);
  const x1 = Math.min(tile.x + tile.w + 40, rock.box.x + rock.box.w + 40);
  pen(ctx, rgba(rock.style.base, 150), 3);
  ctx.beginPath();
  for (let y = y0; y <= y1; y += gap) {
    const row = Math.round(y / gap);
    for (let x = Math.floor(x0 / 40) * 40; x <= x1; x += 40) {
      const wy = y + Math.sin(x / 55 + row * 1.7) * 5 + (hash(Math.floor(x / 40), row) - 0.5) * 7;
      if (x === Math.floor(x0 / 40) * 40) ctx.moveTo(x, wy);
      else if (hash(row, Math.floor(x / 40)) < 0.22) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
  }
  ctx.stroke();
  pen(ctx, rgba(rock.style.edge, 70), 2);
  ctx.beginPath();
  for (let y = y0 + 3; y <= y1; y += gap * 2) {
    const row = Math.round(y / gap);
    for (let x = Math.floor(x0 / 40) * 40; x <= x1; x += 40) {
      const wy = y + Math.sin(x / 55 + row * 1.7) * 5;
      if (x === Math.floor(x0 / 40) * 40 || hash(row + 9, Math.floor(x / 40)) < 0.4) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
  }
  ctx.stroke();
}

/** Dressed stone: every piece outlined, a mortar line across the long ones. */
function masonry(ctx: Ctx, rock: RockArt, pal: Palette, tile: Box): void {
  if (!near(tile, rock.box, 20)) return;
  ctx.lineJoin = 'round';
  pen(ctx, rgba(pal.SHADOW, 120), 2);
  ctx.beginPath();
  for (const part of rock.parts) {
    part.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    if (part.length === 4) {
      const mx = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const a = mx(part[0], part[3]);
      const b = mx(part[1], part[2]);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
  }
  ctx.stroke();
  pen(ctx, rgba(rock.style.edge, 90), 2);
  ctx.beginPath();
  rock.parts.forEach((part, i) => {
    if (i % 3 !== 0) return;
    const c = part.reduce((s, p) => ({ x: s.x + p.x / part.length, y: s.y + p.y / part.length }), { x: 0, y: 0 });
    ctx.moveTo(c.x - 7, c.y - 2);
    ctx.lineTo(c.x + 7, c.y - 2);
  });
  ctx.stroke();
  ctx.lineJoin = 'miter';
}

/** Tufts of coral and weed on the plain reef rock, on a world grid so tiles agree at their seams. */
function tufts(ctx: Ctx, rock: RockArt, pal: Palette, tile: Box): void {
  if (!near(tile, rock.box, 20)) return;
  const step = 46;
  const gx0 = Math.floor(Math.max(tile.x - 20, rock.box.x) / step);
  const gx1 = Math.ceil(Math.min(tile.x + tile.w + 20, rock.box.x + rock.box.w) / step);
  const gy0 = Math.floor(Math.max(tile.y - 20, rock.box.y) / step);
  const gy1 = Math.ceil(Math.min(tile.y + tile.h + 20, rock.box.y + rock.box.h) / step);
  const colours = [pal.CORAL, pal.REEF_EDGE, pal.KELP_LIGHT];
  colours.forEach((c, ci) => {
    pen(ctx, rgba(c, 210), 3);
    ctx.beginPath();
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        if (hash(gx * 3 + ci, gy) > 0.2 || Math.floor(hash(gy, gx) * 3) !== ci) continue;
        const x = gx * step + hash(gx, gy + 5) * step * 0.8;
        const y = gy * step + hash(gy, gx + 7) * step * 0.8;
        const h = 9 + hash(gx + gy, 3) * 9;
        ctx.moveTo(x, y + 6);
        ctx.lineTo(x, y - h);
        ctx.moveTo(x, y - h * 0.3);
        ctx.lineTo(x - 7, y - h * 0.8);
        ctx.moveTo(x, y - h * 0.5);
        ctx.lineTo(x + 7, y - h);
      }
    }
    ctx.stroke();
  });
}

/** What each style is dressed with. */
const DETAIL: Record<string, RockDetail> = { cliff: strata, stone: masonry, reef: tufts };

// ------------------------------------------------------------ floor set pieces

const CAUSE_X0 = 330;
const CAUSE_X1 = 960;
const CAUSE_BOX: Box = { x: CAUSE_X0 - 20, y: 1090, w: CAUSE_X1 - CAUSE_X0 + 40, h: 220 };

/** The causeway's paving: slabs laid between the parapets, a few lost to the sea. */
function bakeCauseway(ctx: Ctx, tile: Box, pal: Palette): void {
  if (!near(tile, CAUSE_BOX)) return;
  ctx.save();
  ctx.beginPath();
  // Ragged ends: the causeway was longer once.
  ctx.moveTo(CAUSE_X0 + 24, causewayY(CAUSE_X0) - 88);
  ctx.lineTo(CAUSE_X0 - 8, causewayY(CAUSE_X0) - 46);
  ctx.lineTo(CAUSE_X0 + 16, causewayY(CAUSE_X0) - 6);
  ctx.lineTo(CAUSE_X0 - 14, causewayY(CAUSE_X0) + 40);
  ctx.lineTo(CAUSE_X0 + 20, causewayY(CAUSE_X0) + 88);
  for (let x = CAUSE_X0 + 40; x <= CAUSE_X1 - 30; x += 20) ctx.lineTo(x, causewayY(x) + 88);
  ctx.lineTo(CAUSE_X1 + 6, causewayY(CAUSE_X1) + 50);
  ctx.lineTo(CAUSE_X1 - 20, causewayY(CAUSE_X1) + 10);
  ctx.lineTo(CAUSE_X1 + 10, causewayY(CAUSE_X1) - 38);
  ctx.lineTo(CAUSE_X1 - 26, causewayY(CAUSE_X1) - 88);
  for (let x = CAUSE_X1 - 40; x >= CAUSE_X0 + 40; x -= 20) ctx.lineTo(x, causewayY(x) - 88);
  ctx.closePath();
  ctx.fillStyle = rgba([92, 98, 112], 255);
  ctx.fill();
  ctx.clip();
  pen(ctx, rgba(pal.SHADOW, 110), 2);
  ctx.beginPath();
  for (let x = CAUSE_X0, i = 0; x <= CAUSE_X1; x += 34, i++) {
    ctx.moveTo(x + (i % 2) * 8, causewayY(x) - 90);
    ctx.lineTo(x + (i % 2) * 8, causewayY(x) + 90);
  }
  for (const k of [-0.5, 0.5]) {
    ctx.moveTo(CAUSE_X0, causewayY(CAUSE_X0) + k * 88);
    for (let x = CAUSE_X0; x <= CAUSE_X1; x += 20) ctx.lineTo(x, causewayY(x) + k * 88);
  }
  ctx.stroke();
  // Slabs the tide has taken: seabed showing through the paving.
  ctx.fillStyle = rgba(pal.SEABED, 230);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const x = CAUSE_X0 + hash(i, 5) * (CAUSE_X1 - CAUSE_X0);
    const y = causewayY(x) + (hash(i, 9) - 0.5) * 150;
    ctx.rect(x, y, 14 + hash(i, 2) * 22, 9 + hash(i, 3) * 12);
  }
  ctx.fill();
  ctx.restore();
}

const PIER_ANGLE = Math.atan2(pierAt(1).y - pierAt(0).y, pierAt(1).x - pierAt(0).x);
const PIER_BOX: Box = (() => {
  const a = pierAt(PIER_OUT - 20);
  const b = pierAt(PIER_BROKEN + 40);
  return { x: Math.min(a.x, b.x) - 100, y: Math.min(a.y, b.y) - 100, w: Math.abs(a.x - b.x) + 200, h: Math.abs(a.y - b.y) + 200 };
})();

/** The pier's deck, laid in the pier's own frame: boards across, a few gone, the end ragged. */
function bakePier(ctx: Ctx, tile: Box, pal: Palette): void {
  if (!near(tile, PIER_BOX)) return;
  ctx.save();
  const o = pierAt(0);
  ctx.translate(o.x, o.y);
  ctx.rotate(PIER_ANGLE);
  const half = 66;
  // The stringers.
  ctx.fillStyle = rgba([54, 36, 52], 255);
  ctx.fillRect(PIER_OUT + 10, -half - 4, PIER_BROKEN - PIER_OUT, 8);
  ctx.fillRect(PIER_OUT + 10, half - 4, PIER_BROKEN - PIER_OUT - 40, 8);
  for (let s = PIER_OUT + 14, i = 0; s < PIER_BROKEN; s += 22, i++) {
    // Past the break the boards thin out to a few ragged ones.
    const ragged = s > PIER_BROKEN - 110;
    if (hash(i, 77) < 0.1 || (ragged && hash(i, 78) < 0.45)) continue;
    const reach = ragged ? 0.45 + 0.55 * hash(i, 79) : 1;
    const tone = hash(i, 80);
    ctx.fillStyle = rgba(tone < 0.5 ? [128, 88, 90] : [112, 76, 82], 255);
    ctx.fillRect(s, -half * (hash(i, 81) < 0.5 ? 1 : reach), 18, half * 2 * (ragged ? reach : 1));
    ctx.fillStyle = rgba(pal.SHADOW, 90);
    ctx.fillRect(s + 17, -half, 2, half * 2);
  }
  ctx.restore();
}

/** The lantern's platform, the road down to the quay, the quay and its jetty. */
const PLATFORM = blob(LANTERN.x, LANTERN.y, 128, 120, 801, 11, 0.04);
const QUAY = blob(HARBOUR.x, HARBOUR.y + 6, 205, 176, 802, 13, 0.05);
const FLOOR_BOX: Box = { x: 1000, y: 1060, w: 400, h: 1010 };

function bakePlaza(ctx: Ctx, tile: Box, pal: Palette): void {
  if (!near(tile, FLOOR_BOX)) return;
  const smooth = (pts: Pt[]): void => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  };
  // The road: paving from the lantern's foot down to the harbour.
  ctx.fillStyle = rgba([98, 104, 118], 255);
  ctx.beginPath();
  ctx.moveTo(LANTERN.x - 42, LANTERN.y + 90);
  ctx.lineTo(LANTERN.x + 42, LANTERN.y + 90);
  ctx.lineTo(HARBOUR.x + 56, HARBOUR.y - 130);
  ctx.lineTo(HARBOUR.x - 56, HARBOUR.y - 130);
  ctx.closePath();
  ctx.fill();
  for (const [poly, base] of [
    [PLATFORM, [112, 118, 130]],
    [QUAY, [100, 106, 120]],
  ] as const) {
    ctx.fillStyle = rgba(pal.SHADOW, 150);
    smooth(poly.map(p => ({ x: p.x + 5, y: p.y + 9 })));
    ctx.fill();
    ctx.fillStyle = rgba(base, 255);
    smooth(poly);
    ctx.fill();
    ctx.save();
    smooth(poly);
    ctx.clip();
    pen(ctx, rgba(pal.SHADOW, 90), 2);
    ctx.beginPath();
    for (let y = Math.floor((tile.y - 10) / 30) * 30; y < tile.y + tile.h + 10; y += 30) {
      ctx.moveTo(1000, y);
      ctx.lineTo(1400, y);
    }
    for (let y = Math.floor((tile.y - 10) / 30) * 30, i = 0; y < tile.y + tile.h + 10; y += 30, i++) {
      for (let x = 1000 + (i % 2) * 20; x < 1400; x += 40) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 30);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
  // The lantern's rose: a compass inlaid in the platform.
  pen(ctx, rgba(pal.LANTERN, 150), 3);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const r = i % 2 ? 56 : 104;
    ctx.moveTo(LANTERN.x, LANTERN.y);
    ctx.lineTo(LANTERN.x + Math.cos(a) * r, LANTERN.y + Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(LANTERN.x, LANTERN.y, 62, 58, 0, 0, TAU);
  ctx.stroke();
  // The jetty: planks running out through the breakwater's mouth, mooring posts at its sides.
  ctx.fillStyle = rgba([54, 36, 52], 255);
  ctx.fillRect(HARBOUR.x - 40, HARBOUR.y + 150, 80, 420);
  for (let y = HARBOUR.y + 156, i = 0; y < HARBOUR.y + 566; y += 18, i++) {
    ctx.fillStyle = rgba(i % 2 ? [128, 88, 90] : [112, 76, 82], 255);
    ctx.fillRect(HARBOUR.x - 38, y, 76, 15);
  }
  ctx.fillStyle = rgba(pal.SHADOW, 220);
  ctx.beginPath();
  for (let y = HARBOUR.y + 190; y < HARBOUR.y + 560; y += 90) {
    for (const x of [HARBOUR.x - 46, HARBOUR.x + 46]) ctx.rect(x - 6, y - 6, 12, 12);
  }
  ctx.fill();
}

// ------------------------------------------------------------ over the rock, over the water

const LAMP: Pt = { x: LANTERN.x, y: 742 };
const TOWER_BOX: Box = { x: LANTERN.x - 90, y: 690, w: 180, h: 320 };

/** The lighthouse: a striped tower standing on the headland, drawn up from its foot. */
function bakeTower(ctx: Ctx, tile: Box, pal: Palette): void {
  if (!near(tile, TOWER_BOX)) return;
  const cx = LANTERN.x;
  const foot = 982;
  const top = 786;
  const wFoot = 96;
  const wTop = 60;
  const width = (y: number): number => wTop + ((wFoot - wTop) * (y - top)) / (foot - top);
  ctx.fillStyle = rgba(pal.SHADOW, 150);
  ctx.beginPath();
  ctx.moveTo(cx - wFoot / 2 + 8, foot + 6);
  ctx.lineTo(cx + wFoot / 2 + 40, foot + 12);
  ctx.lineTo(cx + wTop / 2 + 30, top + 12);
  ctx.lineTo(cx - wTop / 2 + 8, top + 8);
  ctx.closePath();
  ctx.fill();
  // Plinth.
  ctx.fillStyle = rgba([120, 126, 138], 255);
  ctx.fillRect(cx - 66, foot - 14, 132, 24);
  ctx.fillStyle = rgba([170, 174, 182], 255);
  ctx.fillRect(cx - 66, foot - 14, 132, 7);
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const y0 = top + ((foot - 14 - top) * i) / bands;
    const y1 = top + ((foot - 14 - top) * (i + 1)) / bands;
    ctx.fillStyle = rgba(i % 2 ? [226, 92, 80] : pal.CREAM, 255);
    ctx.beginPath();
    ctx.moveTo(cx - width(y0) / 2, y0);
    ctx.lineTo(cx + width(y0) / 2, y0);
    ctx.lineTo(cx + width(y1) / 2, y1);
    ctx.lineTo(cx - width(y1) / 2, y1);
    ctx.closePath();
    ctx.fill();
    // The shaded side.
    ctx.fillStyle = rgba(pal.SHADOW, 70);
    ctx.beginPath();
    ctx.moveTo(cx + width(y0) / 6, y0);
    ctx.lineTo(cx + width(y0) / 2, y0);
    ctx.lineTo(cx + width(y1) / 2, y1);
    ctx.lineTo(cx + width(y1) / 6, y1);
    ctx.closePath();
    ctx.fill();
  }
  // Door and slit windows.
  ctx.fillStyle = rgba(pal.SHADOW, 230);
  ctx.fillRect(cx - 9, foot - 44, 18, 30);
  ctx.fillRect(cx - 3, 870, 6, 18);
  ctx.fillRect(cx - 3, 920, 6, 18);
  // Gallery, lamp room, roof.
  ctx.fillStyle = rgba([54, 46, 64], 255);
  ctx.fillRect(cx - 44, top - 10, 88, 14);
  ctx.fillStyle = rgba(pal.LANTERN, 255);
  ctx.fillRect(cx - 24, top - 52, 48, 42);
  ctx.fillStyle = rgba(pal.LANTERN_HOT, 255);
  ctx.fillRect(cx - 14, top - 46, 28, 30);
  ctx.fillStyle = rgba([54, 46, 64], 255);
  ctx.fillRect(cx - 26, top - 54, 4, 46);
  ctx.fillRect(cx + 22, top - 54, 4, 46);
  ctx.fillStyle = rgba([196, 70, 64], 255);
  ctx.beginPath();
  ctx.moveTo(cx - 34, top - 52);
  ctx.lineTo(cx + 34, top - 52);
  ctx.lineTo(cx, top - 88);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - 2, top - 104, 4, 18);
}

const BEAM_BOX: Box = { x: LANTERN.x - 760, y: LAMP.y - 120, w: 1520, h: 1500 };
const PIER_TORCHES: Pt[] = [-1, 1].map(side => {
  const c = pierAt(PIER_OUT + 30);
  const o = pierAt(0);
  const n = { x: -(pierAt(1).y - o.y), y: pierAt(1).x - o.x };
  return { x: c.x + n.x * side * 96, y: c.y + n.y * side * 96 };
});
const LANTERN_BOX: Box = { x: LANTERN.x - 420, y: LANTERN.y - 420, w: 840, h: 840 };

function live(ctx: Ctx, view: View, timeMs: number, pal: Palette): void {
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 700);
  // The lantern's own glow: the reach of its bite.
  if (sees(view, LANTERN_BOX, 40)) {
    fillEllipse(ctx, rgba(pal.LANTERN, 14 + 10 * pulse), LANTERN.x, LANTERN.y, 780, 740);
    fillEllipse(ctx, rgba(pal.LANTERN, 18 + 12 * pulse), LANTERN.x, LANTERN.y, 520, 490);
    fillEllipse(ctx, rgba(pal.LANTERN_HOT, 26 + 14 * pulse), LANTERN.x, LANTERN.y, 250, 236);
  }
  // The beam, sweeping the island.
  if (sees(view, BEAM_BOX, 40)) {
    const a = (timeMs / 1000) * 0.32;
    for (const [len, half, alpha] of [
      [760, 0.2, 18],
      [560, 0.1, 26],
    ] as const) {
      ctx.fillStyle = rgba(pal.LANTERN, alpha);
      ctx.beginPath();
      ctx.moveTo(LAMP.x, LAMP.y);
      ctx.arc(LAMP.x, LAMP.y, len, a - half, a + half);
      ctx.closePath();
      ctx.fill();
    }
    fillEllipse(ctx, rgba(pal.LANTERN, 40 + 40 * pulse), LAMP.x, LAMP.y, 120, 120);
    fillEllipse(ctx, rgba(pal.LANTERN_HOT, 230), LAMP.x, LAMP.y, 30, 30);
  }
  // Torches at the pier's foot.
  if (sees(view, PIER_BOX, 40)) {
    for (const [i, t] of PIER_TORCHES.entries()) {
      const flick = 0.5 + 0.5 * Math.sin(timeMs / 130 + i * 2.1) * Math.sin(timeMs / 310 + i);
      fillEllipse(ctx, rgba(pal.EMBER, 26 + 30 * flick), t.x, t.y, 96, 96);
      fillEllipse(ctx, rgba(pal.LANTERN, 230), t.x, t.y - 4, 12, 16);
    }
  }
}

const INLET_LANE: Pt[] = [
  { x: 2100, y: 2140 },
  { x: 2000, y: 2040 },
  { x: 1650, y: 1660 },
  { x: 1290, y: 1310 },
];

export const defendArt = (): ReefDescription => ({
  size: DEFEND_SIZE,
  styles: STYLES,
  sea: SEA_WALLS,
  rocks: DEFEND_ROCKS.map(r => (r.style && r.style in DETAIL ? { ...r, detail: DETAIL[r.style] } : r)),
  kelp: KELP,
  floor: [
    { kind: 'sand', points: SAND_ISLAND },
    { kind: 'mud', points: blob(1650, 1640, 300, 150, 811, 14, 0.08, 0.1) },
    { kind: 'mud', points: blob(1880, 520, 240, 150, 812, 14, 0.08) },
    ...POOLS.map(points => ({ kind: 'pool' as const, points })),
    { kind: 'channel', points: [...offsetPath(INLET_LANE, -168), ...offsetPath(INLET_LANE, 168).reverse()] },
  ],
  bakeFloor: (ctx, tile, pal) => {
    bakeCauseway(ctx, tile, pal);
    bakePier(ctx, tile, pal);
    bakePlaza(ctx, tile, pal);
  },
  bake: bakeTower,
  live,
});
