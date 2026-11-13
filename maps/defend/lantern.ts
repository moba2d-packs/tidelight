import { DEFENDERS, LANTERN, LANTERN_MATCH_PX, RAIDERS, type Pt } from './layout';

/** The Great Lantern: the blue turret standing on the lantern point. Null until the match has built its turrets. */
export function findLantern(game: any): any | null {
  for (const turret of game?.turrets ?? []) {
    const at = turret.position;
    if (turret.teamId === DEFENDERS && at && Math.hypot(at.x - LANTERN.x, at.y - LANTERN.y) <= LANTERN_MATCH_PX) return turret;
  }
  return null;
}

/** Live raiders (red minions) the match is fielding. */
export function liveRaiders(game: any): any[] {
  return (game?.minionSpawner?.minions ?? []).filter((m: any) => m.teamId === RAIDERS && !m.isDead && !m.toRemove);
}

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
