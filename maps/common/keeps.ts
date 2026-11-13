import { BLUE, RED, type Court, type Pt } from '../../world/layout';

/**
 * The structure-destroy win both maps share: a court loses the moment its
 * keep (the turret standing on `keeps[court]`) is dead.
 */
export const KEEP_STATS = {
  health: 2_600,
  damage: 40,
  attackInterval: 500,
  attackRange: 460,
  size: 120,
  rebuildTime: 3_600_000,
  repairRate: 0,
} as const;

/** How close a turret must stand to a keep point to be that keep. */
export const KEEP_MATCH_PX = 40;

interface TurretLike {
  teamId?: string;
  isDead?: boolean;
  position?: Pt;
}

export function keepWinner(turrets: TurretLike[] | undefined, keeps: Record<Court, Pt>): Court | null {
  for (const court of [BLUE, RED] as const) {
    const at = keeps[court];
    const keep = (turrets ?? []).find(
      t => t.teamId === court && t.position && Math.hypot(t.position.x - at.x, t.position.y - at.y) <= KEEP_MATCH_PX
    );
    if (keep?.isDead) return court === BLUE ? RED : BLUE;
  }
  return null;
}

export const courtOf = (teamId: string | undefined): Court | null =>
  teamId === BLUE ? BLUE : teamId === RED ? RED : null;
