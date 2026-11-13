import type { AttackableUnit } from '@moba2d/core/content/types';
import { api } from '../packApi';
import { TidePassive, alliesAt, heartOf, inGlow, type Ornament } from '../world/fx';
import { INK } from '../world/palette';
import { ESCORT_RADIUS } from '../world/rules';

/** Health per second Wick's presence gives every ally in the lantern's glow. */
export const WICK_KEEPER_REGEN = 2;

export default class Wick_P extends TidePassive {
  name = 'Người Giữ Đèn';
  image = api.asset('spell_wick_p');
  description =
    'Nội tại: khi Wick đứng trong quầng sáng Đèn Triều, mọi đồng minh trong quầng sáng được hồi <span class="heal">2 máu mỗi giây</span>.';
  ornament: Ornament = 'flame';
  tint = INK.LANTERN;

  rule(unit: AttackableUnit, dtMs: number): void {
    if (!inGlow(unit)) return;
    const heart = heartOf(unit);
    if (!heart) return;
    for (const ally of alliesAt(unit, heart.lanternPos, ESCORT_RADIUS)) {
      ally.takeHeal((WICK_KEEPER_REGEN * dtMs) / 1000, unit);
    }
  }
}
