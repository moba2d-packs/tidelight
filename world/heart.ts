import type { AttackableUnit } from '@moba2d/core/content/types';
import { api } from '../packApi';
import { TideHud } from './hud';
import {
  BLUE,
  CENTER,
  GATE_S,
  HEART_ROLE,
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
import { paintReef } from './scenery';

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
    draw(): void {
      const cam = (this.game as any).camera?.getBoundingBox?.();
      const view = cam ?? { x: 0, y: 0, w: MAP_SIZE, h: MAP_SIZE };
      paintReef(view, {
        timeMs: this.heart.clockMs,
        tide: this.heart.tide(),
        score: this.heart.score,
        gateShut: { [BLUE]: this.heart.gateShut(BLUE), [RED]: this.heart.gateShut(RED) },
      });
      this.heart.drawPearls();
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

    gateShut(court: Court): boolean {
      const turrets: any[] = (this.game as any).turrets ?? [];
      return turrets.some(turret => turret.teamId === court && !turret.isDead);
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

    private unitsNear(center: Pt, radius: number): AttackableUnit[] {
      return this.world.objectManager.queryObjects({
        area: new api.utils.Quadtree.Circle({ x: center.x, y: center.y, r: radius }),
        filters: [api.combat.PredefinedFilters.canTakeDamage],
      }) as AttackableUnit[];
    }

    /** The lantern, held against a shut gate, burns through that gate's warden. */
    private burnWarden(court: Court, dtMs: number): void {
      const turrets: any[] = this.world.turrets ?? [];
      const warden = turrets.find(turret => turret.teamId === court && !turret.isDead);
      if (!warden || typeof warden.takeDamage !== 'function') return;
      const at = this.lanternPos;
      const pusher = this.unitsNear(at, ESCORT_RADIUS).find(
        unit => unit instanceof Champion && courtOf(unit.teamId) !== null && courtOf(unit.teamId) !== court
      );
      if (pusher) warden.takeDamage((GATE_BURN_PER_S * dtMs) / 1000, pusher);
    }

    private countEscort(): void {
      const at = this.lanternPos;
      const heroes = { [BLUE]: 0, [RED]: 0 };
      const bonus = { [BLUE]: 0, [RED]: 0 };
      const minions = { [BLUE]: 0, [RED]: 0 };
      const now = this.now;
      for (const unit of this.unitsNear(at, ESCORT_RADIUS)) {
        const court = courtOf(unit.teamId);
        if (!court) continue;
        if (Math.hypot(unit.position.x - at.x, unit.position.y - at.y) > ESCORT_RADIUS) continue;
        if (unit instanceof Champion) {
          heroes[court] += 1;
          bonus[court] += tideTraits.get(unit)?.escortBonus ?? 0;
          if ((this.glow.get(unit) ?? 0) > now) bonus[court] += PEARL_ESCORT;
        } else if (unit instanceof Minion) {
          minions[court] += 1;
        }
      }
      this.escort = {
        blue: escortWeight(heroes[BLUE], bonus[BLUE], minions[BLUE]),
        red: escortWeight(heroes[RED], bonus[RED], minions[RED]),
      };
    }

    private runShoals(tide: TideState): void {
      const flooded = floodedShoal(tide);
      const dry = dryShoal(tide);
      const now = this.now;
      const champions = this.unitsNear(CENTER, MAP_SIZE).filter(unit => unit instanceof Champion);
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
        this.runShoals(tide);
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

    onRemoved(): void {
      this.hud.destroy();
      this.scenery.toRemove = true;
    }

    drawPearls(): void {
      const dry = dryShoal(this.tide());
      if (!dry) return;
      const now = this.now;
      const bob = Math.sin(this.clockMs / 300) * 3;
      push();
      noStroke();
      for (const pearl of this.pearls) {
        if (pearl.shoal !== dry || pearl.readyAtMs > now) continue;
        fill(INK.PEARL[0], INK.PEARL[1], INK.PEARL[2], 60);
        circle(pearl.at.x, pearl.at.y - 8, 62 + bob * 2);
        fill(INK.SHADOW[0], INK.SHADOW[1], INK.SHADOW[2], 120);
        ellipse(pearl.at.x + 2, pearl.at.y + 6, 26, 9);
        fill(INK.PEARL[0], INK.PEARL[1], INK.PEARL[2]);
        circle(pearl.at.x, pearl.at.y - 10 + bob, 26);
        fill(255, 255, 255, 230);
        circle(pearl.at.x - 5, pearl.at.y - 15 + bob, 8);
      }
      pop();
    }

    draw(): void {
      const at = this.lanternPos;
      const t = this.clockMs / 1000;
      const relighting = this.now < this.relightUntilMs;
      const pushDir = Math.sign(this.push);
      const lead = pushDir > 0 ? courtColor(BLUE) : pushDir < 0 ? courtColor(RED) : INK.CREAM;
      const bob = Math.sin(t * 2.1) * 4;
      push();

      // The glow: who stands inside it is the whole game, so it is drawn.
      noStroke();
      fill(INK.LANTERN[0], INK.LANTERN[1], INK.LANTERN[2], relighting ? 10 : 22);
      circle(at.x, at.y, ESCORT_RADIUS * 2);
      noFill();
      stroke(lead[0], lead[1], lead[2], 170);
      strokeWeight(4);
      const dashes = 36;
      const spin = t * 0.25 * (pushDir || 1);
      for (let i = 0; i < dashes; i++) {
        const a0 = spin + (i / dashes) * Math.PI * 2;
        arc(at.x, at.y, ESCORT_RADIUS * 2, ESCORT_RADIUS * 2, a0, a0 + (Math.PI * 2) / dashes / 2);
      }

      // Escort pips: one row per court, either side of the lantern.
      noStroke();
      const pips = (count: number, court: Court, side: number): void => {
        const c = courtColor(court);
        const whole = Math.min(4, Math.floor(count + 1e-6));
        for (let i = 0; i < whole; i++) {
          fill(c[0], c[1], c[2]);
          circle(at.x + side * (74 + i * 20), at.y + 74, 14);
        }
        if (count - whole > 0.2 && whole < 4) {
          fill(c[0], c[1], c[2], 130);
          circle(at.x + side * (74 + whole * 20), at.y + 74, 9);
        }
      };
      pips(this.escort.blue, BLUE, -1);
      pips(this.escort.red, RED, 1);

      // The float it rides on.
      fill(INK.SHADOW[0], INK.SHADOW[1], INK.SHADOW[2], 150);
      ellipse(at.x + 4, at.y + 40, 120, 34);
      fill(INK.REEF_BASE[0], INK.REEF_BASE[1], INK.REEF_BASE[2]);
      ellipse(at.x, at.y + 32, 116, 34);
      fill(lead[0], lead[1], lead[2]);
      ellipse(at.x, at.y + 28, 92, 22);

      // The paper lantern: halo, body, ribs, flame.
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      fill(INK.LANTERN[0], INK.LANTERN[1], INK.LANTERN[2], relighting ? 24 : 54 + 30 * pulse);
      circle(at.x, at.y - 18 + bob, 150);
      fill(INK.SHADOW[0], INK.SHADOW[1], INK.SHADOW[2]);
      rect(at.x - 20, at.y - 66 + bob, 40, 10, 4);
      rect(at.x - 20, at.y + 16 + bob, 40, 10, 4);
      const body = relighting ? INK.SAND_DARK : INK.LANTERN;
      fill(body[0], body[1], body[2]);
      rect(at.x - 32, at.y - 58 + bob, 64, 76, 26);
      stroke(INK.EMBER[0], INK.EMBER[1], INK.EMBER[2], 150);
      strokeWeight(2.5);
      noFill();
      for (let rib = -1; rib <= 1; rib++) {
        arc(at.x + rib * 4, at.y - 20 + bob, 30 + Math.abs(rib) * 26, 74, -Math.PI / 2, Math.PI / 2);
        arc(at.x - rib * 4, at.y - 20 + bob, 30 + Math.abs(rib) * 26, 74, Math.PI / 2, (Math.PI * 3) / 2);
      }
      noStroke();
      if (!relighting) {
        fill(INK.LANTERN_HOT[0], INK.LANTERN_HOT[1], INK.LANTERN_HOT[2]);
        ellipse(at.x, at.y - 18 + bob, 20, 30 + 6 * pulse);
      }

      // Which way it is going: chevrons on the leading side.
      if (pushDir !== 0) {
        stroke(lead[0], lead[1], lead[2]);
        strokeWeight(6);
        noFill();
        for (let i = 0; i < 2; i++) {
          const x = at.x + pushDir * (58 + i * 20 + ((t * 30) % 12));
          line(x, at.y - 34, x + pushDir * 14, at.y - 18);
          line(x, at.y - 2, x + pushDir * 14, at.y - 18);
        }
      }

      // The anchor: a ring of chain while Brine's hold is on.
      if (this.hold && this.now < this.hold.untilMs) {
        const c = courtColor(this.hold.court);
        stroke(c[0], c[1], c[2], 230);
        strokeWeight(5);
        noFill();
        circle(at.x, at.y + 30, 150 + Math.sin(t * 8) * 6);
      }
      pop();
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
  const existing = hearts.get(game);
  if (existing) return existing;
  const slots: any[] = game?.neutralSlots ?? [];
  const onReef = slots.some(slot => slot?.role === HEART_ROLE) || game?.activeMapId === 'driftglass';
  if (!onReef) return null;
  const heart = createHeart(game);
  game.objectManager.addObject(heart);
  return heart;
}
