import { INK, css, type Rgb } from '../../world/palette';
import { TAU, hash } from '../../world/art/draw';
import type { BridgeKind, Span } from './layout';
import type { BridgeState } from './rules';

/**
 * The three bridges, painted live (a bridge comes and goes, so it cannot be
 * baked into the map's tiles). Each kind is a different *material*, not a
 * recolour: a coral arch, a rope-and-plank walk, a whale's rib-cage. All fill
 * the whole span rect (that is exactly what is walkable) and reach `LAND` px
 * onto each bank. Collapsed, the water underneath (baked by `./art.ts`) shows,
 * with a broken stub on each bank, floating wreckage and a pulsing hazard outline.
 */
const LAND = 30;

const CORAL_TOP: Rgb = [226, 106, 112];
const CORAL_BASE: Rgb = [150, 62, 86];
const CORAL_LIGHT: Rgb = [255, 190, 170];
const WOOD_A: Rgb = [156, 108, 84];
const WOOD_B: Rgb = [128, 86, 70];
const ROPE: Rgb = [232, 204, 156];
const BONE: Rgb = [238, 228, 206];
const BONE_SHADE: Rgb = [128, 108, 96];
const HIDE: Rgb = [176, 150, 128];

type Ctx = CanvasRenderingContext2D;

// ------------------------------------------------------------ open decks

function coralArch(ctx: Ctx, s: Span): void {
  const x = s.x0 - LAND;
  const w = s.x1 - s.x0 + 2 * LAND;
  const h = s.y1 - s.y0;
  const cy = (s.y0 + s.y1) / 2;
  // The arch's south face, with three openings the water runs through.
  ctx.fillStyle = css(CORAL_BASE);
  ctx.beginPath();
  ctx.roundRect(x, s.y0 + 8, w, h + 6, 16);
  ctx.fill();
  ctx.fillStyle = css(INK.ABYSS);
  for (const cx of [s.x0 + 50, s.x0 + 150, s.x0 + 250]) {
    ctx.beginPath();
    ctx.ellipse(cx, s.y1 + 8, 34, 11, 0, Math.PI, TAU);
    ctx.fill();
  }
  // The crown.
  ctx.fillStyle = css(CORAL_TOP);
  ctx.beginPath();
  ctx.roundRect(x, s.y0, w, h - 2, 16);
  ctx.fill();
  ctx.fillStyle = css(CORAL_LIGHT, 0.55);
  ctx.beginPath();
  ctx.roundRect(x + 14, cy - 36, w - 28, 72, 30);
  ctx.fill();
  // Voussoirs: the stones of the arch, radiating from the keystone.
  ctx.strokeStyle = css(CORAL_BASE, 0.7);
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let k = -3; k <= 3; k++) {
    const px = s.x0 + 150 + k * 44;
    ctx.moveTo(px, s.y0 + 6);
    ctx.lineTo(px + k * 4, s.y1 - 8);
  }
  ctx.stroke();
  ctx.fillStyle = css(INK.CREAM, 0.95);
  ctx.beginPath();
  ctx.roundRect(s.x0 + 150 - 14, cy - 22, 28, 44, 8);
  ctx.fill();
  // Polyps along both lips.
  for (let k = 0; k < 13; k++) {
    const px = x + 16 + k * ((w - 32) / 12);
    for (const py of [s.y0 + 12, s.y1 - 16]) {
      ctx.fillStyle = css(CORAL_LIGHT);
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = css(CORAL_BASE, 0.8);
      ctx.beginPath();
      ctx.arc(px + 1, py + 1, 3, 0, TAU);
      ctx.fill();
    }
  }
}

function ropeWalk(ctx: Ctx, s: Span): void {
  const x = s.x0 - LAND;
  const x1 = s.x1 + LAND;
  const h = s.y1 - s.y0;
  // Planks laid across the walk with gaps showing the water.
  for (let px = x, k = 0; px < x1 - 12; px += 27, k++) {
    const dy = (hash(k, 3) - 0.5) * 5;
    ctx.fillStyle = css(k % 2 ? WOOD_A : WOOD_B);
    ctx.fillRect(px, s.y0 + 4 + dy, 22, h - 8);
    ctx.fillStyle = css(INK.SHADOW, 0.35);
    ctx.fillRect(px, s.y0 + 4 + dy, 3, h - 8);
    ctx.fillRect(px, s.y1 - 10 + dy, 22, 6);
  }
  // Two hand-ropes, sagging between knotted posts.
  ctx.lineCap = 'round';
  for (const [edge, dir] of [[s.y0 + 5, 1], [s.y1 - 5, -1]] as const) {
    ctx.strokeStyle = css(INK.SHADOW, 0.5);
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let px = x; px <= x1; px += 15) ctx.lineTo(px, edge + dir * Math.sin(((px - x) / (x1 - x)) * Math.PI) * 7 + 3);
    ctx.stroke();
    ctx.strokeStyle = css(ROPE);
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let px = x; px <= x1; px += 15) ctx.lineTo(px, edge + dir * Math.sin(((px - x) / (x1 - x)) * Math.PI) * 7);
    ctx.stroke();
  }
  for (const px of [x + 6, s.x0 + 150, x1 - 6]) {
    for (const py of [s.y0 + 5, s.y1 - 5]) {
      ctx.fillStyle = css([84, 56, 48]);
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, TAU);
      ctx.fill();
      ctx.fillStyle = css(WOOD_A);
      ctx.beginPath();
      ctx.arc(px - 1, py - 2, 6, 0, TAU);
      ctx.fill();
    }
  }
}

