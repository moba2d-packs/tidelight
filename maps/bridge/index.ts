import type { MapDefinition } from '@moba2d/core/content/ContentPack';
import { FACTION_EMBER, FACTION_TIDE, MAP_SIZE } from '../../world/layout';

/** Cầu Sập — the cheap half a picker lists; polygons load lazily from `./geometry`. */
export const bridgeMap: MapDefinition = {
  id: 'bridge',
  name: 'Cầu Sập',
  size: MAP_SIZE,
  factions: [{ id: FACTION_TIDE }, { id: FACTION_EMBER }],
  // `./art.ts` paints the canyon, cliffs and shore; the bridges are `BridgeSpan`s drawn live.
  paintsOwnTerrain: true,
  tuning: {
    champions: { reviveCurve: { base: 5_000, perMinute: 1_500, max: 12_000 } },
    turrets: { health: 320, damage: 20, attackRange: 400, attackInterval: 1_100, repairRate: 0, rebuildTime: 3_600_000 },
    minions: {
      waves: {
        composition: ['melee', 'melee', 'ranged'],
        intervalMs: 22_000,
        firstDelayMs: 9_000,
        liveCap: 18,
      },
    },
    economy: { startingGold: 600, passiveGoldPerSecond: 4 },
  },
  geometry: () => import('./geometry').then(module => module.geometry),
};
