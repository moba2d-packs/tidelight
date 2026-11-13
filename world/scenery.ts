import {
  BAND_BOTTOM,
  BAND_TOP,
  BASES,
  BLUE,
  CENTER,
  GATE_S,
  ISLANDS,
  KELP,
  MAP_SIZE,
  PEARL_BEDS_NORTH,
  PEARL_BEDS_SOUTH,
  RAIL_HALF,
  RAIL_Y,
  RED,
  SEA_WALLS,
  SHOAL_NORTH,
  SHOAL_SOUTH,
  WARDENS,
  railX,
  type Box,
  type Court,
  type Pt,
} from './layout';
import { INK, type Rgb } from './palette';
import {
  TAU, arcTo_, bounds, centroid, fillArc, fillEllipse, fillRect, hash, inset, overlaps, pen, poly, rgba, sees, seg, solid,
  type Ctx, type View,
} from './art/draw';
import { TileCache } from './art/tiles';

export type { View };

import type { Score, TideState } from './rules';

/**
 * The reef, painted. Core draws a map as grey walls on a dark field; this
 * paints all of it in Tidelight's own hand — cut-paper islands, sand shoals
 * that visibly flood and drain, a channel whose chevrons run the way the tide
 * does — and the map sets `paintsOwnTerrain` so core does not paint first.
 *
 * ## Two layers, because almost none of it moves
 *
 * The first version repainted every sheet of paper every frame: ~300 p5
 * calls, measured at 1.5–2.6ms of draw on a 4x-throttled CPU — more than every
 * champion on the screen together — and a frame twice as long as the same
 * match with the reef switched off. Nearly all of it was the same picture each
 * time.
 *
 * So the still half — sea, seabed, sand, channel bed, docks, islands — is
 * painted **once per world tile** into an offscreen canvas and blitted. Tiles
 * are keyed on the *world* grid and the zoom level, never on the camera
 * (core's `FogOfWar.performance.test.ts` is why: a camera-keyed cache misses
 * on every step the player takes). Core runs the sketch at `pixelDensity(1)`,
 * so a tile is ~1 MB and a screen is a handful of them.
 *
 * The moving half — waves, the water sheet, chevrons, lamp glows, kelp, the
 * gates — is drawn live, straight on the 2D context, one path per colour
 * rather than one p5 call per stroke.
 *
 * Everything here talks to `CanvasRenderingContext2D` directly and wraps
 * itself in `save()`/`restore()`: p5 caches the fill and stroke it last set,
 * and a raw write it does not know about must not outlive this function.
 */
export interface SceneState {
  timeMs: number;
  tide: TideState;
  score: Score;
  gateShut: Record<Court, boolean>;
}


// ------------------------------------------------------------ the still half

// Precomputed once: the polygons never change.
interface IslandArt {
  points: Pt[];
  top: Pt[];
  box: Box;
  centre: Pt;
  seed: number;
}
const islandArt = (points: Pt[], by: number): IslandArt => {
  const centre = centroid(points);
  return { points, top: inset(points, by), box: bounds(points), centre, seed: Math.round(centre.x + centre.y) };
};
const ISLAND_ART = ISLANDS.map(points => islandArt(points, 20));
const HEADLANDS = SEA_WALLS.slice(2).map(points => islandArt(points, 26));
const ALL_ISLANDS = [...HEADLANDS, ...ISLAND_ART];
const KELP_ART = KELP.map(points => bounds(points));

/** An island's still art, shadow included: what its box covers once drawn. */
const islandReach = (art: IslandArt): Box => ({
  x: art.box.x - 20,
  y: art.box.y - 50,
  w: art.box.w + 40,
  h: art.box.h + 70,
});

