import type { AttackableUnit } from '@moba2d/core/content/types';
import { api } from '../packApi';
import { TidePassive, burst, heartOf, type Ornament } from '../world/fx';
import { INK } from '../world/palette';

/** Health Gull recovers each time the tide turns, whichever way it turns. */
export const GULL_TURN_HEAL = 10;

export default class Gull_P extends TidePassive {
  name = 'Đổi Gió';
  image = api.asset('spell_gull_p');
  description =
    'Nội tại: mỗi khi <span class="buff">triều đổi chiều</span>, Gull hồi <span class="heal">10 máu</span>.';
  ornament: Ornament = 'feather';
  tint = INK.GALE;

  private lastTide: string | null | undefined = undefined;

  rule(unit: AttackableUnit): void {
    const favoured = heartOf(unit)?.tide().favoured ?? null;
    if (this.lastTide !== undefined && favoured !== this.lastTide && favoured !== null) {
      unit.takeHeal(GULL_TURN_HEAL, unit);
      burst(unit, unit.position, 80, INK.GALE, 'ring', 360);
    }
    this.lastTide = favoured;
  }
}
