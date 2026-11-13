import { api } from '../packApi';
import { burst, courtOf, enemiesAt, heartOf } from '../world/fx';
import { INK } from '../world/palette';

export const WICK_R_RADIUS = 300;
export const WICK_R_DAMAGE = 40;
export const WICK_R_KICK = 150;
export const WICK_R_COOLDOWN_MS = 10_000;
export const WICK_R_MANA = 90;

/**
 * Wick's R — the lamp flares like a small sun. It burns what is near, and if
 * the lantern itself is in the light, the flare *shoves it* down the rail.
 */
export default class Wick_R extends api.Spell {
  name = 'Lửa Mặt Trời';
  image = api.asset('spell_wick_r');
  description =
    'Bùng cháy quanh mình, gây <span class="damage">40 sát thương</span> cho kẻ địch xung quanh. Nếu Đèn Triều ở trong vùng lửa, đèn bị <span class="buff">hất mạnh một đoạn</span> về phía bến đối phương.';
  coolDown = WICK_R_COOLDOWN_MS;
  manaCost = WICK_R_MANA;
  targetingMode = 'SELF' as const;
  static aiRoles =
    api.enums.SpellRole.Damage | api.enums.SpellRole.Burst | api.enums.SpellRole.Ultimate;

  onSpellCast(): void {
    const owner = this.owner;
    for (const enemy of enemiesAt(owner, owner.position, WICK_R_RADIUS)) {
      enemy.takeDamage(WICK_R_DAMAGE, owner);
    }
    burst(owner, owner.position, WICK_R_RADIUS, INK.LANTERN, 'flame', 700);

    const heart = heartOf(owner);
    const court = courtOf(owner);
    if (!heart || !court) return;
    const lantern = heart.lanternPos;
    if (Math.hypot(lantern.x - owner.position.x, lantern.y - owner.position.y) <= WICK_R_RADIUS) {
      heart.kick(court, WICK_R_KICK);
      burst(owner, heart.lanternPos, 140, INK.LANTERN_HOT, 'ring', 500);
    }
  }
}
