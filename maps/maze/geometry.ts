import type { MapGeometry } from '@moba2d/core/content/ContentPack';
import { BLUE, FACTION_EMBER, FACTION_TIDE, RED } from '../../world/layout';
import {
  MAZE_KELP,
  LANE_Y,
  MAZE_BASES,
  MAZE_KEEPS,
  MAZE_KEEP_STATS,
  MAZE_ROLE,
  MAZE_SIZE,
  MAZE_WARDENS,
  MAZE_WARDEN_STATS,
  MAZE_WALLS,
} from './layout';

export const geometry: MapGeometry = {
  terrain: { wall: MAZE_WALLS, bush: MAZE_KELP, water: [] },
  slots: {
    spawn: [
      { faction: FACTION_TIDE, x: MAZE_BASES[BLUE].x, y: MAZE_BASES[BLUE].y, r: 120, stats: { shopRange: 380 } },
      { faction: FACTION_EMBER, x: MAZE_BASES[RED].x, y: MAZE_BASES[RED].y, r: 120, stats: { shopRange: 380 } },
    ],
    minion: [
      { faction: FACTION_TIDE, lane: 'rong', x: 480, y: LANE_Y, scatter: 40 },
      { faction: FACTION_EMBER, lane: 'rong', x: MAZE_SIZE - 480, y: LANE_Y, scatter: 40 },
    ],
    structure: [
      { faction: FACTION_TIDE, kind: 'turret', x: MAZE_WARDENS[BLUE].x, y: MAZE_WARDENS[BLUE].y, stats: { ...MAZE_WARDEN_STATS } },
      { faction: FACTION_EMBER, kind: 'turret', x: MAZE_WARDENS[RED].x, y: MAZE_WARDENS[RED].y, stats: { ...MAZE_WARDEN_STATS } },
      { faction: FACTION_TIDE, kind: 'turret', x: MAZE_KEEPS[BLUE].x, y: MAZE_KEEPS[BLUE].y, stats: { ...MAZE_KEEP_STATS } },
      { faction: FACTION_EMBER, kind: 'turret', x: MAZE_KEEPS[RED].x, y: MAZE_KEEPS[RED].y, stats: { ...MAZE_KEEP_STATS } },
    ],
    neutral: [{ role: MAZE_ROLE, kind: 'object', x: MAZE_SIZE / 2, y: MAZE_SIZE / 2, r: 40 }],
  },
  lanes: [
    {
      id: 'rong',
      from: FACTION_TIDE,
      to: FACTION_EMBER,
      waypoints: [
        { x: MAZE_BASES[BLUE].x, y: LANE_Y },
        { x: 800, y: LANE_Y },
        { x: MAZE_SIZE / 2, y: LANE_Y },
        { x: MAZE_SIZE - 800, y: LANE_Y },
        { x: MAZE_BASES[RED].x, y: LANE_Y },
      ],
    },
  ],
};
