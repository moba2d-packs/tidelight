import { api } from '../packApi';
import { fireBolt, slow, type PaperBolt } from '../world/fx';
import { INK } from '../world/palette';

export const GULL_Q_DAMAGE = 20;
export const GULL_Q_RANGE = 640;
export const GULL_Q_SLOW = 0.3;
export const GULL_Q_SLOW_MS = 1_500;
export const GULL_Q_COOLDOWN_MS = 6_000;
export const GULL_Q_MANA = 30;

/** Gull's Q — a gust with an edge on it. */
export default class Gull_Q extends api.Spell {
  name = 'Gió Giật';
  image = api.asset('spell_gull_q');
  description =
    'Phóng một luồng gió theo hướng chỉ định, gây <span class="damage">20 sát thương</span> và <span class="buff">làm chậm 30%</span> kẻ địch đầu tiên trong <span class="time">1.5 giây</span>.';
  coolDown = GULL_Q_COOLDOWN_MS;
  manaCost = GULL_Q_MANA;
  targetingMode = 'DIRECTION' as const;
  range = GULL_Q_RANGE;

  live: PaperBolt | null = null;

  onSpellCast(): void {
    const owner = this.owner;
    this.live = fireBolt(owner, this.aimPoint, GULL_Q_RANGE, {
      damage: GULL_Q_DAMAGE,
      speed: 16,
      size: 24,
      tint: INK.GALE,
      shape: 'gust',
      afterHit: target => slow(owner, target, GULL_Q_SLOW, GULL_Q_SLOW_MS, 'gull_q_slow'),
    });
  }

  drawPreview(): void {
    super.drawPreview(api.combat.Reach.effectiveRange(this.range, this.owner));
  }
}
