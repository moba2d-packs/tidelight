import { api } from '../packApi';
import { fireBolt, tideIsWith, type PaperBolt } from '../world/fx';
import { INK } from '../world/palette';

export const NACRE_Q_DAMAGE = 24;
export const NACRE_Q_RANGE = 620;
export const NACRE_Q_COOLDOWN_MS = 5_000;
export const NACRE_Q_MANA = 25;

/** Nacre's Q — a pearl shot. With the tide behind it, it does not stop at the first body. */
export default class Nacre_Q extends api.Spell {
  name = 'Ngọc Bắn';
  image = api.asset('spell_nacre_q');
  description =
    'Bắn một viên ngọc theo hướng chỉ định, gây <span class="damage">24 sát thương</span> cho kẻ địch đầu tiên. Khi <span class="buff">triều thuận</span> về đội mình, viên ngọc <span class="buff">xuyên qua</span> mọi kẻ địch.';
  coolDown = NACRE_Q_COOLDOWN_MS;
  manaCost = NACRE_Q_MANA;
  targetingMode = 'DIRECTION' as const;
  range = NACRE_Q_RANGE;

  live: PaperBolt | null = null;

  onSpellCast(): void {
    const piercing = tideIsWith(this.owner);
    this.live = fireBolt(this.owner, this.aimPoint, NACRE_Q_RANGE, {
      damage: NACRE_Q_DAMAGE,
      speed: 14,
      size: piercing ? 28 : 22,
      maxHitCount: piercing ? Infinity : 1,
      tint: INK.PEARL,
      shape: 'pearl',
    });
  }

  drawPreview(): void {
    super.drawPreview(api.combat.Reach.effectiveRange(this.range, this.owner));
  }
}
