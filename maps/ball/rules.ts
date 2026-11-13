import { BLUE, CENTRE, CY, GOAL_HALF, PITCH, POCKET, RED, type Pt, type Side } from './layout';

/**
 * The pearl ball and the match around it, as plain numbers: no engine, so the
 * physics, the scoring, the reset and the win are all testable by stepping it.
 */
export const BALL_R = 26;
/** Fraction of speed kept per second (exp decay): the pearl rolls ~2s after a hard kick. */
export const FRICTION = 1.25;
export const MAX_SPEED = 1500;
export const STOP_SPEED = 8;
/** Share of speed a wall gives back. */
export const WALL_BOUNCE = 0.72;
/** How lively a body-on-ball bump is (1 = dead stop relative to the body, 2 = perfectly elastic). */
export const BODY_RESTITUTION = 0.9;
export const BODY_R = 30;
/** Launch speeds: a basic attack's kick, and an ability's blast. */
export const KICK_SPEED = 1250;
export const ABILITY_SPEED = 1050;
/** The same ability object may not launch the ball again for this long. */
export const ABILITY_REHIT_MS = 400;

export const GOALS_TO_WIN = 3;
export const MATCH_MS = 5 * 60_000;
export const GOAL_RESET_MS = 3_000;
export const REVIVE_MS = 3_000;

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface Body extends Pt {
  vx: number;
  vy: number;
  r: number;
}
export interface Score {
  blue: number;
  red: number;
}

export const speedOf = (b: Ball): number => Math.hypot(b.vx, b.vy);
const clampSpeed = (b: Ball): void => {
  const s = speedOf(b);
  if (s > MAX_SPEED) {
    b.vx = (b.vx / s) * MAX_SPEED;
    b.vy = (b.vy / s) * MAX_SPEED;
  }
};

const mouthMin = CY - GOAL_HALF + BALL_R;
const mouthMax = CY + GOAL_HALF - BALL_R;

/** Bounce the ball off whatever it is touching, in place. */
function collideWalls(b: Ball): void {
  const bounce = (axis: 'x' | 'y', at: number, sign: 1 | -1): void => {
    b[axis] = at;
    const v = axis === 'x' ? 'vx' : 'vy';
    if (b[v] * sign < 0) b[v] = -b[v] * WALL_BOUNCE;
  };
  const inMouth = b.y >= mouthMin && b.y <= mouthMax;
  const left = PITCH.left;
  const right = PITCH.right;

  if (b.x < left || b.x > right) {
    // In a net pocket: only the goal mouth's height is open.
    if (b.y < mouthMin) bounce('y', mouthMin, 1);
    else if (b.y > mouthMax) bounce('y', mouthMax, -1);
    const back = left - POCKET + BALL_R;
    const backR = right + POCKET - BALL_R;
    if (b.x < back) bounce('x', back, 1);
    else if (b.x > backR) bounce('x', backR, -1);
    return;
  }
  // On the pitch.
  if (b.y < PITCH.top + BALL_R) bounce('y', PITCH.top + BALL_R, 1);
  else if (b.y > PITCH.bottom - BALL_R) bounce('y', PITCH.bottom - BALL_R, -1);
  if (!inMouth) {
    if (b.x < left + BALL_R) bounce('x', left + BALL_R, 1);
    else if (b.x > right - BALL_R) bounce('x', right - BALL_R, -1);
  }
}

/**
 * Move the ball `dtMs`, with friction and wall bounce. Sub-stepped so a hard
 * kick cannot tunnel a wall. Returns the side that SCORED if the ball ended
 * fully over a goal line (centre past it by a radius), else null.
 */
export function stepBall(b: Ball, dtMs: number): Side | null {
  const dt = Math.min(dtMs, 100) / 1000;
  const decay = Math.exp(-FRICTION * dt);
  b.vx *= decay;
  b.vy *= decay;
  if (speedOf(b) < STOP_SPEED) {
    b.vx = 0;
    b.vy = 0;
  }
  const steps = Math.max(1, Math.ceil((speedOf(b) * dt) / (BALL_R * 0.5)));
  for (let i = 0; i < steps; i++) {
    b.x += (b.vx * dt) / steps;
    b.y += (b.vy * dt) / steps;
    collideWalls(b);
  }
  if (b.x < PITCH.left - BALL_R) return RED;
  if (b.x > PITCH.right + BALL_R) return BLUE;
  return null;
}

