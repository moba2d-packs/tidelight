import type { AttackableUnit, CastSpec, DamageType } from '@moba2d/core/content/types';
import { api } from '../packApi';
import { ensurePitch } from '../maps/ball/pitch';
import { ensureDefence } from '../maps/defend/defence';
import { ensureHeart, getHeart, tideTraits, type Heart, type TideTraits } from './heart';
import { BLUE, RED, type Court } from './layout';
import { INK, courtColor, type Rgb } from './palette';
import { ESCORT_RADIUS } from './rules';
import { arcTo_, fillEllipse, pen, rgba } from './art/draw';
import { renderTier } from './art/tier';
import { ensureOn } from '../maps/onMap';
import { HILL_MAP_ID } from '../maps/hill/layout';
import { createHill } from '../maps/hill/hill';
import { createPortalArena } from '../maps/portals/arena';
import { createBridgeArena } from '../maps/bridge/arena';
import { provideRaiderFx } from '../maps/defend/raiderSkills';

/**
 * What the twenty-five spell files share: targeting helpers, the two status
 * effects everyone uses, one paper-cut missile, one burst, and the passive
 * that ties a hero to the tide.
 *
 * Spell modules import this; the data half never does (it builds engine
 * classes at module scope, which needs the pack api to be set).
 */
export type Vec = { x: number; y: number };

export const courtOf = (unit: { teamId?: string }): Court | null =>
  unit.teamId === BLUE ? BLUE : unit.teamId === RED ? RED : null;

export const heartOf = (unit: AttackableUnit): Heart | null => getHeart(unit.game);

/** True while the tide runs for `unit`'s court. */
export const tideIsWith = (unit: AttackableUnit): boolean => {
  const court = courtOf(unit);
  return court !== null && heartOf(unit)?.tide().favoured === court;
};

/** True while `unit` stands in the lantern's glow. */
export const inGlow = (unit: AttackableUnit, extra = 0): boolean => {
  const heart = heartOf(unit);
  if (!heart) return false;
  const at = heart.lanternPos;
  return Math.hypot(unit.position.x - at.x, unit.position.y - at.y) <= ESCORT_RADIUS + extra;
};

/** A point exactly `range` from the caster toward the aim. */
export const aimAt = (owner: AttackableUnit, aim: Vec, range: number) =>
  api.utils.VectorUtils.getVectorWithRange(owner.position, aim as any, range).to;

/** The aim point, pulled in to `range` if it lies beyond it. */
export const aimWithin = (owner: AttackableUnit, aim: Vec, range: number) =>
  api.utils.VectorUtils.getVectorWithMaxRange(owner.position, aim as any, range).to;

export function enemiesAt(owner: AttackableUnit, at: Vec, radius: number): AttackableUnit[] {
  return owner.game.objectManager.queryObjects({
    area: new api.utils.Quadtree.Circle({ x: at.x, y: at.y, r: radius }),
    filters: [api.combat.PredefinedFilters.canTakeDamageFromTeam(owner.teamId)],
  }) as AttackableUnit[];
}

/** Allied champions (the caster included) within `radius` of `at`. */
export function alliesAt(owner: AttackableUnit, at: Vec, radius: number): AttackableUnit[] {
  const found = owner.game.objectManager.queryObjects({
    area: new api.utils.Quadtree.Circle({ x: at.x, y: at.y, r: radius }),
    filters: [api.combat.PredefinedFilters.canTakeDamage],
  }) as AttackableUnit[];
  const allies = found.filter(
    unit => unit.teamId === owner.teamId && unit instanceof api.units.Champion
  );
  if (!allies.includes(owner)) allies.push(owner);
  return allies;
}

export function slow(owner: AttackableUnit, target: AttackableUnit, percent: number, ms: number, id: string): void {
  const buff = new api.buffs.Slow(ms, owner, target);
  buff.percent = percent;
  buff.buffAddType = api.enums.BuffAddType.RENEW_EXISTING;
  buff.stackId = id;
  target.addBuff(buff);
}

export function haste(owner: AttackableUnit, target: AttackableUnit, percent: number, ms: number, id: string): void {
  const buff = new api.buffs.Speedup(ms, owner, target);
  buff.percent = percent;
  buff.buffAddType = api.enums.BuffAddType.RENEW_EXISTING;
  buff.stackId = id;
  target.addBuff(buff);
}

type PulseStyle = InstanceType<typeof api.AoePulse>['style'];

