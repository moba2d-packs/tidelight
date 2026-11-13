import type { Box, Pt } from '../../world/layout';
import type { Ctx, View } from '../../world/art/draw';
import { fillEllipse, overlaps, pen, rgba, sees } from '../../world/art/draw';
import type { Palette, ReefDescription, RockArt } from '../../world/art/reef';
import { blob } from '../../world/art/shapes';
import { HULL_X0, HULL_X1, gunwaleY, LANE_Y, MAZE_KELP, MAZE_ROCKS, MAZE_SEA, MAZE_SIZE } from './layout';

/**
 * Nghĩa Địa Tàu Đắm, painted: the reef art kit fed with this map's lists.
 * The walls, rocks and kelp come straight from `layout.ts` (the polygons the
 * geometry is made of); what is added here is mood and two set pieces — the
 * galleon's deck under the lane, and the ghost lantern on its gunwale.
 */

/** A murkier, greener sea than Driftglass: the graveyard is deep and old. */
const TINT: Partial<Palette> = {
  ABYSS: [6, 13, 30],
  SEABED: [17, 38, 54],
  SEABED_MARK: [28, 58, 74],
  CHANNEL: [12, 28, 44],
  SHADOW: [3, 8, 20],
  KELP: [44, 120, 84],
  KELP_LIGHT: [118, 190, 120],
};

const dotAt = (ctx: Ctx, p: Pt, r: number, color: string): void => fillEllipse(ctx, color, p.x, p.y, r * 2, r * 2);

/** A ship's side: seams between planks, and a round port in every other plank. */
function shipDetail(ctx: Ctx, rock: RockArt, pal: Palette): void {
  ctx.lineJoin = 'round';
  pen(ctx, rgba(pal.SHADOW, 110), 2);
  rock.parts.forEach((part, i) => {
    ctx.beginPath();
    part.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    if (i % 2 === 0 && part.length === 4) {
      const cx = (part[0].x + part[1].x + part[2].x + part[3].x) / 4;
      const cy = (part[0].y + part[1].y + part[2].y + part[3].y) / 4;
      if (Math.hypot(part[0].x - part[3].x, part[0].y - part[3].y) > 36) {
        dotAt(ctx, { x: cx, y: cy }, 6, rgba(pal.SHADOW, 200));
        dotAt(ctx, { x: cx - 1, y: cy - 1 }, 3.5, rgba([196, 154, 132], 200));
      }
    }
  });
  ctx.lineJoin = 'miter';
}

/** The lane's channel and the galleon's interior deck: floor, drawn low-contrast so it never reads as a wall. */
function bakeDeck(ctx: Ctx, tile: Box, pal: Palette): void {
  const reach = { x: HULL_X0 - 20, y: 960, w: HULL_X1 - HULL_X0 + 40, h: 480 };
  if (!overlaps({ x: tile.x - 20, y: tile.y - 20, w: tile.w + 40, h: tile.h + 40 }, reach)) return;
  ctx.save();
  ctx.beginPath();
  for (let x = HULL_X0; x <= HULL_X1; x += 20) {
    if (x === HULL_X0) ctx.moveTo(x, gunwaleY(x));
    else ctx.lineTo(x, gunwaleY(x));
  }
  for (let x = HULL_X1; x >= HULL_X0; x -= 20) ctx.lineTo(x, MAZE_SIZE - gunwaleY(x));
  ctx.closePath();
  ctx.fillStyle = rgba([40, 28, 44], 120);
  ctx.fill();
  ctx.clip();
  pen(ctx, rgba(pal.SHADOW, 90), 2);
  ctx.beginPath();
  for (let y = 980; y < 1430; y += 30) {
    ctx.moveTo(HULL_X0, y);
    ctx.lineTo(HULL_X1, y);
  }
  ctx.stroke();
  ctx.restore();
}

function bakeLane(ctx: Ctx, tile: Box, pal: Palette): void {
  if (tile.y > LANE_Y + 140 || tile.y + tile.h < LANE_Y - 140) return;
  ctx.fillStyle = rgba(pal.SHADOW, 70);
  ctx.beginPath();
  ctx.roundRect(300, LANE_Y - 96, MAZE_SIZE - 600, 192, 96);
  ctx.fill();
  ctx.fillStyle = rgba(pal.CHANNEL, 150);
  ctx.beginPath();
  ctx.roundRect(300, LANE_Y - 90, MAZE_SIZE - 600, 180, 90);
  ctx.fill();
}

/** The ghost lanterns riding the galleon's gunwales, and bubbles rising out of the hull. */
const LANTERNS: Pt[] = [
  { x: 1200, y: gunwaleY(1200) + 4 },
  { x: 1200, y: MAZE_SIZE - (gunwaleY(1200) + 4) },
];
const BUBBLE_FIELD: Box = { x: HULL_X0, y: 940, w: HULL_X1 - HULL_X0, h: 520 };

function live(ctx: Ctx, view: View, timeMs: number, pal: Palette): void {
  if (!sees(view, BUBBLE_FIELD, 80)) return;
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 600);
  for (const l of LANTERNS) {
    fillEllipse(ctx, rgba(pal.LANTERN, 30 + 28 * pulse), l.x, l.y - 4, 96, 96);
    fillEllipse(ctx, rgba(pal.LANTERN, 230), l.x, l.y - 4, 16, 16);
    fillEllipse(ctx, rgba(pal.LANTERN_HOT, 255), l.x, l.y - 5, 7, 7);
  }
  ctx.fillStyle = rgba(pal.FOAM, 120);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const cycle = 5200 + (i % 4) * 700;
    const ph = ((timeMs + i * 977) % cycle) / cycle;
    const x = HULL_X0 + 60 + ((i * 211) % (HULL_X1 - HULL_X0 - 120)) + Math.sin(ph * 9 + i) * 6;
    const y = 1260 - (i % 2) * 120 - ph * 220;
    const r = 2 + (i % 3);
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

export const mazeArt = (): ReefDescription => ({
  size: MAZE_SIZE,
  tint: TINT,
  sea: MAZE_SEA,
  rocks: MAZE_ROCKS.map(r => (r.detail === 'planks' ? { ...r, detail: shipDetail } : r)),
  kelp: MAZE_KELP,
  floor: [
    // Drifts of sand where the fleet went down: the bases' approach and the lane's far ends.
    { kind: 'mud', points: blob(520, 1480, 150, 90, 71, 10, 0.2) },
    { kind: 'mud', points: blob(MAZE_SIZE - 520, MAZE_SIZE - 1480, 150, 90, 72, 10, 0.2) },
    { kind: 'mud', points: blob(900, 520, 110, 160, 73, 10, 0.2) },
    { kind: 'mud', points: blob(MAZE_SIZE - 900, MAZE_SIZE - 520, 110, 160, 74, 10, 0.2) },
  ],
  bakeFloor: (ctx, tile, pal) => {
    bakeLane(ctx, tile, pal);
    bakeDeck(ctx, tile, pal);
  },
  live,
});