/** A whale's rib-cage laid over the gap: hide stretched between curved ribs, a spine of vertebrae down the middle. */
function ribCage(ctx: Ctx, s: Span): void {
  const x = s.x0 - LAND;
  const w = s.x1 - s.x0 + 2 * LAND;
  const cy = (s.y0 + s.y1) / 2;
  ctx.fillStyle = css(INK.SHADOW, 0.45);
  ctx.beginPath();
  ctx.roundRect(x + 2, s.y0 + 8, w, s.y1 - s.y0, 18);
  ctx.fill();
  ctx.fillStyle = css(HIDE);
  ctx.beginPath();
  ctx.roundRect(x, s.y0, w, s.y1 - s.y0 - 4, 18);
  ctx.fill();
  ctx.lineCap = 'round';
  const ribs = 8;
  for (const [color, dx, dy, width] of [
    [BONE_SHADE, 3, 4, 14],
    [BONE, 0, 0, 12],
  ] as const) {
    ctx.strokeStyle = css(color);
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let k = 0; k < ribs; k++) {
      const rx = x + 22 + k * ((w - 44) / (ribs - 1)) + dx;
      for (const side of [-1, 1]) {
        ctx.moveTo(rx, cy + dy);
        ctx.quadraticCurveTo(rx + 20 * side * 0.5 + 12, cy + side * 70 + dy, rx + 6, cy + side * (s.y1 - s.y0 - 22) * 0.5 + dy);
      }
    }
    ctx.stroke();
  }
  for (let k = 0; k < ribs; k++) {
    const rx = x + 22 + k * ((w - 44) / (ribs - 1));
    ctx.fillStyle = css(BONE_SHADE);
    ctx.beginPath();
    ctx.ellipse(rx + 2, cy + 3, 17, 21, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = css(BONE);
    ctx.beginPath();
    ctx.ellipse(rx, cy, 17, 21, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = css(HIDE, 0.8);
    ctx.beginPath();
    ctx.ellipse(rx, cy, 6, 8, 0, 0, TAU);
    ctx.fill();
  }
}

const DECKS: Record<BridgeKind, (ctx: Ctx, s: Span) => void> = { coral: coralArch, rope: ropeWalk, bone: ribCage };

/** Fault lines across a deck about to go (state 'warning'). */
function cracks(ctx: Ctx, s: Span, seed: number): void {
  ctx.strokeStyle = css(INK.SHADOW, 0.85);
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    let px = s.x0 + 20 + hash(k, seed) * 260;
    let py = s.y0 + 4;
    ctx.moveTo(px, py);
    while (py < s.y1 - 6) {
      px += (hash(py, k + seed) - 0.5) * 34;
      py += 26;
      ctx.lineTo(px, Math.min(py, s.y1 - 4));
    }
  }
  ctx.stroke();
}

// ------------------------------------------------------------ the gap

