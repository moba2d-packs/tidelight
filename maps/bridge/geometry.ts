import type { MapGeometry } from '@moba2d/core/content/ContentPack';
import { BLUE, FACTION_EMBER, FACTION_TIDE, MAP_SIZE, RED, type Pt } from '../../world/layout';
import { KEEP_STATS } from '../common/keeps';
import { BRIDGE_ROLE, BRIDGE_Y, HOMES, KEEPS, KELP, WALLS, WARDENS } from './layout';

const flip = (p: Pt): Pt => ({ x: MAP_SIZE - p.x, y: MAP_SIZE - p.y });
const at = (x: number, y: number): Pt => ({ x, y });
const laneVia = (y: number): Pt[] => [at(620, y), at(1250, y), at(1600, y), at(1950, y), at(2580, y)];
const NORTH = laneVia(BRIDGE_Y[0]);
const SOUTH = laneVia(BRIDGE_Y[2]);

/** The two outer bridges carry the waves; the middle one is the heroes' shortcut. */
export const geometry: MapGeometry = {
  terrain: { wall: WALLS, bush: KELP, water: [] },
  slots: {
    spawn: [
      { faction: FACTION_TIDE, x: HOMES[BLUE].x, y: HOMES[BLUE].y, r: 150, stats: { shopRange: 420 } },
      { faction: FACTION_EMBER, x: HOMES[RED].x, y: HOMES[RED].y, r: 150, stats: { shopRange: 420 } },
    ],
    minion: [
      { faction: FACTION_TIDE, lane: 'north', x: NORTH[0].x, y: NORTH[0].y, scatter: 40 },
      { faction: FACTION_TIDE, lane: 'south', x: SOUTH[0].x, y: SOUTH[0].y, scatter: 40 },
      { faction: FACTION_EMBER, lane: 'north', x: flip(SOUTH[0]).x, y: flip(SOUTH[0]).y, scatter: 40 },
      { faction: FACTION_EMBER, lane: 'south', x: flip(NORTH[0]).x, y: flip(NORTH[0]).y, scatter: 40 },
    ],
    structure: [
      { faction: FACTION_TIDE, kind: 'turret', x: KEEPS[BLUE].x, y: KEEPS[BLUE].y, stats: { ...KEEP_STATS } },
      { faction: FACTION_EMBER, kind: 'turret', x: KEEPS[RED].x, y: KEEPS[RED].y, stats: { ...KEEP_STATS } },
      { faction: FACTION_TIDE, kind: 'turret', x: WARDENS[BLUE].x, y: WARDENS[BLUE].y },
      { faction: FACTION_EMBER, kind: 'turret', x: WARDENS[RED].x, y: WARDENS[RED].y },
    ],
    neutral: [{ role: BRIDGE_ROLE, kind: 'object', x: MAP_SIZE / 2, y: MAP_SIZE / 2, r: 60 }],
  },
  lanes: [
    { id: 'north', from: FACTION_TIDE, to: FACTION_EMBER, waypoints: [...NORTH, at(2850, 1400), HOMES[RED]] },
    { id: 'south', from: FACTION_TIDE, to: FACTION_EMBER, waypoints: [...SOUTH, at(2850, 1800), HOMES[RED]] },
  ],
};
