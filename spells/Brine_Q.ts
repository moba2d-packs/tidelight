import { api } from '../packApi';
import { fireBolt, slow, type PaperBolt } from '../world/fx';
import { INK } from '../world/palette';

export const BRINE_Q_DAMAGE = 18;
export const BRINE_Q_RANGE = 520;
export const BRINE_Q_PULL = 190;
export const BRINE_Q_SLOW = 0.3;
export const BRINE_Q_SLOW_MS = 1_200;
export const BRINE_Q_COOLDOWN_MS = 8_000;
export const BRINE_Q_MANA = 30;

/** Brine's Q — throw the hook; the first enemy it bites is hauled toward him. */
export default class Brine_Q extends api.Spell {
  name = 'Neo Móc';
  image = api.asset('spell_brine_q');
  description =
    'Ném móc neo theo hướng chỉ định. Kẻ địch đầu tiên trúng phải nhận <span class="damage">18 sát thương</span>, bị <span class="buff">kéo về phía Brine</span> và <span class="buff">làm chậm 30%</span> trong <span class="time">1.2 giây</span>.';
  coolDown = BRINE_Q_COOLDOWN_MS;
  manaCost = BRINE_Q_MANA;
  targetingMode = 'DIRECTION' as const;
  range = BRINE_Q_RANGE;
  static aiRoles = api.enums.SpellRole.Damage | api.enums.SpellRole.Cc | api.enums.SpellRole.Poke;

  live: PaperBolt | null = null;

  onSpellCast(): void {
    const owner = this.owner;
    this.live = fireBolt(owner, this.aimPoint, BRINE_Q_RANGE, {
      damage: BRINE_Q_DAMAGE,
      speed: 15,
      size: 26,
      tint: INK.IRON,
      shape: 'hook',
      afterHit: target => {
        slow(owner, target, BRINE_Q_SLOW, BRINE_Q_SLOW_MS, 'brine_q_slow');
        if (!api.buffs.Dash.CanDash(target)) return;
        const gap = Math.hypot(target.position.x - owner.position.x, target.position.y - owner.position.y);
        const haul = Math.min(BRINE_Q_PULL, Math.max(0, gap - 90));
        if (haul <= 0) return;
        const pull = new api.buffs.Dash(600, owner, target);
        pull.dashSpeed = 14;
        pull.dashDestination = api.utils.VectorUtils.getVectorWithRange(
          target.position,
          owner.position,
          haul
        ).to;
        target.addBuff(pull);
      },
    });
  }

  drawPreview(): void {
    super.drawPreview(api.combat.Reach.effectiveRange(this.range, this.owner));
  }
}
