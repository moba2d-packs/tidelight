/**
 * Bóng Đá Rạn San Hô: the pearl's physics, the goals, the 3 s reset and the
 * win — on the pure `BallMatch` — then the engine hooks (walk, attack, spell).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApi, createGame, indexObjects, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import { BLUE, CENTRE, CY, GOAL_HALF, PITCH, RED } from '../maps/ball/layout';
import {
  ABILITY_SPEED,
  BALL_R,
  BODY_R,
  BallMatch,
  GOALS_TO_WIN,
  GOAL_RESET_MS,
  KICK_SPEED,
  MATCH_MS,
  REVIVE_MS,
  bumpBall,
  launchBall,
  speedOf,
  stepBall,
  winnerOf,
} from '../maps/ball/rules';
import { ballMap, geometry } from '../maps/ball/map';
import { createPitch } from '../maps/ball/pitch';

const ball = (x: number, y: number, vx = 0, vy = 0) => ({ x, y, vx, vy });
const run = (m: BallMatch, ms: number) => {
  for (let t = 0; t < ms; t += 20) m.step(20);
};

describe('ball physics', () => {
  it('rolls, slows with friction and stops', () => {
    const b = ball(CENTRE.x, CENTRE.y, 400, 0);
    for (let i = 0; i < 20; i++) stepBall(b, 50);
    expect(b.x).toBeGreaterThan(CENTRE.x + 100);
    expect(speedOf(b)).toBeLessThan(400);
    for (let i = 0; i < 400; i++) stepBall(b, 50);
    expect(speedOf(b)).toBe(0);
  });

  it('bounces off the touchline and loses some speed', () => {
    const b = ball(CENTRE.x, PITCH.top + 60, 0, -600);
    stepBall(b, 100);
    expect(b.vy).toBeGreaterThan(0);
    expect(b.vy).toBeLessThan(600);
    expect(b.y).toBeGreaterThanOrEqual(PITCH.top + BALL_R);
  });

  it('bounces off the goal line outside the mouth, never tunnels at full speed', () => {
    const b = ball(PITCH.left + 80, PITCH.top + 100, -1500, 0);
    for (let i = 0; i < 10; i++) stepBall(b, 50);
    expect(b.x).toBeGreaterThanOrEqual(PITCH.left + BALL_R);
    expect(b.vx).toBeGreaterThanOrEqual(0);
  });

  it('a walking champion dribbles it; standing still only blocks it', () => {
    const b = ball(CENTRE.x + BALL_R + BODY_R - 2, CENTRE.y);
    expect(bumpBall(b, { x: CENTRE.x, y: CENTRE.y, vx: 200, vy: 0, r: BODY_R })).toBe(true);
    expect(b.vx).toBeGreaterThan(200);
    const rolling = ball(CENTRE.x + 50, CENTRE.y, -300, 0);
    bumpBall(rolling, { x: CENTRE.x, y: CENTRE.y, vx: 0, vy: 0, r: BODY_R });
    expect(rolling.vx).toBeGreaterThanOrEqual(0);
    expect(bumpBall(ball(CENTRE.x + 500, CENTRE.y), { x: CENTRE.x, y: CENTRE.y, vx: 0, vy: 0, r: BODY_R })).toBe(false);
  });

  it('launch sets a hard speed along a direction and never slows a faster ball', () => {
    const b = ball(0, 0);
    launchBall(b, 3, 4, KICK_SPEED);
    expect(speedOf(b)).toBeCloseTo(KICK_SPEED, 3);
    expect(b.vx / b.vy).toBeCloseTo(0.75, 3);
    const fast = ball(0, 0, 1400, 0);
    launchBall(fast, 1, 0, ABILITY_SPEED);
    expect(fast.vx).toBeGreaterThanOrEqual(1400 - 1);
  });
});

describe('scoring, reset and win', () => {
  const shoot = (m: BallMatch, toRight: boolean) => {
    m.ball.x = toRight ? PITCH.right - 150 : PITCH.left + 150;
    m.ball.y = CY;
    m.ball.vx = toRight ? 900 : -900;
    m.ball.vy = 0;
    run(m, 600);
  };

  it('a ball over the right line scores for blue, over the left for red', () => {
    const m = new BallMatch();
    shoot(m, true);
    expect(m.score).toEqual({ blue: 1, red: 0 });
    run(m, GOAL_RESET_MS + 100);
    shoot(m, false);
    expect(m.score).toEqual({ blue: 1, red: 1 });
  });

  it('the posts hold: a shot wide of the mouth is not a goal', () => {
    const m = new BallMatch();
    m.ball.x = PITCH.right - 150;
    m.ball.y = CY + GOAL_HALF + 80;
    m.ball.vx = 900;
    run(m, 800);
    expect(m.score).toEqual({ blue: 0, red: 0 });
  });

  it('scores once, then puts the ball back at the centre after 3 s', () => {
    const m = new BallMatch();
    shoot(m, true);
    expect(m.resetInMs).toBeGreaterThan(0);
    expect(m.live).toBe(false);
    run(m, GOAL_RESET_MS - 700);
    expect(m.ball.x).toBeGreaterThan(PITCH.right); // still in the net
    expect(m.score.blue).toBe(1); // no double count
    run(m, 900);
    expect(m.ball).toEqual({ x: CENTRE.x, y: CENTRE.y, vx: 0, vy: 0 });
    expect(m.live).toBe(true);
  });

  it('first to 3 goals wins and the match stops', () => {
    const m = new BallMatch();
    for (let i = 0; i < GOALS_TO_WIN; i++) {
      shoot(m, true);
      run(m, GOAL_RESET_MS + 100);
    }
    expect(m.winner).toBe(BLUE);
    const clock = m.elapsedMs;
    m.step(1000);
    expect(m.elapsedMs).toBe(clock);
  });

  it('at five minutes the leader wins; a draw plays on until the next goal', () => {
    expect(winnerOf({ blue: 1, red: 2 }, MATCH_MS - 1)).toBeNull();
    expect(winnerOf({ blue: 1, red: 2 }, MATCH_MS)).toBe(RED);
    expect(winnerOf({ blue: 2, red: 2 }, MATCH_MS + 60_000)).toBeNull();
    const m = new BallMatch();
    m.elapsedMs = MATCH_MS;
    shoot(m, false);
    expect(m.winner).toBe(RED);
  });
});

describe('map', () => {
  it('declares fast respawn, no waves, and the ball in a neutral object slot', () => {
    expect(REVIVE_MS).toBe(3_000);
    expect(ballMap.tuning?.champions?.reviveTime).toBe(REVIVE_MS);
    expect(geometry.slots.neutral[0].kind).toBe('object');
    expect(geometry.slots.minion).toEqual([]);
    expect(geometry.slots.spawn).toHaveLength(2);
  });
});

describe('engine hooks', () => {
  const { Champion, AoePulse } = { ...buildTestApi().units, AoePulse: buildTestApi().AoePulse };
  let game: TestGame;
  let pitch: any;

  const hero = (teamId: string, x: number, y: number) => {
    const unit = new Champion({ game, teamId }) as any;
    unit.position.set(x, y);
    unit.destination.set(x, y);
    return unit;
  };
  const tick = (units: any[], ms = 50) => {
    indexObjects(game, units as never[]);
    (game as any).matchTimeMs += ms;
    pitch.step(ms);
  };

  beforeEach(() => {
    stubGameGlobals();
    vi.stubGlobal('deltaTime', 16);
    game = createGame(2_400);
    (game as any).turrets = [];
    const watcher = hero(BLUE, -5_000, -5_000);
    game.setPlayer(watcher);
    pitch = createPitch(game);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a champion walking into the pearl pushes it', () => {
    const walker = hero(BLUE, CENTRE.x - 80, CENTRE.y);
    for (let i = 0; i < 10; i++) {
      walker.position.x += 12; // 240 units/s
      tick([walker]);
    }
    expect(pitch.match.ball.x).toBeGreaterThan(CENTRE.x + 20);
  });

  it('a basic attack with the pearl in reach kicks it hard', () => {
    const striker = hero(BLUE, CENTRE.x - 100, CENTRE.y);
    (game as any).eventManager.emit('onUnitAttack', striker);
    expect(speedOf(pitch.match.ball)).toBeGreaterThan(KICK_SPEED - 1);
    expect(pitch.match.ball.vx).toBeGreaterThan(0);
  });

  it('a basic attack out of reach does nothing', () => {
    const far = hero(BLUE, CENTRE.x - 900, CENTRE.y);
    (game as any).eventManager.emit('onUnitAttack', far);
    expect(speedOf(pitch.match.ball)).toBe(0);
  });

  it('an ability object overlapping the pearl launches it away from its centre', () => {
    const caster = hero(RED, 2_000, CY);
    const pulse = new AoePulse(caster as any) as any;
    pulse.position.set(CENTRE.x - 60, CENTRE.y);
    pulse.radius = 150;
    tick([caster, pulse]);
    expect(pitch.match.ball.vx).toBeGreaterThan(ABILITY_SPEED * 0.9);
    // The same pulse does not machine-gun the pearl on the next tick.
    const vx = pitch.match.ball.vx;
    tick([caster, pulse]);
    expect(pitch.match.ball.vx).toBeLessThanOrEqual(vx);
  });
});
