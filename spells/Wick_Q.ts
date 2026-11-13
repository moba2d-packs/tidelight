import { api } from '../packApi';
import { alliesAt, burst, fireBolt, type PaperBolt } from '../world/fx';
import { INK } from '../world/palette';

export const WICK_Q_DAMAGE = 18;
export const WICK_Q_RANGE = 560;
export const WICK_Q_HEAL = 12;
export const WICK_Q_HEAL_RADIUS = 360;
export const WICK_Q_COOLDOWN_MS = 5_000;
export const WICK_Q_MANA = 30;

/** Wick's Q — one spark out, and a little warmth back for whoever nearby needs it most. */
export default class Wick_Q extends api.Spell {
  name = 'Tia Lửa';
  image = api.asset('spell_wick_q');
  description =
    'Búng một tia lửa theo hướng chỉ định, gây <span class="damage">18 sát thương</span> cho kẻ địch đầu tiên. Đồng thời hồi <span class="heal">12 máu</span> cho đồng minh yếu nhất ở gần (kể cả Wick).';
  coolDown = WICK_Q_COOLDOWN_MS;
  manaCost = WICK_Q_MANA;
  targetingMode = 'DIRECTION' as const;
  range = WICK_Q_RANGE;

  live: PaperBolt | null = null;

  onSpellCast(): void {
    const owner = this.owner;
    this.live = fireBolt(owner, this.aimPoint, WICK_Q_RANGE, {
      damage: WICK_Q_DAMAGE,
      speed: 14,
      size: 22,
      tint: INK.LANTERN,
      shape: 'spark',
    });

    const missing = (unit: typeof owner): number =>
      unit.stats.maxHealth.value - unit.stats.health.value;
    const neediest = alliesAt(owner, owner.position, WICK_Q_HEAL_RADIUS).sort(
      (a, b) => missing(b) - missing(a)
    )[0];
    if (neediest) {
      neediest.takeHeal(WICK_Q_HEAL, owner);
      burst(owner, neediest.position, 70, INK.LANTERN, 'ring', 320);
    }
  }

  drawPreview(): void {
    super.drawPreview(api.combat.Reach.effectiveRange(this.range, this.owner));
  }
}
