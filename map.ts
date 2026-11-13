import type { MapDefinition } from '@moba2d/core/content/ContentPack';
import { FACTION_EMBER, FACTION_TIDE, MAP_SIZE } from './world/layout';

/**
 * Driftglass Reef — the cheap half a pregame picker lists. The polygons are in
 * `./geometry.ts`, behind a dynamic import.
 *
 * The tuning is what makes a match here short: one small wave at a time, a
 * warden tower that is a lock on a gate rather than a wall, and respawns that
 * start quick and stretch as the match does, so a late wipe is the opening the
 * lantern needs.
 */
export const map: MapDefinition = {
  id: 'driftglass',
  name: 'Rạn Driftglass',
  size: MAP_SIZE,
  // Order is the team bridge: [0] is blue (the Tide Court), [1] red (the Ember Court).
  factions: [{ id: FACTION_TIDE }, { id: FACTION_EMBER }],
  // `world/scenery.ts` paints every wall and kelp bed; core's grey fills under
  // it were a whole extra layer of overdraw.
  paintsOwnTerrain: true,
  tuning: {
    champions: { reviveCurve: { base: 5_000, perMinute: 1_500, max: 12_000 } },
    // Wardens neither repair nor rebuild: a gate that has been opened stays
    // open, and damage done by holding the lantern on it is never wasted.
    turrets: {
      health: 320,
      damage: 20,
      attackRange: 400,
      attackInterval: 1_100,
      repairRate: 0,
      rebuildTime: 3_600_000,
    },
    minions: {
      waves: {
        composition: ['melee', 'melee', 'ranged'],
        intervalMs: 20_000,
        firstDelayMs: 9_000,
        liveCap: 18,
      },
    },
    economy: { startingGold: 600, passiveGoldPerSecond: 4 },
  },
  geometry: () => import('./geometry').then(module => module.geometry),
};
