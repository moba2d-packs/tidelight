/**
 * The rules of a Tidelight match, as arithmetic: the tide's timetable, how the
 * lantern moves, what a gate stops, and who has won. No engine needed.
 */
import { describe, expect, it } from 'vitest';
import { BLUE, GATE_S, RAIL_HALF, RED } from '../world/layout';
import {
  CURRENT_SPEED,
  LIGHTS_TO_WIN,
  MATCH_CAP_MS,
  PUSH_SPEED,
  SLACK_MS,
  TIDE_HALF_MS,
  TURN_WARNING_MS,
  dryShoal,
  escortWeight,
  floodedShoal,
  formatClock,
  lanternVelocity,
  stepLantern,
  tideAt,
  winnerOf,
} from '../world/rules';

const open = { favoured: null, blueGateShut: false, redGateShut: false } as const;

describe('the tide keeps a timetable anyone can learn', () => {
  it('opens on slack water that favours nobody', () => {
    const tide = tideAt(SLACK_MS - 1);
    expect(tide.favoured).toBeNull();
    expect(floodedShoal(tide)).toBeNull();
    expect(tide.level).toBe(0.5);
  });

  it('then turns every half, alternating courts', () => {
    expect(tideAt(SLACK_MS, BLUE).favoured).toBe(BLUE);
    expect(tideAt(SLACK_MS + TIDE_HALF_MS, BLUE).favoured).toBe(RED);
    expect(tideAt(SLACK_MS + TIDE_HALF_MS * 2, BLUE).favoured).toBe(BLUE);
    expect(tideAt(SLACK_MS, RED).favoured).toBe(RED);
  });

  it('warns before it turns, and only then', () => {
    expect(tideAt(SLACK_MS + 1_000).turning).toBe(false);
    expect(tideAt(SLACK_MS + TIDE_HALF_MS - TURN_WARNING_MS + 1).turning).toBe(true);
  });

  it('floods one shoal and bares the other, never both', () => {
    const blue = tideAt(SLACK_MS + 10_000, BLUE);
    expect([floodedShoal(blue), dryShoal(blue)]).toEqual(['south', 'north']);
    const red = tideAt(SLACK_MS + TIDE_HALF_MS + 10_000, BLUE);
    expect([floodedShoal(red), dryShoal(red)]).toEqual(['north', 'south']);
  });

  it('swells in rather than snapping, and settles at the far end', () => {
    const early = tideAt(SLACK_MS + TIDE_HALF_MS + 500, BLUE).level;
    const settled = tideAt(SLACK_MS + TIDE_HALF_MS + 5_000, BLUE).level;
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(1);
    expect(settled).toBe(1);
  });

  it('can be called early by a hero, for as long as the call lasts', () => {
    const at = SLACK_MS + 4_000;
    const called = tideAt(at, BLUE, { court: RED, untilMs: at + 8_000 });
    expect(called.favoured).toBe(RED);
    expect(called.msLeft).toBe(8_000);
    expect(tideAt(at + 8_000, BLUE, { court: RED, untilMs: at + 8_000 }).favoured).toBe(BLUE);
  });
});

describe('the lantern goes where the escort outnumbers', () => {
  it('stands still when nobody is near and the water is slack', () => {
    expect(lanternVelocity({ ...open, blue: 0, red: 0 })).toBe(0);
  });

  it('stalls when the escorts are even — that is the fight', () => {
    expect(lanternVelocity({ ...open, blue: 2, red: 2 })).toBe(0);
  });

  it('moves faster with a bigger margin, with diminishing returns, capped at three', () => {
    const speed = (blue: number) => lanternVelocity({ ...open, blue, red: 0 });
    expect([speed(1), speed(2), speed(3), speed(5)]).toEqual([
      PUSH_SPEED[1],
      PUSH_SPEED[2],
      PUSH_SPEED[3],
      PUSH_SPEED[3],
    ]);
    expect(speed(2) - speed(1)).toBeLessThan(speed(1));
  });

  it('pushes toward red for blue and toward blue for red', () => {
    expect(lanternVelocity({ ...open, blue: 1, red: 0 })).toBeGreaterThan(0);
    expect(lanternVelocity({ ...open, blue: 0, red: 1 })).toBeLessThan(0);
  });

  it('drifts with the tide when left alone, and the tide alone never outruns one escort', () => {
    expect(lanternVelocity({ ...open, favoured: BLUE, blue: 0, red: 0 })).toBe(CURRENT_SPEED);
    expect(lanternVelocity({ ...open, favoured: RED, blue: 0, red: 0 })).toBe(-CURRENT_SPEED);
    expect(lanternVelocity({ ...open, favoured: RED, blue: 1, red: 0 })).toBeGreaterThan(0);
  });

  it('counts a wave of minions as at most one hero', () => {
    expect(escortWeight(0, 0, 2)).toBe(0.5);
    expect(escortWeight(0, 0, 12)).toBe(1);
    expect(escortWeight(2, 1, 0)).toBe(3);
  });
});

