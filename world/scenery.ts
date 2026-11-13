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
import type { Score, TideState } from './rules';

/**
 * The reef, painted. Core draws a map as grey walls on a dark field; this
 * paints over all of it in Tidelight's own hand — cut-paper islands, sand
 * shoals that visibly flood and drain, a channel whose chevrons run the way
 * the tide does.
 *
 * Everything is flat fills and a few strokes, drawn only where the camera is
 * looking. No images, no gradients, no per-frame allocation worth the name:
 * a mid-range phone paints the whole view in well under a millisecond's worth
 * of canvas calls.
 */
export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneState {
  timeMs: number;
  tide: TideState;
  score: Score;
  gateShut: Record<Court, boolean>;
}

const ink = (c: Rgb, a = 255): void => {
  fill(c[0], c[1], c[2], a);
};
const line_ = (c: Rgb, a = 255, weight = 2): void => {
  stroke(c[0], c[1], c[2], a);
  strokeWeight(weight);
};

const shape = (points: Pt[], dx = 0, dy = 0): void => {
  beginShape();
  for (let i = 0; i < points.length; i++) vertex(points[i].x + dx, points[i].y + dy);
  endShape(CLOSE);
};

const centroid = (points: Pt[]): Pt => {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
};

const inset = (points: Pt[], by: number): Pt[] => {
  const c = centroid(points);
  return points.map(p => {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.max(0, len - by) / len;
    return { x: c.x + dx * k, y: c.y + dy * k };
  });
};

const bounds = (points: Pt[]): Box => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

const sees = (view: View, b: Box, pad = 40): boolean =>
  b.x - pad < view.x + view.w &&
  b.x + b.w + pad > view.x &&
  b.y - pad < view.y + view.h &&
  b.y + b.h + pad > view.y;

/** A cheap, stable pseudo-random in 0..1 from two integers. */
const hash = (a: number, b: number): number => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Precomputed once: the polygons never change.
const ISLAND_ART = ISLANDS.map(points => ({
  points,
  top: inset(points, 20),
  box: bounds(points),
}));
const HEADLANDS = SEA_WALLS.slice(2).map(points => ({ points, top: inset(points, 26), box: bounds(points) }));
const KELP_ART = KELP.map(points => bounds(points));

function paintSea(view: View, timeMs: number): void {
  noStroke();
  ink(INK.ABYSS);
  rect(view.x - 4, view.y - 4, view.w + 8, view.h + 8);

  // Wave glyphs: little crescents on a staggered grid, drifting.
  const step = 150;
  const drift = (timeMs / 1000) * 9;
  noFill();
  line_(INK.DEEP_WAVE, 200, 3);
  const cx0 = Math.floor((view.x - drift) / step) - 1;
  const cx1 = Math.ceil((view.x + view.w - drift) / step) + 1;
  const cy0 = Math.floor(view.y / step) - 1;
  const cy1 = Math.ceil((view.y + view.h) / step) + 1;
  for (let gy = cy0; gy <= cy1; gy++) {
    const y = gy * step + 40;
    const inBand = y > BAND_TOP - 20 && y < BAND_BOTTOM + 20;
    for (let gx = cx0; gx <= cx1; gx++) {
      const x = gx * step + (gy % 2 ? step / 2 : 0) + drift + hash(gx, gy) * 40;
      // The seabed has its own marks; open sea beyond the map's ends does not.
      if (inBand && x > -40 && x < MAP_SIZE + 40) continue;
      const wide = 34 + hash(gy, gx) * 22;
      arc(x, y, wide, 14, Math.PI, Math.PI * 2);
    }
  }
  noStroke();
}

function paintSeabed(view: View): void {
  noStroke();
  // The band's lip: a darker sheet peeking out above and below.
  ink(INK.SHADOW);
  rect(0, BAND_TOP - 14, MAP_SIZE, BAND_BOTTOM - BAND_TOP + 28);
  ink(INK.SEABED);
  rect(0, BAND_TOP, MAP_SIZE, BAND_BOTTOM - BAND_TOP);

  // Seabed marks: sparse pebbles, deterministic.
  const step = 120;
  ink(INK.SEABED_MARK);
  const gx0 = Math.max(0, Math.floor(view.x / step));
  const gx1 = Math.min(Math.ceil(MAP_SIZE / step), Math.ceil((view.x + view.w) / step));
  const gy0 = Math.max(Math.ceil(BAND_TOP / step), Math.floor(view.y / step));
  const gy1 = Math.min(Math.floor(BAND_BOTTOM / step) - 1, Math.ceil((view.y + view.h) / step));
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const r = hash(gx, gy);
      if (r < 0.45) continue;
      const x = gx * step + hash(gy, gx + 3) * step;
      const y = gy * step + r * step * 0.8;
      ellipse(x, y, 18 + r * 26, 8 + r * 8);
    }
  }
}

