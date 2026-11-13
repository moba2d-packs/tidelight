import { api } from '../packApi';
import { burst, haste } from '../world/fx';
import { INK } from '../world/palette';

export const SKERRY_W_HASTE = 0.45;
export const SKERRY_W_HASTE_MS = 2_500;
export const SKERRY_W_COOLDOWN_MS = 9_000;
export const SKERRY_W_MANA = 30;

/** Skerry's W — find the slipstream and run in it. */
export default class Skerry_W extends api.Spell {
  name = 'Lướt Nước';
  image = api.asset('spell_skerry_w');
  description =
    '<span class="buff">Tăng 45% tốc chạy</span> trong <span class="time">2.5 giây</span>.';
  coolDown = SKERRY_W_COOLDOWN_MS;
  manaCost = SKERRY_W_MANA;
  targetingMode = 'SELF' as const;
  static aiRoles = api.enums.SpellRole.Buff | api.enums.SpellRole.Escape;

  onSpellCast(): void {
    haste(this.owner, this.owner, SKERRY_W_HASTE, SKERRY_W_HASTE_MS, 'skerry_w_haste');
    burst(this.owner, this.owner.position, 90, INK.CORAL, 'splash', 320);
  }
}
