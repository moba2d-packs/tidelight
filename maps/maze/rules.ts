import { BLUE, RED, type Court } from '../../world/layout';

/**
 * Core ships no win condition (a map is a practice room until a pack says
 * otherwise), so Mê Cung Rong supplies the classic one: a court that has lost
 * every structure — warden and keep — has lost the match.
 */
export interface Standing {
  [BLUE]: number;
  [RED]: number;
}

/** The court that has won, given how many structures each still has; null while both stand. */
export function mazeWinner(left: Standing, fielded: Standing): Court | null {
  // A side that never had a structure cannot lose by losing them.
  const blueOut = fielded[BLUE] > 0 && left[BLUE] === 0;
  const redOut = fielded[RED] > 0 && left[RED] === 0;
  if (blueOut && !redOut) return RED;
  if (redOut && !blueOut) return BLUE;
  return null;
}
