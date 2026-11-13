import type { Box, Pt } from '../layout';
import { INK, type Rgb } from '../palette';
import {
  TAU,
  arcTo_,
  bounds,
  centroid,
  fillEllipse,
  hash,
  overlaps,
  pen,
  rgba,
  sees,
  seg,
  type Ctx,
  type View,
} from './draw';
import { inPoly } from './shapes';
import { TileCache } from './tiles';

/**
 * The reef art kit: paint a whole map from a *description* of it.
 *
 * Driftglass's painter (`scenery.ts`) is hard-wired to Driftglass's constants.
 * This is the same machinery, fed by data: hand it the map's size, its rocks (the
 * wall polygons, grouped into things), its kelp beds, its deep water and sand,
 * and two optional set-piece hooks, and it bakes the still half into 512px tiles
 * at camera scale (`TileCache`) and animates the rest live.
 *
 * ## The one rule: the art follows the polygons
 *
 * `geometry.terrain.wall` is the gameplay truth. A `RockSpec.parts` polygon *is*
 * a wall piece and `sea` polygons *are* wall pieces; the kit paints a footprint
 * exactly where those polygons are and nowhere else (the lift of a rock is
 * clipped to its footprint, so a rock never reads taller than it is wide). Floor
 * patches (`floor`) and set-piece hooks must be *floor* art: never draw something
 * that looks like a wall on ground a hero can walk, and never cover a wall. Feed
 * the geometry and the description from the same lists (see `maps/maze/layout.ts`)
 * and let `wallsOf(description)` be what `terrain.wall` is made from — then they
 * cannot drift apart. `tests/reefArt.test.ts` holds both ends.
 *
 * ## Cost (unchanged from Driftglass, and why)
 *
 * Still art is baked once per world tile at the camera's scale and blitted 1:1 at
 * whole pixels; `MAX_LEVEL`, `SETTLE_FRAMES` and the pixel cap live in `tiles.ts`.
 * Only kelp blades and the `live` hook are drawn per frame, one path per colour.
 * Every raw context use here sits inside `ReefLayer.paint`'s `save()`/`restore()`.
 */
export type Palette = { [K in keyof typeof INK]: Rgb };

/** How a kind of rock is inked: the dark side face, the lit top, the lip between. */
export interface RockStyle {
  base: Rgb;
  top: Rgb;
  edge: Rgb;
  /** World units the top sits above the ground (the visible south face). Default 9. */
  lift?: number;
}

export type RockDetail =
  | 'none'
  /** Dark seams along every part's outline: planks, joints between the quads of a rib. */
  | 'planks'
  /** Polyps and short branches, scattered by hash. */
  | 'coral'
  /** The reef island's few coral sprigs. */
  | 'sprigs'
  | ((ctx: Ctx, rock: RockArt, pal: Palette, tile: Box) => void);

export interface RockSpec {
  /** Convex wall polygons that, together, are one thing (a hull, a heap, a ring). */
  parts: Pt[][];
  style?: string;
  detail?: RockDetail;
  /** Overrides the style's lift. */
  lift?: number;
}

export type FloorKind = 'sand' | 'channel' | 'pool' | 'mud';
export interface FloorPatch {
  /** Walkable ground. Painted smooth; it is *not* a wall and must not look like one. */
  points: Pt[];
  kind: FloorKind;
}

export interface ReefDescription {
  /** Square map size. */
  size: number;
  /** Per-map mood: any `INK` colour replaced. */
  tint?: Partial<Palette>;
  /** Extra or replacement rock styles, by name. Built in: `reef`, `wood`, `coral`, `shell`, `terrace`. */
  styles?: Record<string, RockStyle>;
  /** Wall polygons painted as deep open water (the sea beyond the playable ground). */
  sea: Pt[][];
  rocks: RockSpec[];
  /** The map's `terrain.bush` polygons: painted as kelp beds with swaying blades. */
  kelp: Pt[][];
  floor?: FloorPatch[];
  /** Static set pieces on the floor, under rocks. Cull with `overlaps(tile, …)`. */
  bakeFloor?: (ctx: Ctx, tile: Box, pal: Palette) => void;
  /** Static set pieces over everything still. */
  bake?: (ctx: Ctx, tile: Box, pal: Palette) => void;
  /** Animated set pieces, drawn every frame after the kelp. Cull with `sees(view, …)`. */
  live?: (ctx: Ctx, view: View, timeMs: number, pal: Palette) => void;
}

