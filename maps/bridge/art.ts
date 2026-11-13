import type { Box } from '../../world/layout';
import type { Ctx, View } from '../../world/art/draw';
import { TAU, arcTo_, fillEllipse, hash, overlaps, pen, rgba, sees } from '../../world/art/draw';
import type { Palette, ReefDescription } from '../../world/art/reef';
import {
  BRIDGE_FLOOR,
  BRIDGE_ROCKS,
  BRIDGE_SEA,
  BRIDGE_Y,
  CHANNEL_X0,
  CHANNEL_X1,
  KELP,
  LEDGES,
  SEA_EDGE,
  bridgeSpan,
} from './layout';
import { MAP_SIZE } from '../../world/layout';

/**
 * Cầu Sập, painted: the reef art kit fed with `layout.ts`'s lists, plus the
 * canyon's water. The canyon polygons are `sea` (walls painted as deep water);
 * what is added here is *only* water and foam on top of them — the cascade's
 * ledges (baked) and its flowing streaks (live) — and the water under each
 * bridge span (the bridges themselves are `BridgeSpan` objects, drawn live in
 * `./bridgeArt.ts`, because they come and go).
 */
const CANYON: Box = { x: CHANNEL_X0, y: SEA_EDGE, w: CHANNEL_X1 - CHANNEL_X0, h: MAP_SIZE - 2 * SEA_EDGE };
/** Water between the lumps that line the shore. */
const X0 = CHANNEL_X0 + 30;
const X1 = CHANNEL_X1 - 30;

const spanBox = (i: number): Box => {
  const s = bridgeSpan(i);
  return { x: s.x0, y: s.y0, w: s.x1 - s.x0, h: s.y1 - s.y0 };
};

/** Deep water under every span, the same look as the sea walls above and below it. */
function bakeSpanWater(ctx: Ctx, tile: Box, pal: Palette): void {
  const pad = { x: tile.x - 20, y: tile.y - 20, w: tile.w + 40, h: tile.h + 40 };
  for (let i = 0; i < BRIDGE_Y.length; i++) {
    const b = spanBox(i);
    if (!overlaps(pad, b)) continue;
    ctx.fillStyle = rgba(pal.ABYSS);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    pen(ctx, rgba(pal.DEEP_WAVE, 200), 3);
    ctx.beginPath();
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 4; gx++) {
        const x = b.x + 30 + gx * 80 + (gy % 2 ? 40 : 0) + hash(gx, gy + i) * 14;
        arcTo_(ctx, x, b.y + 24 + gy * 44, 36 + hash(gy, gx) * 16, 12, Math.PI, TAU);
      }
    }
    ctx.stroke();
  }
}

/** The ledges and the cliff lip, laid over the (already painted) canyon water. */
function bakeCascade(ctx: Ctx, tile: Box, pal: Palette): void {
  if (!overlaps({ x: tile.x - 40, y: tile.y - 40, w: tile.w + 80, h: tile.h + 80 }, CANYON)) return;
  ctx.save();
  ctx.lineCap = 'round';
  const w = X1 - X0;
  // The brink the river pours over at the north end: a pale lip and a bright shallow above it.
  ctx.fillStyle = rgba(pal.WATER, 90);
  ctx.fillRect(X0, SEA_EDGE, w, 26);
  pen(ctx, rgba(pal.FOAM, 230), 8);
  ctx.beginPath();
  ctx.moveTo(X0, SEA_EDGE + 28);
  for (let x = X0; x <= X1; x += 20) ctx.lineTo(x, SEA_EDGE + 28 + Math.sin(x * 0.07) * 4);
  ctx.stroke();
  // Two ledges between the bridges: fast clear water above the lip, a shadow, a churn of foam below.
  for (const ly of LEDGES) {
    ctx.fillStyle = rgba(pal.WATER, 70);
    ctx.fillRect(X0, ly - 90, w, 90);
    ctx.fillStyle = rgba(pal.WATER, 60);
    ctx.fillRect(X0, ly - 40, w, 40);
    ctx.fillStyle = rgba(pal.SHADOW, 120);
    ctx.fillRect(X0, ly + 6, w, 22);
    pen(ctx, rgba(pal.FOAM, 235), 7);
    ctx.beginPath();
    ctx.moveTo(X0, ly);
    for (let x = X0; x <= X1; x += 20) ctx.lineTo(x, ly + Math.sin(x * 0.09 + ly) * 4);
    ctx.stroke();
    ctx.fillStyle = rgba(pal.FOAM, 90);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const x = X0 + 14 + hash(i, ly) * (w - 28);
      const y = ly + 26 + hash(ly, i) * 40;
      const r = 5 + hash(i, i + ly) * 8;
      ctx.moveTo(x + r, y);
      ctx.ellipse(x, y, r, r * 0.6, 0, 0, TAU);
    }
    ctx.fill();
  }
  // Where the canyon drains into the southern sea.
  ctx.fillStyle = rgba(pal.FOAM, 60);
  ctx.beginPath();
  for (let i = 0; i < 20; i++) {
    const x = X0 + 10 + hash(i, 5) * (w - 20);
    const y = MAP_SIZE - SEA_EDGE - 70 + hash(5, i) * 60;
    const r = 6 + hash(i, 9) * 9;
    ctx.moveTo(x + r, y);
    ctx.ellipse(x, y, r, r * 0.6, 0, 0, TAU);
  }
  ctx.fill();
  ctx.restore();
}