/** A one-shot ring/splash at a point — the "something happened here" every hit hands off to. */
export function burst(
  owner: AttackableUnit,
  at: Vec,
  radius: number,
  color: Rgb,
  style: PulseStyle = 'ring',
  lifeMs = 420
): void {
  const pulse = new api.AoePulse(owner);
  pulse.position = createVector(at.x, at.y);
  pulse.radius = radius;
  pulse.lifeTime = lifeMs;
  pulse.color = [color[0], color[1], color[2]];
  pulse.style = style;
  owner.game.objectManager.addObject(pulse);
}

export type BoltShape = 'pearl' | 'spark' | 'gust' | 'hook';

/**
 * The pack's one missile: a flat paper shape with a dark sheet under it and a
 * short tail of fading copies. The shape says whose it is.
 */
export class PaperBolt extends api.MissileSpellObject {
  speed = 13;
  size = 22;
  damage = 20;
  /** Which resistance the hit meets, and the name the death recap shows. Set by every caster. */
  damageType: DamageType = 'PHYSICAL';
  label = '';
  maxHitCount = 1;
  tint: Rgb = INK.CREAM;
  shape: BoltShape = 'pearl';
  /** Runs after the damage lands. */
  afterHit: ((target: AttackableUnit) => void) | null = null;
  private origin = { x: this.position.x, y: this.position.y };

  onHit(target: AttackableUnit): void {
    target.takeDamage(this.damage, this.owner, this.damageType, this.label);
    this.afterHit?.(target);
    const pulse = new api.AoePulse(this.owner);
    pulse.position = createVector(target.position.x, target.position.y);
    pulse.radius = this.size * 2.4;
    pulse.lifeTime = 300;
    pulse.color = [this.tint[0], this.tint[1], this.tint[2]];
    pulse.style = 'splash';
    this.game.objectManager.addObject(pulse);
  }

  draw(): void {
    const at = this.position;
    const to = this.destination ?? at;
    const heading = Math.atan2(to.y - at.y, to.x - at.x);
    const c = this.tint;
    const s = this.size;
    push();
    translate(at.x, at.y);
    rotate(heading);
    noStroke();
    // Tail: three shrinking copies behind.
    for (let i = 3; i >= 1; i--) {
      fill(c[0], c[1], c[2], 70 - i * 16);
      ellipse(-i * s * 0.8, 0, s * (1.1 - i * 0.2), s * (0.8 - i * 0.16));
    }
    fill(INK.SHADOW[0], INK.SHADOW[1], INK.SHADOW[2], 150);
    ellipse(3, 6, s * 1.2, s);
    fill(c[0], c[1], c[2]);
    if (this.shape === 'pearl') {
      circle(0, 0, s);
      fill(255, 255, 255, 220);
      circle(-s * 0.16, -s * 0.18, s * 0.34);
    } else if (this.shape === 'spark') {
      triangle(s * 0.9, 0, -s * 0.5, -s * 0.5, -s * 0.5, s * 0.5);
      fill(INK.LANTERN_HOT[0], INK.LANTERN_HOT[1], INK.LANTERN_HOT[2]);
      triangle(s * 0.5, 0, -s * 0.3, -s * 0.24, -s * 0.3, s * 0.24);
    } else if (this.shape === 'gust') {
      noFill();
      stroke(c[0], c[1], c[2]);
      strokeWeight(5);
      arc(0, 0, s * 1.6, s * 1.4, -Math.PI / 2, Math.PI / 2);
      arc(-s * 0.6, 0, s * 1.2, s, -Math.PI / 2, Math.PI / 2);
    } else {
      // The hook: a line back to the thrower is drawn in world space below.
      noFill();
      stroke(c[0], c[1], c[2]);
      strokeWeight(6);
      arc(0, 0, s * 1.3, s * 1.3, -Math.PI * 0.75, Math.PI * 0.75);
      line(-s * 0.65, 0, s * 0.2, 0);
    }
    pop();
    if (this.shape === 'hook') {
      push();
      stroke(c[0], c[1], c[2], 170);
      strokeWeight(3);
      line(this.owner.position.x, this.owner.position.y, at.x, at.y);
      pop();
    }
  }

  getDisplayBoundingBox() {
    if (this.shape !== 'hook') return this.squareDisplayBoundingBox(this.size * 6);
    const far = Math.hypot(this.position.x - this.origin.x, this.position.y - this.origin.y);
    return this.squareDisplayBoundingBox(far * 2 + this.size * 6);
  }
}

