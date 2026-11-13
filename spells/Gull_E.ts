import { api } from '../packApi';
import { aimWithin, layZone, slow, type TideZone } from '../world/fx';
import { INK } from '../world/palette';

export const GULL_E_RANGE = 520;
export const GULL_E_RADIUS = 190;
export const GULL_E_LIFE_MS = 3_000;
export const GULL_E_TICK_MS = 500;
export const GULL_E_TICK_DAMAGE = 5;
export const GULL_E_SLOW = 0.3;
export const GULL_E_COOLDOWN_MS = 10_000;
export const GULL_E_MANA = 45;

/** Gull's E — a squall that sits where you put it. Best put on the lantern. */
export default class Gull_E extends api.Spell {
  name = 'Vùng Bão';
  image = api.asset('spell_gull_e');
  description =
    'Gọi một vùng bão tại vị trí chỉ định trong <span class="time">3 giây</span>. Mỗi nửa giây gây <span class="damage">5 sát thương</span> và <span class="buff">làm chậm 30%</span> kẻ địch bên trong.';
  coolDown = GULL_E_COOLDOWN_MS;
  manaCost = GULL_E_MANA;
  targetingMode = 'POINT' as const;
  range = GULL_E_RANGE;

  zone: TideZone | null = null;

  onSpellCast(): void {
    const owner = this.owner;
    const point = aimWithin(owner, this.aimPoint, GULL_E_RANGE);
    this.zone = layZone(
      owner,
      point,
      GULL_E_RADIUS,
      GULL_E_LIFE_MS,
      GULL_E_TICK_MS,
      target => {
        target.takeDamage(GULL_E_TICK_DAMAGE, owner, 'MAGIC', this.name);
        slow(owner, target, GULL_E_SLOW, GULL_E_TICK_MS * 1.5, 'gull_e_slow');
      },
      { tint: INK.GALE, glyph: 'storm' }
    );
  }

  drawPreview(): void {
    super.drawPreview(GULL_E_RANGE);
  }
}
