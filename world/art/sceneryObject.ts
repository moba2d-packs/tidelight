import { api } from '../../packApi';
import { ReefLayer, type ReefDescription } from './reef';
import type { View } from './draw';

/**
 * The game object that puts a `ReefLayer` on the ground, the way `ReefScenery`
 * does for Driftglass: under everything (`zIndex` -5), always visible, painting
 * on core's raw 2D context. One per match, made by `ensureArt`.
 *
 * Call `ensureArt` from the map's `ensure()` *and* its slot object: the slot
 * fills only with the jungle on, `ensure` is what makes the art exist with it
 * off, and `ensureArt` is idempotent so both may run.
 */
const present = new WeakMap<object, Map<string, { toRemove?: boolean }>>();

let ArtClass: ReturnType<typeof build> | null = null;

function build() {
  class ArtScenery extends api.GameObject {
    zIndex = -5;
    alwaysVisible = true;
    private readonly layer: ReefLayer;
    constructor(
      game: any,
      private readonly size: number,
      desc: ReefDescription
    ) {
      super({ game, position: createVector(size / 2, size / 2) });
      this.layer = new ReefLayer(desc);
    }
    draw(): void {
      const camera = (this.game as any).camera;
      const view: View = camera?.getBoundingBox?.() ?? { x: 0, y: 0, w: this.size, h: this.size };
      this.layer.paint(drawingContext as CanvasRenderingContext2D, view, camera?.currentScale ?? 1, millis());
    }
    onRemoved(): void {
      this.layer.dispose();
    }
    getDisplayBoundingBox() {
      return this.squareDisplayBoundingBox(this.size * 2);
    }
  }
  return ArtScenery;
}

/** Add `key`'s scenery to `game` unless it is already there. `describe` runs once, lazily. */
export function ensureArt(game: any, key: string, size: number, describe: () => ReefDescription): void {
  if (!game?.objectManager) return;
  const mine = present.get(game) ?? new Map();
  present.set(game, mine);
  const had = mine.get(key);
  if (had && !had.toRemove) return;
  ArtClass ??= build();
  const made = new ArtClass(game, size, describe());
  game.objectManager.addObject(made);
  mine.set(key, made);
}

export const hasArt = (game: any, key: string): boolean => present.get(game)?.has(key) ?? false;
