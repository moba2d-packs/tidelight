/**
 * The wave schedule and the win / lose rule of Thủ Đèn, as pure functions.
 * No engine in here: `defence.ts` feeds it the clock and the body count and
 * does what it answers; the tests read every number below.
 */
/** Twenty, not ten: ten waves were over in four minutes ("chơi tý đã hết"). */
export const WAVES_TO_WIN = 20;
export const FIRST_WAVE_DELAY_MS = 15_000;
export const WAVE_INTERVAL_MS = 22_000;
/** Every Nth wave brings the boss. */
export const BOSS_EVERY = 5;
/** Gates open: two at first, the third from this wave on. */
export const THIRD_GATE_FROM_WAVE = 3;
export const GATE_COUNT_EARLY = 2;
export const GATE_COUNT_LATE = 3;

export const BASE_COUNT = 4;
export const COUNT_PER_WAVE = 1.8;
/** +20% health and +9% damage per wave after the first. */
export const HEALTH_PER_WAVE = 0.2;
export const DAMAGE_PER_WAVE = 0.09;
/** The boss is a `tidelord` body with this extra multiplier on top of the wave's. */
export const BOSS_HEALTH_MULT = 1;
/** Brutes join from this wave, one per `BRUTE_EVERY` waves. */
export const BRUTES_FROM_WAVE = 4;
export const BRUTE_EVERY = 2;
/** Eels (fast, a slowing bolt) from this wave, one more every `EEL_EVERY`. */
export const EELS_FROM_WAVE = 2;
export const EEL_EVERY = 3;
/** Jellies (heal the raiders round them) from this wave, one more every `JELLY_EVERY`. */
export const JELLIES_FROM_WAVE = 6;
export const JELLY_EVERY = 5;
/** One of every `SPITTER_EVERY` bodies is a spitter. */
export const SPITTER_EVERY = 3;
/** On a boss wave the escort is this share of the normal count. */
export const BOSS_ESCORT_SHARE = 0.5;

/** The minion type ids `map.ts` declares. */
export type RaiderKind = 'crab' | 'spitter' | 'brute' | 'eel' | 'jelly' | 'tidelord' | 'kraken';

/** The bodies that lead a boss wave: the Chúa Triều and the Bạch Tuộc take turns, and the last wave brings both. */
export const bossesOf = (n: number): RaiderKind[] => {
  if (!isBossWave(n)) return [];
  if (n >= WAVES_TO_WIN) return ['kraken', 'tidelord'];
  return (n / BOSS_EVERY) % 2 === 1 ? ['tidelord'] : ['kraken'];
};
export const BOSS_KINDS: readonly RaiderKind[] = ['tidelord', 'kraken'];

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
  const every = (from: number, step: number) => (n >= from ? Math.floor((n - from) / step) + 1 : 0);
  const kinds: RaiderKind[] = [];
  const add = (kind: RaiderKind, count: number) => {
    for (let i = 0; i < count && kinds.length < total; i++) kinds.push(kind);
  };
  add('brute', every(BRUTES_FROM_WAVE, BRUTE_EVERY));
  add('eel', every(EELS_FROM_WAVE, EEL_EVERY));
  add('jelly', every(JELLIES_FROM_WAVE, JELLY_EVERY));
  for (let i = kinds.length; i < total; i++) kinds.push(i % SPITTER_EVERY === SPITTER_EVERY - 1 ? 'spitter' : 'crab');
  kinds.unshift(...bossesOf(n));
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