/** Fire a `PaperBolt` from the caster toward the aim. */
export function fireBolt(
  owner: AttackableUnit,
  aim: Vec,
  range: number,
  setup: Partial<Pick<PaperBolt, 'speed' | 'size' | 'damage' | 'damageType' | 'label' | 'maxHitCount' | 'tint' | 'shape' | 'afterHit'>>
): PaperBolt {
  const bolt = new PaperBolt(owner);
  Object.assign(bolt, setup);
  bolt.destination = aimAt(owner, aim, range);
  owner.game.objectManager.addObject(bolt);
  return bolt;
}

/**
 * A lingering patch of ground that ticks on the enemies standing in it:
 * Gull's squall, Nacre's moon pool. Flat disc, dashed rim, a few glyphs
 * circling — readable under a crowd, cheap to draw.
 */
export class TideZone extends api.AreaSpellObject {
  zIndex = api.layers.GROUND_Z_INDEX;
  tint: Rgb = INK.TIDE;
  glyph: 'storm' | 'pool' = 'pool';
  lifeMs = 3000;

  /**
   * On the 2D context rather than through p5, on every tier: the same paths,
   * without p5's argument normalising and colour parsing around each one.
   *
   * Once the machine is behind (`renderTier` 1 and up) the rim's eighteen
   * dashes and the five glyphs ride ONE stroke — a stroke bills a phone's GPU
   * canvas the same whether it carries one dash or twenty-three, and a fight
   * lays several of these at once. Tier 0 keeps a stroke a shape: merged, the
   * translucent rim came out up to 2 levels off on ~500 pixels on a PowerVR
   * canvas, and tier 0 is the promise that nothing moved.
   *
   * The glyphs are the zone's flavour, not its edge; a machine that is
   * drowning (tier 2) keeps the disc and the rim, which are what say where
   * the damage is.
   */
  draw(): void {
    const at = this.center;
    const t = this.elapsedMs / 1000;
    const fade = Math.min(1, Math.max(0, (this.lifeMs - this.elapsedMs) / 400));
    const c = this.tint;
    const tier = renderTier(this.game);
    const batch = tier >= 1;
    const ctx = drawingContext as CanvasRenderingContext2D;
    ctx.save();
    ctx.lineCap = 'round';
    fillEllipse(ctx, rgba(c, 46 * fade), at.x, at.y, this.radius * 2, this.radius * 2);
    pen(ctx, rgba(c, 210 * fade), 4);
    if (batch) ctx.beginPath();
    const dashes = 18;
    for (let i = 0; i < dashes; i++) {
      const a0 = t * 0.9 + (i / dashes) * Math.PI * 2;
      if (!batch) ctx.beginPath();
      arcTo_(ctx, at.x, at.y, this.radius * 2, this.radius * 2, a0, a0 + (Math.PI / dashes) * 1.1);
      if (!batch) ctx.stroke();
    }
    if (tier < 2) {
      for (let i = 0; i < 5; i++) {
        const a = -t * 1.8 + (i / 5) * Math.PI * 2;
        const r = this.radius * (0.35 + 0.3 * ((i * 37) % 10) * 0.1);
        const x = at.x + Math.cos(a) * r;
        const y = at.y + Math.sin(a) * r;
        if (!batch) ctx.beginPath();
        if (this.glyph === 'storm') {
          arcTo_(ctx, x, y, 46, 30, a, a + Math.PI);
        } else {
          const d = Math.max(0, 16 + Math.sin(t * 4 + i) * 5);
          ctx.moveTo(x + d / 2, y);
          ctx.ellipse(x, y, d / 2, d / 2, 0, 0, Math.PI * 2);
          ctx.closePath();
        }
        if (!batch) ctx.stroke();
      }
    }
    if (batch) ctx.stroke();
    ctx.restore();
  }
}

/** Lay a `TideZone` that ticks `onTick` on each enemy inside every `tickMs`. */
export function layZone(
  owner: AttackableUnit,
  at: Vec,
  radius: number,
  lifeMs: number,
  tickMs: number,
  onTick: (target: AttackableUnit) => void,
  look: { tint: Rgb; glyph: 'storm' | 'pool' }
): TideZone {
  const zone = new TideZone(owner, { x: at.x, y: at.y }, radius, {
    durationMs: lifeMs,
    tickEveryMs: tickMs,
    candidateFilter: target => target.teamId !== owner.teamId && !target.isDead && target.targetable,
    onTick,
  });
  zone.tint = look.tint;
  zone.glyph = look.glyph;
  zone.lifeMs = lifeMs;
  owner.game.objectManager.addObject(zone);
  return zone;
}

export type Ornament ='anchor' | 'shell' | 'flame' | 'fin' | 'feather';

/** How many separate fills p5 gave each ornament. */
const ORNAMENT_PIECES: Record<Ornament, number> = { anchor: 2, shell: 1, flame: 2, fin: 1, feather: 1 };

