import type { MapDefinition } from '@moba2d/core/content/ContentPack';
import { FACTION_EMBER, FACTION_TIDE } from '../../world/layout';
import { MAZE_MAP_ID, MAZE_SIZE } from './layout';

export const map: MapDefinition = {
  id: MAZE_MAP_ID,
  name: 'Mê Cung Rong',
  size: MAZE_SIZE,
  factions: [{ id: FACTION_TIDE }, { id: FACTION_EMBER }],
  // `./art.ts` paints every wall and kelp bed (the shipwreck graveyard); core's grey fills would only sit under it.
  paintsOwnTerrain: true,
  tuning: {
    champions: { reviveCurve: { base: 6_000, perMinute: 1_500, max: 14_000 } },
    turrets: { health: 360, damage: 22, attackRange: 380, attackInterval: 1_100, repairRate: 0, rebuildTime: 3_600_000 },
    minions: {
      waves: { composition: ['melee', 'melee', 'ranged'], intervalMs: 22_000, firstDelayMs: 8_000, liveCap: 12 },
    },
    economy: { startingGold: 600, passiveGoldPerSecond: 4 },
  },
  geometry: () => import('./geometry').then(module => module.geometry),
};