/** What is left on each bank when a bridge is gone: a jagged stub of its own material. */
function stub(ctx: Ctx, kind: BridgeKind, s: Span, side: -1 | 1): void {
  const edge = side < 0 ? s.x0 : s.x1;
  const inward = -side;
  const out = edge + side * LAND; // the bank end of the deck
  const cy = (s.y0 + s.y1) / 2;
  const reach = 36;
  const jag = (k: number) => 14 + hash(k, edge) * 20;
  ctx.save();
  if (kind === 'coral') {
    ctx.fillStyle = css(CORAL_BASE);
    ctx.beginPath();
    ctx.moveTo(out, s.y0 + 8);
    for (let k = 0; k <= 6; k++) ctx.lineTo(edge + side * (jag(k) - reach), s.y0 + 8 + k * ((s.y1 - s.y0 - 4) / 6));
    ctx.lineTo(out, s.y1 + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(CORAL_TOP);
    ctx.beginPath();
    ctx.moveTo(out, s.y0);
    for (let k = 0; k <= 6; k++) ctx.lineTo(edge + side * (jag(k) - reach), s.y0 + k * ((s.y1 - s.y0 - 8) / 6));
    ctx.lineTo(out, s.y1 - 6);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'rope') {
    // Planks dangling off the posts, the cut ropes trailing down into the water.
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.translate(out + inward * (4 + k * 9), s.y0 + 6);
      ctx.rotate(inward * (0.5 + k * 0.18));
      ctx.fillStyle = css(k % 2 ? WOOD_A : WOOD_B);
      ctx.fillRect(0, 0, 22, s.y1 - s.y0 - 14 - k * 30);
      ctx.restore();
    }
    ctx.strokeStyle = css(ROPE);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const py of [s.y0 + 5, s.y1 - 5]) {
      ctx.moveTo(out, py);
      ctx.quadraticCurveTo(edge + inward * 6, py + (py < cy ? 46 : -46), edge + inward * 14, py + (py < cy ? 24 : -24));
    }
    ctx.stroke();
  } else {
    // Two broken ribs and the last vertebra on the bank.
    ctx.lineCap = 'round';
    ctx.strokeStyle = css(BONE);
    ctx.lineWidth = 12;
    ctx.beginPath();
    for (const dir of [-1, 1]) {
      ctx.moveTo(out + inward * 14, cy);
      ctx.quadraticCurveTo(out + inward * 28, cy + dir * 46, out + inward * 14, cy + dir * 76);
    }
    ctx.stroke();
    ctx.fillStyle = css(BONE);
    ctx.beginPath();
    ctx.ellipse(out + inward * 14, cy, 17, 21, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Drifting wreckage of the right material, rings of churned water, and the pulsing no-go outline. */
function gap(ctx: Ctx, kind: BridgeKind, s: Span, timeMs: number, index: number): void {
  const t = timeMs / 1000;
  const cx = (s.x0 + s.x1) / 2;
  const cy = (s.y0 + s.y1) / 2;
  ctx.fillStyle = css(INK.SHADOW, 0.3);
  ctx.fillRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);
  // Rings of foam spreading from where the bridge fell.
  ctx.strokeStyle = css(INK.FOAM, 1);
  ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    const ph = (t * 0.5 + k / 3 + index * 0.21) % 1;
    ctx.globalAlpha = 0.5 * (1 - ph);
    ctx.beginPath();
    ctx.ellipse(cx + (k - 1) * 70, cy + Math.sin(k * 2 + index) * 30, 20 + ph * 60, 8 + ph * 24, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const debris: Rgb = kind === 'coral' ? CORAL_TOP : kind === 'rope' ? WOOD_A : BONE;
  for (let k = 0; k < 5; k++) {
    const x = s.x0 + 50 + k * 50 + Math.sin(t * 0.8 + k * 1.7) * 14;
    const y = s.y0 + 44 + ((k * 37 + index * 11) % 120) + Math.sin(t * 1.1 + k) * 8;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(hash(k, index) * 3 + Math.sin(t + k) * 0.3);
    ctx.fillStyle = css(INK.SHADOW, 0.5);
    ctx.fillRect(-12 + 2, -4 + 3, 26, 9);
    ctx.fillStyle = css(debris);
    ctx.fillRect(-12, -4, 26, 9);
    ctx.restore();
  }
  // The outline of what is missing: dashed ember, breathing.
  ctx.strokeStyle = css(INK.EMBER, 0.55 + 0.35 * Math.sin(t * 3));
  ctx.lineWidth = 5;
  ctx.setLineDash([22, 16]);
  ctx.lineDashOffset = -t * 20;
  ctx.strokeRect(s.x0 + 3, s.y0 + 3, s.x1 - s.x0 - 6, s.y1 - s.y0 - 6);
  ctx.setLineDash([]);
}

/** Paint one bridge in the state it is in. The caller wraps this in `save()`/`restore()`. */
export function drawBridge(ctx: Ctx, kind: BridgeKind, s: Span, index: number, state: BridgeState, msLeft: number, timeMs: number): void {
  if (state === 'collapsed') {
    gap(ctx, kind, s, timeMs, index);
    stub(ctx, kind, s, -1);
    stub(ctx, kind, s, 1);
    return;
  }
  DECKS[kind](ctx, s);
  if (state === 'warning') {
    cracks(ctx, s, index + 1);
    // Faster flicker as the 5 s run out.
    if (Math.floor(msLeft / (120 + msLeft / 20)) % 2 === 0) {
      ctx.fillStyle = css(INK.EMBER, 0.42);
      ctx.fillRect(s.x0 - LAND, s.y0, s.x1 - s.x0 + 2 * LAND, s.y1 - s.y0);
    }
  }
}