/**
 * A whole ellipse as p5's `ellipse` emits it (`ellipse`, then `closePath`).
 * `join` is for a path that already holds other shapes: it lifts the pen first,
 * or the context would draw a line in from wherever the last shape ended.
 */
function discPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, join: boolean): void {
  if (join) ctx.moveTo(x + w / 2, y);
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.closePath();
}

/** A filled slice as p5's `arc` emits it: the arc, a line to the centre, closed. */
function slicePath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a0: number, a1: number, join: boolean): void {
  if (join) ctx.moveTo(x + Math.cos(a0) * (w / 2), y + Math.sin(a0) * (h / 2));
  ctx.ellipse(x, y, w / 2, h / 2, 0, a0, a1);
  ctx.lineTo(x, y);
  ctx.closePath();
}

/**
 * One piece of a `TideMark` ornament, appended to the current path — the path
 * p5 built for the same primitive. Joined into a shared path the triangles are
 * wound the other way: their piece overlaps a disc, and two shapes wound
 * against each other in one nonzero fill would punch a hole where they meet.
 */
function ornamentPath(ctx: CanvasRenderingContext2D, ornament: Ornament, piece: number, ox: number, oy: number, k: number, join: boolean): void {
  if (ornament === 'anchor') {
    if (piece === 0) {
      const w = k * 0.32;
      const h = k * 1.2;
      const r = Math.min(2, w / 2, h / 2);
      ctx.roundRect(ox - k * 0.16, oy - k * 0.7, w, h, [r, r, r, r]);
    } else slicePath(ctx, ox, oy + k * 0.2, k * 1.3, k * 1.1, 0, Math.PI, join);
  } else if (ornament === 'shell') {
    slicePath(ctx, ox, oy + k * 0.3, k * 1.5, k * 1.6, Math.PI, Math.PI * 2, join);
  } else if (ornament === 'flame') {
    if (piece === 0) trianglePath(ctx, ox, oy - k * 0.9, ox - k * 0.5, oy + k * 0.4, ox + k * 0.5, oy + k * 0.4, join);
    else discPath(ctx, ox, oy + k * 0.2, k, k, join);
  } else if (ornament === 'fin') {
    trianglePath(ctx, ox - k * 0.7, oy + k * 0.5, ox + k * 0.7, oy + k * 0.5, ox + k * 0.3, oy - k * 0.8, join);
  } else {
    discPath(ctx, ox, oy, k * 0.6, k * 1.7, join);
  }
}

function trianglePath(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, flip: boolean): void {
  ctx.moveTo(x1, y1);
  if (flip) {
    ctx.lineTo(x3, y3);
    ctx.lineTo(x2, y2);
  } else {
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
  }
  ctx.closePath();
}

/**
 * The mark a hero's passive leaves on them: a small paper ornament orbiting
 * the portrait, a court-coloured ground ring, and — while a pearl's glow is on
 * them — a pearl riding along. It is how you tell five heroes apart at phone
 * size without reading a name.
 */
export class TideMark extends api.buffs.Buff {
  name = 'Dấu Triều';
  hudVisible = false;
  survivesDeath = true;
  ornament: Ornament = 'anchor';
  tint: Rgb = INK.CREAM;
  /** Called about four times a second with the hero; the passive's actual rule. */
  rule: ((unit: AttackableUnit, dtMs: number) => void) | null = null;
  private clock = 0;
  private age = 0;

  onUpdate(): void {
    this.age += deltaTime;
    this.clock += deltaTime;
    if (this.clock < 250) return;
    const dt = this.clock;
    this.clock = 0;
    if (!this.targetUnit.isDead) this.rule?.(this.targetUnit, dt);
  }