function paintShoal(box: Box, wet: number, beds: Pt[], pearlsUp: boolean, state: SceneState): void {
  const t = state.timeMs / 1000;
  noStroke();
  // Sand: shadow sheet, body, a lighter crest.
  ink(INK.SHADOW, 150);
  rect(box.x + 8, box.y + 12, box.w, box.h, 70);
  ink(INK.SAND_DARK);
  rect(box.x, box.y, box.w, box.h, 70);
  ink(INK.SAND);
  rect(box.x + 14, box.y + 12, box.w - 28, box.h - 30, 60);

  // Ripple marks in the sand.
  noFill();
  line_(INK.SAND_DARK, 170, 3);
  for (let i = 0; i < 9; i++) {
    const x = box.x + 130 + i * ((box.w - 260) / 8);
    const y = box.y + 90 + (i % 3) * 86;
    arc(x, y, 90, 22, 0.15, Math.PI - 0.15);
  }
  noStroke();

  // Pearl beds: an open shell each, the pearl only while the shoal is dry.
  for (const bed of beds) {
    ink(INK.SHADOW, 110);
    ellipse(bed.x + 3, bed.y + 8, 76, 30);
    ink(INK.CORAL);
    arc(bed.x, bed.y, 74, 56, Math.PI, Math.PI * 2);
    ink(INK.CREAM);
    arc(bed.x, bed.y, 74, 30, 0, Math.PI);
    if (!pearlsUp) continue;
    line_(INK.CORAL, 255, 2);
    noFill();
    for (let rib = -2; rib <= 2; rib++) line(bed.x, bed.y, bed.x + rib * 13, bed.y - 25 + Math.abs(rib) * 4);
    noStroke();
  }

  // The water sheet: slides in from the sea side as the shoal floods.
  if (wet > 0.02) {
    const seaSide = box.y < CENTER.y ? -1 : 1;
    const depth = box.h * wet;
    const y0 = seaSide < 0 ? box.y : box.y + box.h - depth;
    ink(INK.WATER, 150 + 70 * wet);
    rect(box.x, y0, box.w, depth, 70);
    // Foam along the advancing edge.
    const edge = seaSide < 0 ? y0 + depth : y0;
    noFill();
    line_(INK.FOAM, 230, 5);
    beginShape();
    for (let x = box.x + 60; x <= box.x + box.w - 60; x += 70) {
      vertex(x, edge + Math.sin(x * 0.02 + t * 2.2) * 7 - seaSide * 4);
    }
    endShape();
    // Current streaks on the flooded sheet.
    if (wet > 0.6 && state.tide.favoured) {
      const dir = state.tide.favoured === BLUE ? 1 : -1;
      line_(INK.FOAM, 120, 3);
      for (let i = 0; i < 7; i++) {
        const span = box.w - 240;
        const x = box.x + 120 + ((i * 290 + dir * t * 150) % span + span) % span;
        const y = box.y + 60 + ((i * 97) % (box.h - 120));
        line(x, y, x + dir * 56, y);
      }
    }
    noStroke();
  }
}

