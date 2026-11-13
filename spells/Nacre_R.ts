import { api } from '../packApi';
import { aimWithin, burst, enemiesAt, layZone, slow, type TideZone } from '../world/fx';
import { INK } from '../world/palette';

export const NACRE_R_RANGE = 600;
export const NACRE_R_RADIUS = 220;
export const NACRE_R_DAMAGE = 40;
export const NACRE_R_POOL_MS = 3_000;
export const NACRE_R_TICK_MS = 500;
export const NACRE_R_TICK_DAMAGE = 5;
export const NACRE_R_SLOW = 0.25;
export const NACRE_R_COOLDOWN_MS = 10_000;
export const NACRE_R_MANA = 90;

/** Nacre's R — the moon pearl comes down, and leaves a pool where it fell. */
export default class Nacre_R extends api.Spell {
  name = 'Trăng Ngọc';
  image = api.asset('spell_nacre_r');
  description =
    'Gọi viên ngọc trăng rơi xuống vị trí chỉ định, gây <span class="damage">40 sát thương</span>. Để lại một vũng nước trong <span class="time">3 giây</span>, mỗi nửa giây gây <span class="damage">5 sát thương</span> và <span class="buff">làm chậm 25%</span>.';
  coolDown = NACRE_R_COOLDOWN_MS;
  manaCost = NACRE_R_MANA;
  targetingMode = 'POINT' as const;
  range = NACRE_R_RANGE;

  pool: TideZone | null = null;

  onSpellCast(): void {
    const owner = this.owner;
    const point = aimWithin(owner, this.aimPoint, NACRE_R_RANGE);
    for (const enemy of enemiesAt(owner, point, NACRE_R_RADIUS)) {
      enemy.takeDamage(NACRE_R_DAMAGE, owner);
    }
    burst(owner, point, NACRE_R_RADIUS, INK.PEARL, 'crater', 700);
    this.pool = layZone(
      owner,
      point,
      NACRE_R_RADIUS,
      NACRE_R_POOL_MS,
      NACRE_R_TICK_MS,
      target => {
        target.takeDamage(NACRE_R_TICK_DAMAGE, owner);
        slow(owner, target, NACRE_R_SLOW, NACRE_R_TICK_MS * 1.5, 'nacre_r_slow');
      },
      { tint: INK.PEARL, glyph: 'pool' }
    );
  }

  drawPreview(): void {
    super.drawPreview(NACRE_R_RANGE);
  }
}