/** One band of the canyon: streaks of foam running south at `speed` px/s. */
function streaks(ctx: Ctx, a: number, b: number, speed: number, n: number, seed: number, t: number): void {
  for (let i = 0; i < n; i++) {
    const x = X0 + 8 + hash(i, seed) * (X1 - X0 - 16);
    const len = 18 + hash(seed, i) * 26;
    const cycle = b - a + len;
    const y = a + ((t * speed + hash(i, seed + 4) * cycle) % cycle) - len;
    const y0 = Math.max(a, y);
    const y1 = Math.min(b, y + len);
    if (y1 <= y0) continue;
    ctx.moveTo(x, y0);
    ctx.lineTo(x + Math.sin(t + i) * 2, y1);
  }
}

/** Flowing water: the falls, the two cascades, the outflow; mist at the feet of the drops. */
function live(ctx: Ctx, view: View, timeMs: number, pal: Palette): void {
  if (!sees(view, CANYON, 60)) return;
  const t = timeMs / 1000;
  ctx.lineCap = 'round';
  pen(ctx, rgba(pal.FOAM, 150), 4);
  ctx.beginPath();
  const south = (i: number) => bridgeSpan(i).y1;
  const north = (i: number) => bridgeSpan(i).y0;
  streaks(ctx, SEA_EDGE + 30, north(0), 340, 12, 1, t); // the falls
  streaks(ctx, south(0), LEDGES[0], 70, 7, 2, t);
  streaks(ctx, LEDGES[0], north(1), 110, 8, 3, t);
  streaks(ctx, south(1), LEDGES[1], 70, 7, 4, t);
  streaks(ctx, LEDGES[1], north(2), 110, 8, 5, t);
  streaks(ctx, south(2), MAP_SIZE - SEA_EDGE, 90, 10, 6, t);
  ctx.stroke();
  // Spray at the foot of the falls and of each ledge.
  const mist: [number, number][] = [[north(0) - 8, 1], ...LEDGES.map((y, i): [number, number] => [y + 34, 2 + i])];
  for (const [y, k] of mist) {
    for (let i = 0; i < 5; i++) {
      const ph = (t * 0.6 + i * 0.37 + k) % 1;
      fillEllipse(ctx, rgba(pal.FOAM, 70 * (1 - ph)), X0 + 30 + i * 52 + Math.sin(t + i * 2 + k) * 8, y - ph * 18, 42 + ph * 26, 14 + ph * 10);
    }
  }
}

export const bridgeArt = (): ReefDescription => ({
  size: MAP_SIZE,
  sea: BRIDGE_SEA,
  rocks: BRIDGE_ROCKS,
  kelp: KELP,
  floor: BRIDGE_FLOOR,
  bakeFloor: bakeSpanWater,
  bake: bakeCascade,
  live,
});
