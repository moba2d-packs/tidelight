import { api } from '../packApi';
import { alliesAt, burst, haste } from '../world/fx';
import { INK } from '../world/palette';

export const WICK_W_RADIUS = 300;
export const WICK_W_HEAL = 16;
export const WICK_W_HASTE = 0.25;
export const WICK_W_HASTE_MS = 2_000;
export const WICK_W_COOLDOWN_MS = 10_000;
export const WICK_W_MANA = 50;

/** Wick's W — relight everyone standing close. */
export default class Wick_W extends api.Spell {
  name = 'Thắp Lại';
  image = api.asset('spell_wick_w');
  description =
    'Hồi <span class="heal">16 máu</span> và <span class="buff">tăng 25% tốc chạy</span> trong <span class="time">2 giây</span> cho Wick và mọi đồng minh xung quanh.';
  coolDown = WICK_W_COOLDOWN_MS;
  manaCost = WICK_W_MANA;
  targetingMode = 'SELF' as const;
  static aiRoles = api.enums.SpellRole.Heal | api.enums.SpellRole.Buff;

  onSpellCast(): void {
    const owner = this.owner;
    for (const ally of alliesAt(owner, owner.position, WICK_W_RADIUS)) {
      ally.takeHeal(WICK_W_HEAL, owner);
      haste(owner, ally, WICK_W_HASTE, WICK_W_HASTE_MS, 'wick_w_haste');
    }
    burst(owner, owner.position, WICK_W_RADIUS, INK.LANTERN, 'ring', 520);
  }
}
