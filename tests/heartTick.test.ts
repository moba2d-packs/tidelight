/**
 * What the Heart does every tick, and what it is allowed to save on.
 *
 * The escort count runs every tick and the shoal pass four times a second.
 * Both got cheaper (no tally objects, one circle kept between queries, one
 * sweep of the map per shoal tick instead of two) and neither may move the
 * lantern by a hair: the push is checked against the rules run by hand, the
 * gate against `wardensOf`, and the saving itself against the queries issued.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApi, createGame, indexObjects, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import { BLUE, CENTER, KEEPS, MAP_SIZE, RAIL_Y, RED, WARDENS, railX } from '../world/layout';
import { ESCORT_RADIUS, escortWeight, stepLantern } from '../world/rules';
import { createHeart, tideTraits, wardensOf, type Heart } from '../world/heart';

const { Champion, Minion } = buildTestApi().units;
let game: TestGame;
let heart: Heart;

const at = (unit: any, x: number, y: number) => {
  unit.position.set(x, y);
  unit.destination.set(x, y);
  return unit;
};
const hero = (teamId: string, dx: number, dy = 40) =>
  at(new Champion({ game, teamId }) as any, CENTER.x + dx, RAIL_Y + dy);
const minion = (teamId: string, dx: number, dy = -30) =>
  at(new Minion({ game, teamId, waypoints: [], lane: 'mid' } as any) as any, CENTER.x + dx, RAIL_Y + dy);

beforeEach(() => {
  stubGameGlobals();
  vi.stubGlobal('deltaTime', 16);
  game = createGame(4_000);
  (game as any).matchTimeMs = 1_000; // slack water: no current to account for
  (game as any).turrets = [];
  game.setPlayer(at(new Champion({ game, teamId: BLUE }) as any, -5_000, -5_000));
  heart = createHeart(game) as unknown as Heart;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the escort count', () => {
  it('pushes the lantern exactly as the rules say for who stands inside the ring', () => {
    const ballast = hero(BLUE, 60);
    tideTraits.set(ballast, { escortBonus: 0.7 });
    const units = [
      ballast,
      hero(BLUE, -120),
      hero(RED, 150),
      hero('solo', 20), // no court: counts for nobody
      minion(BLUE, 90),
      minion(BLUE, -200),
      minion(RED, 10),
      hero(RED, ESCORT_RADIUS + 60, 0), // centre outside the ring, body still touching it
      hero(BLUE, ESCORT_RADIUS + 400, 0),
    ];
    const inRing = (unit: any, s: number) =>
      Math.hypot(unit.position.x - railX(s), unit.position.y - RAIL_Y) <= ESCORT_RADIUS;

    let expected = 0;
    for (let tick = 0; tick < 40; tick++) {
      const count = (court: string, kind: unknown) =>
        units.filter(u => u.teamId === court && u instanceof (kind as any) && inRing(u, expected)).length;
      const blueBonus = inRing(ballast, expected) ? 0.7 : 0;
      expected = stepLantern(
        expected,
        {
          blue: escortWeight(count(BLUE, Champion), blueBonus, count(BLUE, Minion)),
          red: escortWeight(count(RED, Champion), 0, count(RED, Minion)),
          favoured: null,
          blueGateShut: false,
          redGateShut: false,
        },
        50
      ).s;

      indexObjects(game, units as never[]);
      (game as any).matchTimeMs += 50;
      heart.step(50);
      expect(heart.lanternS, `tick ${tick}`).toBe(expected);
    }
    expect(expected).not.toBe(0);
  });

  it('asks the map with one circle, re-aimed at the lantern each tick', () => {
    const units = [hero(BLUE, 0)];
    indexObjects(game, units as never[]);
    const spy = vi.spyOn(game.objectManager, 'queryObjects');
    const seen: { area: any; x: number; r: number }[] = [];
    for (let tick = 0; tick < 3; tick++) {
      (game as any).matchTimeMs += 50;
      const before = heart.lanternS;
      heart.step(50);
      const escort = spy.mock.calls.map(c => (c[0] as any).area).find(a => a.r === ESCORT_RADIUS);
      seen.push({ area: escort, x: escort.x, r: escort.r });
      expect(escort.x).toBe(railX(before));
      expect(escort.bounds).toEqual({
        minX: railX(before) - ESCORT_RADIUS,
        minY: RAIL_Y - ESCORT_RADIUS,
        maxX: railX(before) + ESCORT_RADIUS,
        maxY: RAIL_Y + ESCORT_RADIUS,
      });
      spy.mockClear();
    }
    expect(seen[1].area).toBe(seen[0].area);
    expect(seen[2].area).toBe(seen[0].area);
  });
});

describe('the shoal tick', () => {
  it('sweeps the whole map once, not once per pass', () => {
    indexObjects(game, [hero(BLUE, 0), hero(RED, 500)] as never[]);
    // Radii are noted as each query is made: the Heart re-aims one circle, so
    // looking at it afterwards shows only the last question asked.
    const radii: number[] = [];
    const real = game.objectManager.queryObjects.bind(game.objectManager) as (o: any) => any;
    vi.spyOn(game.objectManager, 'queryObjects').mockImplementation(((options: any) => {
      radii.push(options.area.r);
      return real(options);
    }) as never);
    let sweeps = 0;
    let ticks = 0;
    for (let t = 0; t < 1_000; t += 50) {
      (game as any).matchTimeMs += 50;
      heart.step(50);
      const whole = radii.filter(r => r === MAP_SIZE).length;
      if (whole > 0) {
        ticks += 1;
        sweeps += whole;
      }
      radii.length = 0;
    }
    expect(ticks).toBe(4);
    expect(sweeps).toBe(4);
  });
});

describe('a shut gate', () => {
  it('is shut exactly when wardensOf has a living warden', () => {
    const turret = (teamId: string, isDead: boolean, position?: { x: number; y: number }) => ({ teamId, isDead, position });
    const boards = [
      [],
      [turret(RED, false)],
      [turret(RED, true)],
      [turret(RED, false, { ...KEEPS[RED] })],
      [turret(RED, false, { ...KEEPS[RED] }), turret(RED, true, { ...WARDENS[RED] })],
      [turret(RED, true, { ...WARDENS[RED] }), turret(RED, false, { ...WARDENS[RED] })],
      [turret(BLUE, false, { ...WARDENS[BLUE] }), turret(RED, true, { ...WARDENS[RED] })],
      [turret(BLUE, false, { x: Number.NaN, y: 0 }), turret(RED, false, { x: KEEPS[RED].x + 3, y: KEEPS[RED].y })],
    ];
    for (const [i, turrets] of boards.entries()) {
      (game as any).turrets = turrets;
      for (const court of [BLUE, RED] as const) {
        expect((heart as any).gateShut(court), `board ${i}, ${court}`).toBe(
          wardensOf(turrets, court).some(t => !t.isDead)
        );
      }
    }
    (game as any).turrets = undefined;
    expect((heart as any).gateShut(BLUE)).toBe(false);
  });
});
