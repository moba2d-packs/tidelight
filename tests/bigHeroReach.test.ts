/**
 * Reported three times in one evening: "đường hơi hẹp … tướng to tý là bị kẹt"
 * (Mê Cung Rong), "mấy khe hẹp trong Đảo Cổng … ko đi đc", "vùng băng cũng khe
 * hẹp quá". Each map's own test checked reach with a 28 px body, so every
 * nook a big hero could not enter still passed.
 *
 * Core caps a body at 40 px for terrain (`NAV_MAX_TERRAIN_RADIUS`); this floods
 * with 52 (that cap plus room to be shoved), turrets as solid discs, and counts
 * open floor — at least 60 px from any wall, so not a wall's rim — that a 28 px
 * body reaches and a 52 px body does not. Before the fix: Đảo Cổng's two coral
 * gardens, Mặt Băng's pond, Thủ Đèn's harbour behind the bank's break.
 */
import { describe, expect, it } from 'vitest';
import { geometry as driftglassGeometry } from '../geometry';
import { geometry as ballGeometry } from '../maps/ball/map';
import { geometry as bridgeGeometry } from '../maps/bridge/geometry';
import { geometry as defendGeometry } from '../maps/defend/geometry';
import { geometry as duelGeometry } from '../maps/duel/map';
import { geometry as iceGeometry } from '../maps/ice/geometry';
import { hillGeometry } from '../maps/hill/geometry';
import { geometry as mazeGeometry } from '../maps/maze/geometry';
import { geometry as portalsGeometry } from '../maps/portals/geometry';

type P = { x: number; y: number };
const MAPS: Record<string, unknown> = {
  driftglass: driftglassGeometry,
  ball: ballGeometry,
  bridge: bridgeGeometry,
  'lantern-watch': defendGeometry,
  duel: duelGeometry,
  ice: iceGeometry,
  hill: hillGeometry,
  maze: mazeGeometry,
  portals: portalsGeometry,
};

const BIG = 52;
const SMALL = 28;
const FLOOR = 60;
const TURRET_R = 46;
const CELL = 10;
/** A stray corner is not a nook: about a 30 px square. */
const SLACK = 12;

const segDist = (p: P, a: P, b: P): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
const inside = (poly: P[], p: P): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};

/** Cells of open floor a small hero reaches from the first spawn and a big one does not. */
export function nooksTooTightForBigHeroes(geometry: any): P[] {
  const walls: P[][] = geometry.terrain.wall;
  const turrets: P[] = (geometry.slots.structure ?? []).map((s: P) => ({ x: s.x, y: s.y }));
  const spawn: P = geometry.slots.spawn[0];
  let w = 0;
  let h = 0;
  for (const poly of walls) for (const p of poly) ((w = Math.max(w, p.x)), (h = Math.max(h, p.y)));
  const nx = Math.ceil(w / CELL);
  const ny = Math.ceil(h / CELL);
  const boxes = walls.map(poly => ({
    poly,
    x0: Math.min(...poly.map(p => p.x)),
    x1: Math.max(...poly.map(p => p.x)),
    y0: Math.min(...poly.map(p => p.y)),
    y1: Math.max(...poly.map(p => p.y)),
  }));
  const clear = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const p = { x: i * CELL + CELL / 2, y: j * CELL + CELL / 2 };
      let d = FLOOR + 1;
      for (const b of boxes) {
        if (p.x < b.x0 - d || p.x > b.x1 + d || p.y < b.y0 - d || p.y > b.y1 + d) continue;
        if (inside(b.poly, p)) {
          d = 0;
          break;
        }
        for (let k = 0; k < b.poly.length; k++) d = Math.min(d, segDist(p, b.poly[k], b.poly[(k + 1) % b.poly.length]));
      }
      for (const t of turrets) d = Math.min(d, Math.max(0, Math.hypot(p.x - t.x, p.y - t.y) - TURRET_R));
      clear[j * nx + i] = d;
    }
  const flood = (body: number): Uint8Array => {
    const seen = new Uint8Array(nx * ny);
    const start = Math.floor(spawn.y / CELL) * nx + Math.floor(spawn.x / CELL);
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      const i = c % nx;
      const j = (c / nx) | 0;
      for (const [a, b] of [
        [i + 1, j],
        [i - 1, j],
        [i, j + 1],
        [i, j - 1],
      ]) {
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const k = b * nx + a;
        if (!seen[k] && clear[k] >= body) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
    return seen;
  };
  const small = flood(SMALL);
  const big = flood(BIG);
  const out: P[] = [];
  for (let k = 0; k < nx * ny; k++)
    if (small[k] && clear[k] >= FLOOR && !big[k]) out.push({ x: (k % nx) * CELL, y: ((k / nx) | 0) * CELL });
  return out;
}

describe('a big hero (52 px) reaches every open part of every map', () => {
  it.each(Object.keys(MAPS))('%s', async id => {
    const g = MAPS[id];
    const geometry = typeof g === 'function' ? await (g as () => unknown)() : g;
    const nooks = nooksTooTightForBigHeroes(geometry);
    expect(nooks.length, `first: ${JSON.stringify(nooks.slice(0, 3))}`).toBeLessThanOrEqual(SLACK);
  });
});
