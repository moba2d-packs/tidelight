import type { MapDefinition } from '@moba2d/core/content/ContentPack';
import { FACTION_EMBER, FACTION_TIDE, MAP_SIZE } from '../../world/layout';

/** Đảo Cổng — the cheap half a picker lists; polygons load lazily from `./geometry`. */
export const portalsMap: MapDefinition = {
  id: 'portals',
  name: 'Đảo Cổng',
  size: MAP_SIZE,
  factions: [{ id: FACTION_TIDE }, { id: FACTION_EMBER }],
  // The reef art layer (`./art.ts`) paints the four biomes and the crag; the arena object adds the whirlpools on top.
  paintsOwnTerrain: true,
  tuning: {
    champions: { reviveCurve: { base: 5_000, perMinute: 1_500, max: 12_000 } },
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