/**
 * A body (champion) bumping the ball: pushes it out of the body and gives it
 * the body's own motion, so walking into it dribbles and running into it
 * knocks it ahead. Returns true on contact.
 */
export function bumpBall(b: Ball, body: Body): boolean {
  let dx = b.x - body.x;
  let dy = b.y - body.y;
  let d = Math.hypot(dx, dy);
  const reach = BALL_R + body.r;
  if (d >= reach) return false;
  if (d < 0.001) {
    dx = 1;
    dy = 0;
    d = 1;
  }
  const nx = dx / d;
  const ny = dy / d;
  b.x = body.x + nx * reach;
  b.y = body.y + ny * reach;
  const rel = (b.vx - body.vx) * nx + (b.vy - body.vy) * ny;
  if (rel < 0) {
    b.vx -= (1 + BODY_RESTITUTION) * rel * nx;
    b.vy -= (1 + BODY_RESTITUTION) * rel * ny;
  }
  clampSpeed(b);
  collideWalls(b);
  return true;
}

/** Launch the ball along (dx, dy) at `speed`; never slows a ball already faster that way. */
export function launchBall(b: Ball, dx: number, dy: number, speed: number): void {
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  const along = b.vx * nx + b.vy * ny;
  const s = Math.max(speed, along);
  b.vx = nx * s;
  b.vy = ny * s;
  clampSpeed(b);
}

export function winnerOf(score: Score, elapsedMs: number): Side | null {
  if (score.blue >= GOALS_TO_WIN) return BLUE;
  if (score.red >= GOALS_TO_WIN) return RED;
  if (elapsedMs >= MATCH_MS && score.blue !== score.red) return score.blue > score.red ? BLUE : RED;
  // Level at the whistle: the next goal wins.
  return null;
}

/** The scoreboard clock, `m:ss`, counting down to full time. */
export const formatClock = (elapsedMs: number): string => {
  const left = Math.max(0, Math.ceil((MATCH_MS - elapsedMs) / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
};

/** One whole match, stepped by time: ball, score, the 3 s reset, the winner. */
export class BallMatch {
  ball: Ball = { x: CENTRE.x, y: CENTRE.y, vx: 0, vy: 0 };
  score: Score = { blue: 0, red: 0 };
  winner: Side | null = null;
  elapsedMs = 0;
  /** > 0 while the ball sits in the net waiting to go back to the centre. */
  resetInMs = 0;
  /** The side that scored last, for the banner. */
  lastScorer: Side | null = null;

  /** Advance `dtMs`. Returns the side that scored this step, if any. */
  step(dtMs: number): Side | null {
    if (this.winner) return null;
    this.elapsedMs += dtMs;
    let scored: Side | null = null;
    const hit = stepBall(this.ball, dtMs);
    if (this.resetInMs > 0) {
      this.resetInMs -= dtMs;
      if (this.resetInMs <= 0) this.resetBall();
    } else if (hit) {
      scored = hit;
      if (hit === BLUE) this.score.blue += 1;
      else this.score.red += 1;
      this.lastScorer = hit;
      // The net swallows the shot: it settles instead of flying back out.
      this.ball.vx *= 0.25;
      this.ball.vy *= 0.25;
      this.resetInMs = GOAL_RESET_MS;
    }
    this.winner = winnerOf(this.score, this.elapsedMs);
    return scored;
  }

  resetBall(): void {
    this.ball.x = CENTRE.x;
    this.ball.y = CENTRE.y;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.resetInMs = 0;
  }

  /** A ball already in the net cannot be kicked back out while it waits. */
  get live(): boolean {
    return this.resetInMs <= 0 && !this.winner;
  }
}
