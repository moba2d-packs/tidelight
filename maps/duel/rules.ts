import { BLUE, RED, type Court } from '../../world/layout';

/**
 * The round rules of Vòng Đấu Tay Đôi, as arithmetic. Everybody starts a round
 * alive, nobody comes back inside it, the last court standing takes the round,
 * a short countdown separates rounds, and the first court to ROUNDS_TO_WIN
 * rounds takes the match.
 */
export const ROUNDS_TO_WIN = 3;
export const COUNTDOWN_MS = 2_000;

export type Phase = 'countdown' | 'fight' | 'over';

export interface RoundState {
  phase: Phase;
  /** 1-based number of the round being counted down to or fought. */
  round: number;
  countdownMs: number;
  wins: { [BLUE]: number; [RED]: number };
  /** Who took the round just ended; null for a mutual wipe or before round 1 ends. */
  lastWinner: Court | null;
  matchWinner: Court | null;
}

/** Heads on a court: standing now, and fielded at all. */
export interface Tally {
  [BLUE]: { alive: number; total: number };
  [RED]: { alive: number; total: number };
}

export const initialRounds = (): RoundState => ({
  phase: 'countdown',
  round: 1,
  countdownMs: COUNTDOWN_MS,
  wins: { [BLUE]: 0, [RED]: 0 },
  lastWinner: null,
  matchWinner: null,
});

export interface RoundStep {
  state: RoundState;
  /** True on the tick a round ends and the next countdown begins: bring everyone back. */
  resetRound: boolean;
}

export function stepRounds(state: RoundState, tally: Tally, dtMs: number): RoundStep {
  if (state.phase === 'over') return { state, resetRound: false };

  if (state.phase === 'countdown') {
    const left = state.countdownMs - dtMs;
    return {
      state: left > 0 ? { ...state, countdownMs: left } : { ...state, phase: 'fight', countdownMs: 0 },
      resetRound: false,
    };
  }

  // A side with nobody on it is an empty arena, not a win for the other side.
  if (tally[BLUE].total === 0 || tally[RED].total === 0) return { state, resetRound: false };
  const blueOut = tally[BLUE].alive === 0;
  const redOut = tally[RED].alive === 0;
  if (!blueOut && !redOut) return { state, resetRound: false };

  const winner: Court | null = blueOut && redOut ? null : blueOut ? RED : BLUE;
  const wins = { ...state.wins };
  if (winner) wins[winner] += 1;
  if (winner && wins[winner] >= ROUNDS_TO_WIN) {
    return {
      state: { ...state, phase: 'over', wins, lastWinner: winner, matchWinner: winner },
      resetRound: false,
    };
  }
  return {
    state: {
      ...state,
      phase: 'countdown',
      round: state.round + 1,
      countdownMs: COUNTDOWN_MS,
      wins,
      lastWinner: winner,
    },
    resetRound: true,
  };
}