  /**
   * On the 2D context rather than through p5, on every tier — every hero wears
   * one of these every frame, and the p5 version was up to nine primitives
   * each behind `fill()`'s colour parsing (measured ~0.8ms a hero on a Helio
   * P35).
   *
   * Tier 0 emits the paths p5 did, one fill a shape, in p5's order: the same
   * pixels. Once the machine is behind (`renderTier` 1 and up) the two
   * ornaments share one fill, their two shadows another, and the pearl loses
   * its halo; a machine that is drowning (tier 2) drops the shadows as well.
   * The ring and the ornaments themselves never go: they are how five heroes
   * are told apart at phone size.
   */
  draw(): void {
    const unit = this.targetUnit;
    if (unit.isDead) return;
    const at = unit.position;
    const size = unit.stats.size.value;
    const t = this.age / 1000;
    const court = courtColor(unit.teamId ?? null);
    const tier = renderTier(unit.game);
    const batch = tier >= 1;
    const ctx = drawingContext as CanvasRenderingContext2D;
    const k = size * 0.2;
    const pieces = ORNAMENT_PIECES[this.ornament];
    const spot = (i: number): Vec => {
      const a = t * 1.7 + i * Math.PI;
      return { x: at.x + Math.cos(a) * size * 0.78, y: at.y + Math.sin(a) * size * 0.3 - size * 0.1 };
    };

    ctx.save();
    // Ground ring, in the court's colour, under the feet.
    pen(ctx, rgba(court as Rgb, 120), 3);
    ctx.beginPath();
    discPath(ctx, at.x, at.y + size * 0.42, size * 1.5, size * 0.5, false);
    ctx.stroke();

    // Two ornaments orbiting on a tilted ellipse.
    const shadow = rgba(INK.SHADOW, 140);
    const paper = rgba(this.tint);
    if (!batch) {
      for (let i = 0; i < 2; i++) {
        const o = spot(i);
        ctx.fillStyle = shadow;
        ctx.beginPath();
        discPath(ctx, o.x + 2, o.y + 4, k * 1.3, k * 1.3, false);
        ctx.fill();
        ctx.fillStyle = paper;
        for (let piece = 0; piece < pieces; piece++) {
          ctx.beginPath();
          ornamentPath(ctx, this.ornament, piece, o.x, o.y, k, false);
          ctx.fill();
        }
      }
    } else {
      const a = spot(0);
      const b = spot(1);
      if (tier < 2) {
        ctx.fillStyle = shadow;
        ctx.beginPath();
        discPath(ctx, a.x + 2, a.y + 4, k * 1.3, k * 1.3, true);
        discPath(ctx, b.x + 2, b.y + 4, k * 1.3, k * 1.3, true);
        ctx.fill();
      }
      ctx.fillStyle = paper;
      ctx.beginPath();
      for (let piece = 0; piece < pieces; piece++) {
        ornamentPath(ctx, this.ornament, piece, a.x, a.y, k, true);
        ornamentPath(ctx, this.ornament, piece, b.x, b.y, k, true);
      }
      ctx.fill();
    }

    const heart = heartOf(unit) as (Heart & { glowing?: (u: object) => boolean }) | null;
    if (heart?.glowing?.(unit)) {
      const bob = Math.sin(t * 4) * 3;
      if (!batch) {
        ctx.fillStyle = rgba(INK.PEARL, 70);
        ctx.beginPath();
        discPath(ctx, at.x, at.y - size * 0.86 + bob, size * 0.5, size * 0.5, false);
        ctx.fill();
      }
      ctx.fillStyle = rgba(INK.PEARL);
      ctx.beginPath();
      discPath(ctx, at.x, at.y - size * 0.86 + bob, size * 0.26, size * 0.26, false);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * Base for the five passives. Pressing it (once per life, by core) makes sure
 * the match has its Heart, registers the hero's traits with it and pins the
 * `TideMark` on.
 */
export abstract class TidePassive extends api.Spell {
  targetingMode = 'SELF' as const;
  coolDown = 0;
  manaCost = 0;
  abstract ornament: Ornament;
  abstract tint: Rgb;
  traits: TideTraits = {};

  get castSpec(): CastSpec {
    return {
      activation: 'PRESS',
      targeting: 'SELF',
      castTimeMs: 0,
      resource: { commitAt: 'start', refundOn: [] },
      cooldown: { startAt: 'start', durationMs: 0 },
    };
  }

  /** The per-tick rule, if this passive has one. */
  rule(_unit: AttackableUnit, _dtMs: number): void {}

  onSpellCast(): void {
    ensureHeart(this.game);
    ensurePitch(this.game);
    ensureDefence(this.game);
    ensureOn(this.game, HILL_MAP_ID, createHill);
    ensureOn(this.game, 'portals', createPortalArena);
    ensureOn(this.game, 'bridge', createBridgeArena);
    tideTraits.set(this.owner, this.traits);
    const mark = new TideMark(0, this.owner, this.owner);
    mark.stackId = `tidelight-mark-${this.ornament}`;
    mark.ornament = this.ornament;
    mark.tint = this.tint;
    mark.rule = (unit, dt) => this.rule(unit, dt);
    this.owner.addBuff(mark);
  }
}

// Thủ Đèn's raiders cast with these; see `provideRaiderFx` for why it is not an import there.
provideRaiderFx({ burst, enemiesAt, fireBolt, layZone, slow });
