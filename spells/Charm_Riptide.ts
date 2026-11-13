import { api } from '../packApi';
import { aimAt, burst, tideIsWith } from '../world/fx';
import { charmKit } from '../world/charms';
import { INK } from '../world/palette';

export const RIPTIDE_DISTANCE = 240;
export const RIPTIDE_TIDE_DISTANCE = 360;
export const RIPTIDE_COOLDOWN_MS = 12_000;

/**
 * A sea charm (the D/F shelf): a short ride on the undertow. It costs nothing
 * and belongs to no hero, so it is the one escape everyone has — and it goes
 * half as far again while the tide is running your way.
 */
export default class Charm_Riptide extends api.Spell {
  name = 'Sóng Rút';
  image = api.asset('charm_riptide');
  description =
    'Cưỡi dòng nước lướt một đoạn ngắn theo hướng chỉ định. Khi <span class="buff">triều thuận</span>, lướt xa hơn 50%.';
  coolDown = RIPTIDE_COOLDOWN_MS;
  manaCost = 0;
  targetingMode = 'DIRECTION' as const;
  range = RIPTIDE_TIDE_DISTANCE;
  static aiRoles = api.enums.SpellRole.Dash | api.enums.SpellRole.Escape;

  private reach(): number {
    return tideIsWith(this.owner) ? RIPTIDE_TIDE_DISTANCE : RIPTIDE_DISTANCE;
  }

  checkCastCondition(): boolean {
    return api.buffs.Dash.CanDash(this.owner);
  }

  onSpellCast(): void {
    const owner = this.owner;
    burst(owner, owner.position, 70, INK.WATER, 'splash', 300);
    const dash = new api.buffs.Dash(700, owner, owner);
    dash.image = this.image;
    dash.dashDestination = aimAt(owner, this.aimPoint, this.reach());
    dash.dashSpeed = 24;
    dash.onReachedDestination = () => burst(owner, owner.position, 70, INK.WATER, 'splash', 300);
    owner.addBuff(dash);
  }

  drawPreview(): void {
    super.drawPreview(this.reach());
  }
}

charmKit.d = Charm_Riptide;
