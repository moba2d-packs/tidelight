import type { MapDefinition, MapGeometry } from '@moba2d/core/content/ContentPack';
import { FACTION_EMBER, FACTION_TIDE } from '../../world/layout';
import { DUEL_KELP, DUEL_MAP_ID, DUEL_ROLE, DUEL_SIZE, DUEL_SPAWNS, DUEL_WALLS } from './layout';

/** Longer than any round: a fallen hero stays down until the next round resets everyone. */
export const NO_REVIVE_MS = 3_600_000;

export const map: MapDefinition = {
  id: DUEL_MAP_ID,
  name: 'Vòng Đấu Tay Đôi',
  size: DUEL_SIZE,
  factions: [{ id: FACTION_TIDE }, { id: FACTION_EMBER }],
  // `./art.ts` paints the terraces, the clam and the kelp; core's grey fills would only sit under it.
  paintsOwnTerrain: true,
  tuning: {
    champions: { reviveCurve: { base: NO_REVIVE_MS, perMinute: 0, max: NO_REVIVE_MS } },
    economy: { startingGold: 600, passiveGoldPerSecond: 0 },
  },
  geometry: () => Promise.resolve(geometry),
};

export const geometry: MapGeometry = {
  terrain: { wall: DUEL_WALLS, bush: DUEL_KELP, water: [] },
  slots: {
    spawn: [
      { faction: FACTION_TIDE, x: DUEL_SPAWNS.blue.x, y: DUEL_SPAWNS.blue.y, r: 90, stats: { shopRange: 260 } },
      { faction: FACTION_EMBER, x: DUEL_SPAWNS.red.x, y: DUEL_SPAWNS.red.y, r: 90, stats: { shopRange: 260 } },
    ],
    minion: [],
    structure: [],
    neutral: [{ role: DUEL_ROLE, kind: 'object', x: DUEL_SIZE / 2, y: DUEL_SIZE / 2, r: 40 }],
  },
};
