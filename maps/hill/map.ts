import type { MapDefinition } from '@moba2d/core/content/ContentPack';
import { FACTION_EMBER, FACTION_TIDE } from '../../world/layout';
import { HILL_MAP_ID, HILL_MAP_SIZE } from './layout';

/** Vua Đảo — the cheap half a picker lists. Polygons are in `./geometry.ts`. */
export const hillMap: MapDefinition = {
  id: HILL_MAP_ID,
  name: 'Vua Đảo',
  size: HILL_MAP_SIZE,
  factions: [{ id: FACTION_TIDE }, { id: FACTION_EMBER }],
  // `./art.ts` paints the atoll, the ruins and the kelp; core's grey fills would only sit under it. The hill object draws its ring on top.
  paintsOwnTerrain: true,
  tuning: {
    champions: { reviveCurve: { base: 5_000, perMinute: 1_500, max: 12_000 } },
    minions: {
      waves: { composition: ['melee', 'ranged'], intervalMs: 20_000, firstDelayMs: 9_000, liveCap: 12 },
    },
    economy: { startingGold: 600, passiveGoldPerSecond: 4 },
  },
  geometry: () => import('./geometry').then(module => module.hillGeometry),
};
