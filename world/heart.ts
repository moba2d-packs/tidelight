import type { AttackableUnit } from '@moba2d/core/content/types';
import { api } from '../packApi';
import { issueCharms } from './charms';
import { TideHud } from './hud';
import {
  BLUE,
  CENTER,
  GATE_S,
  HEART_ROLE,
  KEEPS,
  KEEP_MATCH_PX,
  MAP_SIZE,
  PEARL_BEDS_NORTH,
  PEARL_BEDS_SOUTH,
  RAIL_HALF,
  RAIL_Y,
  RED,
  SHOAL_NORTH,
  SHOAL_SOUTH,
  inBox,
  railX,
  type Court,
  type Pt,
} from './layout';
import { INK, courtColor } from './palette';
import {
  ESCORT_RADIUS,
  GATE_BURN_PER_S,
  TIDE_CALL_LOCK_MS,
  RELIGHT_MS,
  dryShoal,
  escortWeight,
  floodedShoal,
  stepLantern,
  tideAt,
  winnerOf,
  type Score,
  type TideOverride,
  type TideState,
} from './rules';
import { paintReef, ReefTiles } from './scenery';
import { arcTo_, fillEllipse, fillRect, pen, rgba, seg, solid } from './art/draw';
import { renderTier } from './art/tier';
import { ensureMapObject } from '../maps';
import { onMap } from '../maps/onMap';

/**
 * The Heart — the one object that makes a match on Driftglass Reef a match.
 *
 * Core gives this pack a practice room: lanes, towers, bots, no way to win.
 * The Heart sits in the map's single neutral slot and supplies everything
 * else: it reads the tide off the match clock, counts who is standing in the
 * lantern's glow, moves the lantern, floods and drains the shoals, surfaces
 * pearls, keeps score, and calls the match.
 *
 * All the *deciding* is in `rules.ts`, as pure functions. This file is the
 * part that touches the engine: it gathers the inputs, applies the outputs,
 * and paints.
 */

/** What a hero's passive tells the Heart about them. */
export interface TideTraits {
  /** Extra escort weight at the lantern (Brine's ballast). */
  escortBonus?: number;
  /** Multiplier on what a pearl gives (Nacre). */
  pearlMult?: number;
}
export const tideTraits = new WeakMap<object, TideTraits>();

export const FLOOD_SLOW = 0.3;
export const CURRENT_HASTE = 0.25;
export const PEARL_HEAL = 12;
export const PEARL_GLOW_MS = 10_000;
export const PEARL_ESCORT = 0.5;
export const PEARL_RESPAWN_MS = 14_000;
const PEARL_REACH = 70;
const SHOAL_TICK_MS = 250;

export interface Heart {
  readonly lanternS: number;
  readonly lanternPos: Pt;
  readonly score: Score;
  readonly winner: Court | null;
  tide(): TideState;
  /** Shove the lantern `distance` units toward `court`'s goal. Gates still hold. */
  kick(court: Court, distance: number): void;
  /** Force the tide to run for `court` for `ms`. */
  overrideTide(court: Court, ms: number): void;
  /** For `ms`, the lantern cannot be moved against `court`. */
  anchor(court: Court, ms: number): void;
  /** Advance the rules by `dtMs` without drawing — what `update()` does each tick. */
  step(dtMs: number): void;
}

const hearts = new WeakMap<object, Heart>();

export const getHeart = (game: unknown): Heart | null =>
  (game ? hearts.get(game as object) : null) ?? null;

const courtOf = (teamId: string | undefined): Court | null =>
  teamId === BLUE ? BLUE : teamId === RED ? RED : null;

/**
 * A court's wardens: its turrets that are not its keep. Only a warden locks a
 * gate or burns under the lantern — a keep standing at home must never hold
 * the lantern at a gate 600 units away.
 */
export function wardensOf(turrets: any[] | undefined, court: Court): any[] {
  const keep = KEEPS[court];
  return (turrets ?? []).filter(turret => {
    if (turret.teamId !== court) return false;
    const at = turret.position;
    return !at || Math.hypot(at.x - keep.x, at.y - keep.y) > KEEP_MATCH_PX;
  });
}

