import type { ContentApi } from '@moba2d/core/content/ContentApi';
import type {
  ChampionAttack,
  ChampionDefence,
  ChampionEntry,
  ContentPackCode,
  ContentPackData,
  SpellDisplayData,
  SpellSource,
} from '@moba2d/core/content/ContentPack';
import { setPackApi } from './packApi';
import { spellCatalog } from './generated/spellCatalog';
import { spellModules } from './generated/spellModules';
import { map } from './map';
import { extraMaps, extraSlotObjects } from './maps';
import { hillMap } from './maps/hill/map';
import { createHill } from './maps/hill/hill';
import { HILL_ROLE } from './maps/hill/layout';
import { ballMap } from './maps/ball/map';
import { createPitch } from './maps/ball/pitch';
import { BALL_ROLE } from './maps/ball/layout';
import { defendAI } from './maps/defend/defendAI';
import { createDefence } from './maps/defend/defence';
import { DEFEND_ROLE } from './maps/defend/layout';
import { defendMap } from './maps/defend/map';
import { bridgeMap } from './maps/bridge';
import { createBridgeArena } from './maps/bridge/arena';
import { BRIDGE_ROLE } from './maps/bridge/layout';
import { portalsMap } from './maps/portals';
import { createPortalArena } from './maps/portals/arena';
import { PORTALS_ROLE } from './maps/portals/layout';
import { createHeart } from './world/heart';
import { HEART_ROLE } from './world/layout';

/**
 * Tidelight — one champion, one map, four abilities: the smallest thing
 * that is actually a pack, not the smallest thing that would compile.
 *
 * Four abilities and not one because core validates a pack before installing
 * it, and a `playable` champion there means exactly this: a portrait, and a
 * kit of four. A pack that ships three is not a pack with a gap in it, it is
 * a pack that fails to install, in a browser, after it is already published.
 * The four here are deliberately the same bolt four times — your job is to
 * make them different, and the shape is already in place for it.
 *
 * ## The two halves, and why the data one imports no spell
 *
 * `data` is inert: a roster, a map to list, and the display strings a picker
 * draws. It must be readable without ever building a `ContentApi`, because a
 * menu screen that only wants champion names should never load the engine
 * first — see `@moba2d/core/content/ContentPack`'s own header.
 *
 * So the numbers below come from `generated/spellCatalog.ts`, which the
 * catalogue generator produced by *constructing* each spell once at build
 * time and reading its fields. Nothing here imports `./spells/...`, and
 * nothing here may: a spell module reads `api` the moment it evaluates, and
 * at data-read time nobody has set one. `tests/dataHalf.test.ts` enforces it.
 *
 * `code` is the other half. It sets the api first — that single call is what
 * lets every spell file be an ordinary class declaration — and then hands
 * core a loader per spell, so a match downloads the kits in play.
 */
const displayData = (): Record<string, SpellDisplayData> => {
  const out: Record<string, SpellDisplayData> = {};
  for (const [id, entry] of Object.entries(spellCatalog)) {
    out[id] = {
      name: entry.name,
      description: entry.description,
      iconKey: entry.iconKey,
      coolDownMs: entry.coolDownMs,
      manaCost: entry.manaCost,
      specCoolDownMs: entry.specCoolDownMs,
    };
  }
  return out;
};

/**
 * One roster entry. Every hero has the same shape — a portrait, four keys and
 * a passive that ties them to the tide — so the shape is written once and the
 * table below is only what differs.
 */
const hero = (
  id: string,
  name: string,
  attack: ChampionAttack,
  defence: ChampionDefence,
  tint: [number, number, number]
): ChampionEntry => ({
  id,
  name,
  image: `champ_${id}`,
  playable: true,
  attack,
  defence,
  passive: `${name}_P`,
  spells: [`${name}_Q`, `${name}_W`, `${name}_E`, `${name}_R`],
  trail: { widths: [0.62, 0.5, 0.38, 0.26, 0.14], spacing: 0.55, color: tint, glow: 0.4 },
});

