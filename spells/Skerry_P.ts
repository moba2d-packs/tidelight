import type { AttackableUnit } from '@moba2d/core/content/types';
import { api } from '../packApi';
import { TidePassive, haste, tideIsWith, type Ornament } from '../world/fx';
import { INK } from '../world/palette';

/** Move speed Skerry gains while the tide runs for her court. */
export const SKERRY_TIDE_HASTE = 0.15;

export default class Skerry_P extends TidePassive {
  name = 'Con Nước';
  image = api.asset('spell_skerry_p');
  description =
    'Nội tại: khi <span class="buff">triều thuận</span> về đội mình, Skerry được <span class="buff">tăng 15% tốc chạy</span>.';
  ornament: Ornament = 'fin';
  tint = INK.CORAL;

  rule(unit: AttackableUnit): void {
    if (tideIsWith(unit)) haste(unit, unit, SKERRY_TIDE_HASTE, 600, 'skerry_p_haste');
  }
}
