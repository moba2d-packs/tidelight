/**
 * Every spell this pack ships, by id.
 *
 * Read by two things and written by hand: `catalog.config.mjs` points the
 * catalogue generator at this file, and the generator uses it twice — once to
 * construct each spell and read its display fields into
 * `generated/spellCatalog.ts`, and once to emit `generated/spellModules.ts`,
 * the `id -> () => import('...')` map a match loads kits through.
 *
 * The export *name* is the spell id. `pack.ts`'s roster names the same string
 * in a champion's `spells: [...]`, and a mismatch is a champion with an empty
 * slot rather than an error, so keep them in step.
 *
 * `moba2d-pack-add spell` appends here.
 */
export { default as Brine_P } from './Brine_P';
export { default as Brine_Q } from './Brine_Q';
export { default as Brine_W } from './Brine_W';
export { default as Brine_E } from './Brine_E';
export { default as Brine_R } from './Brine_R';
export { default as Nacre_P } from './Nacre_P';
export { default as Nacre_Q } from './Nacre_Q';
export { default as Nacre_W } from './Nacre_W';
export { default as Nacre_E } from './Nacre_E';
export { default as Nacre_R } from './Nacre_R';
export { default as Wick_P } from './Wick_P';
export { default as Wick_Q } from './Wick_Q';
export { default as Wick_W } from './Wick_W';
export { default as Wick_E } from './Wick_E';
export { default as Wick_R } from './Wick_R';
export { default as Skerry_P } from './Skerry_P';
export { default as Skerry_Q } from './Skerry_Q';
export { default as Skerry_W } from './Skerry_W';
export { default as Skerry_E } from './Skerry_E';
export { default as Skerry_R } from './Skerry_R';
export { default as Gull_P } from './Gull_P';
export { default as Gull_Q } from './Gull_Q';
export { default as Gull_W } from './Gull_W';
export { default as Gull_E } from './Gull_E';
export { default as Gull_R } from './Gull_R';
// moba2d-pack-add spell: new barrel entries go above this line
