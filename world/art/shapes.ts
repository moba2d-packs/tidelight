import type { Pt } from '../layout';

/**
 * Organic shapes that are still legal walls.
 *
 * Core's collision answers for **convex** polygons (`TerrainField`), so a curved
 * rib or a lumpy coral heap is never one polygon: it is a chain or a hull of
 * convex pieces. Everything here returns convex pieces — `hull` by construction,
 * `ribbon` because consecutive quads share their edge and curvature stays gentle
 * (`isConvex` and the geometry tests hold the line).
 */

/** Deterministic pseudo-random 0..1 from an integer seed (a small LCG; no Math.random in a layout). */
export const rng = (seed: number): (() => number) => {
  let s = (Math.floor(seed) * 2654435761) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const cross = (o: Pt, a: Pt, b: Pt): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Convex hull (Andrew's monotone chain), clockwise on screen. */
export function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper].map(q => ({ x: Math.round(q.x), y: Math.round(q.y) }));
}

/** A lumpy convex blob: a jittered ellipse, hulled. `jit` is the radius wobble (0.14 = ±14%). */
export function blob(cx: number, cy: number, rx: number, ry: number, seed: number, n = 9, jit = 0.14, spin = 0): Pt[] {
  const r = rng(seed);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = spin + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.35;
    const k = 1 + (r() - 0.5) * 2 * jit;
    pts.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
  }
  return hull(pts);
}

/** Points along an arc (angles in radians, screen convention: y down). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, steps: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/**
 * A curved plank: a thick line along `path`, cut into convex quads that share
 * their edges (offset along the vertex normals), so the chain has no seam to
 * walk through. `width` is one number or one per vertex (a tapering rib).
 */
export function ribbon(path: Pt[], width: number | number[]): Pt[][] {
  const w = (i: number): number => (typeof width === 'number' ? width : width[i]) / 2;
  const normals: Pt[] = path.map((_p, i) => {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
  const left = path.map((p, i) => ({ x: p.x + normals[i].x * w(i), y: p.y + normals[i].y * w(i) }));
  const right = path.map((p, i) => ({ x: p.x - normals[i].x * w(i), y: p.y - normals[i].y * w(i) }));
  const round = (q: Pt): Pt => ({ x: Math.round(q.x), y: Math.round(q.y) });
  const out: Pt[][] = [];
  for (let i = 0; i + 1 < path.length; i++) out.push([left[i], left[i + 1], right[i + 1], right[i]].map(round));
  return out;
}

export const isConvex = (poly: Pt[]): boolean => {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const c = cross(poly[i], poly[(i + 1) % poly.length], poly[(i + 2) % poly.length]);
    if (Math.abs(c) < 1e-6) continue;
    const s = Math.sign(c);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return poly.length >= 3;
};

export const flipX = (size: number, poly: Pt[]): Pt[] => poly.map(p => ({ x: size - p.x, y: p.y })).reverse();
export const flipY = (size: number, poly: Pt[]): Pt[] => poly.map(p => ({ x: p.x, y: size - p.y })).reverse();
/** The point-mirror through the middle of a square map. */
export const mirror = (size: number, poly: Pt[]): Pt[] => poly.map(p => ({ x: size - p.x, y: size - p.y }));

export const inPoly = (poly: Pt[], x: number, y: number): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

/** Distance from a point to a polygon's outline (0 inside). */
export function distToPoly(poly: Pt[], x: number, y: number): number {
  if (inPoly(poly, x, y)) return 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
  }
  return best;
}

/** Do two convex polygons overlap (SAT)? Touching edges do not count. */
export function convexOverlap(a: Pt[], b: Pt[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const nx = q.y - p.y;
      const ny = p.x - q.x;
      let a0 = Infinity;
      let a1 = -Infinity;
      let b0 = Infinity;
      let b1 = -Infinity;
      for (const v of a) {
        const d = v.x * nx + v.y * ny;
        a0 = Math.min(a0, d);
        a1 = Math.max(a1, d);
      }
      for (const v of b) {
        const d = v.x * nx + v.y * ny;
        b0 = Math.min(b0, d);
        b1 = Math.max(b1, d);
      }
      if (a1 <= b0 + 1e-6 || b1 <= a0 + 1e-6) return false;
    }
  }
  return true;
}
