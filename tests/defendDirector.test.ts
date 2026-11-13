/**
 * The Thủ Đèn director in a headless match: waves go out through the spawner,
 * bodies are scaled, red champions are adopted, the lantern decides the match.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApi, createGame, indexObjects, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import { createDefence } from '../maps/defend/defence';
import { defendPosture, DEFEND_RADIUS } from '../maps/defend/defendAI';
import { DEFENDERS, GATES, LANTERN, RAIDERS } from '../maps/defend/layout';
import { RAIDER_TYPES, defendMap } from '../maps/defend/map';
import { WAVES_TO_WIN, FIRST_WAVE_DELAY_MS, waveSpec } from '../maps/defend/waves';
import { data } from '../pack';

const { Champion } = buildTestApi().units;
let game: TestGame;
let spawned: any[];
let lantern: any;

const body = (kind: string, lane: string) => ({
  kind,
  lane,
  isDead: false,
  toRemove: false,
  teamId: RAIDERS,
  damage: RAIDER_TYPES[kind].damage,
  stats: { maxHealth: { baseValue: 0 }, health: { baseValue: 0 } },
});

beforeEach(() => {
  stubGameGlobals();
  vi.stubGlobal('deltaTime', 50);
  game = createGame(2_400);
  spawned = [];
  lantern = { teamId: DEFENDERS, position: { x: LANTERN.x, y: LANTERN.y }, isDead: false, stats: { health: { value: 4000 }, maxHealth: { value: 4000 } } };
  (game as any).turrets = [lantern];
  (game as any).minionSpawner = {
    minions: spawned,
    setEnabled: vi.fn(),
    spawn: ({ lane, kind }: any) => {
      const m = body(kind, lane);
      spawned.push(m);
      return m;
    },
  };
  const watcher = new Champion({ game, teamId: DEFENDERS }) as any;
  watcher.position.set(-5_000, -5_000);
  game.setPlayer(watcher);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const run = (ms: number, d: any) => {
  for (let t = 0; t < ms; t += 50) d.step(50);
};

describe('the Thủ Đèn director', () => {
  it('is one per match and silences core wave clock', () => {
    const d = createDefence(game);
    expect(createDefence(game)).toBe(d);
    d.step(50);
    expect((game as any).minionSpawner.setEnabled).toHaveBeenCalledWith(false);
  });

  it('sends wave 1 through the spawner on the raiders side, scaled', () => {
    const d = createDefence(game);
    run(FIRST_WAVE_DELAY_MS, d);
    expect(spawned.length).toBe(waveSpec(1).spawns.length);
    expect(new Set(spawned.map(m => m.lane))).toEqual(new Set(GATES.slice(0, 2).map(g => g.id)));
    expect(spawned[0].stats.maxHealth.baseValue).toBe(RAIDER_TYPES[spawned[0].kind].health);
    expect(d.raiders.length).toBe(spawned.length);
  });

  it('gives later waves more health and the boss its body', () => {
    const d = createDefence(game);
    run(FIRST_WAVE_DELAY_MS + 25_000 * 4, d);
    const boss = spawned.find(m => m.kind === 'tidelord')!;
    expect(boss).toBeTruthy();
    expect(boss.stats.maxHealth.baseValue).toBe(Math.round(RAIDER_TYPES.tidelord.health * waveSpec(5).healthMult));
    expect(boss.damage).toBeGreaterThan(RAIDER_TYPES.tidelord.damage);
  });

  it('is won after the last wave when the field is cleared', () => {
    const d = createDefence(game);
    run(FIRST_WAVE_DELAY_MS + 25_000 * (WAVES_TO_WIN - 1), d);
    expect(d.state.wave).toBe(WAVES_TO_WIN);
    expect(d.state.outcome).toBe('play');
    for (const m of spawned) m.isDead = true;
    run(100, d);
    expect(d.state.outcome).toBe('won');
  });

  it('is lost when the lantern breaks', () => {
    const d = createDefence(game);
    run(20_000, d);
    lantern.isDead = true;
    run(100, d);
    expect(d.state.outcome).toBe('lost');
  });

  it('does not call a missing lantern a loss', () => {
    (game as any).turrets = [];
    const d = createDefence(game);
    run(2_000, d);
    expect(d.state.outcome).toBe('play');
  });

  it('moves red champions to the defenders side', () => {
    const red = new Champion({ game, teamId: RAIDERS }) as any;
    red.position.set(LANTERN.x + 100, LANTERN.y);
    const d = createDefence(game);
    indexObjects(game, [red]);
    run(300, d);
    expect(red.teamId).toBe(DEFENDERS);
  });
});

describe('the map as data', () => {
  it('is registered, declares its own types and lanes per gate', async () => {
    expect(data.maps?.some(m => m.id === defendMap.id)).toBe(true);
    const geometry = await (defendMap.geometry as () => Promise<any>)();
    expect(geometry.lanes.map((l: any) => l.id)).toEqual(GATES.map(g => g.id));
    expect(Object.keys(defendMap.tuning!.minions!.types!)).toEqual(['crab', 'spitter', 'brute', 'tidelord']);
  });
});

describe('defending bots', () => {
  const near = { x: LANTERN.x + 100, y: LANTERN.y };
  it('walk back to the lantern when they drift out', () => {
    expect(defendPosture('PUSH', { x: LANTERN.x + DEFEND_RADIUS + 50, y: LANTERN.y }, [])).toBe('RETREAT');
    expect(defendPosture('ROAM', { x: LANTERN.x, y: LANTERN.y + DEFEND_RADIUS + 50 }, [])).toBe('RETREAT');
  });
  it('do not march out to push, but fight raiders that are close', () => {
    expect(defendPosture('PUSH', near, [])).toBe('ROAM');
    expect(defendPosture('FARM', near, [{ x: near.x + 200, y: near.y }])).toBe('PUSH');
    expect(defendPosture('PUSH', near, [{ x: near.x + 1500, y: near.y }])).toBe('ROAM');
  });
  it('leave fights and retreats to the shared brain', () => {
    expect(defendPosture('FIGHT', { x: 0, y: 0 }, [])).toBeUndefined();
    expect(defendPosture('RETREAT', near, [])).toBeUndefined();
  });
});
