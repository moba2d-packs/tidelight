/**
 * What the reef's own art draws at each render tier.
 *
 * Tier 0 is a promise that nothing changed: one canvas call a shape, in the
 * order p5 used to issue them. Merging shapes into one path is cheaper and is
 * NOT the same pixels on a phone's GPU canvas (measured: up to 62 levels on a
 * few hundred edge pixels), so batching and dropped decoration both wait for
 * tier 1, and the heavier cuts for tier 2.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApi, createGame, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import { setPackApi } from '../packApi';
import { BLUE } from '../world/layout';
import { createHeart } from '../world/heart';
import { layZone, TideMark, type Ornament } from '../world/fx';
import { renderTier } from '../world/art/tier';

const { Champion } = buildTestApi().units;

/** A 2D context that only counts what was asked of it. */
function countingContext() {
  const calls: Record<string, number> = {};
  const ctx = new Proxy(
    {},
    {
      get: (_target, key: string) =>
        key === 'canvas'
          ? { width: 800, height: 600 }
          : (..._args: unknown[]) => {
              calls[key] = (calls[key] ?? 0) + 1;
              return key === 'getTransform' ? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } : undefined;
            },
      set: () => true,
    }
  );
  const of = (name: string) => calls[name] ?? 0;
  return { ctx, of, paints: () => of('fill') + of('stroke') };
}

let game: TestGame;
let owner: any;

const atTier = (tier: 0 | 1 | 2) => {
  const g = game as any;
  g.renderQuality = tier === 0 ? 'high' : tier === 2 ? 'low' : 'auto';
  g.renderStressed = tier === 1;
  g.deeplyStressed = false;
  expect(renderTier(game)).toBe(tier);
};

const painted = (subject: { draw(): void }, tier: 0 | 1 | 2) => {
  atTier(tier);
  const counter = countingContext();
  vi.stubGlobal('drawingContext', counter.ctx);
  subject.draw();
  return counter;
};

beforeEach(() => {
  stubGameGlobals();
  vi.stubGlobal('deltaTime', 16);
  game = createGame(4_000);
  (game as any).matchTimeMs = 1_000;
  (game as any).turrets = [];
  owner = new Champion({ game, teamId: BLUE }) as any;
  owner.position.set(1_000, 1_000);
  game.setPlayer(owner);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('renderTier', () => {
  it('is 0 on a core too old to answer, so an old core gets the full picture', () => {
    try {
      setPackApi({ ...buildTestApi(), render: undefined } as never);
      (game as any).renderQuality = 'low';
      expect(renderTier(game)).toBe(0);
    } finally {
      setPackApi(buildTestApi());
    }
    expect(renderTier(game)).toBe(2);
  });
});

describe('a tide zone', () => {
  const zone = () => {
    const made = layZone(owner, { x: 1_000, y: 1_000 }, 200, 3_000, 500, () => {}, {
      tint: [90, 200, 220],
      glyph: 'pool',
    } as never);
    return made as unknown as { draw(): void };
  };

  it('keeps one stroke a shape at tier 0: 18 dashes and 5 glyphs', () => {
    const at0 = painted(zone(), 0);
    expect(at0.of('fill')).toBe(1);
    expect(at0.of('stroke')).toBe(23);
  });

  it('rides one stroke once the machine is behind', () => {
    const at1 = painted(zone(), 1);
    expect(at1.of('fill')).toBe(1);
    expect(at1.of('stroke')).toBe(1);
  });

  it('drops the five glyphs at tier 2 and keeps the disc and the rim', () => {
    const subject = zone();
    const at1 = painted(subject, 1);
    const at2 = painted(subject, 2);
    expect(at2.paints()).toBe(2);
    // a pool glyph is one `moveTo` + one `ellipse` on top of the rim's path
    expect(at1.of('ellipse') - at2.of('ellipse')).toBe(5);
  });
});

describe('a hero\'s tide mark', () => {
  const mark = (ornament: Ornament) => {
    const made = new TideMark(0, owner, owner);
    made.ornament = ornament;
    return made as unknown as { draw(): void };
  };
  const p5Calls = () =>
    ['ellipse', 'circle', 'rect', 'arc', 'triangle', 'fill', 'push']
      .map(name => ((globalThis as any)[name] as ReturnType<typeof vi.fn>).mock.calls.length)
      .reduce((a, b) => a + b, 0);

  it('keeps one fill a shape at tier 0, on the context instead of through p5', () => {
    // the ring is the one stroke; then per ornament a shadow and its pieces
    const fills: Record<Ornament, number> = { anchor: 6, shell: 4, flame: 6, fin: 4, feather: 4 };
    for (const ornament of Object.keys(fills) as Ornament[]) {
      const at0 = painted(mark(ornament), 0);
      expect(at0.of('stroke')).toBe(1);
      expect(at0.of('fill')).toBe(fills[ornament]);
      // p5's own paths: a circle is `ellipse` + `closePath`, never `arc`
      expect(at0.of('arc')).toBe(0);
    }
    expect(p5Calls()).toBe(0);
  });

  it('gives both ornaments one fill, and both shadows one, once the machine is behind', () => {
    for (const ornament of ['anchor', 'shell', 'flame', 'fin', 'feather'] as Ornament[]) {
      const at1 = painted(mark(ornament), 1);
      expect(at1.of('stroke')).toBe(1);
      expect(at1.of('fill')).toBe(2);
    }
  });

  it('drops the shadows at tier 2 and keeps the ring and the ornaments', () => {
    const subject = mark('flame');
    const at1 = painted(subject, 1);
    const at2 = painted(subject, 2);
    expect(at2.of('stroke')).toBe(1);
    expect(at2.of('fill')).toBe(1);
    // the two shadow discs are what went; a flame's own two discs stay
    expect(at1.of('ellipse') - at2.of('ellipse')).toBe(2);
    expect(at2.of('ellipse')).toBe(3);
  });

  it('draws nothing on a dead hero', () => {
    vi.spyOn(owner, 'isDead', 'get').mockReturnValue(true);
    expect(painted(mark('fin'), 0).paints()).toBe(0);
  });
});

describe('the lantern', () => {
  it('draws less at each tier, and tier 0 never batches', () => {
    const heart = createHeart(game) as unknown as { draw(): void; push: number };
    heart.push = 1; // moving, so the chevrons are drawn
    const at0 = painted(heart, 0);
    const at1 = painted(heart, 1);
    const at2 = painted(heart, 2);
    // tier 0: 6 rib strokes + 4 chevron strokes + the ring = 11 strokes
    expect(at0.of('stroke')).toBe(11);
    // tier 1: ribs, chevrons and ring are one stroke each; the halo is gone
    expect(at1.of('stroke')).toBe(3);
    expect(at1.of('fill')).toBeLessThan(at0.of('fill'));
    // tier 2: no ribs, no escort glow disc
    expect(at2.of('stroke')).toBe(2);
    expect(at2.of('fill')).toBe(at1.of('fill') - 1);
  });
});

describe('the reef scenery', () => {
  it('paints lamps, gates, waves and glows in full at tier 0 and batches them above it', () => {
    const reef = (createHeart(game) as any).scenery as { draw(): void };
    // the baked terrain tiles need a real canvas and are the same on every tier
    (reef as any).tiles.draw = () => {};
    // the whole map in view, so every lamp and both gates are painted
    (game as any).camera = undefined;
    expect(reef).toBeDefined();
    const at0 = painted(reef, 0);
    const at1 = painted(reef, 1);
    expect(at0.paints()).toBeGreaterThan(at1.paints() + 15);
  });
});
