import { describe, expect, it } from 'vitest';
import {
  BASE_COUNT,
  BOSS_EVERY,
  COUNT_PER_WAVE,
  FIRST_WAVE_DELAY_MS,
  GATE_COUNT_EARLY,
  GATE_COUNT_LATE,
  HEALTH_PER_WAVE,
  WAVES_TO_WIN,
  WAVE_INTERVAL_MS,
  initialDefence,
  stepDefence,
  waveCount,
  waveSpec,
} from '../maps/defend/waves';

/** Run the schedule to the end with a fixed hostile count; return what was sent. */
const run = (hostiles: () => number, lanternAlive: () => boolean, maxMs = 600_000) => {
  const state = initialDefence();
  const sent: { atMs: number; n: number }[] = [];
  for (let t = 0; t < maxMs && state.outcome === 'play'; t += 100) {
    const wave = stepDefence(state, 100, { lanternAlive: lanternAlive(), hostiles: hostiles() });
    if (wave) sent.push({ atMs: t + 100, n: wave.number });
  }
  return { state, sent };
};

describe('Thủ Đèn wave schedule', () => {
  it('sends wave 1 after the first delay, then one every 25 s', () => {
    const { sent } = run(() => 1, () => true, 100_000);
    expect(sent[0]).toEqual({ atMs: FIRST_WAVE_DELAY_MS, n: 1 });
    expect(sent[1].atMs - sent[0].atMs).toBe(WAVE_INTERVAL_MS);
    expect(WAVE_INTERVAL_MS).toBe(25_000);
  });

  it('sends exactly WAVES_TO_WIN waves and no more', () => {
    const { sent } = run(() => 1, () => true, 900_000);
    expect(sent.map(s => s.n)).toEqual(Array.from({ length: WAVES_TO_WIN }, (_, i) => i + 1));
  });

  it('scales count and health every wave', () => {
    for (let n = 2; n <= WAVES_TO_WIN; n++) {
      expect(waveCount(n)).toBeGreaterThanOrEqual(waveCount(n - 1));
      expect(waveSpec(n).healthMult).toBeGreaterThan(waveSpec(n - 1).healthMult);
      expect(waveSpec(n).damageMult).toBeGreaterThan(waveSpec(n - 1).damageMult);
    }
    expect(waveCount(1)).toBe(BASE_COUNT);
    expect(waveCount(10)).toBe(Math.round(BASE_COUNT + COUNT_PER_WAVE * 9));
    expect(waveSpec(10).healthMult).toBeCloseTo(1 + HEALTH_PER_WAVE * 9);
  });

  it('brings a boss on every 5th wave and only then', () => {
    for (let n = 1; n <= WAVES_TO_WIN; n++) {
      const bosses = waveSpec(n).spawns.filter(s => s.kind === 'tidelord').length;
      expect(bosses).toBe(n % BOSS_EVERY === 0 ? 1 : 0);
      expect(waveSpec(n).boss).toBe(n % BOSS_EVERY === 0);
    }
    expect(waveSpec(5).spawns[0].kind).toBe('tidelord');
  });

  it('opens the third gate from wave 3 and spreads bodies over open gates only', () => {
    expect(waveSpec(1).gates).toBe(GATE_COUNT_EARLY);
    expect(waveSpec(3).gates).toBe(GATE_COUNT_LATE);
    for (const n of [1, 2, 3, 7]) {
      const gates = new Set(waveSpec(n).spawns.map(s => s.gate));
      expect(Math.max(...gates)).toBeLessThan(waveSpec(n).gates);
      expect(gates.size).toBe(waveSpec(n).gates);
    }
  });

  it('adds brutes from wave 4', () => {
    expect(waveSpec(3).spawns.some(s => s.kind === 'brute')).toBe(false);
    expect(waveSpec(4).spawns.some(s => s.kind === 'brute')).toBe(true);
  });
});

describe('Thủ Đèn win and lose', () => {
  it('is won when wave 10 is out and nothing hostile is left', () => {
    let hostiles = 3;
    const { state, sent } = run(
      () => hostiles,
      () => true,
      900_000
    );
    // hostiles never drop: still playing after the last wave
    expect(state.outcome).toBe('play');
    expect(sent.length).toBe(WAVES_TO_WIN);
    hostiles = 0;
    expect(stepDefence(state, 100, { lanternAlive: true, hostiles })).toBeNull();
    expect(state.outcome).toBe('won');
  });

  it('is not won while waves are still to come, even with the field clear', () => {
    const { state } = run(() => 0, () => true, 60_000);
    expect(state.outcome).toBe('play');
    expect(state.wave).toBeLessThan(WAVES_TO_WIN);
  });

  it('is lost the moment the lantern breaks, and beats a win on the same tick', () => {
    let alive = true;
    const { state } = run(() => 5, () => alive, 40_000);
    expect(state.outcome).toBe('play');
    alive = false;
    stepDefence(state, 100, { lanternAlive: alive, hostiles: 5 });
    expect(state.outcome).toBe('lost');

    const late = initialDefence();
    late.wave = WAVES_TO_WIN;
    stepDefence(late, 100, { lanternAlive: false, hostiles: 0 });
    expect(late.outcome).toBe('lost');
  });

  it('sends nothing once the match is decided', () => {
    const state = initialDefence();
    state.outcome = 'lost';
    state.nextWaveInMs = 0;
    expect(stepDefence(state, 1000, { lanternAlive: true, hostiles: 0 })).toBeNull();
    expect(state.wave).toBe(0);
  });
});
