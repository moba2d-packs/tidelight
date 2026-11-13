import { api } from '../packApi';
import { TidePassive, type Ornament } from '../world/fx';
import { INK } from '../world/palette';

/** How much more a pearl is worth in Nacre's hands. */
export const NACRE_PEARL_MULT = 2;

export default class Nacre_P extends TidePassive {
  name = 'Mắt Ngọc';
  image = api.asset('spell_nacre_p');
  description =
    'Nội tại: ngọc trai nhặt trên bãi cạn cho Nacre <span class="buff">gấp đôi</span> hồi máu và thời gian phát sáng.';
  ornament: Ornament = 'shell';
  tint = INK.PEARL;
  traits = { pearlMult: NACRE_PEARL_MULT };
}
