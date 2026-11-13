/**
 * Đảo Cổng: the portal timing / cooldown / rotation rules, the same rules in a
 * headless match, and the map against core's own checks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApi, createGame, indexObjects, stubGameGlobals, validatePackData, type TestGame } from '@moba2d/core/testing';
import { mapIssues } from '@moba2d/core/testing/maps';
import { data } from '../../pack';
import { BLUE, RED } from '../../world/layout';
import { createPortalArena } from '../../maps/portals/arena';
import { geometry } from '../../maps/portals/geometry';
import { KEEPS, PORTAL_SPOTS } from '../../maps/portals/layout';
import {
  PAIRINGS,
  PAIRING_ROTATE_MS,
  PORTAL_COOLDOWN_MS,
  PORTAL_WINDUP_MS,
  PortalTracker,
  msToRotation,
  pairingIndexAt,
  partnerOf,
} from '../../maps/portals/rules';

const at = (i: number) => PORTAL_SPOTS[i];

describe('pairing', () => {
  it('every pairing joins all four islands exactly once, and is point-symmetric', () => {
    for (const pairing of PAIRINGS) {
      const ends = pairing.flat().sort();
      expect(ends).toEqual([0, 1, 2, 3]);
      for (const [a, b] of pairing) {
        // The 180 degree turn must map a pair onto a pair, so no court is favoured.
        const turned = [(a + 2) % 4, (b + 2) % 4].sort();
        expect(pairing.some(([x, y]) => [x, y].sort().join() === turned.join())).toBe(true);
      }
    }
  });

  it('rotates every 45 s and cycles through all of them', () => {
    expect(PAIRING_ROTATE_MS).toBe(45_000);
    expect(pairingIndexAt(0)).toBe(0);
    expect(pairingIndexAt(44_999)).toBe(0);
    expect(pairingIndexAt(45_000)).toBe(1);
    expect(pairingIndexAt(90_000)).toBe(2);
    expect(pairingIndexAt(135_000)).toBe(0);
    expect(msToRotation(40_000)).toBe(5_000);
  });

  it('partnerOf is its own inverse', () => {
    for (let p = 0; p < PAIRINGS.length; p++) {
      for (let i = 0; i < 4; i++) expect(partnerOf(p, partnerOf(p, i))).toBe(i);
    }
  });
});

describe('PortalTracker', () => {
  const unit = {};

  it('winds up for 0.6 s, then sends the unit to its partner', () => {
    const t = new PortalTracker();
    expect(t.step(unit, at(0), 1_000)).toEqual({ kind: 'start', portal: 0 });
    expect(t.windup(unit, 1_300)).toBeCloseTo(0.5);
    expect(t.step(unit, at(0), 1_000 + PORTAL_WINDUP_MS - 1)).toBeNull();
    expect(t.step(unit, at(0), 1_000 + PORTAL_WINDUP_MS)).toEqual({ kind: 'teleport', from: 0, to: partnerOf(0, 0) });
  });

  it('cancels when the unit steps out, and the wind-up starts over', () => {
    const t = new PortalTracker();
    t.step(unit, at(0), 0);
    expect(t.step(unit, { x: 0, y: 0 }, 400)).toEqual({ kind: 'cancel' });
    expect(t.windup(unit, 400)).toBeNull();
    expect(t.step(unit, at(0), 500)).toEqual({ kind: 'start', portal: 0 });
    // 0.6 s from the *new* start, not the old one.
    expect(t.step(unit, at(0), 500 + PORTAL_WINDUP_MS - 1)).toBeNull();
    expect(t.step(unit, at(0), 500 + PORTAL_WINDUP_MS)?.kind).toBe('teleport');
  });

  it('gives each unit its own 8 s cooldown', () => {
    const t = new PortalTracker();
    const other = {};
    t.step(unit, at(0), 0);
    t.step(unit, at(0), PORTAL_WINDUP_MS);
    const left = PORTAL_COOLDOWN_MS;
    expect(t.cooldownLeft(unit, PORTAL_WINDUP_MS)).toBe(left);
    // Landing in the partner portal does not bounce it back...
    expect(t.step(unit, at(1), PORTAL_WINDUP_MS + 50)).toBeNull();
    expect(t.step(unit, at(1), PORTAL_WINDUP_MS + 5_000)).toBeNull();
    // ...but somebody else is not on cooldown.
    expect(t.step(other, at(1), PORTAL_WINDUP_MS + 5_000)).toEqual({ kind: 'start', portal: 1 });
    // And once it is over, a unit still standing there winds up again.
    const done = PORTAL_WINDUP_MS + PORTAL_COOLDOWN_MS;
    expect(t.step(unit, at(1), done - 1)).toBeNull();
    expect(t.step(unit, at(1), done)).toEqual({ kind: 'start', portal: 1 });
  });

  it('uses the pairing in force when the wind-up completes', () => {
    const t = new PortalTracker();
    const start = PAIRING_ROTATE_MS - 300;
    t.step(unit, at(0), start);
    expect(t.step(unit, at(0), start + PORTAL_WINDUP_MS)).toEqual({
      kind: 'teleport',
      from: 0,
      to: partnerOf(1, 0),
    });
  });
});

describe('the arena in a match', () => {
  const { Champion } = buildTestApi().units;
  let game: TestGame;

  const hero = (teamId: string, p: { x: number; y: number }) => {
    const unit = new Champion({ game, teamId }) as any;
    unit.position.set(p.x, p.y);
    unit.destination.set(p.x, p.y);
    unit.stats.health.baseValue = 100;
    unit.stats.maxHealth.baseValue = 100;
    return unit;
  };
  const run = (arena: any, units: unknown[], from: number, ms: number) => {
    for (let t = 0; t < ms; t += 50) {
      indexObjects(game, units as never[]);
      (game as any).matchTimeMs = from + t + 50;
      arena.step(50);
    }
  };

  beforeEach(() => {
    stubGameGlobals();
    vi.stubGlobal('deltaTime', 16);
    game = createGame(3_200);
    (game as any).turrets = [];
    game.setPlayer(hero(BLUE, { x: -5_000, y: -5_000 }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('teleports a hero after the wind-up, not before', () => {
    const arena = createPortalArena(game);
    const h = hero(BLUE, at(0));
    run(arena, [h], 1_000, PORTAL_WINDUP_MS - 100);
    expect(h.position.x).toBe(at(0).x);
    run(arena, [h], 1_000 + PORTAL_WINDUP_MS - 100, 200);
    expect(h.position.x).toBe(at(1).x);
    expect(h.position.y).toBe(at(1).y);
  });

  it('does not teleport a hero who steps out in time', () => {
    const arena = createPortalArena(game);
    const h = hero(BLUE, at(0));
    run(arena, [h], 1_000, 300);
    h.position.set(at(0).x + 300, at(0).y);
    run(arena, [h], 1_300, 1_000);
    expect(h.position.x).toBe(at(0).x + 300);
  });

  it('calls the match when a keep falls', () => {
    const arena = createPortalArena(game);
    (game as any).turrets = [{ teamId: RED, isDead: true, position: KEEPS[RED] }];
    run(arena, [], 1_000, 100);
    expect(arena.winner).toBe(BLUE);
  });
});

describe('the map', () => {
  it('is a pack core would install, with the neutral slot mapped', () => {
    const checked = validatePackData(data);
    expect(checked.ok === true ? [] : checked.errors).toEqual([]);
    expect(data.maps?.map(m => m.id)).toContain('portals');
  });

  it('has nothing the map editor’s checker would refuse', () => {
    const issues = mapIssues({
      size: 3_200,
      lanes: geometry.lanes!.map(l => ({ id: l.id, points: l.waypoints.map(({ x, y }): [number, number] => [x, y]) })),
      walls: geometry.terrain.wall.map(poly => poly.map(({ x, y }): [number, number] => [x, y])),
      turrets: geometry.slots.structure,
      spawns: geometry.slots.spawn,
      musters: geometry.slots.minion,
      neutrals: geometry.slots.neutral,
    });
    expect(issues.map(i => `${i.text} @ ${i.at.map(Math.round).join(',')}`)).toEqual([]);
  });
});
