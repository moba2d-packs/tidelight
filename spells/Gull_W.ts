import { api } from '../packApi';
import { alliesAt, burst, haste } from '../world/fx';
import { INK } from '../world/palette';

export const GULL_W_RADIUS = 320;
export const GULL_W_HASTE = 0.3;
export const GULL_W_HASTE_MS = 2_500;
export const GULL_W_COOLDOWN_MS = 10_000;
export const GULL_W_MANA = 40;

/** Gull's W — a tailwind for everyone standing with her. */
export default class Gull_W extends api.Spell {
  name = 'Gió Xuôi';
  image = api.asset('spell_gull_w');
  description =
    'Gọi gió xuôi: Gull và mọi đồng minh xung quanh được <span class="buff">tăng 30% tốc chạy</span> trong <span class="time">2.5 giây</span>.';
  coolDown = GULL_W_COOLDOWN_MS;
  manaCost = GULL_W_MANA;
  targetingMode = 'SELF' as const;
  static aiRoles = api.enums.SpellRole.Buff;

  onSpellCast(): void {
    const owner = this.owner;
    for (const ally of alliesAt(owner, owner.position, GULL_W_RADIUS)) {
      haste(owner, ally, GULL_W_HASTE, GULL_W_HASTE_MS, 'gull_w_haste');
    }
    burst(owner, owner.position, GULL_W_RADIUS, INK.GALE, 'ring', 480);
  }
}
