import type { MapGeometry } from '@moba2d/core/content/ContentPack';
import { BLUE, FACTION_EMBER, FACTION_TIDE, MAP_SIZE, RED, type Pt } from '../../world/layout';
import { KEEP_STATS } from '../common/keeps';
import { HOMES, KELP, KEEPS, PORTALS_ROLE, WALLS } from './layout';

const flip = (p: Pt): Pt => ({ x: MAP_SIZE - p.x, y: MAP_SIZE - p.y });
const at = (x: number, y: number): Pt => ({ x, y });

/** The long way round: Tide's wave walks the ring one way, Ember's the other. */
const NORTH: Pt[] = [at(500, 250), at(1000, 250), at(1600, 250), at(2200, 250), at(2650, 300), at(2950, 700), at(2950, 1600), at(2950, 2500)];
const SOUTH: Pt[] = [at(250, 500), at(250, 1000), at(250, 1600), at(250, 2200), at(300, 2650), at(700, 2950), at(1600, 2950), at(2500, 2950)];

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
    ],
    // The one neutral slot: the arena object (portals, announcer, win check).
    neutral: [{ role: PORTALS_ROLE, kind: 'object', x: 2600, y: 500, r: 60 }],
  },
  lanes: [
    { id: 'north', from: FACTION_TIDE, to: FACTION_EMBER, waypoints: [...NORTH, at(2960, 2960)] },
    { id: 'south', from: FACTION_TIDE, to: FACTION_EMBER, waypoints: [...SOUTH, at(2960, 2960)] },
  ],
};
