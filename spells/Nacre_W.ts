import { api } from '../packApi';
import { aimWithin, burst, enemiesAt } from '../world/fx';
import { INK } from '../world/palette';

export const NACRE_W_RANGE = 500;
export const NACRE_W_RADIUS = 115;
export const NACRE_W_DAMAGE = 14;
export const NACRE_W_ROOT_MS = 1_200;
export const NACRE_W_COOLDOWN_MS = 10_000;
export const NACRE_W_MANA = 45;

/** Nacre's W — a bubble that closes over whoever is standing there. */
export default class Nacre_W extends api.Spell {
  name = 'Bong Bóng';
  image = api.asset('spell_nacre_w');
  description =
    'Thổi một bong bóng tại vị trí chỉ định: gây <span class="damage">14 sát thương</span> và <span class="buff">trói chân</span> kẻ địch bên trong trong <span class="time">1.2 giây</span>.';
  coolDown = NACRE_W_COOLDOWN_MS;
  manaCost = NACRE_W_MANA;
  targetingMode = 'POINT' as const;
  range = NACRE_W_RANGE;

  onSpellCast(): void {
    const owner = this.owner;
    const point = aimWithin(owner, this.aimPoint, NACRE_W_RANGE);
    for (const enemy of enemiesAt(owner, point, NACRE_W_RADIUS)) {
      enemy.takeDamage(NACRE_W_DAMAGE, owner, 'PHYSICAL', this.name);
      enemy.addBuff(new api.buffs.Root(NACRE_W_ROOT_MS, owner, enemy));
    }
    burst(owner, point, NACRE_W_RADIUS, INK.PEARL, 'splash', 520);
  }

  drawPreview(): void {
    super.drawPreview(NACRE_W_RANGE);
  }
}
