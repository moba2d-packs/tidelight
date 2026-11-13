/**
 * The wave schedule and the win / lose rule of Thủ Đèn, as pure functions.
 * No engine in here: `defence.ts` feeds it the clock and the body count and
 * does what it answers; the tests read every number below.
 */
export const WAVES_TO_WIN = 10;
export const FIRST_WAVE_DELAY_MS = 15_000;
export const WAVE_INTERVAL_MS = 25_000;
/** Every Nth wave brings the boss. */
export const BOSS_EVERY = 5;
/** Gates open: two at first, the third from this wave on. */
export const THIRD_GATE_FROM_WAVE = 3;
export const GATE_COUNT_EARLY = 2;
export const GATE_COUNT_LATE = 3;

export const BASE_COUNT = 4;
export const COUNT_PER_WAVE = 1.5;
/** +18% health and +8% damage per wave after the first. */
export const HEALTH_PER_WAVE = 0.18;
export const DAMAGE_PER_WAVE = 0.08;
/** The boss is a `tidelord` body with this extra multiplier on top of the wave's. */
export const BOSS_HEALTH_MULT = 1;
/** Brutes join from this wave, one per `BRUTE_EVERY` waves. */
export const BRUTES_FROM_WAVE = 4;
export const BRUTE_EVERY = 3;
/** One of every `SPITTER_EVERY` bodies is a spitter. */
export const SPITTER_EVERY = 3;
/** On a boss wave the escort is this share of the normal count. */
export const BOSS_ESCORT_SHARE = 0.5;

/** The minion type ids `map.ts` declares. */
export type RaiderKind = 'crab' | 'spitter' | 'brute' | 'tidelord';

export interface WaveSpawn {
  kind: RaiderKind;
  /** Index into the gates that are open this wave. */
  gate: number;
}
export interface WaveSpec {
  number: number;
  boss: boolean;
  gates: number;
  healthMult: number;
  damageMult: number;
  spawns: WaveSpawn[];
}

export const isBossWave = (n: number): boolean => n > 0 && n % BOSS_EVERY === 0;
export const gatesOpen = (n: number): number => (n >= THIRD_GATE_FROM_WAVE ? GATE_COUNT_LATE : GATE_COUNT_EARLY);
export const waveCount = (n: number): number => Math.round(BASE_COUNT + COUNT_PER_WAVE * (n - 1));
export const healthMult = (n: number): number => 1 + HEALTH_PER_WAVE * (n - 1);
export const damageMult = (n: number): number => 1 + DAMAGE_PER_WAVE * (n - 1);

/** Bodies of wave `n`, in release order, gates assigned round-robin. */
export function waveSpec(n: number): WaveSpec {
  const boss = isBossWave(n);
  const total = boss ? Math.max(2, Math.round(waveCount(n) * BOSS_ESCORT_SHARE)) : waveCount(n);
  const brutes = n >= BRUTES_FROM_WAVE ? Math.floor((n - BRUTES_FROM_WAVE) / BRUTE_EVERY) + 1 : 0;
  const kinds: RaiderKind[] = [];
  for (let i = 0; i < Math.min(brutes, total); i++) kinds.push('brute');
  for (let i = kinds.length; i < total; i++) kinds.push(i % SPITTER_EVERY === SPITTER_EVERY - 1 ? 'spitter' : 'crab');
  if (boss) kinds.unshift('tidelord');
  const gates = gatesOpen(n);
  return {
    number: n,
    boss,
    gates,
    healthMult: healthMult(n) * (boss ? BOSS_HEALTH_MULT : 1),
    damageMult: damageMult(n),
    spawns: kinds.map((kind, i) => ({ kind, gate: i % gates })),
  };
}

export type Outcome = 'play' | 'won' | 'lost';

export interface DefenceState {
  /** Waves already sent. */
  wave: number;
  nextWaveInMs: number;
  outcome: Outcome;
}
export const initialDefence = (): DefenceState => ({ wave: 0, nextWaveInMs: FIRST_WAVE_DELAY_MS, outcome: 'play' });

export interface DefenceInput {
  lanternAlive: boolean;
  /** Raiders still standing. */
  hostiles: number;
}

/**
 * Advance the schedule by `dtMs`. Returns the wave to send this tick, or null.
 * Lose beats win: a lantern that breaks on the last body is still broken.
 * Win: the last wave has been sent and nothing hostile is left.
 */
export function stepDefence(state: DefenceState, dtMs: number, input: DefenceInput): WaveSpec | null {
  if (state.outcome !== 'play') return null;
  if (!input.lanternAlive) {
    state.outcome = 'lost';
    return null;
  }
  let sent: WaveSpec | null = null;
  if (state.wave < WAVES_TO_WIN) {
    state.nextWaveInMs -= dtMs;
    if (state.nextWaveInMs <= 0) {
      state.wave += 1;
      state.nextWaveInMs = WAVE_INTERVAL_MS;
      sent = waveSpec(state.wave);
    }
  } else if (input.hostiles <= 0) {
    state.outcome = 'won';
  }
  return sent;
}
