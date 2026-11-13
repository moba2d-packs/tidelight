import type { Pt } from '../layout';
import { hull, rng } from './shapes';

/**
 * Coastline helpers for the maps that are not squares-and-circles: ragged
 * shores, tilted slabs, posts. Everything returns convex pieces (core's
 * collision wants that), laid so their shared edges leave no seam.
 */

export const swapXY = (poly: Pt[]): Pt[] => poly.map(p => ({ x: p.y, y: p.x }));

/** A lumpy convex slab: an ellipse turned by `ang` (radians) and jittered. */
export function slab(cx: number, cy: number, rx: number, ry: number, ang: number, seed: number, n = 9, jit = 0.12): Pt[] {
  const r = rng(seed);
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.3;
    const k = 1 + (r() - 0.5) * 2 * jit;
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    pts.push({ x: cx + x * ca - y * sa, y: cy + x * sa + y * ca });
  }
  return hull(pts);
}

/** A post or block: a small tilted quad-ish piece, never a circle. */
export function post(cx: number, cy: number, w: number, h: number, ang: number, seed: number): Pt[] {
  return slab(cx, cy, w / 2, h / 2, ang, seed, 5, 0.18);
}

export interface Avoid {
  at: Pt;
  r: number;
}

export interface BandOptions {
  /** How far the band reaches into the wall behind the shore. */
  depth: number;
  /** Shore offset toward open water: `[cut, bulge]`, e.g. `[-15, 55]` (negative cuts into the wall). */
  reach: [number, number];
  /** Piece length range along the shore. */
  step: [number, number];
  seed: number;
  /** Near these points the shore never bulges into open ground (only cuts back). */
  avoid?: Avoid[];
  /** Inner end points, when the shore turns a corner and the band must meet its neighbour. */
  qa?: Pt;
  qb?: Pt;
}

/**
 * A ragged shore along `a`..`b`. `open` is the unit normal pointing to open
 * ground; the wall lies the other way. Pieces are hulls of two consecutive shore
 * points and their inner partners, so neighbours share an edge. The two end points
 * are not jittered: bands of adjacent edges meet at the corner.
 */
export function band(a: Pt, b: Pt, open: Pt, o: BandOptions): Pt[][] {
  const r = rng(o.seed);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const ts: number[] = [0];
  for (let d = 0; ; ) {
    d += o.step[0] + r() * (o.step[1] - o.step[0]);
    if (d >= len - o.step[0] * 0.6) break;
    ts.push(d / len);
  }
  ts.push(1);
  const qa = o.qa ?? { x: a.x - open.x * o.depth, y: a.y - open.y * o.depth };
  const qb = o.qb ?? { x: b.x - open.x * o.depth, y: b.y - open.y * o.depth };
  const shore: Pt[] = [];
  const inner: Pt[] = [];
  ts.forEach((t, i) => {
    const edge = i === 0 || i === ts.length - 1;
    const bx = a.x + (b.x - a.x) * t;
    const by = a.y + (b.y - a.y) * t;
    let off = edge ? 0 : o.reach[0] + r() * (o.reach[1] - o.reach[0]);
    if (off > 0 && o.avoid?.some(v => Math.hypot(bx - v.at.x, by - v.at.y) < v.r)) off = Math.min(off, 0);
    const slide = edge ? 0 : (r() - 0.5) * 18;
    shore.push({ x: bx + open.x * off + ux * slide, y: by + open.y * off + uy * slide });
    inner.push({ x: qa.x + (qb.x - qa.x) * t, y: qa.y + (qb.y - qa.y) * t });
  });
  const out: Pt[][] = [];
  for (let i = 0; i + 1 < shore.length; i++) out.push(hull([shore[i], shore[i + 1], inner[i + 1], inner[i]]));
  return out;
}

/** The unit normal to the left of a→b on screen (y down). For a clockwise ring that is the open side. */
export const leftOf = (a: Pt, b: Pt): Pt => {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.y - a.y) / len, y: -(b.x - a.x) / len };
};

/** Point `s` along `path` (arc length), with the direction there. */
export function pointAt(path: Pt[], s: number): { p: Pt; dir: Pt } {
  let left = s;
  for (let i = 0; i + 1 < path.length; i++) {
    const len = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    if (left <= len || i === path.length - 2) {
      const t = left / len;
      return {
        p: { x: path[i].x + (path[i + 1].x - path[i].x) * t, y: path[i].y + (path[i + 1].y - path[i].y) * t },
        dir: { x: (path[i + 1].x - path[i].x) / len, y: (path[i + 1].y - path[i].y) / len },
      };
    }
    left -= len;
  }
  return { p: path[0], dir: { x: 1, y: 0 } };
}

/** Walk the path edges that touch `list` and return the polyline offset sideways by `by` (to the right of travel, y down). */
export const offsetPath = (path: Pt[], by: number): Pt[] =>
  path.map((p, i) => {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: Math.round(p.x - ((b.y - a.y) / len) * by), y: Math.round(p.y + ((b.x - a.x) / len) * by) };
  });

/** The point and heading `t` (0..1) of the way along `path`, by length. */
export function along(path: Pt[], t: number): { p: Pt; dir: Pt } {
  let total = 0;
  for (let i = 0; i + 1 < path.length; i++) total += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
  return pointAt(path, total * t);
}

/**
 * A chain of overlapping lumps along `path`: a coral bank or a rocky spur that is
 * thick and thin and knobbly, never a ruled strip. `widths` is one value per path
 * vertex (interpolated); lumps overlap, so the chain is one body, and each is convex.
 */
export function lumps(path: Pt[], widths: number[], seed: number, pitch = 0.55): Pt[][] {
  const r = rng(seed);
  let total = 0;
  for (let i = 0; i + 1 < path.length; i++) total += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
  const out: Pt[][] = [];
  for (let s = 0, k = 0; s <= total; k++) {
    const t = total ? s / total : 0;
    const w = widthAt(path, widths, s) * 2;
    const { p, dir } = pointAt(path, s);
    const side = (r() - 0.5) * w * 0.3;
    const cx = p.x - dir.y * side;
    const cy = p.y + dir.x * side;
    const ang = Math.atan2(dir.y, dir.x) + (r() - 0.5) * 0.8;
    const lengthwise = w * (0.5 + r() * 0.25);
    const crosswise = w * (0.38 + r() * 0.2);
    out.push(slab(cx, cy, lengthwise, crosswise, ang, Math.floor(seed * 31 + k * 7 + t * 100), 8, 0.14));
    s += Math.max(14, w * pitch * (0.7 + r() * 0.6));
  }
  return out;
}

/** Half the per-vertex `widths`, interpolated at arc length `s`. */
function widthAt(path: Pt[], widths: number[], s: number): number {
  let left = s;
  for (let i = 0; i + 1 < path.length; i++) {
    const len = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    if (left <= len || i === path.length - 2) {
      const t = Math.min(1, left / len);
      return (widths[i] + (widths[i + 1] - widths[i]) * t) / 2;
    }
    left -= len;
  }
  return widths[0] / 2;
}

/** Nudge each path vertex sideways at random, so a chain does not run on a ruler. */
export function wobble(path: Pt[], amount: number, seed: number): Pt[] {
  const r = rng(seed);
  return path.map(p => ({ x: Math.round(p.x + (r() - 0.5) * 2 * amount), y: Math.round(p.y + (r() - 0.5) * 2 * amount) }));
}
