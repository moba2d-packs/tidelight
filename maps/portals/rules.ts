import type { Pt } from '../../world/layout';
import { PORTAL_RADIUS, PORTAL_SPOTS } from './layout';

/**
 * Đảo Cổng's rules as plain arithmetic: which portal pairs with which, and the
 * per-unit wind-up / teleport / cooldown machine. No engine in this file.
 */
export const PORTAL_WINDUP_MS = 600;
export const PORTAL_COOLDOWN_MS = 8_000;
export const PAIRING_ROTATE_MS = 45_000;
/** The announcement before a rotation. */
export const PAIRING_WARN_MS = 4_000;

/**
 * The three ways to pair four islands (0 NW, 1 NE, 2 SE, 3 SW). Every one is
 * point-symmetric (i <-> i+2), so no pairing favours a court. The base-to-base
 * pairing is last: a match gets its first minutes before the rush is open.
 */
export const PAIRINGS: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 1], [2, 3]],
  [[0, 3], [1, 2]],
  [[0, 2], [1, 3]],
];

export const pairingIndexAt = (timeMs: number): number =>
  Math.floor(Math.max(0, timeMs) / PAIRING_ROTATE_MS) % PAIRINGS.length;

export const msToRotation = (timeMs: number): number =>
  PAIRING_ROTATE_MS - (Math.max(0, timeMs) % PAIRING_ROTATE_MS);

export function partnerOf(pairing: number, portal: number): number {
  for (const [a, b] of PAIRINGS[pairing]) {
    if (a === portal) return b;
    if (b === portal) return a;
  }
  return portal;
}

/** Which of the pair (0 or 1) a portal belongs to, for colouring both ends alike. */
export function pairIdOf(pairing: number, portal: number): number {
  return PAIRINGS[pairing].findIndex(([a, b]) => a === portal || b === portal);
}

export function portalAt(p: Pt): number | null {
  for (let i = 0; i < PORTAL_SPOTS.length; i++) {
    if (Math.hypot(p.x - PORTAL_SPOTS[i].x, p.y - PORTAL_SPOTS[i].y) <= PORTAL_RADIUS) return i;
  }
  return null;
}

export type PortalEvent =
  | { kind: 'start'; portal: number }
  | { kind: 'cancel' }
  | { kind: 'teleport'; from: number; to: number };

interface UnitState {
  portal: number | null;
  startedAt: number;
  readyAt: number;
}

/**
 * One tracker per match. Feed it each unit's position every tick:
 *  - stepping into a portal starts a wind-up (unless the unit is cooling down);
 *  - leaving it (or entering another) cancels;
 *  - 0.6 s inside completes: the unit goes to the partner as paired *then*,
 *    and cannot use any portal for 8 s.
 */
export class PortalTracker {
  private readonly units = new WeakMap<object, UnitState>();

  private stateOf(unit: object): UnitState {
    let s = this.units.get(unit);
    if (!s) this.units.set(unit, (s = { portal: null, startedAt: 0, readyAt: -Infinity }));
    return s;
  }

  step(unit: object, at: Pt, nowMs: number): PortalEvent | null {
    const s = this.stateOf(unit);
    const here = nowMs < s.readyAt ? null : portalAt(at);
    if (s.portal !== null && here !== s.portal) {
      s.portal = null;
      if (here === null) return { kind: 'cancel' };
    }
    if (here === null) return null;
    if (s.portal === null) {
      s.portal = here;
      s.startedAt = nowMs;
      return { kind: 'start', portal: here };
    }
    if (nowMs - s.startedAt >= PORTAL_WINDUP_MS) {
      const to = partnerOf(pairingIndexAt(nowMs), here);
      s.portal = null;
      s.readyAt = nowMs + PORTAL_COOLDOWN_MS;
      return { kind: 'teleport', from: here, to };
    }
    return null;
  }

  /** 0..1 wind-up progress, or null when the unit is not winding up. */
  windup(unit: object, nowMs: number): number | null {
    const s = this.units.get(unit);
    if (!s || s.portal === null) return null;
    return Math.min(1, (nowMs - s.startedAt) / PORTAL_WINDUP_MS);
  }

  cooldownLeft(unit: object, nowMs: number): number {
    const s = this.units.get(unit);
    return s ? Math.max(0, s.readyAt - nowMs) : 0;
  }
}
