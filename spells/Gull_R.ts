import { api } from '../packApi';
import { burst, courtOf, enemiesAt, heartOf } from '../world/fx';
import { INK } from '../world/palette';

export const GULL_R_TIDE_MS = 8_000;
export const GULL_R_RADIUS = 280;
export const GULL_R_DAMAGE = 30;
export const GULL_R_COOLDOWN_MS = 10_000;
export const GULL_R_MANA = 90;

/**
 * Gull's R — call the tide. For eight seconds it runs for her court whatever
 * the clock says: the current, the shoals, every "with the tide" bonus on the
 * reef. The one ability in the pack that edits the map.
 */
export default class Gull_R extends api.Spell {
  name = 'Gọi Triều';
  image = api.asset('spell_gull_r');
  description =
    'Gọi triều về đội mình trong <span class="time">8 giây</span>: dòng chảy, bãi ngập và mọi hiệu ứng "triều thuận" đều đổi phe (biển chỉ nghe một lần gọi mỗi 28 giây). Cơn gió bùng ra gây <span class="damage">30 sát thương</span> cho kẻ địch quanh Gull.';
  coolDown = GULL_R_COOLDOWN_MS;
  manaCost = GULL_R_MANA;
  targetingMode = 'SELF' as const;
  static aiRoles = api.enums.SpellRole.Damage | api.enums.SpellRole.Ultimate;

  onSpellCast(): void {
    const owner = this.owner;
    const court = courtOf(owner);
    if (court) heartOf(owner)?.overrideTide(court, GULL_R_TIDE_MS);
    for (const enemy of enemiesAt(owner, owner.position, GULL_R_RADIUS)) {
      enemy.takeDamage(GULL_R_DAMAGE, owner, 'MAGIC', this.name);
    }
    burst(owner, owner.position, GULL_R_RADIUS, INK.GALE, 'ring', 700);
  }
}
