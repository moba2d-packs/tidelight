/**
 * "Nền bản đồ: Đơn giản" — the player asked for core's solid ground so the
 * fight is what they see. Core then draws every wall and kelp bed itself, and
 * this pack leaves out what only decorates. What a player has to *read* to
 * play stays: the tide over the shoals, the gates, the berths, an ice floe, a
 * goal mouth.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { buildTestApi, createGame, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import { setPackApi } from '../packApi';
import { plainGround } from '../world/art/tier';
import { ReefLayer, type ReefDescription } from '../world/art/reef';
import { TileCache } from '../world/art/tiles';
import { ensureArt } from '../world/art/sceneryObject';
import { createHeart } from '../world/heart';
import { BLUE } from '../world/layout';
import { bridgeArt } from '../maps/bridge/art';
import { iceArt } from '../maps/ice/art';
import { ICE_FLOES } from '../maps/ice/layout';
import { hillArt } from '../maps/hill/art';
import { mazeArt } from '../maps/maze/art';
import { portalsArt } from '../maps/portals/art';
import { ballArt } from '../maps/ball/art';
import { defendArt } from '../maps/defend/art';
import { duelArt } from '../maps/duel/art';

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
  ) as unknown as CanvasRenderingContext2D;
  const of = (name: string) => calls[name] ?? 0;
  return { ctx, of, paints: () => of('fill') + of('stroke') + of('fillRect') };
}

let game: TestGame;
let blit: MockInstance;
let freed: MockInstance;

beforeEach(() => {
  stubGameGlobals();
  vi.stubGlobal('deltaTime', 16);
  vi.stubGlobal('millis', () => 0);
  game = createGame(4_000);
  (game as any).matchTimeMs = 1_000;
  (game as any).turrets = [];
  // The baked tiles need a real canvas; whether they are blitted is the question.
  blit = vi.spyOn(TileCache.prototype, 'draw').mockImplementation(() => {});
  freed = vi.spyOn(TileCache.prototype, 'dispose');
});
afterEach(() => {
  setPackApi(buildTestApi());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('plainGround', () => {
  it('is core’s answer: the player’s own setting', () => {
    expect(plainGround({ mapGround: 'plain' })).toBe(true);
    expect(plainGround({ mapGround: 'detailed' })).toBe(false);
    expect(plainGround({})).toBe(false);
  });

  it('is the painted art on a core too old to answer', () => {
    const full = buildTestApi();
    // Contract 24 has `api.render` and no `plainGround`; before it, no `api.render`.
    setPackApi({ ...full, render: { stressTier: full.render.stressTier } } as never);
    expect(plainGround({ mapGround: 'plain' })).toBe(false);
    setPackApi({ ...full, render: undefined } as never);
    expect(plainGround({ mapGround: 'plain' })).toBe(false);
  });
});

describe('a painted map layer', () => {
  const whole = (desc: ReefDescription) => ({ x: -200, y: -200, w: desc.size + 400, h: desc.size + 400 });

  it('paints sea, tiles, kelp and its live set pieces when detailed', () => {
    const live = vi.fn();
    const plain = vi.fn();
    const desc = { ...mazeArt(), live, plain };
    const { ctx, paints } = countingContext();
    new ReefLayer(desc).paint(ctx, whole(desc), 1, 0);
    expect(blit).toHaveBeenCalledTimes(1);
    expect(live).toHaveBeenCalledTimes(1);
    expect(plain).not.toHaveBeenCalled();
    expect(paints()).toBeGreaterThan(0);
  });

  it('paints none of it when plain, only what the map says must still be read', () => {
    const live = vi.fn();
    const plain = vi.fn();
    const desc = { ...mazeArt(), live, plain };
    const { ctx, paints } = countingContext();
    new ReefLayer(desc).paint(ctx, whole(desc), 1, 0, true);
    expect(blit).not.toHaveBeenCalled();
    expect(live).not.toHaveBeenCalled();
    expect(plain).toHaveBeenCalledTimes(1);
    // No outer sea, no kelp blades: core's own fills are the ground now.
    expect(paints()).toBe(0);
  });

  it('lets its baked tiles go once on the way to plain, and bakes again on the way back', () => {
    const desc = mazeArt();
    const layer = new ReefLayer(desc);
    const { ctx } = countingContext();
    layer.paint(ctx, whole(desc), 1, 0, true);
    layer.paint(ctx, whole(desc), 1, 16, true);
    expect(freed).toHaveBeenCalledTimes(1);
    layer.paint(ctx, whole(desc), 1, 32, false);
    expect(blit).toHaveBeenCalledTimes(1);
    layer.paint(ctx, whole(desc), 1, 48, true);
    expect(freed).toHaveBeenCalledTimes(2);
  });

  it('is only decoration on six maps: nothing at all is painted when plain', () => {
    for (const art of [bridgeArt, hillArt, mazeArt, portalsArt, defendArt, duelArt]) {
      const desc = art();
      const { ctx, paints, of } = countingContext();
      new ReefLayer(desc).paint(ctx, whole(desc), 1, 500, true);
      expect(paints(), `size ${desc.size}`).toBe(0);
      expect(of('drawImage')).toBe(0);
    }
  });

  it('still shows the ice floes, which core’s zone draws with a clear fill', () => {
    const desc = iceArt();
    const { ctx, of } = countingContext();
    new ReefLayer(desc).paint(ctx, whole(desc), 1, 500, true);
    expect(blit).not.toHaveBeenCalled();
    // One fill and one outline for all of them, every floe in the path.
    expect(of('fill')).toBe(1);
    expect(of('stroke')).toBe(1);
    expect(of('moveTo')).toBe(ICE_FLOES.length);
  });

  it('still shows both goals and the pitch lines on the ball map', () => {
    const desc = ballArt();
    const { ctx, of } = countingContext();
    new ReefLayer(desc).paint(ctx, whole(desc), 1, 500, true);
    expect(blit).not.toHaveBeenCalled();
    // Two net pockets and two goal-line bars, each in its court's colour.
    expect(of('fillRect')).toBe(4);
    expect(of('stroke')).toBeGreaterThan(0);
  });
});

describe('the scenery objects ask the game every frame', () => {
  const sceneryOf = (key: string, describe: () => ReefDescription) => {
    let made: { draw(): void } | null = null;
    const host: any = { objectManager: { addObject: (o: { draw(): void }) => (made = o) } };
    ensureArt(host, key, describe().size, describe);
    return { host, made: made! };
  };

  it('a mode map: no tiles while plain, tiles again on the frame after', () => {
    const { host, made } = sceneryOf('maze', mazeArt);
    vi.stubGlobal('drawingContext', countingContext().ctx);
    host.mapGround = 'plain';
    made.draw();
    expect(blit).not.toHaveBeenCalled();
    host.mapGround = 'detailed';
    made.draw();
    expect(blit).toHaveBeenCalledTimes(1);
  });

  it('Driftglass: drops the reef and keeps the tide, the gates and the berths', () => {
    const owner = new (buildTestApi().units.Champion)({ game, teamId: BLUE }) as any;
    game.setPlayer(owner);
    const reef = (createHeart(game) as any).scenery as { draw(): void };
    (game as any).camera = undefined;
    const paintedAs = (ground: string) => {
      (game as any).mapGround = ground;
      const counter = countingContext();
      vi.stubGlobal('drawingContext', counter.ctx);
      blit.mockClear();
      reef.draw();
      return counter;
    };

    const detailed = paintedAs('detailed');
    expect(blit).toHaveBeenCalledTimes(1);

    const plain = paintedAs('plain');
    expect(blit).not.toHaveBeenCalled();
    // Something is still drawn — both berths and both gates at the least —
    expect(plain.paints()).toBeGreaterThanOrEqual(4);
    // — and far less than the painted reef: no lamps, waves, kelp or outer sea.
    expect(plain.paints()).toBeLessThan(detailed.paints() - 15);
    // No island is re-inked over a flood sheet: islands are core's solid walls now.
    expect(plain.of('clip')).toBe(0);

    paintedAs('detailed');
    expect(blit).toHaveBeenCalledTimes(1);
  });
});