function bakeSeabed(ctx: Ctx, tile: Box): void {
  fillRect(ctx, solid(INK.SHADOW), 0, BAND_TOP - 14, MAP_SIZE, BAND_BOTTOM - BAND_TOP + 28);
  fillRect(ctx, solid(INK.SEABED), 0, BAND_TOP, MAP_SIZE, BAND_BOTTOM - BAND_TOP);
  // Sparse pebbles, deterministic per grid cell, so tiles agree at their seams.
  const step = 120;
  ctx.fillStyle = solid(INK.SEABED_MARK);
  ctx.beginPath();
  const gx0 = Math.max(0, Math.floor(tile.x / step) - 1);
  const gx1 = Math.min(Math.ceil(MAP_SIZE / step), Math.ceil((tile.x + tile.w) / step) + 1);
  const gy0 = Math.max(Math.ceil(BAND_TOP / step), Math.floor(tile.y / step) - 1);
  const gy1 = Math.min(Math.floor(BAND_BOTTOM / step) - 1, Math.ceil((tile.y + tile.h) / step) + 1);
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const r = hash(gx, gy);
      if (r < 0.45) continue;
      const x = gx * step + hash(gy, gx + 3) * step;
      const y = gy * step + r * step * 0.8;
      const w = 18 + r * 26;
      ctx.moveTo(x + w / 2, y);
      ctx.ellipse(x, y, w / 2, (8 + r * 8) / 2, 0, 0, TAU);
    }
  }
  ctx.fill();
}

function bakeShoal(ctx: Ctx, box: Box, beds: Pt[]): void {
  fillRect(ctx, rgba(INK.SHADOW, 150), box.x + 8, box.y + 12, box.w, box.h, 70);
  fillRect(ctx, solid(INK.SAND_DARK), box.x, box.y, box.w, box.h, 70);
  fillRect(ctx, solid(INK.SAND), box.x + 14, box.y + 12, box.w - 28, box.h - 30, 60);
  // Ripple marks in the sand.
  pen(ctx, rgba(INK.SAND_DARK, 170), 3);
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const x = box.x + 130 + i * ((box.w - 260) / 8);
    const y = box.y + 90 + (i % 3) * 86;
    arcTo_(ctx, x, y, 90, 22, 0.15, Math.PI - 0.15);
  }
  ctx.stroke();
  // Pearl beds: an open shell each. The ribs (pearl up) are drawn live.
  for (const bed of beds) {
    fillEllipse(ctx, rgba(INK.SHADOW, 110), bed.x + 3, bed.y + 8, 76, 30);
    fillArc(ctx, solid(INK.CORAL), bed.x, bed.y, 74, 56, Math.PI, TAU);
    fillArc(ctx, solid(INK.CREAM), bed.x, bed.y, 74, 30, 0, Math.PI);
  }
}

const CHANNEL_X0 = railX(-RAIL_HALF) - 60;
const CHANNEL_X1 = railX(RAIL_HALF) + 60;

function bakeChannel(ctx: Ctx, tile: Box): void {
  const x0 = CHANNEL_X0;
  const x1 = CHANNEL_X1;
  fillRect(ctx, rgba(INK.SHADOW, 160), x0, RAIL_Y - 92, x1 - x0, 184, 92);
  fillRect(ctx, solid(INK.CHANNEL), x0, RAIL_Y - 82, x1 - x0, 164, 82);
  // The rail's sleepers.
  pen(ctx, rgba(INK.CREAM, 46), 4);
  ctx.beginPath();
  for (let x = x0 + 80; x < x1 - 60; x += 46) {
    if (x < tile.x - 20 || x > tile.x + tile.w + 20) continue;
    seg(ctx, x, RAIL_Y - 9, x, RAIL_Y + 9);
  }
  ctx.stroke();
}

const berthX = (court: Court): number => railX(court === BLUE ? -RAIL_HALF : RAIL_HALF);
const courtInk = (court: Court): Rgb => (court === BLUE ? INK.TIDE : INK.EMBER);
const LIGHT_Y = [RAIL_Y - 150, RAIL_Y + 150];

function bakeDock(ctx: Ctx, court: Court): void {
  const base = BASES[court];
  const c = courtInk(court);
  fillEllipse(ctx, rgba(INK.SHADOW, 150), base.x + 8, base.y + 12, 440, 440);
  fillEllipse(ctx, solid(INK.REEF_BASE), base.x, base.y, 440, 440);
  fillEllipse(ctx, rgba(c, 60), base.x, base.y, 372, 372);
  pen(ctx, rgba(c, 210), 5);
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, 186, 186, 0, 0, TAU);
  ctx.stroke();
  // Planks.
  pen(ctx, rgba(INK.SHADOW, 90), 3);
  ctx.beginPath();
  for (let i = -3; i <= 3; i++) {
    const half = Math.sqrt(Math.max(0, 186 * 186 - i * 50 * (i * 50)));
    seg(ctx, base.x + i * 50, base.y - half, base.x + i * 50, base.y + half);
  }
  ctx.stroke();
  // The berth's and the two lights' shadows; what sits on them changes.
  const berth = berthX(court);
  fillRect(ctx, rgba(INK.SHADOW, 160), berth - 38, RAIL_Y - 46, 76, 96, 16);
  for (const y of LIGHT_Y) fillRect(ctx, rgba(INK.SHADOW, 160), berth - 15, y - 20, 34, 46, 10);
}