/** Durability per role. Armor/MR use core's curve: 100 / (100 + r), so 45 armor takes ~69% of a physical hit. */
export const TANK: ChampionDefence = { health: 165, armor: 45, magicResist: 35 };
export const SKIRMISHER: ChampionDefence = { health: 105, armor: 15, magicResist: 10 };
export const MARKSMAN: ChampionDefence = { health: 85, armor: 5, magicResist: 0 };
export const SUPPORT: ChampionDefence = { health: 100, armor: 8, magicResist: 22 };
export const MAGE: ChampionDefence = { health: 90, armor: 0, magicResist: 15 };

export const data: ContentPackData = {
  // `coreRange` is the oldest core this pack works against. Core parses
  // exactly two shapes — `*` and `>=X.Y.Z` — and treats anything else as
  // unsatisfiable, so `^1` is not a loose range, it is a pack that refuses to
  // install. `scripts/write-manifest.mjs` states the same floor for the
  // published manifest; raise both together.
  manifest: { id: 'tidelight', version: '1.0.0', coreRange: '>=1.20.0' },
  champions: [
    // Roles (docs/design.md section 4): tank / AD marksman / support (magic) / AD skirmisher / AP mage.
    hero('brine', 'Brine', { damage: 13, attacksPerSecond: 1.0, range: 150 }, TANK, [156, 186, 204]),
    hero('nacre', 'Nacre', { damage: 14, attacksPerSecond: 1.2, range: 480 }, MARKSMAN, [240, 232, 255]),
    hero('wick', 'Wick', { damage: 10, attacksPerSecond: 1.1, range: 430 }, SUPPORT, [255, 208, 112]),
    hero('skerry', 'Skerry', { damage: 16, attacksPerSecond: 1.3, range: 150 }, SKIRMISHER, [255, 138, 128]),
    hero('gull', 'Gull', { damage: 12, attacksPerSecond: 1.0, range: 520 }, MAGE, [150, 204, 255]),
    // The D/F shelf: two sea charms every hero may carry. Not a champion.
    {
      id: 'charms',
      name: 'Bùa Biển',
      image: null,
      playable: false,
      summonerShelf: true,
      spells: ['Charm_Riptide', 'Charm_Lampglass'],
    },
  ],
  spellDisplay: displayData(),
  maps: [map, hillMap, ballMap, defendMap, portalsMap, bridgeMap, ...extraMaps],
};

const code = (api: ContentApi): ContentPackCode => {
  // **First, and before anything reaches a spell module.** Every class in
  // `spells/` is declared against `packApi.ts`'s `api`, so this call is what
  // makes them constructible at all. The loaders below are lazy, so nothing
  // has evaluated yet when this runs.
  setPackApi(api);

  const spells: Record<string, SpellSource> = {};
  for (const [id, load] of Object.entries(spellModules)) {
    spells[id] = () => load().then(module => module.default);
  }
  return {
    spells,
    // The map's one neutral slot is the Heart: tide, lantern, score, win.
    slotObjects: {
      [HEART_ROLE]: (slot, game) => createHeart(game, slot.x, slot.y),
      [HILL_ROLE]: (slot, game) => createHill(game, slot.x, slot.y),
      [BALL_ROLE]: (slot, game) => createPitch(game, slot.x, slot.y),
      [DEFEND_ROLE]: (_slot, game) => createDefence(game),
      [PORTALS_ROLE]: (slot, game) => createPortalArena(game, slot.x, slot.y),
      [BRIDGE_ROLE]: (slot, game) => createBridgeArena(game, slot.x, slot.y),
      ...extraSlotObjects,
    },
    championAI: Object.fromEntries(['brine', 'nacre', 'wick', 'skerry', 'gull'].map(id => [id, defendAI])),
  };
};

export default code;
