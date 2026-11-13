import { api } from '../packApi';
import { burst, inGlow } from '../world/fx';
import { INK } from '../world/palette';

export const BRINE_W_SHIELD = 26;
export const BRINE_W_GLOW_SHIELD = 42;
export const BRINE_W_DURATION_MS = 3_000;
export const BRINE_W_COOLDOWN_MS = 11_000;
export const BRINE_W_MANA = 40;

/** Brine's W — a shield that is worth more where it matters: beside the lantern. */
export default class Brine_W extends api.Spell {
  name = 'Dằn Thuyền';
  image = api.asset('spell_brine_w');
  description =
    'Nhận <span class="buff">Lá Chắn 26</span> trong <span class="time">3 giây</span>. Nếu đang đứng trong quầng sáng Đèn Triều, lá chắn tăng lên <span class="buff">42</span>.';
  coolDown = BRINE_W_COOLDOWN_MS;
  manaCost = BRINE_W_MANA;
  targetingMode = 'SELF' as const;
  static aiRoles = api.enums.SpellRole.Shield;

  onSpellCast(): void {
    const owner = this.owner;
    const shield = new api.buffs.Shield(BRINE_W_DURATION_MS, owner, owner);
    shield.amount = inGlow(owner) ? BRINE_W_GLOW_SHIELD : BRINE_W_SHIELD;
    shield.image = this.image;
    shield.stackId = 'brine_w_shield';
    owner.addBuff(shield);
    burst(owner, owner.position, 110, INK.IRON, 'ring', 360);
  }
}
