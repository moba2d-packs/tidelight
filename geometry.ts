import type { MapGeometry } from '@moba2d/core/content/ContentPack';
import {
  BASES,
  BLUE,
  CENTER,
  FACTION_EMBER,
  FACTION_TIDE,
  HEART_ROLE,
  ISLANDS,
  KEEP_STATS,
  KEEPS,
  KELP,
  MAP_SIZE,
  RAIL_Y,
  RED,
  SEA_WALLS,
  WARDENS,
} from './world/layout';

/**
 * Driftglass Reef's heavy half, built from `world/layout.ts` — the same
 * numbers the scenery paints and the rules play on.
 *
 * One lane, straight down the lantern channel: a wave walking it *is* an
 * escort, which is the point. The shoals have no lane; they are the players'
 * to use, and the tide's to take away.
 *
 * No `water` layer and no `zones`: the shoals change state mid-match, and a
 * static speed multiplier baked into the map cannot. The director owns them.
 */
export const geometry: MapGeometry = {
  terrain: {
    wall: [...SEA_WALLS, ...ISLANDS],
    bush: KELP,
    water: [],
  },
  slots: {
    spawn: [
      { faction: FACTION_TIDE, x: BASES[BLUE].x, y: BASES[BLUE].y, r: 150, stats: { shopRange: 420 } },
      { faction: FACTION_EMBER, x: BASES[RED].x, y: BASES[RED].y, r: 150, stats: { shopRange: 420 } },
    ],
    minion: [
      { faction: FACTION_TIDE, lane: 'channel', x: 540, y: RAIL_Y, scatter: 50 },
      { faction: FACTION_EMBER, lane: 'channel', x: MAP_SIZE - 540, y: RAIL_Y, scatter: 50 },
    ],
    structure: [
      { faction: FACTION_TIDE, kind: 'turret', x: WARDENS[BLUE].x, y: WARDENS[BLUE].y },
      { faction: FACTION_EMBER, kind: 'turret', x: WARDENS[RED].x, y: WARDENS[RED].y },
      // Keeps: the harbour's own guns, stronger than any warden (`layout.ts`).
      { faction: FACTION_TIDE, kind: 'turret', x: KEEPS[BLUE].x, y: KEEPS[BLUE].y, stats: { ...KEEP_STATS } },
      { faction: FACTION_EMBER, kind: 'turret', x: KEEPS[RED].x, y: KEEPS[RED].y, stats: { ...KEEP_STATS } },
    ],
    neutral: [{ role: HEART_ROLE, kind: 'object', x: CENTER.x, y: CENTER.y, r: 60 }],
  },
  lanes: [
    {
      id: 'channel',
      from: FACTION_TIDE,
      to: FACTION_EMBER,
      waypoints: [
        { x: BASES[BLUE].x, y: RAIL_Y },
        { x: 700, y: RAIL_Y + 70 },
        { x: 1200, y: RAIL_Y + 70 },
        { x: CENTER.x, y: RAIL_Y + 70 },
        { x: 2000, y: RAIL_Y + 70 },
        { x: 2500, y: RAIL_Y + 70 },
        { x: BASES[RED].x, y: RAIL_Y },
      ],
    },
  ],
};
