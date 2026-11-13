import { api } from '../packApi';
import { aimWithin, burst, enemiesAt } from '../world/fx';
import { INK } from '../world/palette';

export const SKERRY_R_RANGE = 520;
export const SKERRY_R_RADIUS = 180;
export const SKERRY_R_DAMAGE = 48;
export const SKERRY_R_STUN_MS = 800;
export const SKERRY_R_COOLDOWN_MS = 10_000;
export const SKERRY_R_MANA = 90;

/** Skerry's R — breach: out of the water in an arc, down on the spot you chose. */
export default class Skerry_R extends api.Spell {
  name = 'Phá Rạn';
  image = api.asset('spell_skerry_r');
  description =
    'Phóng vọt lên rồi lao xuống vị trí chỉ định, gây <span class="damage">48 sát thương</span> và <span class="buff">làm choáng</span> kẻ địch quanh đó trong <span class="time">0.8 giây</span>.';
  coolDown = SKERRY_R_COOLDOWN_MS;
  manaCost = SKERRY_R_MANA;
  targetingMode = 'POINT' as const;
  range = SKERRY_R_RANGE;
  static aiRoles =
    api.enums.SpellRole.Dash |
    api.enums.SpellRole.Damage |
    api.enums.SpellRole.Burst |
    api.enums.SpellRole.Cc |
    api.enums.SpellRole.Ultimate;

  checkCastCondition(): boolean {
    return api.buffs.Dash.CanDash(this.owner);
  }

  onSpellCast(): void {
    const owner = this.owner;
    const dash = new api.buffs.Dash(900, owner, owner);
    dash.image = this.image;
    dash.dashDestination = aimWithin(owner, this.aimPoint, SKERRY_R_RANGE);
    dash.dashSpeed = 26;
    dash.onReachedDestination = () => {
      for (const enemy of enemiesAt(owner, owner.position, SKERRY_R_RADIUS)) {
        enemy.takeDamage(SKERRY_R_DAMAGE, owner, 'PHYSICAL', this.name);
        enemy.addBuff(new api.buffs.Stun(SKERRY_R_STUN_MS, owner, enemy));
      }
      burst(owner, owner.position, SKERRY_R_RADIUS, INK.CORAL, 'crater', 620);
    };
    owner.addBuff(dash);
  }

  drawPreview(): void {
    super.drawPreview(SKERRY_R_RANGE);
  }
}