function paintChannel(view: View, state: SceneState): void {
  const t = state.timeMs / 1000;
  const x0 = railX(-RAIL_HALF) - 60;
  const x1 = railX(RAIL_HALF) + 60;
  noStroke();
  ink(INK.SHADOW, 160);
  rect(x0, RAIL_Y - 92, x1 - x0, 184, 92);
  ink(INK.CHANNEL);
  rect(x0, RAIL_Y - 82, x1 - x0, 164, 82);

  // The rail: sleepers, then chevrons that run with the tide.
  line_(INK.CREAM, 46, 4);
  for (let x = x0 + 80; x < x1 - 60; x += 46) {
    if (x < view.x - 20 || x > view.x + view.w + 20) continue;
    line(x, RAIL_Y - 9, x, RAIL_Y + 9);
  }
  const favoured = state.tide.favoured;
  if (favoured) {
    const dir = favoured === BLUE ? 1 : -1;
    const c = favoured === BLUE ? INK.TIDE : INK.EMBER;
    noFill();
    const gap = 150;
    const offset = ((dir * t * 60) % gap + gap) % gap;
    for (let x = x0 + 60 + offset; x < x1 - 60; x += gap) {
      if (x < view.x - 40 || x > view.x + view.w + 40) continue;
      for (const side of [-1, 1]) {
        line_(c, 150, 4);
        const y = RAIL_Y + side * 48;
        line(x - dir * 13, y - 11, x, y);
        line(x - dir * 13, y + 11, x, y);
      }
    }
  }
  noStroke();
}

function paintDock(court: Court, state: SceneState): void {
  const base = BASES[court];
  const c = court === BLUE ? INK.TIDE : INK.EMBER;
  const lights = court === BLUE ? state.score.blue : state.score.red;
  const pulse = 0.5 + 0.5 * Math.sin(state.timeMs / 420);
  noStroke();
  ink(INK.SHADOW, 150);
  circle(base.x + 8, base.y + 12, 440);
  ink(INK.REEF_BASE);
  circle(base.x, base.y, 440);
  ink(c, 60);
  circle(base.x, base.y, 372);
  noFill();
  line_(c, 210, 5);
  circle(base.x, base.y, 372);
  // Planks.
  line_(INK.SHADOW, 90, 3);
  for (let i = -3; i <= 3; i++) {
    const half = Math.sqrt(Math.max(0, 186 * 186 - (i * 50) * (i * 50)));
    line(base.x + i * 50, base.y - half, base.x + i * 50, base.y + half);
  }
  noStroke();
  // The berth where the lantern lands, at the rail's end, and the lights won.
  const berth = railX(court === BLUE ? -RAIL_HALF : RAIL_HALF);
  ink(INK.SHADOW, 160);
  rect(berth - 38, RAIL_Y - 46, 76, 96, 16);
  ink(c, 110 + 60 * pulse);
  rect(berth - 34, RAIL_Y - 50, 68, 92, 14);
  for (let i = 0; i < 2; i++) {
    const lit = i < lights;
    const y = RAIL_Y - 150 - i * 0 + (i === 0 ? 0 : 300);
    ink(INK.SHADOW, 160);
    rect(berth - 15, y - 20, 34, 46, 10);
    ink(lit ? INK.LANTERN : INK.SEABED_MARK);
    rect(berth - 17, y - 24, 34, 46, 10);
    if (lit) {
      ink(INK.LANTERN, 50 + 40 * pulse);
      circle(berth, y, 120);
      ink(INK.LANTERN_HOT);
      rect(berth - 8, y - 14, 16, 26, 6);
    }
  }
}

function paintGate(court: Court, shut: boolean, state: SceneState): void {
  const x = railX(court === BLUE ? -GATE_S : GATE_S);
  const c = court === BLUE ? INK.TIDE : INK.EMBER;
  const warden = WARDENS[court];
  const postY = warden.y < RAIL_Y ? RAIL_Y - 96 : RAIL_Y + 96;
  // The chain from the warden tower to its gate: the reason the gate is shut.
  if (shut) {
    noFill();
    line_(INK.SHADOW, 150, 7);
    line(warden.x + 4, warden.y + 6, x + 4, postY + 6);
    line_(c, 230, 4);
    const links = 9;
    for (let i = 0; i < links; i++) {
      const a = i / links;
      const b = (i + 0.6) / links;
      line(
        warden.x + (x - warden.x) * a,
        warden.y + (postY - warden.y) * a,
        warden.x + (x - warden.x) * b,
        warden.y + (postY - warden.y) * b
      );
    }
  }
  noStroke();
  for (const side of [-1, 1]) {
    const y = RAIL_Y + side * 96;
    ink(INK.SHADOW, 170);
    rect(x - 15, y - 18, 38, 46, 9);
    ink(INK.REEF_TOP);
    rect(x - 19, y - 23, 38, 46, 9);
    ink(shut ? c : INK.SEABED_MARK);
    rect(x - 9, y - 13, 18, 22, 5);
  }
  if (shut) {
    const sway = Math.sin(state.timeMs / 600) * 2;
    ink(INK.SHADOW, 150);
    rect(x - 5, RAIL_Y - 74, 16, 156, 6);
    ink(c);
    rect(x - 8 + sway, RAIL_Y - 78, 16, 156, 6);
    ink(INK.CREAM, 220);
    for (let i = -2; i <= 2; i++) rect(x - 8 + sway, RAIL_Y + i * 30 - 4, 16, 6);
  }
}

