import type { MapDefinition, MapGeometry } from '@moba2d/core/content/ContentPack';
import { FACTION_EMBER, FACTION_TIDE } from '../../world/layout';
import { BALL_KELP, BALL_MAP_ID, BALL_ROLE, BLUE, CENTRE, MAP_SIZE, RED, SPAWNS, WALLS } from './layout';
import { REVIVE_MS } from './rules';

/**
 * Bóng Đá Rạn San Hô — a walled pitch, a goal at each end, one pearl.
 * No lanes, no waves, no towers: the only objective is the ball, which lives
 * in the neutral slot below (`pitch.ts`). `art.ts` paints the sandbar, the whale
 * jaws and the kelp, so core's grey fills would only sit under it.
 */
export const geometry: MapGeometry = {
  terrain: { wall: WALLS, bush: BALL_KELP, water: [] },
  slots: {
    spawn: [
      { faction: FACTION_TIDE, x: SPAWNS[BLUE].x, y: SPAWNS[BLUE].y, r: 110, stats: { shopRange: 300 } },
      { faction: FACTION_EMBER, x: SPAWNS[RED].x, y: SPAWNS[RED].y, r: 110, stats: { shopRange: 300 } },
    ],
    minion: [],
    structure: [],
    neutral: [{ role: BALL_ROLE, kind: 'object', x: CENTRE.x, y: CENTRE.y, r: 40 }],
  },
  lanes: [],
};

export const ballMap: MapDefinition = {
  id: BALL_MAP_ID,
  name: 'Bóng Đá Rạn San Hô',
  size: MAP_SIZE,
  factions: [{ id: FACTION_TIDE }, { id: FACTION_EMBER }],
  paintsOwnTerrain: true,
  tuning: {
    champions: { reviveTime: REVIVE_MS },
    economy: { startingGold: 1200, passiveGoldPerSecond: 6 },
    minions: { waves: { composition: [], intervalMs: 3_600_000, firstDelayMs: 3_600_000, liveCap: 0 } },
  },
  geometry: () => Promise.resolve(geometry),
};