describe('a gate holds the lantern until its warden falls', () => {
  const pushing = { favoured: null, blue: 3, red: 0 } as const;

  it('stops it at the gate while the warden stands', () => {
    const step = stepLantern(GATE_S - 1, { ...pushing, blueGateShut: false, redGateShut: true }, 1_000);
    expect(step.s).toBe(GATE_S);
    expect(step.blocked).toBe(true);
    expect(step.delivered).toBeNull();
  });

  it('lets it through once the warden is down', () => {
    const step = stepLantern(GATE_S - 1, { ...pushing, blueGateShut: false, redGateShut: false }, 1_000);
    expect(step.s).toBeGreaterThan(GATE_S);
    expect(step.blocked).toBe(false);
  });

  it('never traps a lantern that is already past it', () => {
    const step = stepLantern(GATE_S + 40, { favoured: null, blue: 0, red: 2, blueGateShut: false, redGateShut: true }, 1_000);
    expect(step.s).toBeLessThan(GATE_S + 40);
  });

  it('guards only its own side', () => {
    const step = stepLantern(-GATE_S + 1, { favoured: null, blue: 0, red: 3, blueGateShut: true, redGateShut: false }, 1_000);
    expect(step.s).toBe(-GATE_S);
    expect(step.blocked).toBe(true);
  });

  it('delivers at the end of the rail, to the court that pushed it there', () => {
    const blue = stepLantern(RAIL_HALF - 1, { ...pushing, blueGateShut: false, redGateShut: false }, 1_000);
    expect(blue).toEqual({ s: RAIL_HALF, delivered: BLUE, blocked: false });
    const red = stepLantern(-RAIL_HALF + 1, { favoured: null, blue: 0, red: 3, blueGateShut: false, redGateShut: false }, 1_000);
    expect(red.delivered).toBe(RED);
  });
});

describe('a match ends, and soon', () => {
  it('goes to the first court to light enough lights', () => {
    expect(winnerOf({ blue: LIGHTS_TO_WIN, red: 0 }, 60_000, 0)).toBe(BLUE);
    expect(winnerOf({ blue: 1, red: LIGHTS_TO_WIN }, 60_000, 0)).toBe(RED);
    expect(winnerOf({ blue: 1, red: 1 }, 60_000, 500)).toBeNull();
  });

  it('is called at the cap: more lights, else whoever holds the lantern forward', () => {
    expect(MATCH_CAP_MS).toBeLessThanOrEqual(10 * 60_000);
    expect(winnerOf({ blue: 1, red: 0 }, MATCH_CAP_MS, -300)).toBe(BLUE);
    expect(winnerOf({ blue: 1, red: 1 }, MATCH_CAP_MS, -300)).toBe(RED);
    expect(winnerOf({ blue: 0, red: 0 }, MATCH_CAP_MS, 0)).toBeNull();
  });

  it('can be won from a standing start inside one tide by a full escort', () => {
    const seconds = RAIL_HALF / (PUSH_SPEED[3] + CURRENT_SPEED);
    expect(seconds * 1000).toBeLessThan(TIDE_HALF_MS);
  });

  it('prints the clock the way the HUD shows it', () => {
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(-5)).toBe('0:00');
  });
});