/** One island's paper sheets and coral. Baked, and redrawn live only over a flood. */
function paintIsland(ctx: Ctx, art: IslandArt): void {
  ctx.fillStyle = rgba(INK.SHADOW, 170);
  poly(ctx, art.points, 10, 16);
  ctx.fill();
  ctx.fillStyle = solid(INK.REEF_BASE);
  poly(ctx, art.points);
  ctx.fill();
  ctx.fillStyle = solid(INK.REEF_TOP);
  poly(ctx, art.top, -3, -7);
  ctx.fill();
  pen(ctx, rgba(INK.REEF_EDGE, 150), 3);
  ctx.stroke();
  // Coral sprigs, placed by hash.
  const c = art.centre;
  for (let i = 0; i < 4; i++) {
    const px = c.x + (hash(art.seed, i) - 0.5) * art.box.w * 0.55;
    const py = c.y + (hash(i, art.seed) - 0.5) * art.box.h * 0.4 - 6;
    const tall = 20 + hash(art.seed + i, 7) * 16;
    pen(ctx, rgba(i % 2 ? INK.CORAL : INK.REEF_EDGE, 235), 5);
    ctx.beginPath();
    seg(ctx, px, py + 10, px, py - tall);
    seg(ctx, px, py - tall * 0.3, px - 11, py - tall * 0.8);
    seg(ctx, px, py - tall * 0.5, px + 11, py - tall);
    ctx.stroke();
  }
}

/** Everything that never moves, for one world tile. `ctx` is already in world space. */
function bakeTile(ctx: Ctx, tile: Box): void {
  ctx.lineCap = 'round';
  ctx.fillStyle = solid(INK.ABYSS);
  ctx.fillRect(tile.x - 4, tile.y - 4, tile.w + 8, tile.h + 8);
  if (tile.y < BAND_BOTTOM + 14 && tile.y + tile.h > BAND_TOP - 14) bakeSeabed(ctx, tile);
  const pad = { x: tile.x - 30, y: tile.y - 30, w: tile.w + 60, h: tile.h + 60 };
  if (overlaps(pad, SHOAL_NORTH)) bakeShoal(ctx, SHOAL_NORTH, PEARL_BEDS_NORTH);
  if (overlaps(pad, SHOAL_SOUTH)) bakeShoal(ctx, SHOAL_SOUTH, PEARL_BEDS_SOUTH);
  if (overlaps(pad, { x: CHANNEL_X0, y: RAIL_Y - 100, w: CHANNEL_X1 - CHANNEL_X0, h: 200 })) bakeChannel(ctx, tile);
  for (const court of [BLUE, RED] as Court[]) {
    const base = BASES[court];
    const dock = { x: Math.min(base.x, berthX(court)) - 240, y: base.y - 240, w: 480 + Math.abs(base.x - berthX(court)), h: 480 };
    if (overlaps(pad, dock)) bakeDock(ctx, court);
  }
  for (const art of ALL_ISLANDS) if (overlaps(pad, islandReach(art))) paintIsland(ctx, art);
}

// ------------------------------------------------------------ the tile cache

/** The reef's tiles: the shared cache (`art/tiles.ts`) painting Driftglass's still half. */
export class ReefTiles extends TileCache {
  constructor() {
    super(MAP_SIZE, bakeTile);
  }
}

// ------------------------------------------------------------ the moving half

