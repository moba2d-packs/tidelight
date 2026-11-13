import type { ChampionAI } from '@moba2d/core/content/ContentPack';
import { DEFEND_MAP_ID, LANTERN } from './layout';
import { dist, liveRaiders } from './lantern';
import { onMap } from '../onMap';

/** Bots never wander further than this from the lantern. */
export const DEFEND_RADIUS = 650;
/** A raider this close to a bot is worth fighting; anything further is not. */
export const ENGAGE_RADIUS = 600;

/**
 * Pure answer to "what should a bot do this tick on Thủ Đèn", so the test can
 * drive it without a brain. `undefined` keeps the shared brain's own choice.
 */
export function defendPosture(
  suggested: string,
  bot: { x: number; y: number },
  raiders: { x: number; y: number }[]
): string | undefined {
  // Fights, retreats and recoveries are already the right answer: a hurt bot
  // walks to the nearest friendly turret, which on this map is the lantern.
  if (!['PUSH', 'FARM', 'OBJECTIVE', 'ROAM'].includes(suggested)) return undefined;
  if (dist(bot, LANTERN) > DEFEND_RADIUS) return 'RETREAT';
  if (suggested === 'ROAM') return undefined;
  // PUSH/FARM/OBJECTIVE walk toward the enemy side. Only keep PUSH (which also
  // swings at the wave) while a raider is actually close.
  return raiders.some(r => dist(bot, r) <= ENGAGE_RADIUS) ? 'PUSH' : 'ROAM';
}

/** One opinion for every Tidelight champion; it does nothing off this map. */
export const defendAI: ChampionAI = {
  posture(context, suggested) {
    const game: any = context.owner.game;
    if (!onMap(game, DEFEND_MAP_ID)) return undefined;
    return defendPosture(suggested, context.owner.position, liveRaiders(game).map(m => m.position)) as any;
  },
};
