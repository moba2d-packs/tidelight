/**
 * "game thủ đèn nên cho tăng độ khó hoặc số wave lên, chơi tý đã hết chán quá"
 * and "dùng thêm quái rừng ra nữa với chiêu thức, chứ lính chỉ to thôi thì ko
 * vui lắm": ten waves of four bodies that only walked and swung. Twenty waves
 * now, three new raiders, and every raider but the crab casts something.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApi, createGame, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import { api } from '../packApi';
// The code half registers the raiders' helpers (see `provideRaiderFx`); a test loads it itself.
import '../world/fx';
import { DEFENDERS, RAIDERS } from '../maps/defend/layout';
import {
  JELLY_HEAL_SHARE,
  RAIDER_SKILLS,
  RaiderSkills,
  SLAM_DAMAGE,
  SUMMON_COUNT,
  TENTACLE_ROOT_MS,
} from '../maps/defend/raiderSkills';
import { WAVES_TO_WIN, waveSpec, type RaiderKind } from '../maps/defend/waves';

describe('the Thủ Đèn schedule is longer and more varied', () => {
  it('runs 20 waves', () => {
    expect(WAVES_TO_WIN).toBeGreaterThanOrEqual(20);
  });

  it('brings eels from wave 2 and jellies from wave 6', () => {
    const kinds = (n: number) => new Set(waveSpec(n).spawns.map(s => s.kind));
    expect(kinds(1).has('eel')).toBe(false);
    expect(kinds(2).has('eel')).toBe(true);
    expect(kinds(6).has('jelly')).toBe(true);
  });

  it('alternates the two bosses, and the last wave brings both', () => {
    const bosses = (n: number) => waveSpec(n).spawns.filter(s => s.kind === 'tidelord' || s.kind === 'kraken').map(s => s.kind);
    expect(bosses(5)).toEqual(['tidelord']);
    expect(bosses(10)).toEqual(['kraken']);
    expect(bosses(15)).toEqual(['tidelord']);
    expect(bosses(WAVES_TO_WIN).sort()).toEqual(['kraken', 'tidelord']);
  });

  it('has every raider but the crab casting a skill', () => {
    const all: RaiderKind[] = ['spitter', 'brute', 'eel', 'jelly', 'tidelord', 'kraken'];
    for (const kind of all) expect(RAIDER_SKILLS[kind], kind).toBeDefined();
    expect(RAIDER_SKILLS.crab).toBeUndefined();
  });
});

describe('raider skills in a match', () => {
  const { Champion } = buildTestApi().units;
  let game: TestGame;

  beforeEach(() => {
    stubGameGlobals();
    vi.stubGlobal('deltaTime', 50);
    game = createGame(2_400);
    const watcher = new Champion({ game, teamId: DEFENDERS }) as any;
    watcher.position.set(-5_000, -5_000);
    game.setPlayer(watcher);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const unit = (teamId: string, x: number, y: number) => {
    const u = new Champion({ game, teamId }) as any;
    u.position.set(x, y);
    u.destination.set(x, y);
    game.objectManager.addObject(u);
    return u;
  };
  const settle = () => (game.objectManager as any).update?.();
  const run = (skills: RaiderSkills, fromMs: number, ms: number) => {
    for (let t = fromMs; t <= fromMs + ms; t += 50) skills.step(t);
  };
  const has = (u: any, Buff: any) => u.buffs.some((b: any) => b instanceof Buff);

  it('a brute winds up, then slams: damage and a stun on the defender beside it', () => {
    const brute = unit(RAIDERS, 1000, 1000);
    const hero = unit(DEFENDERS, 1080, 1000);
    settle();
    const before = hero.stats.health.value;
    const skills = new RaiderSkills(() => {});
    skills.track(brute, 'brute', 1, 0);
    run(skills, 0, RAIDER_SKILLS.brute!.firstMs + 50);
    expect(skills.winding(brute)?.name).toBe('Dập Rạn');
    expect(hero.stats.health.value).toBe(before);
    run(skills, RAIDER_SKILLS.brute!.firstMs + 100, RAIDER_SKILLS.brute!.windupMs);
    expect(skills.winding(brute)).toBeNull();
    expect(before - hero.stats.health.value).toBeGreaterThan(0);
    expect(before - hero.stats.health.value).toBeLessThanOrEqual(SLAM_DAMAGE);
    expect(has(hero, api.buffs.Stun)).toBe(true);
  });

  it('casts nothing with no defender in reach', () => {
    const brute = unit(RAIDERS, 1000, 1000);
    unit(DEFENDERS, 1800, 1000);
    settle();
    const skills = new RaiderSkills(() => {});
    skills.track(brute, 'brute', 1, 0);
    run(skills, 0, 5_000);
    expect(skills.winding(brute)).toBeNull();
  });

  it('an eel fires its spark at the defender (a real bolt, no throw)', () => {
    const eel = unit(RAIDERS, 1000, 1000);
    unit(DEFENDERS, 1300, 1000);
    settle();
    const skills = new RaiderSkills(() => {});
    skills.track(eel, 'eel', 1, 0);
    const added: any[] = [];
    const add = game.objectManager.addObject.bind(game.objectManager);
    (game.objectManager as any).addObject = (o: any) => (added.push(o), add(o));
    expect(() => run(skills, 0, RAIDER_SKILLS.eel!.firstMs + RAIDER_SKILLS.eel!.windupMs + 100)).not.toThrow();
    expect(added.some(o => o.constructor.name === 'PaperBolt')).toBe(true);
    expect(skills.winding(eel)).toBeNull();
  });

  it('a kraken roots the defenders in reach', () => {
    const kraken = unit(RAIDERS, 1000, 1000);
    const a = unit(DEFENDERS, 1300, 1000);
    const b = unit(DEFENDERS, 1000, 1350);
    settle();
    const skills = new RaiderSkills(() => {});
    skills.track(kraken, 'kraken', 1, 0);
    run(skills, 0, RAIDER_SKILLS.kraken!.firstMs + RAIDER_SKILLS.kraken!.windupMs + 100);
    expect(has(a, api.buffs.Root)).toBe(true);
    expect(has(b, api.buffs.Root)).toBe(true);
    expect(TENTACLE_ROOT_MS).toBeGreaterThan(1000);
  });

  it('a jelly heals a hurt raider beside it', () => {
    const jelly = unit(RAIDERS, 1000, 1000);
    const hurt = unit(RAIDERS, 1100, 1000);
    unit(DEFENDERS, 2000, 2000);
    settle();
    const max = hurt.stats.maxHealth.value;
    hurt.stats.health.baseValue = max * 0.4;
    const skills = new RaiderSkills(() => {});
    skills.track(jelly, 'jelly', 1, 0);
    run(skills, 0, RAIDER_SKILLS.jelly!.firstMs + RAIDER_SKILLS.jelly!.windupMs + 100);
    expect(hurt.stats.health.value).toBeGreaterThan(max * 0.4 + max * JELLY_HEAL_SHARE * 0.9);
  });

  it('the Chúa Triều calls crabs as it falls, once per threshold', () => {
    const lord = unit(RAIDERS, 1000, 1000);
    settle();
    const calls: unknown[] = [];
    const skills = new RaiderSkills(at => calls.push(at));
    skills.track(lord, 'tidelord', 1, 0);
    skills.step(50);
    expect(calls.length).toBe(0);
    lord.stats.health.baseValue = lord.stats.maxHealth.value * 0.6;
    skills.step(100);
    skills.step(150);
    expect(calls.length).toBe(SUMMON_COUNT);
    lord.stats.health.baseValue = lord.stats.maxHealth.value * 0.2;
    skills.step(200);
    expect(calls.length).toBe(SUMMON_COUNT * 2);
  });
});
