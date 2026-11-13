import type { MapGeometry } from '@moba2d/core/content/ContentPack';
import { DEFEND_ROLE, FACTION_EMBER, FACTION_TIDE, GATES, HARBOUR, KELP, LANTERN, SEALED_COVE, WALLS } from './layout';
import { LANTERN_STATS } from './map';

/**
 * The heavy half of Thủ Đèn. One lane per sea gate, each running from the
 * lantern (the "tide" end) out to its gate (the "ember" end): raiders are the
 * ember side, and core walks them down their lane in reverse, toward the lantern.
 */
export const geometry: MapGeometry = {
  terrain: { wall: WALLS, bush: KELP, water: [] },
  slots: {
    spawn: [
      { faction: FACTION_TIDE, x: HARBOUR.x, y: HARBOUR.y, r: 150, stats: { shopRange: 420 } },
      // The raiders' fountain is a dummy: nobody fights for ember here.
      { faction: FACTION_EMBER, x: SEALED_COVE.x, y: SEALED_COVE.y, r: 40 },
    ],
    minion: GATES.flatMap(gate => [
      { faction: FACTION_EMBER, lane: gate.id, x: gate.muster.x, y: gate.muster.y, scatter: 70 },
      // The tide end fields no wave: the director is the only thing that sends raiders.
      { faction: FACTION_TIDE, lane: gate.id, x: gate.arrive.x, y: gate.arrive.y, scatter: 0, stats: { composition: [] } },
    ]),
    structure: [{ faction: FACTION_TIDE, kind: 'turret', x: LANTERN.x, y: LANTERN.y, stats: { ...LANTERN_STATS } }],
    neutral: [{ role: DEFEND_ROLE, kind: 'object', x: LANTERN.x, y: LANTERN.y, r: 60 }],
  },
  lanes: GATES.map(gate => ({
    id: gate.id,
    from: FACTION_TIDE,
    to: FACTION_EMBER,
    waypoints: [gate.arrive, ...[...gate.via].reverse(), gate.muster],
  })),
};
