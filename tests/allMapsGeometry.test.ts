/**
 * A map whose geometry is a loader is checked by core when it *loads*, not when
 * the pack installs — so `validatePackData(data)` alone passes a map the game
 * then refuses to start (Thủ Đèn shipped that way: three raider types declared,
 * none fielded). Here every map is validated with its real geometry in place.
 */
import { describe, expect, it } from 'vitest';
import { validatePackData } from '@moba2d/core/testing';
import { data } from '../pack';
import { geometry as ballGeometry } from '../maps/ball/map';
import { geometry as bridgeGeometry } from '../maps/bridge/geometry';
import { geometry as defendGeometry } from '../maps/defend/geometry';
import { geometry as duelGeometry } from '../maps/duel/map';
import { geometry as iceGeometry } from '../maps/ice/geometry';
import { hillGeometry } from '../maps/hill/geometry';
import { geometry as mazeGeometry } from '../maps/maze/geometry';
import { geometry as portalsGeometry } from '../maps/portals/geometry';

const GEOMETRY: Record<string, unknown> = {
  ball: ballGeometry,
  bridge: bridgeGeometry,
  'lantern-watch': defendGeometry,
  duel: duelGeometry,
  hill: hillGeometry,
  ice: iceGeometry,
  maze: mazeGeometry,
  portals: portalsGeometry,
};

describe('every extra map passes core validation with its geometry loaded', () => {
  it('covers every map the pack lists besides the reef', () => {
    const ids = (data.maps ?? []).map(m => m.id).filter(id => id !== 'driftglass');
    expect(ids.sort()).toEqual(Object.keys(GEOMETRY).sort());
  });

  it.each(Object.keys(GEOMETRY))('%s', id => {
    const checked = validatePackData({
      ...data,
      maps: (data.maps ?? []).map(m => (m.id === id ? { ...m, geometry: GEOMETRY[id] } : m)),
    } as never);
    expect(checked.ok === true ? [] : checked.errors).toEqual([]);
  });
});
