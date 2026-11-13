import type { Box, Pt } from '../layout';
import type { Rgb } from '../palette';

/**
 * The shared brush of every painter in this pack (the reef's and the art kit's):
 * one set of raw-2D-context primitives and the small geometry they need.
 *
 * Everything here talks to `CanvasRenderingContext2D` directly. A caller wraps
 * its whole paint in `save()`/`restore()`: p5 caches the fill and stroke it last
 * set, and a raw write it does not know about must not outlive the caller.
 */
export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Ctx = CanvasRenderingContext2D;

export const TAU = Math.PI * 2;

export const rgba = (c: Rgb, a = 255): string => `rgba(${c[0]},${c[1]},${c[2]},${a / 255})`;
// The fixed colours, stringified once.
export const SOLID = new Map<Rgb, string>();
export const solid = (c: Rgb): string => {
  let s = SOLID.get(c);
  if (!s) SOLID.set(c, (s = rgba(c)));
  return s;
};

export const centroid = (points: Pt[]): Pt => {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
};

export const inset = (points: Pt[], by: number): Pt[] => {
  const c = centroid(points);
  return points.map(p => {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.max(0, len - by) / len;
    return { x: c.x + dx * k, y: c.y + dy * k };
  });
};

export const bounds = (points: Pt[]): Box => {
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

export const sees = (view: View, b: Box, pad = 40): boolean =>
  b.x - pad < view.x + view.w &&
  b.x + b.w + pad > view.x &&
  b.y - pad < view.y + view.h &&
  b.y + b.h + pad > view.y;

/** A cheap, stable pseudo-random in 0..1 from two integers. */
export const hash = (a: number, b: number): number => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ------------------------------------------------------------ primitives
// Same conventions as the p5 calls they replace: rect from its corner,
// ellipse/circle from the centre with a width (not a radius), round caps.

export const poly = (ctx: Ctx, points: Pt[], dx = 0, dy = 0): void => {
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    if (i === 0) ctx.moveTo(points[i].x + dx, points[i].y + dy);
    else ctx.lineTo(points[i].x + dx, points[i].y + dy);
  }
  ctx.closePath();
};

export const fillRect = (ctx: Ctx, color: string, x: number, y: number, w: number, h: number, r = 0): void => {
  ctx.fillStyle = color;
  if (r <= 0) {
    ctx.fillRect(x, y, w, h);
    return;
  }
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  ctx.fill();
};

export const fillEllipse = (ctx: Ctx, color: string, x: number, y: number, w: number, h: number): void => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, TAU);
  ctx.fill();
};

/** A filled half (or any slice) of an ellipse, closed along its chord. */
export const fillArc = (ctx: Ctx, color: string, x: number, y: number, w: number, h: number, a0: number, a1: number): void => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, a0, a1);
  ctx.closePath();
  ctx.fill();
};

export const pen = (ctx: Ctx, color: string, weight: number): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
};

/** Append an open arc to the current path without joining it to the last one. */
export const arcTo_ = (ctx: Ctx, x: number, y: number, w: number, h: number, a0: number, a1: number): void => {
  ctx.moveTo(x + Math.cos(a0) * (w / 2), y + Math.sin(a0) * (h / 2));
  ctx.ellipse(x, y, w / 2, h / 2, 0, a0, a1);
};

export const seg = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number): void => {
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
};
export const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

