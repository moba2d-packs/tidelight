import { DUEL_MAP_ID, DUEL_ROLE, DUEL_SIZE } from './layout';
import { createDuel, getDuel } from './object';
import { duelArt } from './art';
import { ensureArt } from '../../world/art/sceneryObject';
import { onMap } from '../onMap';

export { map } from './map';

const paint = (game: any): void => ensureArt(game, DUEL_MAP_ID, DUEL_SIZE, duelArt);

export const slotObjects = {
  [DUEL_ROLE]: (slot: { x: number; y: number }, game: any): any => {
    paint(game);
    return createDuel(game, slot.x, slot.y);
  },
};

/**
 * For `ensureMapObject`: make sure the round keeper and the painted arena exist
 * even when neutral slots are off.
 */
export function ensure(game: any): boolean {
  if (!onMap(game, DUEL_MAP_ID)) return false;
  paint(game);
  if (!getDuel(game)) game.objectManager.addObject(createDuel(game));
  return true;
}
