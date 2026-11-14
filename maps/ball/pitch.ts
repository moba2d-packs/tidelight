import { onMap } from '../onMap';
import { ensureArt } from '../../world/art/sceneryObject';
import { ballArt } from './art';
import { api } from '../../packApi';
import { INK, css } from '../../world/palette';
import {
  BALL_MAP_ID,
  BALL_ROLE,
  BLUE,
  CENTRE,
  CY,
  GOAL_CENTRE,
  GOAL_HALF,
  MAP_SIZE,
  PITCH,
  POCKET,
  RED,
  SPAWNS,
  type Side,
} from './layout';
import {
  ABILITY_REHIT_MS,
  ABILITY_SPEED,
  BALL_R,
  BODY_R,
  BallMatch,
  GOALS_TO_WIN,
  KICK_SPEED,
  bumpBall,
  formatClock,
  launchBall,
} from './rules';

/**
 * The Pearl Ball's world object — the only thing that makes a Bóng Đá match a
 * match. It lives in the map's one neutral slot (`BALL_ROLE`), runs the pure
 * `BallMatch` each tick and feeds it what the engine knows:
 *
 *   - bodies:  champions walking into the pearl dribble it (`bumpBall`);
 *   - attacks: `ON_ATTACK` with the pearl in reach kicks it hard;
 *   - spells:  any `SpellObject` (missile, area, pulse, beam) whose body
 *              overlaps the pearl launches it — damage or not, so a utility
 *              ability counts too;
 *   - bots:    their own movement is switched off and steered here.
 */
const BASIC_ATTACK_LABEL = 'Đánh thường'; // core's BASIC_ATTACK_SOURCE
const BOT_THINK_MS = 200;
const HUD_MS = 90;
const KICK_REACH_CAP = 260;

const pitches = new WeakMap<object, unknown>();
export const getPitch = (game: unknown): any => (game ? (pitches.get(game as object) ?? null) : null);

const sideOf = (teamId: string | undefined): Side | null =>
  teamId === BLUE ? BLUE : teamId === RED ? RED : null;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

