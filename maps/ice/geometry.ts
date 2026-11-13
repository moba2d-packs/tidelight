import type { MapGeometry } from '@moba2d/core/content/ContentPack';
import { BLUE, FACTION_EMBER, FACTION_TIDE, RED } from '../../world/layout';
import { KEEP_STATS } from '../common/keeps';
import { ICE_BASES, ICE_FLOES, ICE_KEEPS, ICE_LANES, ICE_MUSTERS, ICE_REEDS, ICE_ROLE, ICE_SIZE, ICE_WALLS, ICE_WARDENS } from './layout';

const flip = (p: { x: number; y: number }) => ({ x: ICE_SIZE - p.x, y: p.y });

export const geometry: MapGeometry = {
  terrain: { wall: ICE_WALLS, bush: ICE_REEDS, water: [] },
  // The floes are the map's ice. Core's own fill is left clear: `./art.ts` paints them.
  zones: [{ id: 'floes', name: 'Băng Trôi', ice: true, render: { fill: 'rgba(0,0,0,0)' }, polygons: ICE_FLOES }],
  slots: {
    spawn: [
      { faction: FACTION_TIDE, x: ICE_BASES[BLUE].x, y: ICE_BASES[BLUE].y, r: 120, stats: { shopRange: 380 } },
      { faction: FACTION_EMBER, x: ICE_BASES[RED].x, y: ICE_BASES[RED].y, r: 120, stats: { shopRange: 380 } },
    ],
    minion: [
      { faction: FACTION_TIDE, lane: 'floe', x: ICE_MUSTERS.floe.x, y: ICE_MUSTERS.floe.y, scatter: 40 },
      { faction: FACTION_TIDE, lane: 'snow', x: ICE_MUSTERS.snow.x, y: ICE_MUSTERS.snow.y, scatter: 40 },
      { faction: FACTION_EMBER, lane: 'floe', x: flip(ICE_MUSTERS.floe).x, y: ICE_MUSTERS.floe.y, scatter: 40 },
      { faction: FACTION_EMBER, lane: 'snow', x: flip(ICE_MUSTERS.snow).x, y: ICE_MUSTERS.snow.y, scatter: 40 },
    ],
    structure: [
      { faction: FACTION_TIDE, kind: 'turret', x: ICE_KEEPS[BLUE].x, y: ICE_KEEPS[BLUE].y, stats: { ...KEEP_STATS } },
      { faction: FACTION_EMBER, kind: 'turret', x: ICE_KEEPS[RED].x, y: ICE_KEEPS[RED].y, stats: { ...KEEP_STATS } },
      { faction: FACTION_TIDE, kind: 'turret', x: ICE_WARDENS[BLUE].x, y: ICE_WARDENS[BLUE].y },
      { faction: FACTION_EMBER, kind: 'turret', x: ICE_WARDENS[RED].x, y: ICE_WARDENS[RED].y },
    ],
    neutral: [{ role: ICE_ROLE, kind: 'object', x: ICE_SIZE / 2, y: ICE_SIZE / 2, r: 40 }],
  },
  lanes: [
    { id: 'floe', from: FACTION_TIDE, to: FACTION_EMBER, waypoints: [...ICE_LANES.floe] },
    { id: 'snow', from: FACTION_TIDE, to: FACTION_EMBER, waypoints: [...ICE_LANES.snow] },
  ],
};
