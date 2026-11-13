import { MAZE_MAP_ID, MAZE_ROLE, MAZE_SIZE } from './layout';
import { createReferee, getReferee } from './object';
import { mazeArt } from './art';
import { ensureArt } from '../../world/art/sceneryObject';
import { onMap } from '../onMap';

export { map } from './map';

const paint = (game: any): void => ensureArt(game, MAZE_MAP_ID, MAZE_SIZE, mazeArt);

export const slotObjects = {
  [MAZE_ROLE]: (slot: { x: number; y: number }, game: any): any => {
    paint(game);
    return createReferee(game, slot.x, slot.y);
  },
};

/**
 * For `ensureMapObject`: make sure the referee and the painted wreckyard exist
 * even when neutral slots are off (the slot is where they come from with the jungle on).
 */
export function ensure(game: any): boolean {
  if (!onMap(game, MAZE_MAP_ID)) return false;
  paint(game);
  if (!getReferee(game)) game.objectManager.addObject(createReferee(game));
  return true;
}
