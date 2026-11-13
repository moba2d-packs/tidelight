import { api } from '../packApi';
import { aimAt, burst, enemiesAt, slow } from '../world/fx';
import { INK } from '../world/palette';

export const BRINE_E_DISTANCE = 300;
export const BRINE_E_RADIUS = 150;
export const BRINE_E_DAMAGE = 20;
export const BRINE_E_SLOW = 0.4;
export const BRINE_E_SLOW_MS = 1_200;
export const BRINE_E_COOLDOWN_MS = 9_000;
export const BRINE_E_MANA = 40;

/** Brine's E — shoulder through the water and land like a dropped crate. */
export default class Brine_E extends api.Spell {
  name = 'Sóng Xô';
  image = api.asset('spell_brine_e');
  description =
    'Lao tới theo hướng chỉ định. Khi dừng lại, dậm sóng gây <span class="damage">20 sát thương</span> và <span class="buff">làm chậm 40%</span> kẻ địch xung quanh trong <span class="time">1.2 giây</span>.';
  coolDown = BRINE_E_COOLDOWN_MS;
  manaCost = BRINE_E_MANA;
  targetingMode = 'DIRECTION' as const;
  range = BRINE_E_DISTANCE;
  static aiRoles = api.enums.SpellRole.Dash | api.enums.SpellRole.Damage | api.enums.SpellRole.Cc;

  checkCastCondition(): boolean {
    return api.buffs.Dash.CanDash(this.owner);
  }

  onSpellCast(): void {
    const owner = this.owner;
    const dash = new api.buffs.Dash(900, owner, owner);
    dash.image = this.image;
    dash.dashDestination = aimAt(owner, this.aimPoint, BRINE_E_DISTANCE);
    dash.dashSpeed = 17;
    dash.onReachedDestination = () => {
      for (const enemy of enemiesAt(owner, owner.position, BRINE_E_RADIUS)) {
        enemy.takeDamage(BRINE_E_DAMAGE, owner);
        slow(owner, enemy, BRINE_E_SLOW, BRINE_E_SLOW_MS, 'brine_e_slow');
      }
      burst(owner, owner.position, BRINE_E_RADIUS, INK.IRON, 'stomp', 460);
    };
    owner.addBuff(dash);
  }

  drawPreview(): void {
    super.drawPreview(BRINE_E_DISTANCE);
  }
}
