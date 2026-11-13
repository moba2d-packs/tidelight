import { api } from '../packApi';
import { aimAt, burst, haste } from '../world/fx';
import { INK } from '../world/palette';

export const NACRE_E_DISTANCE = 320;
export const NACRE_E_HASTE = 0.3;
export const NACRE_E_HASTE_MS = 1_500;
export const NACRE_E_COOLDOWN_MS = 9_000;
export const NACRE_E_MANA = 35;

/** Nacre's E — dive, surface somewhere else, and keep swimming. */
export default class Nacre_E extends api.Spell {
  name = 'Lặn Sâu';
  image = api.asset('spell_nacre_e');
  description =
    'Lặn một đoạn theo hướng chỉ định, sau đó được <span class="buff">tăng 30% tốc chạy</span> trong <span class="time">1.5 giây</span>.';
  coolDown = NACRE_E_COOLDOWN_MS;
  manaCost = NACRE_E_MANA;
  targetingMode = 'DIRECTION' as const;
  range = NACRE_E_DISTANCE;
  static aiRoles = api.enums.SpellRole.Dash | api.enums.SpellRole.Escape;

  checkCastCondition(): boolean {
    return api.buffs.Dash.CanDash(this.owner);
  }

  onSpellCast(): void {
    const owner = this.owner;
    burst(owner, owner.position, 80, INK.PEARL, 'splash', 320);
    const dash = new api.buffs.Dash(900, owner, owner);
    dash.image = this.image;
    dash.dashDestination = aimAt(owner, this.aimPoint, NACRE_E_DISTANCE);
    dash.dashSpeed = 19;
    dash.onReachedDestination = () => {
      haste(owner, owner, NACRE_E_HASTE, NACRE_E_HASTE_MS, 'nacre_e_haste');
      burst(owner, owner.position, 80, INK.PEARL, 'splash', 320);
    };
    owner.addBuff(dash);
  }

  drawPreview(): void {
    super.drawPreview(NACRE_E_DISTANCE);
  }
}
