import { api } from '../packApi';
import { TidePassive, type Ornament } from '../world/fx';
import { INK } from '../world/palette';

/** How many extra bodies Brine counts as while he stands in the lantern's glow. */
export const BRINE_BALLAST = 1;

export default class Brine_P extends TidePassive {
  name = 'Đá Dằn';
  image = api.asset('spell_brine_p');
  description =
    'Nội tại: khi đứng trong <span class="buff">quầng sáng Đèn Triều</span>, Brine được tính như <span class="buff">2 người hộ tống</span>.';
  ornament: Ornament = 'anchor';
  tint = INK.IRON;
  traits = { escortBonus: BRINE_BALLAST };
}
