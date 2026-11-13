import { BLUE, GATE_S, RAIL_HALF, RED, type Court } from './layout';

/**
 * The rules of a Tidelight match, as pure functions of numbers.
 *
 * Nothing here knows about the engine, the canvas or the clock on the wall:
 * the director feeds it match time and head counts and gets the next state
 * back. That is what makes "the tide turns every thirty seconds" and "three
 * escorts beat one" things a test can assert rather than things somebody
 * watched happen once.
 */

/** Slack water at the start of a match: nobody is favoured while players find the lantern. */
export const SLACK_MS = 12_000;
/** How long the tide runs one way before it turns. */
export const TIDE_HALF_MS = 30_000;
/** The last stretch of a tide, when the HUD warns that it is about to turn. */
export const TURN_WARNING_MS = 5_000;
/** After a called tide ends, how long before the tide can be called again — by anyone. */
export const TIDE_CALL_LOCK_MS = 20_000;

export interface TideState {
  /** The court the current runs for, or `null` in slack water. */
  favoured: Court | null;
  /** Milliseconds until the tide next turns. */
  msLeft: number;
  /** True in the last `TURN_WARNING_MS` of a tide. */
  turning: boolean;
  /** 0 = north shoal dry / south flooded … 1 = north flooded / south dry. Eased, for drawing. */
  level: number;
  /** Which whole tide this is, counting from 0 at the end of slack water; -1 during slack. */
  index: number;
}

export interface TideOverride {
  court: Court;
  untilMs: number;
}

const smooth = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** How long the water takes to visibly rise or fall when the tide turns. */
const SWELL_MS = 2_500;

/**
 * The tide at `matchMs`. `first` is the court the opening tide runs for — the
 * director picks it from the match seed so neither side always opens.
 *
 * A red tide floods the north shoal (level 1) and a blue tide the south
 * (level 0): the flooded shoal is the favoured court's highway, the dry one
 * is where pearls lie.
 */
export function tideAt(
  matchMs: number,
  first: Court = BLUE,
  override: TideOverride | null = null
): TideState {
  const other: Court = first === BLUE ? RED : BLUE;
  let favoured: Court | null = null;
  let msLeft = Math.max(0, SLACK_MS - matchMs);
  let index = -1;
  let sinceTurn = matchMs;

  if (matchMs >= SLACK_MS) {
    const run = matchMs - SLACK_MS;
    index = Math.floor(run / TIDE_HALF_MS);
    favoured = index % 2 === 0 ? first : other;
    sinceTurn = run - index * TIDE_HALF_MS;
    msLeft = TIDE_HALF_MS - sinceTurn;
  }

  const natural = favoured;
  if (override && matchMs < override.untilMs) {
    favoured = override.court;
    msLeft = Math.min(msLeft, override.untilMs - matchMs);
  }

  const target = levelFor(favoured);
  // Ease from the previous tide's level only on a natural turn; an override
  // snaps, because a stolen tide should look like one.
  let level = target;
  if (favoured === natural && index >= 0 && sinceTurn < SWELL_MS) {
    const before = index === 0 ? 0.5 : levelFor(favoured === first ? other : first);
    level = before + (target - before) * smooth(sinceTurn / SWELL_MS);
  }

  return { favoured, msLeft, turning: favoured !== null && msLeft <= TURN_WARNING_MS, level, index };
}

function levelFor(favoured: Court | null): number {
  if (favoured === RED) return 1;
  if (favoured === BLUE) return 0;
  return 0.5;
}

/** Which shoal is under water for a tide, if any. */
export const floodedShoal = (tide: TideState): 'north' | 'south' | null =>
  tide.favoured === RED ? 'north' : tide.favoured === BLUE ? 'south' : null;

/** Which shoal is dry — where pearls surface. */
export const dryShoal = (tide: TideState): 'north' | 'south' | null =>
  tide.favoured === RED ? 'south' : tide.favoured === BLUE ? 'north' : null;

// ───────────────────────────── The lantern ─────────────────────────────

