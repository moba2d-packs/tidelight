import { api } from '../packApi';
import { aimAt, burst, enemiesAt, slow } from '../world/fx';
import { INK } from '../world/palette';

export const SKERRY_E_DISTANCE = 340;
export const SKERRY_E_RADIUS = 125;
export const SKERRY_E_DAMAGE = 20;
export const SKERRY_E_SLOW = 0.3;
export const SKERRY_E_SLOW_MS = 1_000;
export const SKERRY_E_COOLDOWN_MS = 7_000;
export const SKERRY_E_MANA = 35;

/** Skerry's E — go under and come up cutting. */
export default class Skerry_E extends api.Spell {
  name = 'Xoáy Ngầm';
  image = api.asset('spell_skerry_e');
  description =
    'Lướt ngầm theo hướng chỉ định. Khi trồi lên gây <span class="damage">20 sát thương</span> và <span class="buff">làm chậm 30%</span> kẻ địch quanh điểm đến trong <span class="time">1 giây</span>.';
  coolDown = SKERRY_E_COOLDOWN_MS;
  manaCost = SKERRY_E_MANA;
  targetingMode = 'DIRECTION' as const;
  range = SKERRY_E_DISTANCE;
  static aiRoles = api.enums.SpellRole.Dash | api.enums.SpellRole.Damage;

  checkCastCondition(): boolean {
    return api.buffs.Dash.CanDash(this.owner);
  }

  onSpellCast(): void {
    const owner = this.owner;
    const dash = new api.buffs.Dash(800, owner, owner);
    dash.image = this.image;
    dash.dashDestination = aimAt(owner, this.aimPoint, SKERRY_E_DISTANCE);
    dash.dashSpeed = 22;
    dash.onReachedDestination = () => {
      for (const enemy of enemiesAt(owner, owner.position, SKERRY_E_RADIUS)) {
        enemy.takeDamage(SKERRY_E_DAMAGE, owner);
        slow(owner, enemy, SKERRY_E_SLOW, SKERRY_E_SLOW_MS, 'skerry_e_slow');
      }
      burst(owner, owner.position, SKERRY_E_RADIUS, INK.CORAL, 'splash', 380);
    };
    owner.addBuff(dash);
  }

  drawPreview(): void {
    super.drawPreview(SKERRY_E_DISTANCE);
  }
}
