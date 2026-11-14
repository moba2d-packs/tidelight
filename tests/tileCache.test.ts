import { describe, expect, it, vi } from 'vitest';
import { TileCache } from '../world/art/tiles';

/**
 * "Back ra app khác xong quay lại game là nó đen hết luôn": a backgrounded
 * phone purges offscreen canvases, these tiles among them. Every return from
 * hidden repaints what is on screen.
 */
describe('the tile cache after the app was in the background', () => {
  class FakePage extends EventTarget {
    hidden = false;
    flip(hidden: boolean) {
      this.hidden = hidden;
      this.dispatchEvent(new Event('visibilitychange'));
    }
  }
  const ctx = {
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    setTransform: () => undefined,
    drawImage: () => undefined,
  } as unknown as CanvasRenderingContext2D;
  const view = { x: 0, y: 0, w: 900, h: 400 };
  const canvas = () => ({ width: 0, height: 0, getContext: () => ({ setTransform: () => undefined }) }) as unknown as HTMLCanvasElement;
  const cacheWith = (page: FakePage) => (vi.stubGlobal('document', { createElement: canvas }), new TileCache(6400, () => undefined, page as never));

  it('repaints the visible tiles on the first frame after coming back', () => {
    const page = new FakePage();
    const cache = cacheWith(page);
    cache.draw(ctx, view, 1);
    const first = cache.bakes;
    cache.draw(ctx, view, 1);
    const steady = cache.bakes;
    page.flip(true);
    page.flip(false);
    cache.draw(ctx, view, 1);
    expect(cache.bakes - steady).toBeGreaterThanOrEqual(first - 1);
  });

  it('leaves the tiles alone on a frame with no trip to the background', () => {
    const page = new FakePage();
    const cache = cacheWith(page);
    cache.draw(ctx, view, 1);
    cache.draw(ctx, view, 1);
    const steady = cache.bakes;
    cache.draw(ctx, view, 1);
    expect(cache.bakes - steady).toBeLessThanOrEqual(1); // the one prefetch a frame
  });

  it('stops listening once destroyed', () => {
    const page = new FakePage();
    const cache = cacheWith(page);
    cache.draw(ctx, view, 1);
    cache.destroy();
    page.flip(true);
    page.flip(false);
    cache.draw(ctx, view, 1);
    const after = cache.bakes;
    cache.draw(ctx, view, 1);
    expect(cache.bakes - after).toBeLessThanOrEqual(1);
  });
});
