import type { MapGeometry } from '@moba2d/core/content/ContentPack';
import { FACTION_EMBER, FACTION_TIDE } from '../../world/layout';
import {
  HILL_BASES,
  HILL_ISLANDS,
  HILL_KELP,
  HILL_MAP_SIZE,
  HILL_MID_Y,
  HILL_ROLE,
  HILL_TURRETS,
  HILL_WALLS,
} from './layout';

/** Vua Đảo's walls, kelp, spawns, one lane around the centre rock, one tower a side. */
export const hillGeometry: MapGeometry = {
  terrain: { wall: HILL_WALLS, bush: HILL_KELP, water: [] },
  slots: {
    spawn: [
      { faction: FACTION_TIDE, x: HILL_BASES.blue.x, y: HILL_BASES.blue.y, r: 140, stats: { shopRange: 400 } },
      { faction: FACTION_EMBER, x: HILL_BASES.red.x, y: HILL_BASES.red.y, r: 140, stats: { shopRange: 400 } },
    ],
    minion: [
      { faction: FACTION_TIDE, lane: 'channel', x: 420, y: HILL_MID_Y, scatter: 40 },
      { faction: FACTION_EMBER, x: HILL_MAP_SIZE - 420, y: HILL_MID_Y, lane: 'channel', scatter: 40 },
    ],
    structure: [
      { faction: FACTION_TIDE, kind: 'turret', x: HILL_TURRETS.blue.x, y: HILL_TURRETS.blue.y },
      { faction: FACTION_EMBER, kind: 'turret', x: HILL_TURRETS.red.x, y: HILL_TURRETS.red.y },
    ],
    neutral: [{ role: HILL_ROLE, kind: 'object', x: HILL_ISLANDS[0].x, y: HILL_ISLANDS[0].y, r: 60 }],
  },
  lanes: [
    {
      id: 'channel',
      from: FACTION_TIDE,
      to: FACTION_EMBER,
      waypoints: [
        { x: HILL_BASES.blue.x, y: HILL_MID_Y },
        { x: 800, y: HILL_MID_Y },
        { x: 1200, y: HILL_MID_Y + 130 },
        { x: 1600, y: HILL_MID_Y },
        { x: HILL_BASES.red.x, y: HILL_MID_Y },
      ],
    },
  ],
};