/** What the geometry's `terrain.wall` is: every sea polygon and every rock part. */
export const wallsOf = (d: Pick<ReefDescription, 'sea' | 'rocks'>): Pt[][] => [
  ...d.sea,
  ...d.rocks.flatMap(r => r.parts),
];

export interface RockArt {
  spec: RockSpec;
  parts: Pt[][];
  style: RockStyle;
  detail: RockDetail;
  box: Box;
  centre: Pt;
  seed: number;
  lift: number;
}

interface KelpBed {
  points: Pt[];
  box: Box;
  blades: { x: number; y: number; lit: number; phase: number }[];
}

const KELP_STEP_X = 26;
const KELP_STEP_Y = 34;

const area = (p: Pt[]): number => {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return a / 2;
};
/** One winding for every part, so a single nonzero fill is the union of them. */
const wound = (p: Pt[]): Pt[] => (area(p) < 0 ? [...p].reverse() : p);

/** The built-in rock styles, from the (tinted) palette. */
export const builtinStyles = (pal: Palette): Record<string, RockStyle> => ({
  reef: { base: pal.REEF_BASE, top: pal.REEF_TOP, edge: pal.REEF_EDGE },
  wood: { base: [70, 46, 62], top: [156, 112, 112], edge: [232, 190, 152], lift: 9 },
  coral: { base: [150, 62, 86], top: [226, 106, 112], edge: [255, 190, 170], lift: 10 },
  shell: { base: [150, 112, 120], top: [236, 206, 196], edge: [255, 246, 226], lift: 12 },
  terrace: { base: [120, 58, 78], top: [214, 108, 108], edge: [255, 196, 164], lift: 10 },
});

function compileRock(spec: RockSpec, styles: Record<string, RockStyle>): RockArt {
  const parts = spec.parts.map(wound);
  const all = parts.flat();
  const style = styles[spec.style ?? 'reef'];
  if (!style) throw new Error(`reef art: no rock style "${spec.style}"`);
  const c = centroid(all);
  return {
    spec,
    parts,
    style,
    detail: spec.detail ?? 'none',
    box: bounds(all),
    centre: c,
    seed: Math.round(c.x + c.y * 7),
    lift: spec.lift ?? style.lift ?? 9,
  };
}

function compileKelp(points: Pt[], k: number): KelpBed {
  const box = bounds(points);
  const blades: KelpBed['blades'] = [];
  for (let row = 0, y = box.y + 14; y < box.y + box.h + 10; row++, y += KELP_STEP_Y) {
    for (let col = 0, x = box.x + (row % 2) * (KELP_STEP_X / 2); x < box.x + box.w; col++, x += KELP_STEP_X) {
      const bx = x + (hash(col + k * 7, row) - 0.5) * 10;
      const by = y + (hash(row, col + k * 5) - 0.5) * 10;
      if (!inPoly(points, bx, by)) continue;
      blades.push({ x: bx, y: by, lit: (col + row) % 2, phase: col * 0.9 + row + k });
    }
  }
  return { points, box, blades };
}

// ------------------------------------------------------------ path helpers

const unionPath = (ctx: Ctx, parts: Pt[][], dx = 0, dy = 0): void => {
  ctx.beginPath();
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      if (i === 0) ctx.moveTo(part[i].x + dx, part[i].y + dy);
      else ctx.lineTo(part[i].x + dx, part[i].y + dy);
    }
    ctx.closePath();
  }
};

/** A closed curve through the midpoints of a polygon's edges: soft ground, never a wall. */
const smoothPath = (ctx: Ctx, pts: Pt[], dx = 0, dy = 0): void => {
  const n = pts.length;
  ctx.beginPath();
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2 + dx, y: (a.y + b.y) / 2 + dy });
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i].x + dx, pts[i].y + dy, m.x, m.y);
  }
  ctx.closePath();
};

const scaled = (pts: Pt[], by: number): Pt[] => {
  const c = centroid(pts);
  return pts.map(p => ({ x: c.x + (p.x - c.x) * by, y: c.y + (p.y - c.y) * by }));
};

// ------------------------------------------------------------ compiled map

export class ReefArt {
  readonly size: number;
  readonly pal: Palette;
  readonly styles: Record<string, RockStyle>;
  readonly rocks: RockArt[];
  readonly kelp: KelpBed[];
  private readonly seaBox: Box[];
  private readonly floorBox: Box[];

