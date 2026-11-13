import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SLOT_D, SLOT_F, charmKit, issueCharms } from '../world/charms';

class D {
  constructor(public owner: unknown) {}
}
class F {
  constructor(public owner: unknown) {}
}
class Other {}

const hero = (atD: unknown, atF: unknown) => {
  const spells: unknown[] = [0, 1, 2, 3, 4, atD, atF];
  return {
    spells,
    replaceSpell(index: number, spell: unknown) {
      spells[index] = spell;
    },
  };
};

describe('issueCharms', () => {
  const saved = { ...charmKit };
  beforeEach(() => {
    charmKit.d = D;
    charmKit.f = F;
  });
  afterEach(() => {
    charmKit.d = saved.d;
    charmKit.f = saved.f;
  });

  it("replaces another pack's D/F with the two charms", () => {
    const h = hero(new Other(), new Other());
    issueCharms(h);
    expect(h.spells[SLOT_D]).toBeInstanceOf(D);
    expect(h.spells[SLOT_F]).toBeInstanceOf(F);
  });

  it('splits one charm sitting in both slots', () => {
    const h = hero(new D(null), new D(null));
    const kept = h.spells[SLOT_D];
    issueCharms(h);
    expect(h.spells[SLOT_D]).toBe(kept);
    expect(h.spells[SLOT_F]).toBeInstanceOf(F);
  });

  it('leaves a hero who carries both alone, in either order', () => {
    const h = hero(new F(null), new D(null));
    const before = [...h.spells];
    issueCharms(h);
    expect(h.spells).toEqual(before);
  });

  it('does nothing to a unit without summoner slots', () => {
    const h = hero(undefined, undefined);
    h.spells.length = 5;
    issueCharms(h);
    expect(h.spells).toHaveLength(5);
  });
});