/** World units per second the lantern moves for a net escort of 1, 2, 3+. */
export const PUSH_SPEED = [0, 30, 42, 50] as const;
/** World units per second the current carries the lantern toward the unfavoured court's base. */
export const CURRENT_SPEED = 10;
/** How close a body has to be to count as escorting. */
export const ESCORT_RADIUS = 270;
/** What one minion is worth, and the most a whole wave can add up to. */
export const MINION_WEIGHT = 0.25;
export const MINION_WEIGHT_CAP = 1;
/** Lights a court needs to win. */
export const LIGHTS_TO_WIN = 2;
/** After a delivery the lantern relights in the middle and holds still this long. */
export const RELIGHT_MS = 4_000;
/**
 * Damage per second the lantern's light does to a warden while an escort holds
 * it against that warden's shut gate. A match must not hinge on bots choosing
 * to hit a tower: pressing the lantern on the gate *is* the siege, and a
 * standing warden (320) gives way after ~18 s of uncontested holding.
 */
export const GATE_BURN_PER_S = 18;
/** A match that reaches this length is settled on lights, then on where the lantern is. */
export const MATCH_CAP_MS = 8 * 60_000;

export interface Escort {
  /** Weighted bodies of each court standing in the lantern's glow. */
  blue: number;
  red: number;
}

export interface LanternInput extends Escort {
  favoured: Court | null;
  /** Whether each court's warden tower still stands (its gate is shut). */
  blueGateShut: boolean;
  redGateShut: boolean;
}

/**
 * Lantern velocity along the rail, world units per second. Positive is toward
 * the red base — i.e. blue is winning the push.
 */
export function lanternVelocity(input: LanternInput): number {
  const net = input.blue - input.red;
  const strength = Math.min(3, Math.floor(Math.abs(net) + 1e-6));
  // A fraction of a body (a couple of minions against nobody) still nudges it.
  const partial = Math.abs(net) < 1 ? Math.abs(net) * PUSH_SPEED[1] : PUSH_SPEED[strength];
  const push = Math.sign(net) * partial;
  const current =
    input.favoured === BLUE ? CURRENT_SPEED : input.favoured === RED ? -CURRENT_SPEED : 0;
  return push + current;
}

export interface LanternStep {
  s: number;
  /** The court that just delivered the lantern, if this step carried it home. */
  delivered: Court | null;
  /** True if a shut gate stopped the lantern this step. */
  blocked: boolean;
}

/** Advance the lantern by `dtMs`. */
export function stepLantern(s: number, input: LanternInput, dtMs: number): LanternStep {
  let next = s + (lanternVelocity(input) * dtMs) / 1000;
  let blocked = false;
  // Blue pushes toward +s and meets the red gate; red the mirror.
  // A lantern already past a gate (the tower fell, then was rebuilt) is not
  // dragged back by it: a gate stops a crossing, it does not undo one.
  if (input.redGateShut && s <= GATE_S && next > GATE_S) {
    next = GATE_S;
    blocked = true;
  }
  if (input.blueGateShut && s >= -GATE_S && next < -GATE_S) {
    next = -GATE_S;
    blocked = true;
  }
  if (next >= RAIL_HALF) return { s: RAIL_HALF, delivered: BLUE, blocked: false };
  if (next <= -RAIL_HALF) return { s: -RAIL_HALF, delivered: RED, blocked: false };
  return { s: next, delivered: null, blocked };
}

/** Sum a set of escorts into the two weights `stepLantern` wants. */
export function escortWeight(heroes: number, bonus: number, minions: number): number {
  return heroes + bonus + Math.min(MINION_WEIGHT_CAP, minions * MINION_WEIGHT);
}

export interface Score {
  blue: number;
  red: number;
}

/**
 * Who has won, or `null` while the match is still live.
 *
 * Two lights wins outright. At the cap the court with more lights takes it;
 * level on lights, the lantern's side of the reef decides, and a lantern
 * sitting dead centre is a draw nobody gets — the match plays on.
 */
export function winnerOf(score: Score, matchMs: number, lanternS: number): Court | null {
  if (score.blue >= LIGHTS_TO_WIN) return BLUE;
  if (score.red >= LIGHTS_TO_WIN) return RED;
  if (matchMs < MATCH_CAP_MS) return null;
  if (score.blue !== score.red) return score.blue > score.red ? BLUE : RED;
  if (Math.abs(lanternS) < 1) return null;
  return lanternS > 0 ? BLUE : RED;
}

export const formatClock = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