interface Pearl {
  at: Pt;
  shoal: 'north' | 'south';
  readyAtMs: number;
}

function build() {
  const { Champion, Minion } = api.units;

  /** Paints the reef under everything. Its own object so it can sit below the fountains. */
  class ReefScenery extends api.GameObject {
    zIndex = -5;
    alwaysVisible = true;
    constructor(
      game: any,
      private readonly heart: HeartObject
    ) {
      super({ game, position: createVector(CENTER.x, CENTER.y) });
    }
    private readonly tiles = new ReefTiles();
    draw(): void {
      const camera = (this.game as any).camera;
      const cam = camera?.getBoundingBox?.();
      const view = cam ?? { x: 0, y: 0, w: MAP_SIZE, h: MAP_SIZE };
      const state = {
        timeMs: this.heart.clockMs,
        tide: this.heart.tide(),
        score: this.heart.score,
        gateShut: { [BLUE]: this.heart.gateShut(BLUE), [RED]: this.heart.gateShut(RED) },
        tier: renderTier(this.game),
      };
      paintReef(drawingContext as CanvasRenderingContext2D, this.tiles, view, camera?.currentScale ?? 1, state);
      this.heart.drawPearls();
    }
    /** Core's restart/exit does not remove objects one by one: let go of the DOM here too. */
    onMatchTeardown(): void {
      this.onRemoved();
    }

    onRemoved(): void {
      this.tiles.destroy();
    }
    getDisplayBoundingBox() {
      return this.squareDisplayBoundingBox(MAP_SIZE * 2);
    }
  }

  class HeartObject extends api.GameObject implements Heart {
    zIndex = api.layers.OBJECTIVE_Z_INDEX ?? 3.5;
    alwaysVisible = true;

    lanternS = 0;
    score: Score = { blue: 0, red: 0 };
    winner: Court | null = null;
    /** Visual clock: keeps running after the match is called, so the reef stays alive. */
    clockMs = 0;

    private first: Court;
    private override: TideOverride | null = null;
    private hold: { court: Court; untilMs: number } | null = null;
    private relightUntilMs = 0;
    private lastFavoured: Court | null = null;
    private push = 0;
    private escort = { blue: 0, red: 0 };
    private shoalClock = 0;
    private hudClock = 0;
    private flash: { text: string; untilMs: number } | null = null;
    private blockedNoticeAt = -1e9;
    private callLockedUntilMs = 0;
    private pearls: Pearl[] = [
      ...PEARL_BEDS_NORTH.map(at => ({ at, shoal: 'north' as const, readyAtMs: 0 })),
      ...PEARL_BEDS_SOUTH.map(at => ({ at, shoal: 'south' as const, readyAtMs: 0 })),
    ];
    private glow = new WeakMap<object, number>();
    private hud: TideHud;
    private scenery: ReefScenery;

    constructor(game: any, x: number, y: number) {
      super({ game, position: createVector(x, y) });
      const seed = Number(game.matchSeed);
      this.first = Number.isFinite(seed) && Math.abs(Math.floor(seed)) % 2 === 1 ? RED : BLUE;
      this.hud = new TideHud(() => {
        if (typeof game.onRestartRequested === 'function') game.onRestartRequested();
        else if (typeof location !== 'undefined') location.reload();
      });
      this.scenery = new ReefScenery(game, this);
      game.objectManager.addObject(this.scenery);
      hearts.set(game, this);
      // A handle for the screenshot script and for poking at a match from devtools.
      if (typeof window !== 'undefined') (window as any).__tidelight = { game, heart: this };
    }

    /** The match, loosely typed: the Heart reads fields core does not put on a slot object's context. */
    private get world(): any {
      return this.game;
    }

    private get now(): number {
      return Number((this.game as any).matchTimeMs) || 0;
    }

    get lanternPos(): Pt {
      return { x: railX(this.lanternS), y: RAIL_Y };
    }

    tide(): TideState {
      return tideAt(this.now, this.first, this.override);
    }

    /**
     * `wardensOf(...).some(alive)` without the list: this is asked for both
     * courts every tick, and the list was built to be read once and dropped.
     * Same test per turret as `wardensOf`, in the same order.
     */
    gateShut(court: Court): boolean {
      const turrets: any[] | undefined = (this.game as any).turrets;
      if (!turrets) return false;
      const keep = KEEPS[court];
      for (let i = 0; i < turrets.length; i++) {
        const turret = turrets[i];
        if (turret.teamId !== court) continue;
        const at = turret.position;
        if (at && !(Math.hypot(at.x - keep.x, at.y - keep.y) > KEEP_MATCH_PX)) continue;
        if (!turret.isDead) return true;
      }
      return false;
    }

    kick(court: Court, distance: number): void {
      if (this.winner || this.now < this.relightUntilMs) return;
      const dir = court === BLUE ? 1 : -1;
      if (this.hold && this.now < this.hold.untilMs && this.hold.court !== court) return;
      let next = this.lanternS + dir * distance;
      if (dir > 0 && this.gateShut(RED) && this.lanternS <= GATE_S) next = Math.min(next, GATE_S);
      if (dir < 0 && this.gateShut(BLUE) && this.lanternS >= -GATE_S) next = Math.max(next, -GATE_S);
      // A kick never scores by itself: the last step has to be walked.
      this.lanternS = Math.max(-RAIL_HALF + 20, Math.min(RAIL_HALF - 20, next));
    }

    overrideTide(court: Court, ms: number): void {
      // The sea answers one call, then not again for a while — otherwise a
      // ten-second ultimate would simply own the tide for the whole match.
      if (this.now < this.callLockedUntilMs) return;
      this.override = { court, untilMs: this.now + ms };
      this.callLockedUntilMs = this.now + ms + TIDE_CALL_LOCK_MS;
      this.say(court === BLUE ? 'Gọi Triều Lam!' : 'Gọi Triều Lửa!');
    }

    anchor(court: Court, ms: number): void {
      this.hold = { court, untilMs: this.now + ms };
    }

    private say(text: string, ms = 2600): void {
      this.flash = { text, untilMs: this.clockMs + ms };
    }

    /**
     * The circle and the filter list are the Heart's own, re-aimed per call:
     * the escort count asks this every tick, and nothing keeps the circle past
     * the query it was handed to.
     */
    private readonly nearArea = new api.utils.Quadtree.Circle({ x: 0, y: 0, r: 0 });
    private readonly nearFilters = [api.combat.PredefinedFilters.canTakeDamage];

    private unitsNear(x: number, y: number, radius: number): AttackableUnit[] {
      const area = this.nearArea;
      area.x = x;
      area.y = y;
      area.r = radius;
      const bounds = area.bounds;
      bounds.minX = x - radius;
      bounds.minY = y - radius;
      bounds.maxX = x + radius;
      bounds.maxY = y + radius;
      return this.world.objectManager.queryObjects({
        area,
        filters: this.nearFilters,
      }) as AttackableUnit[];
    }

    /** The lantern, held against a shut gate, burns through that gate's warden. */
    private burnWarden(court: Court, dtMs: number): void {
      const warden = wardensOf(this.world.turrets, court).find(turret => !turret.isDead);
      if (!warden || typeof warden.takeDamage !== 'function') return;
      const at = this.lanternPos;
      const pusher = this.unitsNear(at.x, at.y, ESCORT_RADIUS).find(
        unit => unit instanceof Champion && courtOf(unit.teamId) !== null && courtOf(unit.teamId) !== court
      );
      if (pusher) warden.takeDamage((GATE_BURN_PER_S * dtMs) / 1000, pusher);
    }

    private countEscort(): void {
      // Six running totals as locals and the lantern's spot as two numbers:
      // this runs every tick, and the three tally objects and the point it
      // used to build were garbage by the end of it.
      const atX = railX(this.lanternS);
      const atY = RAIL_Y;
      let blueHeroes = 0;
      let redHeroes = 0;
      let blueBonus = 0;
      let redBonus = 0;
      let blueMinions = 0;
      let redMinions = 0;
      const now = this.now;
      const near = this.unitsNear(atX, atY, ESCORT_RADIUS);
      for (let i = 0; i < near.length; i++) {
        const unit = near[i];
        const court = courtOf(unit.teamId);
        if (!court) continue;
        if (Math.hypot(unit.position.x - atX, unit.position.y - atY) > ESCORT_RADIUS) continue;
        if (unit instanceof Champion) {
          // Two separate additions per court, as before: folding them into
          // one would change the order the floats are summed in.
          const trait = tideTraits.get(unit)?.escortBonus ?? 0;
          const pearl = (this.glow.get(unit) ?? 0) > now ? PEARL_ESCORT : 0;
          if (court === BLUE) {
            blueHeroes += 1;
            blueBonus += trait;
            if (pearl) blueBonus += pearl;
          } else {
            redHeroes += 1;
            redBonus += trait;
            if (pearl) redBonus += pearl;
          }
        } else if (unit instanceof Minion) {
          if (court === BLUE) blueMinions += 1;
          else redMinions += 1;
        }
      }
      this.escort = {
        blue: escortWeight(blueHeroes, blueBonus, blueMinions),
        red: escortWeight(redHeroes, redBonus, redMinions),
      };
    }

    private runShoals(tide: TideState, everyone: AttackableUnit[]): void {
      const flooded = floodedShoal(tide);
      const dry = dryShoal(tide);
      const now = this.now;
      const champions = everyone.filter(unit => unit instanceof Champion);
      for (const unit of champions) {
        const court = courtOf(unit.teamId);
        if (!court) continue;
        const where = inBox(unit.position, SHOAL_NORTH)
          ? 'north'
          : inBox(unit.position, SHOAL_SOUTH)
            ? 'south'
            : null;
        if (!where) continue;

        if (where === flooded) {
          // The current is the favoured court's highway and everyone else's mud.
          const riding = court === tide.favoured;
          const buff = riding
            ? new api.buffs.Speedup(SHOAL_TICK_MS * 2.4, unit, unit)
            : new api.buffs.Slow(SHOAL_TICK_MS * 2.4, unit, unit);
          buff.percent = riding ? CURRENT_HASTE : FLOOD_SLOW;
          buff.buffAddType = api.enums.BuffAddType.RENEW_EXISTING;
          buff.stackId = riding ? 'tidelight-current' : 'tidelight-flood';
          buff.name = riding ? 'Thuận Dòng' : 'Ngập Triều';
          unit.addBuff(buff);
        }

        if (where === dry) {
          for (const pearl of this.pearls) {
            if (pearl.shoal !== where || pearl.readyAtMs > now) continue;
            if (Math.hypot(unit.position.x - pearl.at.x, unit.position.y - pearl.at.y) > PEARL_REACH) continue;
            const mult = tideTraits.get(unit)?.pearlMult ?? 1;
            pearl.readyAtMs = now + PEARL_RESPAWN_MS;
            unit.takeHeal(PEARL_HEAL * mult, unit);
            this.glow.set(unit, now + PEARL_GLOW_MS * mult);
            const ring = new api.AoePulse(unit);
            ring.position = createVector(pearl.at.x, pearl.at.y);
            ring.radius = 90;
            ring.lifeTime = 420;
            ring.color = [INK.PEARL[0], INK.PEARL[1], INK.PEARL[2]];
            this.world.objectManager.addObject(ring);
          }
        }
      }
    }

    /** True while `unit` carries a pearl's glow. */
    glowing(unit: object): boolean {
      return (this.glow.get(unit) ?? 0) > this.now;
    }

    step(dtMs: number): void {
      this.clockMs += dtMs;
      if (this.winner) return;
      const now = this.now;
      const tide = this.tide();

      if (tide.favoured !== this.lastFavoured) {
        if (tide.favoured) this.say(tide.favoured === BLUE ? 'Triều Lam dâng!' : 'Triều Lửa dâng!');
        this.lastFavoured = tide.favoured;
      }

      this.shoalClock += dtMs;
      if (this.shoalClock >= SHOAL_TICK_MS) {
        this.shoalClock = 0;
        // One sweep of the map for both passes. The second used to ask again
        // and get the same list unless the shoals had just made somebody
        // unfit to be on it, so that is what it re-checks: the query's own
        // `toRemove` and can-take-damage tests, per unit, at the moment the
        // second query would have run them.
        const everyone = this.unitsNear(CENTER.x, CENTER.y, MAP_SIZE);
        this.runShoals(tide, everyone);
        for (let i = 0; i < everyone.length; i++) {
          const unit: any = everyone[i];
          if (!(unit instanceof Champion)) continue;
          if (unit.toRemove || !unit.targetable || unit.isDead) continue;
          issueCharms(unit);
        }
      }

      if (now >= this.relightUntilMs) {
        this.countEscort();
        let { blue, red } = this.escort;
        let favoured = tide.favoured;
        if (this.hold && now < this.hold.untilMs) {
          // An anchored lantern ignores the other court and the current against it.
          if (this.hold.court === BLUE) red = 0;
          else blue = 0;
          if (favoured && favoured !== this.hold.court) favoured = null;
        }
        const input = {
          blue,
          red,
          favoured,
          blueGateShut: this.gateShut(BLUE),
          redGateShut: this.gateShut(RED),
        };
        const before = this.lanternS;
        const result = stepLantern(this.lanternS, input, dtMs);
        this.lanternS = result.s;
        this.push = result.s - before;
        if (result.blocked) this.burnWarden(result.s > 0 ? RED : BLUE, dtMs);
        if (result.blocked && this.clockMs - this.blockedNoticeAt > 9000) {
          this.blockedNoticeAt = this.clockMs;
          this.say('Cổng khoá — hạ Tháp Canh!');
        }
        if (result.delivered) this.deliver(result.delivered);
      } else {
        this.push = 0;
      }

      const winner = winnerOf(this.score, now, this.lanternS);
      if (winner) this.winner = winner;
    }

    private deliver(court: Court): void {
      if (court === BLUE) this.score.blue += 1;
      else this.score.red += 1;
      const at = this.lanternPos;
      const burst = new api.AoePulse(this as any);
      burst.position = createVector(at.x, at.y);
      burst.radius = 320;
      burst.lifeTime = 900;
      burst.color = [INK.LANTERN[0], INK.LANTERN[1], INK.LANTERN[2]];
      this.world.objectManager.addObject(burst);
      this.say(court === BLUE ? 'Đội Lam thắp một đèn!' : 'Đội Lửa thắp một đèn!', 3400);
      this.lanternS = 0;
      this.hold = null;
      this.relightUntilMs = this.now + RELIGHT_MS;
    }

    update(): void {
      this.step(deltaTime);
      this.position.x = railX(this.lanternS);
      this.hudClock += deltaTime;
      if (this.hudClock >= 90) {
        this.hudClock = 0;
        const player: any = (this.game as any).player;
        this.hud.render({
          tide: this.tide(),
          score: this.score,
          lanternS: this.lanternS,
          push: this.push,
          blueGateShut: this.gateShut(BLUE),
          redGateShut: this.gateShut(RED),
          playerCourt: courtOf(player?.teamId) ?? BLUE,
          matchMs: this.now,
          winner: this.winner,
          flash: this.flash && this.flash.untilMs > this.clockMs ? this.flash.text : null,
        });
      }
    }

    /** Core's restart/exit does not remove objects one by one: let go of the DOM here too. */
    onMatchTeardown(): void {
      this.onRemoved();
    }

    onRemoved(): void {
      this.hud.destroy();
      this.scenery.toRemove = true;
    }

    /**
     * Pearls and the lantern go straight to the 2D context: same shapes, same
     * colours, same order as the p5 calls they replace, without p5's colour
     * parsing and argument normalising around each one.
     */
    drawPearls(): void {
      const dry = dryShoal(this.tide());
      if (!dry) return;
      const now = this.now;
      const bob = Math.sin(this.clockMs / 300) * 3;
      const ctx = drawingContext as CanvasRenderingContext2D;
      ctx.save();
      for (const pearl of this.pearls) {
        if (pearl.shoal !== dry || pearl.readyAtMs > now) continue;
        fillEllipse(ctx, rgba(INK.PEARL, 60), pearl.at.x, pearl.at.y - 8, 62 + bob * 2, 62 + bob * 2);
        fillEllipse(ctx, rgba(INK.SHADOW, 120), pearl.at.x + 2, pearl.at.y + 6, 26, 9);
        fillEllipse(ctx, solid(INK.PEARL), pearl.at.x, pearl.at.y - 10 + bob, 26, 26);
        fillEllipse(ctx, 'rgba(255,255,255,' + 230 / 255 + ')', pearl.at.x - 5, pearl.at.y - 15 + bob, 8, 8);
      }
      ctx.restore();
    }

    draw(): void {
      const tier = renderTier(this.game);
      // One path per colour where shapes cannot touch — but only once the
      // machine is behind. On a GPU canvas a multi-shape path is rasterised by
      // a different renderer than a lone shape and its edges land a few levels
      // off; tier 0 is the promise that nothing moved, so it keeps one call a
      // shape, exactly as p5 issued them.
      const batch = tier >= 1;
      const at = this.lanternPos;
      const t = this.clockMs / 1000;
      const relighting = this.now < this.relightUntilMs;
      const pushDir = Math.sign(this.push);
      const lead = pushDir > 0 ? courtColor(BLUE) : pushDir < 0 ? courtColor(RED) : INK.CREAM;
      const bob = Math.sin(t * 2.1) * 4;
      const ctx = drawingContext as CanvasRenderingContext2D;
      ctx.save();
      ctx.lineCap = 'round';

      // The glow: who stands inside it is the whole game, so it is drawn. On a
      // machine that is drowning the dashed ring says the same thing alone —
      // the disc is the widest translucent fill on the map.
      if (tier < 2) {
        fillEllipse(ctx, rgba(INK.LANTERN, relighting ? 10 : 22), at.x, at.y, ESCORT_RADIUS * 2, ESCORT_RADIUS * 2);
      }
      // The ring's dashes: one path and one stroke.
      pen(ctx, rgba(lead, 170), 4);
      ctx.beginPath();
      const dashes = 36;
      const spin = t * 0.25 * (pushDir || 1);
      for (let i = 0; i < dashes; i++) {
        const a0 = spin + (i / dashes) * Math.PI * 2;
        ctx.moveTo(at.x + Math.cos(a0) * ESCORT_RADIUS, at.y + Math.sin(a0) * ESCORT_RADIUS);
        ctx.arc(at.x, at.y, ESCORT_RADIUS, a0, a0 + Math.PI / dashes);
      }
      ctx.stroke();

      // Escort pips: one row per court, either side of the lantern. The whole
      // ones are opaque and 20 apart, so a row is one path.
      const pips = (count: number, court: Court, side: number): void => {
        const c = courtColor(court);
        const whole = Math.min(4, Math.floor(count + 1e-6));
        if (whole > 0 && batch) {
          ctx.fillStyle = solid(c);
          ctx.beginPath();
          for (let i = 0; i < whole; i++) {
            const x = at.x + side * (74 + i * 20);
            ctx.moveTo(x + 7, at.y + 74);
            ctx.arc(x, at.y + 74, 7, 0, Math.PI * 2);
          }
          ctx.fill();
        } else {
          for (let i = 0; i < whole; i++) fillEllipse(ctx, solid(c), at.x + side * (74 + i * 20), at.y + 74, 14, 14);
        }
        if (count - whole > 0.2 && whole < 4) {
          fillEllipse(ctx, rgba(c, 130), at.x + side * (74 + whole * 20), at.y + 74, 9, 9);
        }
      };
      pips(this.escort.blue, BLUE, -1);
      pips(this.escort.red, RED, 1);

      // The float it rides on.
      fillEllipse(ctx, rgba(INK.SHADOW, 150), at.x + 4, at.y + 40, 120, 34);
      fillEllipse(ctx, solid(INK.REEF_BASE), at.x, at.y + 32, 116, 34);
      fillEllipse(ctx, solid(lead), at.x, at.y + 28, 92, 22);

      // The paper lantern: halo, body, ribs, flame. The halo and the ribs are
      // the lantern's decoration and go first when frames are short; the body
      // and the flame are what say "lit" and "relighting", and stay.
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      if (tier < 1) {
        fillEllipse(ctx, rgba(INK.LANTERN, relighting ? 24 : 54 + 30 * pulse), at.x, at.y - 18 + bob, 150, 150);
      }
      if (batch) {
        ctx.fillStyle = solid(INK.SHADOW);
        ctx.beginPath();
        ctx.roundRect(at.x - 20, at.y - 66 + bob, 40, 10, 4);
        ctx.roundRect(at.x - 20, at.y + 16 + bob, 40, 10, 4);
        ctx.fill();
      } else {
        fillRect(ctx, solid(INK.SHADOW), at.x - 20, at.y - 66 + bob, 40, 10, 4);
        fillRect(ctx, solid(INK.SHADOW), at.x - 20, at.y + 16 + bob, 40, 10, 4);
      }
      fillRect(ctx, solid(relighting ? INK.SAND_DARK : INK.LANTERN), at.x - 32, at.y - 58 + bob, 64, 76, 26);
      if (tier < 2) {
        pen(ctx, rgba(INK.EMBER, 150), 2.5);
        if (batch) ctx.beginPath();
        for (let rib = -1; rib <= 1; rib++) {
          const w = 30 + Math.abs(rib) * 26;
          for (const half of [1, -1]) {
            if (!batch) ctx.beginPath();
            const a0 = half > 0 ? -Math.PI / 2 : Math.PI / 2;
            arcTo_(ctx, at.x + half * rib * 4, at.y - 20 + bob, w, 74, a0, a0 + Math.PI);
            if (!batch) ctx.stroke();
          }
        }
        if (batch) ctx.stroke();
      }
      if (!relighting) {
        fillEllipse(ctx, solid(INK.LANTERN_HOT), at.x, at.y - 18 + bob, 20, 30 + 6 * pulse);
      }

      // Which way it is going: chevrons on the leading side.
      if (pushDir !== 0) {
        pen(ctx, solid(lead), 6);
        if (batch) ctx.beginPath();
        for (let i = 0; i < 2; i++) {
          const x = at.x + pushDir * (58 + i * 20 + ((t * 30) % 12));
          for (const fromY of [at.y - 34, at.y - 2]) {
            if (!batch) ctx.beginPath();
            seg(ctx, x, fromY, x + pushDir * 14, at.y - 18);
            if (!batch) ctx.stroke();
          }
        }
        if (batch) ctx.stroke();
      }

      // The anchor: a ring of chain while Brine's hold is on.
      if (this.hold && this.now < this.hold.untilMs) {
        pen(ctx, rgba(courtColor(this.hold.court), 230), 5);
        ctx.beginPath();
        const r = (150 + Math.sin(t * 8) * 6) / 2;
        ctx.ellipse(at.x, at.y + 30, r, r, 0, 0, Math.PI * 2);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }

    getDisplayBoundingBox() {
      return this.squareDisplayBoundingBox(ESCORT_RADIUS * 2 + 80);
    }
  }

  return HeartObject;
}

let HeartClass: ReturnType<typeof build> | null = null;

/** Build the Heart at a slot. `pack.ts` wires this to the map's `HEART_ROLE` slot. */
export function createHeart(game: any, x = CENTER.x, y = CENTER.y) {
  HeartClass ??= build();
  const existing = hearts.get(game);
  if (existing) return existing as InstanceType<typeof HeartClass>;
  return new HeartClass(game, x, y);
}

/**
 * Make sure a match on Driftglass has its Heart even when the lobby turned
 * "jungle" off — neutral slots are only filled when it is on. Hero passives
 * call this; on any other map it does nothing.
 */
export function ensureHeart(game: any): Heart | null {
  if (ensureMapObject(game)) return null;
  const existing = hearts.get(game);
  if (existing) return existing;
  const slots: any[] = game?.neutralSlots ?? [];
  const onReef = slots.some(slot => slot?.role === HEART_ROLE) || onMap(game, 'driftglass');
  if (!onReef) return null;
  const heart = createHeart(game);
  game.objectManager.addObject(heart);
  return heart;
}
