import { api } from '../packApi';
import { burst, enemiesAt } from '../world/fx';
import { INK } from '../world/palette';

export const SKERRY_Q_RADIUS = 175;
export const SKERRY_Q_DAMAGE = 22;
export const SKERRY_Q_COOLDOWN_MS = 5_000;
export const SKERRY_Q_MANA = 25;

/** Skerry's Q — one turn of the shell blades, all the way round. */
export default class Skerry_Q extends api.Spell {
  name = 'Lưỡi Sò';
  image = api.asset('spell_skerry_q');
  description =
    'Xoay một vòng lưỡi sò, gây <span class="damage">22 sát thương</span> cho mọi kẻ địch xung quanh.';
  coolDown = SKERRY_Q_COOLDOWN_MS;
  manaCost = SKERRY_Q_MANA;
  targetingMode = 'SELF' as const;
  static aiRoles = api.enums.SpellRole.Damage;

  onSpellCast(): void {
    const owner = this.owner;
    for (const enemy of enemiesAt(owner, owner.position, SKERRY_Q_RADIUS)) {
      enemy.takeDamage(SKERRY_Q_DAMAGE, owner, 'PHYSICAL', this.name);
    }
    burst(owner, owner.position, SKERRY_Q_RADIUS, INK.CORAL, 'blades', 380);
  }
}
