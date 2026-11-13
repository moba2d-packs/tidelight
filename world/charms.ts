/**
 * The two sea charms, by slot — filled in by the charm spells themselves when
 * they load, read by the Heart when it hands them out.
 *
 * A registry rather than an import because the Heart cannot import a spell:
 * every spell reaches the Heart through `fx.ts`, and a cycle between modules
 * whose top level is `class … extends api.Spell` is a load-order bug waiting
 * for a bundler to pick the other order.
 */
type CharmClass = new (owner: any) => any;

export const charmKit: { d?: CharmClass; f?: CharmClass } = {};

/** Kit slots core gives the two summoner keys (after A, Q, W, E, R). */
export const SLOT_D = 5;
export const SLOT_F = 6;

/**
 * On Driftglass Reef everyone carries the two charms: core has one D/F shelf
 * for the whole install, so with another pack's shelf in front of this one —
 * or with a saved choice this pack does not have — a hero would otherwise
 * arrive with someone else's spells, or with one charm in both slots. A hero
 * who already carries both, in either order, is left alone.
 */
export const issueCharms = (champion: any): void => {
  const { d, f } = charmKit;
  if (!d || !f || !Array.isArray(champion.spells) || champion.spells.length <= SLOT_F) return;
  const isD = (spell: unknown): boolean => spell instanceof d;
  const isF = (spell: unknown): boolean => spell instanceof f;
  const atD = champion.spells[SLOT_D];
  const atF = champion.spells[SLOT_F];
  if ((isD(atD) && isF(atF)) || (isF(atD) && isD(atF))) return;
  if (isD(atD)) champion.replaceSpell(SLOT_F, new f(champion));
  else if (isF(atD)) champion.replaceSpell(SLOT_F, new d(champion));
  else if (isD(atF)) champion.replaceSpell(SLOT_D, new f(champion));
  else if (isF(atF)) champion.replaceSpell(SLOT_D, new d(champion));
  else {
    champion.replaceSpell(SLOT_D, new d(champion));
    champion.replaceSpell(SLOT_F, new f(champion));
  }
};