/** Open sea outside the map's square, where there are no tiles. */
function paintOuterSea(ctx: Ctx, view: View): void {
  const x0 = view.x - 4;
  const y0 = view.y - 4;
  const x1 = view.x + view.w + 4;
  const y1 = view.y + view.h + 4;
  if (x0 >= 0 && y0 >= 0 && x1 <= MAP_SIZE && y1 <= MAP_SIZE) return;
  ctx.fillStyle = solid(INK.ABYSS);
  if (y0 < 0) ctx.fillRect(x0, y0, x1 - x0, -y0);
  if (y1 > MAP_SIZE) ctx.fillRect(x0, MAP_SIZE, x1 - x0, y1 - MAP_SIZE);
  const my0 = Math.max(0, y0);
  const my1 = Math.min(MAP_SIZE, y1);
  if (x0 < 0) ctx.fillRect(x0, my0, -x0, my1 - my0);
  if (x1 > MAP_SIZE) ctx.fillRect(MAP_SIZE, my0, x1 - MAP_SIZE, my1 - my0);
}

const WAVE = rgba(INK.DEEP_WAVE, 200);

function paintWaves(ctx: Ctx, view: View, timeMs: number): void {
  // Little crescents on a staggered grid, drifting. One path, one stroke.
  const step = 150;
  const drift = (timeMs / 1000) * 9;
  const cx0 = Math.floor((view.x - drift) / step) - 1;
  const cx1 = Math.ceil((view.x + view.w - drift) / step) + 1;
  const cy0 = Math.floor(view.y / step) - 1;
  const cy1 = Math.ceil((view.y + view.h) / step) + 1;
  pen(ctx, WAVE, 3);
  ctx.beginPath();
  for (let gy = cy0; gy <= cy1; gy++) {
    const y = gy * step + 40;
    const inBand = y > BAND_TOP - 20 && y < BAND_BOTTOM + 20;
    for (let gx = cx0; gx <= cx1; gx++) {
      const x = gx * step + (gy % 2 ? step / 2 : 0) + drift + hash(gx, gy) * 40;
      // The seabed has its own marks; open sea beyond the map's ends does not.
      if (inBand && x > -40 && x < MAP_SIZE + 40) continue;
      arcTo_(ctx, x, y, 34 + hash(gy, gx) * 22, 14, Math.PI, TAU);
    }
  }
  ctx.stroke();
}

/** Islands whose still art the flood sheet of a shoal can reach. */
const ISLANDS_ON = (box: Box): IslandArt[] => ALL_ISLANDS.filter(art => overlaps(islandReach(art), box));
const FLOODABLE = { north: ISLANDS_ON(SHOAL_NORTH), south: ISLANDS_ON(SHOAL_SOUTH) };

function paintShoalLive(
  ctx: Ctx,
  view: View,
  box: Box,
  wet: number,
  beds: Pt[],
  pearlsUp: boolean,
  islands: IslandArt[],
  state: SceneState
): void {
  if (!sees(view, box, 60)) return;
  const t = state.timeMs / 1000;
  if (pearlsUp) {
    pen(ctx, solid(INK.CORAL), 2);
    ctx.beginPath();
    for (const bed of beds) {
      for (let rib = -2; rib <= 2; rib++) seg(ctx, bed.x, bed.y, bed.x + rib * 13, bed.y - 25 + Math.abs(rib) * 4);
    }
    ctx.stroke();
  }
  if (wet <= 0.02) return;
  // The water sheet: slides in from the sea side as the shoal floods.
  const seaSide = box.y < CENTER.y ? -1 : 1;
  const depth = box.h * wet;
  const y0 = seaSide < 0 ? box.y : box.y + box.h - depth;
  fillRect(ctx, rgba(INK.WATER, 150 + 70 * wet), box.x, y0, box.w, depth, 70);
  // Foam along the advancing edge.
  const edge = seaSide < 0 ? y0 + depth : y0;
  pen(ctx, rgba(INK.FOAM, 230), 5);
  ctx.beginPath();
  let first = true;
  for (let x = box.x + 60; x <= box.x + box.w - 60; x += 70) {
    const y = edge + Math.sin(x * 0.02 + t * 2.2) * 7 - seaSide * 4;
    if (first) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    first = false;
  }
  ctx.stroke();
  // Current streaks on the flooded sheet.
  if (wet > 0.6 && state.tide.favoured) {
    const dir = state.tide.favoured === BLUE ? 1 : -1;
    pen(ctx, rgba(INK.FOAM, 120), 3);
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const span = box.w - 240;
      const x = box.x + 120 + ((((i * 290 + dir * t * 150) % span) + span) % span);
      const y = box.y + 60 + ((i * 97) % (box.h - 120));
      seg(ctx, x, y, x + dir * 56, y);
    }
    ctx.stroke();
  }
  // An island the sheet has reached sits on top of it, as it always did —
  // clipped to the sheet, so its baked shadow outside the water is not doubled.
  const sheet = { x: box.x, y: y0, w: box.w, h: depth };
  for (const art of islands) {
    if (!sees(view, art.box) || !overlaps(islandReach(art), sheet)) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(sheet.x, sheet.y, sheet.w, sheet.h);
    ctx.clip();
    paintIsland(ctx, art);
    ctx.restore();
  }
}

