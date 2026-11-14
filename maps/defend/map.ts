import type { MapDefinition, MinionTypeDef } from '@moba2d/core/content/ContentPack';
import { RAIDER_ART, withBody } from './raiderArt';
import { DEFEND_MAP_ID, DEFEND_SIZE, FACTION_EMBER, FACTION_TIDE } from './layout';

/** The Great Lantern: a blue turret in the middle of the reef. It lights the way and bites back a little. */
export const LANTERN_STATS = {
  health: 4_000,
  damage: 18,
  attackInterval: 900,
  attackRange: 380,
  size: 110,
  rebuildTime: 3_600_000,
  repairDelay: 8_000,
  repairRate: 0.25,
} as const;

/** Raider numbers. The director scales health and damage per wave on top of these. */
const RAIDER_STATS: Record<keyof typeof RAIDER_ART, MinionTypeDef> = {
  crab: { name: 'Cua Rạn', style: 'melee', speed: 2.4, size: 34, health: 90, damage: 6, attackInterval: 1_300, attackRange: 40, aggroRange: 320, goldBounty: 14 },
  spitter: { name: 'Ốc Phun', style: 'ranged', speed: 2.2, size: 32, health: 60, damage: 7, attackInterval: 1_500, attackRange: 240, aggroRange: 340, goldBounty: 16 },
  brute: { name: 'Hà Đá', style: 'melee', speed: 2.0, size: 48, health: 280, damage: 14, attackInterval: 1_400, attackRange: 50, aggroRange: 320, goldBounty: 30 },
  eel: { name: 'Lươn Điện', style: 'ranged', speed: 3.0, size: 36, health: 110, damage: 8, attackInterval: 1_200, attackRange: 260, aggroRange: 420, goldBounty: 24 },
  jelly: { name: 'Sứa Ngọc', style: 'ranged', speed: 2.0, size: 40, health: 150, damage: 5, attackInterval: 1_600, attackRange: 260, aggroRange: 360, goldBounty: 28 },
  kraken: { name: 'Bạch Tuộc', style: 'ranged', speed: 1.6, size: 96, health: 2_200, damage: 26, attackInterval: 1_500, attackRange: 260, aggroRange: 420, goldBounty: 180 },
  tidelord: { name: 'Chúa Triều', style: 'melee', speed: 1.8, size: 84, health: 1_800, damage: 32, attackInterval: 1_600, attackRange: 80, aggroRange: 360, goldBounty: 150 },
};

/**
 * The raiders: the numbers above, each wearing its own body from `./raiderArt.ts`.
 * `withBody` hides `draw` from enumeration — see there for why an older core needs that.
 */
export const RAIDER_TYPES: Record<string, MinionTypeDef> = Object.fromEntries(
  (Object.keys(RAIDER_STATS) as Array<keyof typeof RAIDER_ART>).map(kind => [kind, withBody(RAIDER_STATS[kind], RAIDER_ART[kind])])
);

/**
 * Thủ Đèn — co-op wave defence. The heavy half is `./geometry.ts`; the rules
 * (waves, win, lose, the banner) are the director in `./defence.ts`.
 */
export const defendMap: MapDefinition = {
  id: DEFEND_MAP_ID,
  name: 'Thủ Đèn',
  size: DEFEND_SIZE,
  factions: [{ id: FACTION_TIDE }, { id: FACTION_EMBER }],
  // `./art.ts` paints the island: every wall and kelp bed, and the lighthouse on its headland.
  paintsOwnTerrain: true,
  tuning: {
    champions: { reviveCurve: { base: 4_000, perMinute: 1_000, max: 8_000 } },
    minions: {
      types: RAIDER_TYPES,
      // The director sends every wave itself; core's own clock must never fire.
      // Every type is still listed: core refuses a declared minion no formation
      // fields, and this hour-long formation is the one it reads.
      waves: { composition: Object.keys(RAIDER_TYPES), intervalMs: 3_600_000, firstDelayMs: 3_600_000, liveCap: 80 },
    },
    economy: { startingGold: 700, passiveGoldPerSecond: 5 },
  },
  geometry: () => import('./geometry').then(module => module.geometry),
};
