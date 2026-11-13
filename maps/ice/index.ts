import { ICE_MAP_ID, ICE_ROLE, ICE_SIZE } from './layout';
import { createIceArena, getIceArena } from './object';
import { iceArt } from './art';
import { ensureArt } from '../../world/art/sceneryObject';
import { onMap } from '../onMap';

export { map } from './map';

const paint = (game: any): void => ensureArt(game, ICE_MAP_ID, ICE_SIZE, iceArt);

export const slotObjects = {
  [ICE_ROLE]: (slot: { x: number; y: number }, game: any): any => {
    paint(game);
    return createIceArena(game, slot.x, slot.y);
  },
};

/**
 * For `ensureMapObject`: make sure the referee and the painted lagoon exist
 * even when neutral slots are off (the slot is where they come from with the jungle on).
 */
export function ensure(game: any): boolean {
  if (!onMap(game, ICE_MAP_ID)) return false;
  paint(game);
  if (!getIceArena(game)) game.objectManager.addObject(createIceArena(game));
  return true;
}
