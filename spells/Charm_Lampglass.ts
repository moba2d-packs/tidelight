import { api } from '../packApi';
import { burst, inGlow } from '../world/fx';
import { charmKit } from '../world/charms';
import { INK } from '../world/palette';

export const LAMPGLASS_SHIELD = 22;
export const LAMPGLASS_GLOW_SHIELD = 36;
export const LAMPGLASS_DURATION_MS = 2_500;
export const LAMPGLASS_COOLDOWN_MS = 12_000;

/**
 * A sea charm (the D/F shelf): a pane of the Lantern's own glass. A small
 * shield anywhere, a real one for whoever is standing in the Lantern's light —
 * the escort's answer to being dived.
 */
export default class Charm_Lampglass extends api.Spell {
  name = 'Kính Đèn';
  image = api.asset('charm_lampglass');
  description =
    'Nhận <span class="buff">Lá Chắn 22</span> trong <span class="time">2.5 giây</span>. Đứng trong quầng sáng Đèn Triều, lá chắn là <span class="buff">36</span>.';
  coolDown = LAMPGLASS_COOLDOWN_MS;
  manaCost = 0;
  targetingMode = 'SELF' as const;
  static aiRoles = api.enums.SpellRole.Shield;

  onSpellCast(): void {
    const owner = this.owner;
    const shield = new api.buffs.Shield(LAMPGLASS_DURATION_MS, owner, owner);
    shield.amount = inGlow(owner) ? LAMPGLASS_GLOW_SHIELD : LAMPGLASS_SHIELD;
    shield.image = this.image;
    shield.stackId = 'charm_lampglass';
    owner.addBuff(shield);
    burst(owner, owner.position, 100, INK.LANTERN, 'ring', 340);
  }
}

charmKit.f = Charm_Lampglass;
