/**
 * The raiders draw themselves (core contract 26, `MinionTypeDef.draw`). Claims:
 * every raider type carries a body; each body stays inside its painted-path
 * budget, full and thin, at rest and mid-swing; a body never leaves the canvas
 * state unbalanced; and `draw` is hidden from a core too old to know the field,
 * whose validator would otherwise refuse the whole pack over it.
 */
import { describe, expect, it } from 'vitest';
import { validatePackData } from '@moba2d/core/testing';
import { RAIDER_TYPES, defendMap } from '../maps/defend/map';
import { RAIDER_ART, RAIDER_OP_BUDGET, THIN_OP_BUDGET } from '../maps/defend/raiderArt';
import { data } from '../pack';

type View = Parameters<(typeof RAIDER_ART)['crab']>[1];

/** A context that counts instead of painting. `ops` is painted paths: the calls that cost pixels. */
const recorder = () => {
  const count = { ops: 0, saves: 0, restores: 0, calls: 0 };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (store, name: string) => {
      if (name in store) return store[name];
      return () => {
        count.calls++;
        if (name === 'fill' || name === 'stroke' || name === 'fillRect' || name === 'strokeRect') count.ops++;
        if (name === 'save') count.saves++;
        if (name === 'restore') count.restores++;
      };
    },
    set: (store, name: string, value) => {
      store[name] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, count };
};

const view = (kind: string, over: Partial<View> = {}): View => ({
  size: RAIDER_TYPES[kind].size,
  style: RAIDER_TYPES[kind].style ?? 'melee',
  colors: { body: 'rgb(226, 84, 68)', trim: 'rgb(86, 22, 18)', bar: 'rgb(255, 126, 106)' },
  charge: 0,
  reach: 0,
  thin: false,
  timeMs: 1_234,
  seed: 1,
  ...over,
});

/** At rest, wound up, and following through — the three poses a body is ever asked for. */
const POSES: Partial<View>[] = [{}, { charge: 1, reach: -8 }, { reach: 8, timeMs: 98_765 }];
const KINDS = Object.keys(RAIDER_TYPES);

describe('Thủ Đèn: the raiders draw themselves', () => {
  it('gives every raider type a body of its own', () => {
    expect(KINDS.length).toBe(7);
    for (const kind of KINDS) expect([kind, typeof RAIDER_TYPES[kind].draw]).toEqual([kind, 'function']);
    expect(new Set(KINDS.map(kind => RAIDER_TYPES[kind].draw)).size).toBe(KINDS.length);
    expect(Object.keys(RAIDER_ART).sort()).toEqual([...KINDS].sort());
  });

  it.each(KINDS)('%s paints something, inside its budget, in every pose', kind => {
    const budget = RAIDER_OP_BUDGET[kind as keyof typeof RAIDER_OP_BUDGET];
    for (const pose of POSES) {
      const { ctx, count } = recorder();
      RAIDER_ART[kind as keyof typeof RAIDER_ART](ctx, view(kind, pose));
      expect(count.ops).toBeGreaterThanOrEqual(3);
      expect(count.ops).toBeLessThanOrEqual(budget);
      expect(count.saves).toBe(count.restores);
    }
  });

  it.each(KINDS)('%s has a thin body of at most four paths that is cheaper than the full one', kind => {
    const full = recorder();
    RAIDER_ART[kind as keyof typeof RAIDER_ART](full.ctx, view(kind));
    for (const pose of POSES) {
      const thin = recorder();
      RAIDER_ART[kind as keyof typeof RAIDER_ART](thin.ctx, view(kind, { ...pose, thin: true }));
      expect(thin.count.ops).toBeGreaterThanOrEqual(2);
      expect(thin.count.ops).toBeLessThanOrEqual(THIN_OP_BUDGET);
      expect(thin.count.ops).toBeLessThan(full.count.ops);
      expect(thin.count.saves).toBe(thin.count.restores);
    }
  });

  it('keeps ordinary bodies at eight paths and lets only the two bosses have more', () => {
    for (const kind of KINDS) {
      const boss = kind === 'kraken' || kind === 'tidelord';
      const budget = RAIDER_OP_BUDGET[kind as keyof typeof RAIDER_OP_BUDGET];
      expect([kind, budget <= (boss ? 12 : 8)]).toEqual([kind, true]);
    }
  });

  it('hides draw from enumeration, so a core that predates the field still installs the pack', () => {
    // A pre-26 validator rest-spreads a type's fields and refuses any name it
    // does not know. Spreading is exactly what must not see `draw`.
    for (const kind of KINDS) {
      expect(Object.keys(RAIDER_TYPES[kind])).not.toContain('draw');
      expect('draw' in { ...RAIDER_TYPES[kind] }).toBe(false);
    }
    expect(defendMap.tuning?.minions?.types).toBe(RAIDER_TYPES);
    const result = validatePackData(data);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});