  constructor(readonly desc: ReefDescription) {
    this.size = desc.size;
    this.pal = { ...INK, ...desc.tint } as Palette;
    this.styles = { ...builtinStyles(this.pal), ...desc.styles };
    this.rocks = desc.rocks.map(r => compileRock(r, this.styles));
    this.kelp = desc.kelp.map(compileKelp);
    this.seaBox = desc.sea.map(bounds);
    this.floorBox = (desc.floor ?? []).map(f => bounds(f.points));
  }

  private bakeSeabed(ctx: Ctx, tile: Box): void {
    const pal = this.pal;
    ctx.fillStyle = rgba(pal.SEABED);
    ctx.fillRect(0, 0, this.size, this.size);
    // Sparse pebbles, deterministic per grid cell, so tiles agree at their seams.
    const step = 120;
    ctx.fillStyle = rgba(pal.SEABED_MARK);
    ctx.beginPath();
    const gx0 = Math.max(0, Math.floor(tile.x / step) - 1);
    const gx1 = Math.min(Math.ceil(this.size / step), Math.ceil((tile.x + tile.w) / step) + 1);
    const gy0 = Math.max(0, Math.floor(tile.y / step) - 1);
    const gy1 = Math.min(Math.ceil(this.size / step), Math.ceil((tile.y + tile.h) / step) + 1);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const r = hash(gx, gy);
        if (r < 0.4) continue;
        const x = gx * step + hash(gy, gx + 3) * step;
        const y = gy * step + r * step * 0.8;
        const w = 18 + r * 26;
        ctx.moveTo(x + w / 2, y);
        ctx.ellipse(x, y, w / 2, (8 + r * 8) / 2, 0, 0, TAU);
      }
    }
    ctx.fill();
  }

  private bakeFloorPatch(ctx: Ctx, patch: FloorPatch, tile: Box): void {
    const pal = this.pal;
    const pts = patch.points;
    if (patch.kind === 'sand') {
      ctx.fillStyle = rgba(pal.SHADOW, 140);
      smoothPath(ctx, pts, 6, 10);
      ctx.fill();
      ctx.fillStyle = rgba(pal.SAND_DARK);
      smoothPath(ctx, pts);
      ctx.fill();
      ctx.fillStyle = rgba(pal.SAND);
      smoothPath(ctx, scaled(pts, 0.93));
      ctx.fill();
      // Ripple marks, clipped to the patch.
      ctx.save();
      smoothPath(ctx, pts);
      ctx.clip();
      pen(ctx, rgba(pal.SAND_DARK, 150), 3);
      ctx.beginPath();
      const b = bounds(pts);
      for (let gy = Math.floor(b.y / 70); gy * 70 < b.y + b.h; gy++) {
        for (let gx = Math.floor(b.x / 110); gx * 110 < b.x + b.w; gx++) {
          if (hash(gx, gy) < 0.35) continue;
          const x = gx * 110 + hash(gy, gx) * 60;
          const y = gy * 70 + hash(gx, gy + 1) * 40;
          if (x < tile.x - 60 || x > tile.x + tile.w + 60 || y < tile.y - 60 || y > tile.y + tile.h + 60) continue;
          arcTo_(ctx, x, y, 80, 20, 0.15, Math.PI - 0.15);
        }
      }
      ctx.stroke();
      ctx.restore();
    } else if (patch.kind === 'channel') {
      ctx.fillStyle = rgba(pal.SHADOW, 150);
      smoothPath(ctx, scaled(pts, 1.04), 0, 6);
      ctx.fill();
      ctx.fillStyle = rgba(pal.CHANNEL);
      smoothPath(ctx, pts);
      ctx.fill();
    } else if (patch.kind === 'pool') {
      ctx.fillStyle = rgba(pal.SHADOW, 120);
      smoothPath(ctx, pts, 3, 6);
      ctx.fill();
      ctx.fillStyle = rgba(pal.WATER, 120);
      smoothPath(ctx, pts);
      ctx.fill();
      pen(ctx, rgba(pal.FOAM, 190), 3);
      smoothPath(ctx, pts);
      ctx.stroke();
      pen(ctx, rgba(pal.FOAM, 90), 2);
      smoothPath(ctx, scaled(pts, 0.66));
      ctx.stroke();
    } else {
      ctx.fillStyle = rgba(pal.SEABED_MARK, 200);
      smoothPath(ctx, pts);
      ctx.fill();
    }
  }

  private bakeSea(ctx: Ctx, tile: Box, pad: Box): void {
    const pal = this.pal;
    const here = this.desc.sea.filter((_, i) => overlaps(pad, this.seaBox[i]));
    if (here.length === 0) return;
    // The shore's shadow, laid on the floor along the sea's edge.
    ctx.lineJoin = 'round';
    pen(ctx, rgba(pal.SHADOW), 28);
    unionPath(ctx, here);
    ctx.stroke();
    ctx.fillStyle = rgba(pal.ABYSS);
    unionPath(ctx, here);
    ctx.fill();
    // Wave crescents, clipped to the water.
    ctx.save();
    unionPath(ctx, here);
    ctx.clip();
    pen(ctx, rgba(pal.DEEP_WAVE, 200), 3);
    ctx.beginPath();
    const step = 150;
    for (let gy = Math.floor(tile.y / step) - 1; gy <= Math.ceil((tile.y + tile.h) / step) + 1; gy++) {
      for (let gx = Math.floor(tile.x / step) - 1; gx <= Math.ceil((tile.x + tile.w) / step) + 1; gx++) {
        const x = gx * step + (gy % 2 ? step / 2 : 0) + hash(gx, gy) * 40;
        const y = gy * step + 40;
        arcTo_(ctx, x, y, 34 + hash(gy, gx) * 22, 14, Math.PI, TAU);
      }
    }
    ctx.stroke();
    ctx.restore();
    ctx.lineJoin = 'miter';
  }

  private paintRockShadow(ctx: Ctx, rock: RockArt): void {
    ctx.fillStyle = rgba(this.pal.SHADOW, 150);
    unionPath(ctx, rock.parts, 7, 12);
    ctx.fill();
  }

  private paintRock(ctx: Ctx, rock: RockArt, tile: Box): void {
    const { base, top, edge } = rock.style;
    const lift = rock.lift;
    ctx.fillStyle = rgba(base);
    unionPath(ctx, rock.parts);
    ctx.fill();
    ctx.save();
    unionPath(ctx, rock.parts);
    ctx.clip();
    // The lip catches the light just above the dark south face, then the top.
    ctx.fillStyle = rgba(edge);
    unionPath(ctx, rock.parts, 0, 3 - lift);
    ctx.fill();
    ctx.fillStyle = rgba(top);
    unionPath(ctx, rock.parts, 0, -lift);
    ctx.fill();
    ctx.translate(0, -lift);
    this.paintDetail(ctx, rock, tile);
    ctx.restore();
  }

  private paintDetail(ctx: Ctx, rock: RockArt, tile: Box): void {
    const pal = this.pal;
    const d = rock.detail;
    if (typeof d === 'function') {
      d(ctx, rock, pal, tile);
      return;
    }
    if (d === 'planks') {
      ctx.lineJoin = 'round';
      pen(ctx, rgba(pal.SHADOW, 110), 2);
      for (const part of rock.parts) {
        ctx.beginPath();
        part.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.stroke();
      }
      ctx.lineJoin = 'miter';
    } else if (d === 'coral') {
      const b = rock.box;
      const n = Math.min(60, Math.round((b.w * b.h) / 900));
      for (let i = 0; i < n; i++) {
        const x = b.x + hash(rock.seed, i) * b.w;
        const y = b.y + hash(i, rock.seed) * b.h;
        if (x < tile.x - 20 || x > tile.x + tile.w + 20 || y < tile.y - 20 || y > tile.y + tile.h + 20) continue;
        const r = 4 + hash(i, i + rock.seed) * 6;
        fillEllipse(ctx, rgba(rock.style.edge, 200), x, y, r * 2, r * 2);
        fillEllipse(ctx, rgba(rock.style.base, 150), x + 1, y + 1, r, r);
      }
    } else if (d === 'sprigs') {
      const c = rock.centre;
      for (let i = 0; i < 4; i++) {
        const px = c.x + (hash(rock.seed, i) - 0.5) * rock.box.w * 0.55;
        const py = c.y + (hash(i, rock.seed) - 0.5) * rock.box.h * 0.4 - 6;
        const tall = 20 + hash(rock.seed + i, 7) * 16;
        pen(ctx, rgba(i % 2 ? pal.CORAL : pal.REEF_EDGE, 235), 5);
        ctx.beginPath();
        seg(ctx, px, py + 10, px, py - tall);
        seg(ctx, px, py - tall * 0.3, px - 11, py - tall * 0.8);
        seg(ctx, px, py - tall * 0.5, px + 11, py - tall);
        ctx.stroke();
      }
    }
  }

  /** Everything that never moves, for one world tile. `ctx` is already in world space. */
  bakeTile = (ctx: Ctx, tile: Box): void => {
    const pal = this.pal;
    ctx.lineCap = 'round';
    ctx.fillStyle = rgba(pal.ABYSS);
    ctx.fillRect(tile.x - 4, tile.y - 4, tile.w + 8, tile.h + 8);
    this.bakeSeabed(ctx, tile);
    const pad = { x: tile.x - 30, y: tile.y - 30, w: tile.w + 60, h: tile.h + 60 };
    (this.desc.floor ?? []).forEach((patch, i) => {
      if (overlaps(pad, this.floorBox[i])) this.bakeFloorPatch(ctx, patch, tile);
    });
    this.desc.bakeFloor?.(ctx, tile, pal);
    this.bakeSea(ctx, tile, pad);
    for (const bed of this.kelp) {
      if (!overlaps(pad, bed.box)) continue;
      ctx.fillStyle = rgba(pal.KELP, 120);
      unionPath(ctx, [bed.points]);
      ctx.fill();
      pen(ctx, rgba(pal.KELP_LIGHT, 130), 2);
      ctx.stroke();
    }
    const near = this.rocks.filter(r => overlaps(pad, { x: r.box.x - 20, y: r.box.y - 50, w: r.box.w + 40, h: r.box.h + 70 }));
    for (const rock of near) this.paintRockShadow(ctx, rock);
    for (const rock of near) this.paintRock(ctx, rock, tile);
    this.desc.bake?.(ctx, tile, pal);
  };

  /** Open sea outside the map's square, where there are no tiles. */
  paintOuterSea(ctx: Ctx, view: View): void {
    const s = this.size;
    const x0 = view.x - 4;
    const y0 = view.y - 4;
    const x1 = view.x + view.w + 4;
    const y1 = view.y + view.h + 4;
    if (x0 >= 0 && y0 >= 0 && x1 <= s && y1 <= s) return;
    ctx.fillStyle = rgba(this.pal.ABYSS);
    if (y0 < 0) ctx.fillRect(x0, y0, x1 - x0, -y0);
    if (y1 > s) ctx.fillRect(x0, s, x1 - x0, y1 - s);
    const my0 = Math.max(0, y0);
    const my1 = Math.min(s, y1);
    if (x0 < 0) ctx.fillRect(x0, my0, -x0, my1 - my0);
    if (x1 > s) ctx.fillRect(s, my0, x1 - s, my1 - my0);
  }

  paintKelp(ctx: Ctx, view: View, timeMs: number): void {
    const t = timeMs / 1000;
    const visible: KelpBed[] = [];
    for (const bed of this.kelp) if (sees(view, bed.box)) visible.push(bed);
    if (visible.length === 0) return;
    const dark = rgba(this.pal.KELP, 240);
    const lit = rgba(this.pal.KELP_LIGHT, 240);
    ctx.lineWidth = 6;
    for (const tone of [0, 1]) {
      ctx.strokeStyle = tone ? lit : dark;
      ctx.beginPath();
      for (const bed of visible) {
        for (const b of bed.blades) {
          if (b.lit !== tone) continue;
          const sway = Math.sin(t * 1.6 + b.phase) * 7;
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x + sway * 0.4, b.y - 13);
          ctx.lineTo(b.x + sway, b.y - 27);
        }
      }
      ctx.stroke();
    }
  }
}

/** A map's whole painted layer: the compiled art and its tile cache. One per match. */
export class ReefLayer {
  readonly art: ReefArt;
  readonly tiles: TileCache;

  constructor(desc: ReefDescription) {
    this.art = new ReefArt(desc);
    this.tiles = new TileCache(desc.size, this.art.bakeTile);
  }

  /**
   * Paint the map for the part of the world `view` shows. `ctx` is the sketch's
   * 2D context with the camera's transform already on it; `scale` is the camera's
   * current scale, which picks the tiles' level.
   */
  paint(ctx: Ctx, view: View, scale: number, timeMs: number): void {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';
    this.art.paintOuterSea(ctx, view);
    this.tiles.draw(ctx, view, scale);
    this.art.paintKelp(ctx, view, timeMs);
    this.art.desc.live?.(ctx, view, timeMs, this.art.pal);
    ctx.restore();
  }

  dispose(): void {
    this.tiles.dispose();
  }
}