function build() {
  const { Champion } = api.units;

  class BallPitch extends api.GameObject {
    // The pearl is all this object draws, so it sits on the ground layer: above
    // the fountain's healing ring (FOUNTAIN_Z_INDEX), which used to hide it
    // whenever it rolled home, and still under every unit.
    zIndex = api.layers.GROUND_Z_INDEX;
    alwaysVisible = true;
    readonly match = new BallMatch();
    private clockMs = 0;
    private botClock = 0;
    private plans = new WeakMap<object, { to: { x: number; y: number }; mayFight: boolean }>();
    private steered: any[] = [];
    private hudClock = 0;
    private last = new WeakMap<object, { x: number; y: number }>();
    private hitAt = new WeakMap<object, number>();
    private unsub: (() => void) | null = null;
    private root: HTMLElement | null = null;
    private line!: HTMLElement;
    private note!: HTMLElement;
    private end!: HTMLElement;
    private dismissed = false;
    private shown = '';

    constructor(game: any, x = CENTRE.x, y = CENTRE.y) {
      super({ game, position: createVector(x, y) });
      pitches.set(game, this);
      this.unsub = game.eventManager?.on(api.enums.EventType.ON_ATTACK, (unit: any) => this.onAttack(unit)) ?? null;
      this.buildHud();
      if (typeof window !== 'undefined') (window as any).__ballpitch = this;
    }

    // ---- engine inputs ----------------------------------------------------

    private champions(center: { x: number; y: number }, radius: number): any[] {
      const found = (this.game as any).objectManager.queryObjects({
        area: new api.utils.Quadtree.Circle({ x: center.x, y: center.y, r: radius }),
        filters: [api.combat.PredefinedFilters.canTakeDamage],
      }) as any[];
      return found.filter(unit => unit instanceof Champion && !unit.isDead);
    }

    /** A basic attack swung with the pearl in reach kicks it, hard. */
    onAttack(unit: any): void {
      if (!this.match.live || !(unit instanceof Champion) || !unit.position) return;
      const ball = this.match.ball;
      const range = Math.min(Number(unit.stats?.attackRange?.value ?? unit.stats?.attackRange?.baseValue) || 0, KICK_REACH_CAP);
      if (dist(unit.position, ball) > range + BALL_R + BODY_R) return;
      launchBall(ball, ball.x - unit.position.x, ball.y - unit.position.y, KICK_SPEED);
    }

    private bump(dtMs: number): void {
      const ball = this.match.ball;
      for (const unit of this.champions(ball, BALL_R + BODY_R + 80)) {
        const prev = this.last.get(unit);
        const dt = Math.max(dtMs, 1) / 1000;
        const vx = prev ? (unit.position.x - prev.x) / dt : 0;
        const vy = prev ? (unit.position.y - prev.y) / dt : 0;
        bumpBall(ball, { x: unit.position.x, y: unit.position.y, vx, vy, r: BODY_R });
      }
    }

    private remember(): void {
      for (const unit of this.champions(CENTRE, MAP_SIZE)) {
        this.last.set(unit, { x: unit.position.x, y: unit.position.y });
      }
    }

    /** Any spell object touching the pearl launches it. */
    private spells(): void {
      const ball = this.match.ball;
      const objects: any[] = (this.game as any).objectManager?.objects ?? [];
      for (const obj of objects) {
        if (!obj || obj === this || obj.toRemove || !(obj instanceof api.SpellObject)) continue;
        if ((obj.owner as unknown) === this || obj.attributedTo?.name === BASIC_ATTACK_LABEL) continue;
        const at = obj.position;
        if (!at) continue;
        const reach = BALL_R + Math.max(20, Math.min(Number((obj as any).radius) || 40, 260));
        if (dist(at, ball) > reach) continue;
        const seen = this.hitAt.get(obj);
        if (seen !== undefined && this.clockMs - seen < ABILITY_REHIT_MS) continue;
        this.hitAt.set(obj, this.clockMs);
        let dx = ball.x - at.x;
        let dy = ball.y - at.y;
        const dest = obj.destination;
        if (obj.isMissile && dest && Math.hypot(dest.x - at.x, dest.y - at.y) > 1) {
          dx = dest.x - at.x;
          dy = dest.y - at.y;
        } else if (Math.hypot(dx, dy) < 4 && obj.owner?.position) {
          dx = ball.x - obj.owner.position.x;
          dy = ball.y - obj.owner.position.y;
        }
        launchBall(ball, dx, dy, ABILITY_SPEED);
      }
    }

    // ---- bots -------------------------------------------------------------

    /**
     * Bots know nothing of a ball: core has no hook to teach them one. So their
     * own movement is switched off and the nearest bot of each side is steered
     * to get behind the pearl and run it at the enemy goal; the rest hold a
     * line between the pearl and their own goal. They still cast and swing.
     *
     * **One owner per bot per frame.** Switching `_autoMove` off stops the
     * brain walking, but not its retaliation: a hit still hands the bot's
     * `basicAttack` an order, and that controller then `navigateTo`s or plants
     * on *every frame*. Steering only every 200ms meant a fighting bot was
     * pulled toward the pearl for one frame and back for eleven — the
     * stutter reported in fights. So this only *plans* every 200ms
     * (`plans`), and `applyPlans` enforces the plan every frame: a defender
     * with an enemy already in reach is left to swing where it stands;
     * everyone else has any attack order dropped and walks the plan.
     */
    private steerBots(): void {
      const ball = this.match.ball;
      const all = this.champions(CENTRE, MAP_SIZE).filter(unit => 'brain' in unit);
      for (const side of [BLUE, RED] as Side[]) {
        const mine = all.filter(unit => unit.teamId === side);
        if (!mine.length) continue;
        const own = GOAL_CENTRE[side];
        const goal = GOAL_CENTRE[side === BLUE ? RED : BLUE];
        const live = this.match.live;
        let chaser: any = null;
        for (const unit of mine) {
          if (!chaser || dist(unit.position, ball) < dist(chaser.position, ball)) chaser = unit;
        }
        for (const unit of mine) {
          unit._autoMove = false;
          let to: { x: number; y: number };
          if (!live) to = SPAWNS[side];
          else if (unit === chaser) to = this.chaseTarget(unit.position, ball, goal);
          else
            to = {
              x: own.x + (ball.x - own.x) * 0.35 + (side === BLUE ? 120 : -120),
              y: CY + (ball.y - CY) * 0.4,
            };
          this.plans.set(unit, { to, mayFight: live && unit !== chaser });
        }
      }
      this.steered = all;
    }

    /** Every frame: the plan wins, except for a defender already trading blows in reach. */
    private applyPlans(): void {
      for (const unit of this.steered) {
        if (unit.isDead || unit.toRemove) continue;
        const plan = this.plans.get(unit);
        if (!plan) continue;
        const swing = unit.basicAttack;
        const target = swing?.target;
        if (target) {
          const engaged =
            plan.mayFight && !target.isDead && dist(unit.position, target.position) <= swing.reachTo(target);
          if (engaged) continue;
          swing.clear();
        }
        const to = plan.to;
        if (dist(unit.position, to) <= 40) continue;
        const d = unit.destination;
        if (!d || d.x !== to.x || d.y !== to.y) unit.moveTo(to.x, to.y);
      }
    }

    /** Where a chasing bot should walk: behind the pearl, then through it at the goal. */
    private chaseTarget(bot: { x: number; y: number }, ball: { x: number; y: number }, goal: { x: number; y: number }) {
      const gx = goal.x - ball.x;
      const gy = goal.y - ball.y;
      const g = Math.hypot(gx, gy) || 1;
      const ux = gx / g;
      const uy = gy / g;
      const rx = bot.x - ball.x;
      const ry = bot.y - ball.y;
      const along = rx * ux + ry * uy;
      const lateral = rx * -uy + ry * ux;
      if (along < -10 && Math.abs(lateral) < 70) return { x: ball.x + ux * 200, y: ball.y + uy * 200 };
      const side = lateral >= 0 ? 1 : -1;
      const back = BALL_R + BODY_R + 90;
      return {
        x: Math.max(PITCH.left + 40, Math.min(PITCH.right - 40, ball.x - ux * back + -uy * side * 100)),
        y: Math.max(PITCH.top + 40, Math.min(PITCH.bottom - 40, ball.y - uy * back + ux * side * 100)),
      };
    }

    // ---- tick -------------------------------------------------------------

    /** Advance without drawing — what `update()` does each frame. */
    step(dtMs: number): void {
      this.clockMs += dtMs;
      if (this.match.live) {
        this.bump(dtMs);
        this.spells();
      }
      const scored = this.match.step(dtMs);
      if (scored) this.onGoal(scored);
      this.botClock += dtMs;
      if (this.botClock >= BOT_THINK_MS) {
        this.botClock = 0;
        this.steerBots();
      }
      this.applyPlans();
      this.remember();
    }

    private onGoal(side: Side): void {
      const at = this.match.ball;
      const burst = new api.AoePulse(this as any);
      burst.position = createVector(at.x, at.y);
      burst.radius = 260;
      burst.lifeTime = 900;
      const c = side === BLUE ? INK.TIDE : INK.EMBER;
      burst.color = [c[0], c[1], c[2]];
      (this.game as any).objectManager.addObject(burst);
    }

    update(): void {
      this.step(deltaTime);
      this.position.x = this.match.ball.x;
      this.position.y = this.match.ball.y;
      this.hudClock += deltaTime;
      if (this.hudClock >= HUD_MS) {
        this.hudClock = 0;
        this.renderHud();
      }
    }

    // ---- banner (DOM, a few writes a second) -------------------------------

    private buildHud(): void {
      if (typeof document === 'undefined') return;
      document.getElementById('ballpitch-hud')?.remove();
      const root = document.createElement('div');
      root.id = 'ballpitch-hud';
      root.style.cssText = `position:fixed;left:50%;top:calc(var(--safe-top,0px) + 39px);transform:translateX(-50%);z-index:40;
        pointer-events:none;text-align:center;font:700 15px "Avenir Next","Segoe UI",system-ui,sans-serif;color:${css(INK.CREAM)}`;
      this.line = document.createElement('div');
      this.line.style.cssText = `padding:3px 14px;border-radius:999px;background:${css(INK.ABYSS, 0.82)};border:1.5px solid ${css(INK.CREAM, 0.25)};white-space:nowrap`;
      this.note = document.createElement('div');
      this.note.style.cssText = `margin-top:4px;font-size:12px;color:${css(INK.LANTERN)}`;
      root.append(this.line, this.note);
      this.end = document.createElement('div');
      this.end.style.cssText = `position:fixed;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:10px;
        background:${css(INK.ABYSS, 0.78)};z-index:60;pointer-events:auto;font:700 18px "Avenir Next","Segoe UI",system-ui,sans-serif;color:${css(INK.CREAM)}`;
      const again = document.createElement('button');
      again.textContent = 'Trận mới';
      again.onclick = () => {
        // Gone before the restart: a card left up over the next match eats every click.
        this.onRemoved();
        const g: any = this.game;
        if (typeof g.onRestartRequested === 'function') g.onRestartRequested();
        else if (typeof location !== 'undefined') location.reload();
      };
      const stay = document.createElement('button');
      stay.textContent = 'Xem tiếp';
      stay.onclick = () => {
        this.dismissed = true;
        this.end.style.display = 'none';
      };
      this.end.append(document.createElement('h1'), again, stay);
      (document.getElementById('game-scene') ?? document.body).append(root);
      document.body.append(this.end);
      this.root = root;
    }

    private renderHud(): void {
      if (!this.root) return;
      const m = this.match;
      const key = `${m.score.blue}:${m.score.red}:${formatClock(m.elapsedMs)}:${m.resetInMs > 0}:${m.winner}`;
      if (key === this.shown) return;
      this.shown = key;
      this.line.textContent = `Lam ${m.score.blue}  :  ${m.score.red} Lửa  ·  ${formatClock(m.elapsedMs)}  ·  đến ${GOALS_TO_WIN}`;
      const tied = m.elapsedMs >= 5 * 60_000 && m.score.blue === m.score.red;
      this.note.textContent = m.resetInMs > 0
        ? m.lastScorer === BLUE ? 'BÀN THẮNG cho Lam!' : 'BÀN THẮNG cho Lửa!'
        : tied ? 'Hoà giờ: bàn kế tiếp thắng!' : '';
      if (m.winner && !this.dismissed) {
        const player: any = (this.game as any).player;
        const won = sideOf(player?.teamId) === m.winner;
        (this.end.firstChild as HTMLElement).textContent = `${won ? 'Chiến thắng!' : 'Thua rồi'}  ${m.score.blue} – ${m.score.red}`;
        this.end.style.display = 'flex';
      }
    }

    /** Core's restart/exit does not remove objects one by one: let go of the DOM here too. */
    onMatchTeardown(): void {
      this.onRemoved();
    }

    onRemoved(): void {
      this.unsub?.();
      this.root?.remove();
      this.end?.remove();
      this.root = null;
    }

    // ---- drawing: the pearl alone (the pitch is painted by `art.ts`) -------

    draw(): void {
      const ctx = drawingContext as CanvasRenderingContext2D;
      const m = this.match;
      ctx.save();
      // The sandbar, its lines, the whale-jaw goals and the pools are `art.ts`'s; only the pearl moves.
      // The pearl: shadow, body, shine.
      const b = m.ball;
      ctx.fillStyle = css(INK.SHADOW, 0.45);
      ctx.beginPath();
      ctx.ellipse(b.x + 3, b.y + BALL_R * 0.7, BALL_R, BALL_R * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(INK.PEARL);
      ctx.strokeStyle = css(INK.LANTERN, 0.9);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(b.x - 8, b.y - 9, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    getDisplayBoundingBox() {
      return this.squareDisplayBoundingBox(MAP_SIZE * 2);
    }
  }
  return BallPitch;
}

let PitchClass: ReturnType<typeof build> | null = null;

/** Build the pitch's ball at a slot. `pack.ts` wires this to `BALL_ROLE`. */
export function createPitch(game: any, x = CENTRE.x, y = CENTRE.y) {
  if (onMap(game, BALL_MAP_ID)) ensureArt(game, BALL_MAP_ID, MAP_SIZE, ballArt);
  PitchClass ??= build();
  const existing = pitches.get(game);
  if (existing) return existing as InstanceType<typeof PitchClass>;
  return new PitchClass(game, x, y);
}

/** Neutral slots only fill with "jungle" on: guarantee a Bóng Đá match has its ball regardless. */
export function ensurePitch(game: any): void {
  if (!game || pitches.has(game)) return;
  const slots: any[] = game.neutralSlots ?? [];
  if (!slots.some(slot => slot?.role === BALL_ROLE) && !onMap(game, BALL_MAP_ID)) return;
  game.objectManager.addObject(createPitch(game));
}