function paintIslands(view: View, timeMs: number): void {
  noStroke();
  for (const art of [...HEADLANDS, ...ISLAND_ART]) {
    if (!sees(view, art.box)) continue;
    ink(INK.SHADOW, 170);
    shape(art.points, 10, 16);
    ink(INK.REEF_BASE);
    shape(art.points);
    ink(INK.REEF_TOP);
    shape(art.top, -3, -7);
    noFill();
    line_(INK.REEF_EDGE, 150, 3);
    shape(art.top, -3, -7);
    noStroke();

    // Coral sprigs and a paper lamp on each island, placed by hash.
    const c = centroid(art.points);
    const seed = Math.round(c.x + c.y);
    for (let i = 0; i < 4; i++) {
      const px = c.x + (hash(seed, i) - 0.5) * art.box.w * 0.55;
      const py = c.y + (hash(i, seed) - 0.5) * art.box.h * 0.4 - 6;
      const tall = 20 + hash(seed + i, 7) * 16;
      line_(i % 2 ? INK.CORAL : INK.REEF_EDGE, 235, 5);
      line(px, py + 10, px, py - tall);
      line(px, py - tall * 0.3, px - 11, py - tall * 0.8);
      line(px, py - tall * 0.5, px + 11, py - tall);
      noStroke();
    }
    const glow = 0.5 + 0.5 * Math.sin(timeMs / 700 + seed);
    ink(INK.LANTERN, 34 + 30 * glow);
    circle(c.x, c.y - 8, 84);
    ink(INK.LANTERN);
    rect(c.x - 8, c.y - 20, 16, 22, 5);
    ink(INK.LANTERN_HOT);
    rect(c.x - 3, c.y - 15, 6, 12, 3);
  }
}

function paintKelp(view: View, timeMs: number): void {
  const t = timeMs / 1000;
  for (let k = 0; k < KELP_ART.length; k++) {
    const box = KELP_ART[k];
    if (!sees(view, box)) continue;
    noStroke();
    ink(INK.KELP, 120);
    rect(box.x, box.y, box.w, box.h, 26);
    const cols = Math.max(3, Math.floor(box.w / 26));
    const rows = Math.max(2, Math.floor(box.h / 34));
    noFill();
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = box.x + 14 + (col + (r % 2) * 0.5) * ((box.w - 28) / cols);
        const y = box.y + 30 + r * ((box.h - 34) / rows);
        const sway = Math.sin(t * 1.6 + col * 0.9 + r + k) * 7;
        line_((col + r) % 2 ? INK.KELP_LIGHT : INK.KELP, 240, 6);
        line(x, y, x + sway * 0.4, y - 13);
        line(x + sway * 0.4, y - 13, x + sway, y - 27);
      }
    }
    noStroke();
  }
}

/** Paint the whole reef for the part of the world `view` shows. */
export function paintReef(view: View, state: SceneState): void {
  push();
  paintSea(view, state.timeMs);
  paintSeabed(view);
  const level = state.tide.level;
  const favoured = state.tide.favoured;
  paintShoal(SHOAL_NORTH, level, PEARL_BEDS_NORTH, favoured === BLUE, state);
  paintShoal(SHOAL_SOUTH, 1 - level, PEARL_BEDS_SOUTH, favoured === RED, state);
  paintChannel(view, state);
  paintDock(BLUE, state);
  paintDock(RED, state);
  paintIslands(view, state.timeMs);
  paintKelp(view, state.timeMs);
  paintGate(BLUE, state.gateShut[BLUE], state);
  paintGate(RED, state.gateShut[RED], state);
  pop();
}
