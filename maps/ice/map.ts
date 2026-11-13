import type { MapDefinition } from '@moba2d/core/content/ContentPack';
import { FACTION_EMBER, FACTION_TIDE } from '../../world/layout';
import { ICE_MAP_ID, ICE_SIZE, ICE_TUNING } from './layout';

/** Mặt Băng — the cheap half a picker lists; polygons load lazily from `./geometry`. */
export const map: MapDefinition = {
  id: ICE_MAP_ID,
  name: 'Mặt Băng',
  size: ICE_SIZE,
  factions: [{ id: FACTION_TIDE }, { id: FACTION_EMBER }],
  // `./art.ts` paints the sea, the floes, the ridges and the reeds; core's grey fills would only sit under it.
  paintsOwnTerrain: true,
  // Ground that keeps its momentum: only the polygons of the geometry's `floes` zone (not `everywhere`).
  ice: { ...ICE_TUNING },
  tuning: {
    champions: { reviveCurve: { base: 5_000, perMinute: 1_500, max: 12_000 } },
    turrets: { health: 360, damage: 22, attackRange: 380, attackInterval: 1_100, repairRate: 0, rebuildTime: 3_600_000 },
    minions: {
      waves: { composition: ['melee', 'melee', 'ranged'], intervalMs: 22_000, firstDelayMs: 9_000, liveCap: 14 },
    },
    economy: { startingGold: 600, passiveGoldPerSecond: 4 },
  },
  geometry: () => import('./geometry').then(module => module.geometry),
};
