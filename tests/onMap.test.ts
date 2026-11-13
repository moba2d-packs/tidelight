/**
 * A real match qualifies the map id (`'tidelight:hill'`). Every map's rule
 * object is found through `onMap`, so this is the test that the qualified form —
 * the one tests used to skip by setting the bare id — reaches all of them.
 */
import { describe, expect, it } from 'vitest';
import { ensureOn, onMap } from '../maps/onMap';
import { ensureMapObject } from '../maps';

const fakeGame = (activeMapId: string) => {
  const added: unknown[] = [];
  return {
    activeMapId,
    neutralSlots: [],
    added,
    objectManager: { objects: [] as unknown[], _objectToBeAdd: added, addObject: (o: unknown) => added.push(o) },
  };
};

describe('onMap', () => {
  it('matches the qualified id a real match uses, and the bare one', () => {
    expect(onMap({ activeMapId: 'tidelight:hill' }, 'hill')).toBe(true);
    expect(onMap({ activeMapId: 'hill' }, 'hill')).toBe(true);
  });
  it('does not match a different map that shares a suffix', () => {
    expect(onMap({ activeMapId: 'tidelight:uphill' }, 'hill')).toBe(false);
    expect(onMap({ activeMapId: 'tidelight:driftglass' }, 'hill')).toBe(false);
    expect(onMap({}, 'hill')).toBe(false);
  });
});

describe('ensureOn', () => {
  it('adds the object once on its map, never off it', () => {
    const made = { id: 'arena' };
    const g = fakeGame('tidelight:portals');
    expect(ensureOn(g, 'portals', () => made)).toBe(true);
    expect(ensureOn(g, 'portals', () => made)).toBe(true);
    expect(g.added).toEqual([made]);
    const off = fakeGame('tidelight:driftglass');
    expect(ensureOn(off, 'portals', () => made)).toBe(false);
    expect(off.added).toEqual([]);
  });
  it('does not add twice when the jungle slot already placed it', () => {
    const made = { id: 'arena' };
    const g = fakeGame('tidelight:bridge');
    g.objectManager.objects.push(made);
    ensureOn(g, 'bridge', () => made);
    expect(g.added).toEqual([]);
  });
});

describe('the maze and duel keepers in a real (qualified) match', () => {
  it.each(['maze', 'duel'])('%s: ensureMapObject sees tidelight:%s', id => {
    const g = fakeGame(`tidelight:${id}`) as any;
    expect(ensureMapObject(g)).toBe(true);
  });
});
