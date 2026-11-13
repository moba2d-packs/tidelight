import * as duel from './duel';
import * as maze from './maze';
import * as ice from './ice';

/** The extra maps, for `pack.ts`: one list of definitions, one table of slot objects. */
export const extraMaps = [maze.map, duel.map, ice.map];
export const extraSlotObjects = { ...maze.slotObjects, ...duel.slotObjects, ...ice.slotObjects };

/** True when `game` is one of the extra maps (and its object now exists). Called from `ensureHeart`. */
export const ensureMapObject = (game: any): boolean => maze.ensure(game) || duel.ensure(game) || ice.ensure(game);
