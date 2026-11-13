import { api } from '../packApi';
import { aimWithin, burst, courtOf, enemiesAt, heartOf } from '../world/fx';
import { INK } from '../world/palette';

export const BRINE_R_RANGE = 460;
export const BRINE_R_RADIUS = 230;
export const BRINE_R_DAMAGE = 42;
export const BRINE_R_ROOT_MS = 1_400;
export const BRINE_R_ANCHOR_MS = 5_000;
export const BRINE_R_COOLDOWN_MS = 10_000;
export const BRINE_R_MANA = 90;

/**
 * Brine's R — drop the great anchor. Enemies under it are rooted; a lantern
 * under it is *held*: for five seconds the other court cannot move it, however
 * many of them stand around it.
 */
export default class Brine_R extends api.Spell {
  name = 'Thả Neo';
  image = api.asset('spell_brine_r');
  description =
    'Thả mỏ neo khổng lồ xuống vị trí chỉ định: gây <span class="damage">42 sát thương</span> và <span class="buff">trói chân</span> kẻ địch trong <span class="time">1.4 giây</span>. Nếu Đèn Triều nằm trong vùng neo, đèn bị <span class="buff">ghìm lại</span> — đối phương không thể đẩy nó trong <span class="time">5 giây</span>.';
  coolDown = BRINE_R_COOLDOWN_MS;
  manaCost = BRINE_R_MANA;
  targetingMode = 'POINT' as const;
  range = BRINE_R_RANGE;
  static aiRoles =
    api.enums.SpellRole.Damage | api.enums.SpellRole.Cc | api.enums.SpellRole.Ultimate;

  onSpellCast(): void {
    const owner = this.owner;
    const point = aimWithin(owner, this.aimPoint, BRINE_R_RANGE);
    for (const enemy of enemiesAt(owner, point, BRINE_R_RADIUS)) {
      enemy.takeDamage(BRINE_R_DAMAGE, owner, 'PHYSICAL', this.name);
      enemy.addBuff(new api.buffs.Root(BRINE_R_ROOT_MS, owner, enemy));
    }
    burst(owner, point, BRINE_R_RADIUS, INK.IRON, 'crater', 700);

    const heart = heartOf(owner);
    const court = courtOf(owner);
    if (heart && court) {
      const lantern = heart.lanternPos;
      if (Math.hypot(lantern.x - point.x, lantern.y - point.y) <= BRINE_R_RADIUS) {
        heart.anchor(court, BRINE_R_ANCHOR_MS);
      }
    }
  }

  drawPreview(): void {
    super.drawPreview(BRINE_R_RANGE);
  }
}
