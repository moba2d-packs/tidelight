/**
 * Vua Đảo's rules, as pure functions: who holds the ring, where the ring is,
 * what a second of holding is worth, and who has won. No engine, no clock.
 */
export type Side = 'blue' | 'red';
export interface HillScore {
  blue: number;
  red: number;
}

/** Radius of the capture ring, world units. */
export const ZONE_RADIUS = 260;
/** Points per second to the court that holds the ring. */
export const SCORE_PER_SECOND = 1;
/** The ring moves to another island this often. */
export const ROTATE_MS = 60_000;
/** The next island is marked this long before the ring moves. */
export const WARN_MS = 10_000;
export const WIN_SCORE = 100;
/** At this match time the higher score wins. */
export const TIME_LIMIT_MS = 360_000;
export const ISLAND_COUNT = 3;

/**
 * Who holds the ring. A court holds it when it has **strictly more living
 * champions inside than the other court**: 1 v 0 and 3 v 2 both hold. Equal
 * numbers — including 1 v 1 and an empty ring — are contested and nobody
 * scores.
 */
export function holderOf(blue: number, red: number): Side | null {
  if (blue > red) return 'blue';
  if (red > blue) return 'red';
  return null;
}

/** Deterministic 0..n-1 from a seed and a step (no `Math.random`: matches replay). */
const pick = (seed: number, step: number, n: number): number => {
  let h = (Math.imul(seed | 0, 2654435761) ^ Math.imul(step + 1, 40503)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % n;
};

/**
 * Island of rotation `epoch`. Epoch 0 is the centre (index 0); every later
 * epoch is one of the two islands the ring is *not* on, so it always moves.
 */
export function islandOfEpoch(epoch: number, seed = 0): number {
  let island = 0;
  for (let k = 1; k <= epoch; k++) {
    const others = [0, 1, 2].filter(i => i !== island);
    island = others[pick(seed, k, others.length)];
  }
  return island;
}

export interface ZoneSchedule {
  epoch: number;
  /** Island the ring is on now. */
  island: number;
  /** Island it moves to next. */
  next: number;
  msLeft: number;
  /** True in the last `WARN_MS` before it moves: the marker is up. */
  announcing: boolean;
}

export function scheduleAt(matchMs: number, seed = 0): ZoneSchedule {
  const t = Math.max(0, matchMs);
  const epoch = Math.floor(t / ROTATE_MS);
  const msLeft = ROTATE_MS - (t - epoch * ROTATE_MS);
  return {
    epoch,
    island: islandOfEpoch(epoch, seed),
    next: islandOfEpoch(epoch + 1, seed),
    msLeft,
    announcing: msLeft <= WARN_MS,
  };
}

/** Score after `dtMs` of the ring being held by `holder` (a new object). */
export function accrue(score: HillScore, holder: Side | null, dtMs: number): HillScore {
  if (!holder) return { ...score };
  return { ...score, [holder]: score[holder] + (SCORE_PER_SECOND * dtMs) / 1000 };
}

/**
 * The winner, or `null` while the match runs. First to `WIN_SCORE` (if both
 * cross in one tick the higher wins). At `TIME_LIMIT_MS` the higher score
 * wins; an exact tie is sudden death — play on until someone leads.
 */
export function winnerOf(score: HillScore, matchMs: number): Side | null {
  const { blue, red } = score;
  if (blue >= WIN_SCORE || red >= WIN_SCORE) return blue >= red ? (blue === red ? null : 'blue') : 'red';
  if (matchMs >= TIME_LIMIT_MS && blue !== red) return blue > red ? 'blue' : 'red';
  return null;
}

/** Pearl pickups: heal on touch, then gone for a while. */
export const PEARL_HEAL = 60;
export const PEARL_REACH = 70;
export const PEARL_RESPAWN_MS = 20_000;
