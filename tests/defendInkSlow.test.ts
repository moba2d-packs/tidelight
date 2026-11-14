/**
 * "Ốc Phun – Phun Mực ... hình như làm chậm đang bị cộng dồn vô hạn, tới mức ko
 * di chuyển đc luôn": standing in the ink must cost SPIT_SLOW of your speed,
 * never more, however long you stand there and however many pools overlap.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApi, createGame, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import '../world/fx';
import { slow } from '../world/fx';
import { DEFENDERS, RAIDERS } from '../maps/defend/layout';
import { SPARK_SLOW, SPIT_SLOW, SPIT_TICK_MS } from '../maps/defend/raiderSkills';

describe('the ink pool slow does not pile up', () => {
  const { Champion } = buildTestApi().units;
  let game: TestGame;
  beforeEach(() => {
    stubGameGlobals();
    vi.stubGlobal('deltaTime', 50);
    game = createGame(2_400);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('holds at SPIT_SLOW through 20 s of ticks from three overlapping pools', () => {
    const hero = new Champion({ game, teamId: DEFENDERS }) as any;
    const snail = new Champion({ game, teamId: RAIDERS }) as any;
    game.setPlayer(hero);
    const base = hero.stats.speed.value;
    let worst = base;
    for (let t = 0; t < 20_000; t += 50) {
      if (t % SPIT_TICK_MS === 0) for (let k = 0; k < 3; k++) slow(snail, hero, SPIT_SLOW, SPIT_TICK_MS + 200, 'tidelight:raider-ink');
      hero.updateBuffs?.() ?? hero.update?.();
      worst = Math.min(worst, hero.stats.speed.value);
    }
    // A literal, not `1 - SPIT_SLOW`: the bug *was* that constant (35, read
    // by core as 3500%), and a bound computed from it agreed with it.
    expect(worst / base).toBeGreaterThan(0.6);
    expect(worst / base).toBeLessThan(0.7);
  });

  it('states every raider slow as a fraction, the unit core\'s Slow reads', () => {
    for (const s of [SPIT_SLOW, SPARK_SLOW]) {
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThan(1);
    }
  });
});
