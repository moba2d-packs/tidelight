import type { Pt } from '../../world/layout';
import { CHANNEL_MID_X, CHANNEL_X0, CHANNEL_X1, bridgeSpan } from './layout';

/**
 * Cầu Sập's rules as arithmetic: when each bridge is open, about to go, or
 * gone, and where a unit caught on a collapsing span is put.
 */
export const COLLAPSE_EVERY_MS = 40_000;
export const COLLAPSE_FOR_MS = 15_000;
export const TELEGRAPH_MS = 5_000;
/** Collapse order, repeated: the middle first, then north, then south. */
export const COLLAPSE_ORDER: readonly number[] = [1, 0, 2];
/** Gap left between a pushed unit's edge and the channel wall. */
export const BANK_MARGIN = 4;

export type BridgeState = 'open' | 'warning' | 'collapsed';
export interface BridgeStatus {
  state: BridgeState;
  /** ms until the state changes (warning -> collapse, collapse -> rebuilt); 0 when open. */
  msLeft: number;
}

/** The k-th collapse (k >= 1) begins at k * COLLAPSE_EVERY_MS. */
export const collapseStartOf = (k: number): number => k * COLLAPSE_EVERY_MS;
export const bridgeOfCollapse = (k: number): number => COLLAPSE_ORDER[(k - 1) % COLLAPSE_ORDER.length];

export function bridgeStatus(timeMs: number, bridge: number): BridgeStatus {
  const t = Math.max(0, timeMs);
  const k = Math.floor(t / COLLAPSE_EVERY_MS);
  if (k >= 1 && bridgeOfCollapse(k) === bridge) {
    const left = collapseStartOf(k) + COLLAPSE_FOR_MS - t;
    if (left > 0) return { state: 'collapsed', msLeft: left };
  }
  const warnAt = collapseStartOf(k + 1) - TELEGRAPH_MS;
  if (bridgeOfCollapse(k + 1) === bridge && t >= warnAt) {
    return { state: 'warning', msLeft: collapseStartOf(k + 1) - t };
  }
  return { state: 'open', msLeft: 0 };
}

/**
 * Where a circle of `radius` at `p` must go if it overlaps bridge `bridge`'s
 * span: straight sideways to the nearer bank. `null` when it is clear.
 */
export function bankPushOut(p: Pt, radius: number, bridge: number): Pt | null {
  const s = bridgeSpan(bridge);
  const overlaps =
    p.x + radius > s.x0 && p.x - radius < s.x1 && p.y + radius > s.y0 && p.y - radius < s.y1;
  if (!overlaps) return null;
  return p.x < CHANNEL_MID_X
    ? { x: CHANNEL_X0 - radius - BANK_MARGIN, y: p.y }
    : { x: CHANNEL_X1 + radius + BANK_MARGIN, y: p.y };
}