function paintChevrons(ctx: Ctx, view: View, state: SceneState): void {
  const favoured = state.tide.favoured;
  if (!favoured) return;
  const t = state.timeMs / 1000;
  const dir = favoured === BLUE ? 1 : -1;
  pen(ctx, rgba(favoured === BLUE ? INK.TIDE : INK.EMBER, 150), 4);
  ctx.beginPath();
  const gap = 150;
  const offset = (((dir * t * 60) % gap) + gap) % gap;
  for (let x = CHANNEL_X0 + 60 + offset; x < CHANNEL_X1 - 60; x += gap) {
    if (x < view.x - 40 || x > view.x + view.w + 40) continue;
    for (const side of [-1, 1]) {
      const y = RAIL_Y + side * 48;
      seg(ctx, x - dir * 13, y - 11, x, y);
      seg(ctx, x - dir * 13, y + 11, x, y);
    }
  }
  ctx.stroke();
}

function paintDockLive(ctx: Ctx, view: View, court: Court, state: SceneState): void {
  const berth = berthX(court);
  if (!sees(view, { x: berth - 80, y: RAIL_Y - 220, w: 160, h: 440 })) return;
  const c = courtInk(court);
  const lights = court === BLUE ? state.score.blue : state.score.red;
  const pulse = 0.5 + 0.5 * Math.sin(state.timeMs / 420);
  fillRect(ctx, rgba(c, 110 + 60 * pulse), berth - 34, RAIL_Y - 50, 68, 92, 14);
  for (let i = 0; i < 2; i++) {
    const lit = i < lights;
    const y = LIGHT_Y[i];
    fillRect(ctx, solid(lit ? INK.LANTERN : INK.SEABED_MARK), berth - 17, y - 24, 34, 46, 10);
    if (lit) {
      fillEllipse(ctx, rgba(INK.LANTERN, 50 + 40 * pulse), berth, y, 120, 120);
      fillRect(ctx, solid(INK.LANTERN_HOT), berth - 8, y - 14, 16, 26, 6);
    }
  }
}

function paintLamps(ctx: Ctx, view: View, timeMs: number): void {
  for (const art of ALL_ISLANDS) {
    if (!sees(view, art.box)) continue;
    const c = art.centre;
    const glow = 0.5 + 0.5 * Math.sin(timeMs / 700 + art.seed);
    fillEllipse(ctx, rgba(INK.LANTERN, 34 + 30 * glow), c.x, c.y - 8, 84, 84);
    fillRect(ctx, solid(INK.LANTERN), c.x - 8, c.y - 20, 16, 22, 5);
    fillRect(ctx, solid(INK.LANTERN_HOT), c.x - 3, c.y - 15, 6, 12, 3);
  }
}

const KELP_BED = rgba(INK.KELP, 120);
const KELP_DARK = rgba(INK.KELP, 240);
const KELP_LIT = rgba(INK.KELP_LIGHT, 240);

