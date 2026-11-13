import { api } from '../packApi';
import { aimWithin, burst, enemiesAt, slow } from '../world/fx';
import { INK } from '../world/palette';

export const WICK_E_RANGE = 480;
export const WICK_E_RADIUS = 140;
export const WICK_E_DAMAGE = 16;
export const WICK_E_SILENCE_MS = 1_000;
export const WICK_E_SLOW = 0.35;
export const WICK_E_SLOW_MS = 1_500;
export const WICK_E_COOLDOWN_MS = 9_000;
export const WICK_E_MANA = 40;

/** Wick's E — a flash in the eyes: no casting, and not much walking either. */
export default class Wick_E extends api.Spell {
  name = 'Chói Loà';
  image = api.asset('spell_wick_e');
  description =
    'Làm loé sáng tại vị trí chỉ định: gây <span class="damage">16 sát thương</span>, <span class="buff">câm lặng</span> <span class="time">1 giây</span> và <span class="buff">làm chậm 35%</span> trong <span class="time">1.5 giây</span>.';
  coolDown = WICK_E_COOLDOWN_MS;
  manaCost = WICK_E_MANA;
  targetingMode = 'POINT' as const;
  range = WICK_E_RANGE;

  onSpellCast(): void {
    const owner = this.owner;
    const point = aimWithin(owner, this.aimPoint, WICK_E_RANGE);
    for (const enemy of enemiesAt(owner, point, WICK_E_RADIUS)) {
      enemy.takeDamage(WICK_E_DAMAGE, owner);
      enemy.addBuff(new api.buffs.Silence(WICK_E_SILENCE_MS, owner, enemy));
      slow(owner, enemy, WICK_E_SLOW, WICK_E_SLOW_MS, 'wick_e_slow');
    }
    burst(owner, point, WICK_E_RADIUS, INK.LANTERN_HOT, 'shards', 480);
  }

  drawPreview(): void {
    super.drawPreview(WICK_E_RANGE);
  }
}