function paintKelp(ctx: Ctx, view: View, timeMs: number): void {
  const t = timeMs / 1000;
  const visible: number[] = [];
  for (let k = 0; k < KELP_ART.length; k++) {
    if (!sees(view, KELP_ART[k])) continue;
    visible.push(k);
    const box = KELP_ART[k];
    fillRect(ctx, KELP_BED, box.x, box.y, box.w, box.h, 26);
  }
  if (visible.length === 0) return;
  // Blades: one path per colour across every bed in view.
  ctx.lineWidth = 6;
  for (const lit of [0, 1]) {
    ctx.strokeStyle = lit ? KELP_LIT : KELP_DARK;
    ctx.beginPath();
    for (const k of visible) {
      const box = KELP_ART[k];
      const cols = Math.max(3, Math.floor(box.w / 26));
      const rows = Math.max(2, Math.floor(box.h / 34));
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          if ((col + r) % 2 !== lit) continue;
          const x = box.x + 14 + (col + (r % 2) * 0.5) * ((box.w - 28) / cols);
          const y = box.y + 30 + r * ((box.h - 34) / rows);
          const sway = Math.sin(t * 1.6 + col * 0.9 + r + k) * 7;
          ctx.moveTo(x, y);
          ctx.lineTo(x + sway * 0.4, y - 13);
          ctx.lineTo(x + sway, y - 27);
        }
      }
    }
    ctx.stroke();
  }
}

function paintGate(ctx: Ctx, view: View, court: Court, shut: boolean, state: SceneState): void {
  const x = railX(court === BLUE ? -GATE_S : GATE_S);
  const warden = WARDENS[court];
  const reach = bounds([warden, { x, y: RAIL_Y - 120 }, { x, y: RAIL_Y + 120 }]);
  if (!sees(view, reach)) return;
  const c = courtInk(court);
  const postY = warden.y < RAIL_Y ? RAIL_Y - 96 : RAIL_Y + 96;
  // The chain from the warden tower to its gate: the reason the gate is shut.
  if (shut) {
    pen(ctx, rgba(INK.SHADOW, 150), 7);
    ctx.beginPath();
    seg(ctx, warden.x + 4, warden.y + 6, x + 4, postY + 6);
    ctx.stroke();
    pen(ctx, rgba(c, 230), 4);
    ctx.beginPath();
    const links = 9;
    for (let i = 0; i < links; i++) {
      const a = i / links;
      const b = (i + 0.6) / links;
      seg(
        ctx,
        warden.x + (x - warden.x) * a,
        warden.y + (postY - warden.y) * a,
        warden.x + (x - warden.x) * b,
        warden.y + (postY - warden.y) * b
      );
    }
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    const y = RAIL_Y + side * 96;
    fillRect(ctx, rgba(INK.SHADOW, 170), x - 15, y - 18, 38, 46, 9);
    fillRect(ctx, solid(INK.REEF_TOP), x - 19, y - 23, 38, 46, 9);
    fillRect(ctx, solid(shut ? c : INK.SEABED_MARK), x - 9, y - 13, 18, 22, 5);
  }
  if (shut) {
    const sway = Math.sin(state.timeMs / 600) * 2;
    fillRect(ctx, rgba(INK.SHADOW, 150), x - 5, RAIL_Y - 74, 16, 156, 6);
    fillRect(ctx, solid(c), x - 8 + sway, RAIL_Y - 78, 16, 156, 6);
    const cream = rgba(INK.CREAM, 220);
    for (let i = -2; i <= 2; i++) fillRect(ctx, cream, x - 8 + sway, RAIL_Y + i * 30 - 4, 16, 6);
  }
}

/**
 * Paint the whole reef for the part of the world `view` shows.
 *
 * `ctx` is the sketch's 2D context with the camera's transform already on it;
 * `scale` is the camera's current scale, which picks the tiles' level.
 */
export function paintReef(ctx: Ctx, tiles: ReefTiles, view: View, scale: number, state: SceneState): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';
  paintOuterSea(ctx, view);
  tiles.draw(ctx, view, scale);
  paintWaves(ctx, view, state.timeMs);
  const level = state.tide.level;
  const favoured = state.tide.favoured;
  paintShoalLive(ctx, view, SHOAL_NORTH, level, PEARL_BEDS_NORTH, favoured === BLUE, FLOODABLE.north, state);
  paintShoalLive(ctx, view, SHOAL_SOUTH, 1 - level, PEARL_BEDS_SOUTH, favoured === RED, FLOODABLE.south, state);
  paintChevrons(ctx, view, state);
  paintDockLive(ctx, view, BLUE, state);
  paintDockLive(ctx, view, RED, state);
  paintLamps(ctx, view, state.timeMs);
  paintKelp(ctx, view, state.timeMs);
  paintGate(ctx, view, BLUE, state.gateShut[BLUE], state);
  paintGate(ctx, view, RED, state.gateShut[RED], state);
  ctx.restore();
}
