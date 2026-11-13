import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { data, MAGE, MARKSMAN, SKIRMISHER, SUPPORT, TANK } from '../pack';

/**
 * Every ability hit must say what kind it is and what it is called, or core
 * falls back to its default type and the death recap reads "Không rõ".
 */
const root = join(__dirname, '..');
const spellsDir = join(root, 'spells');
const files = [
  ...readdirSync(spellsDir).filter(f => f.endsWith('.ts') && f !== 'index.ts').map(f => join(spellsDir, f)),
  join(root, 'world/fx.ts'),
];

/** Top-level arguments of every `takeDamage(...)` call in `src`. */
const calls = (src: string): string[][] => {
  const out: string[][] = [];
  let at = src.indexOf('takeDamage(');
  while (at !== -1) {
    let depth = 0;
    let arg = '';
    const args: string[] = [];
    for (let i = at + 'takeDamage('.length; i < src.length; i++) {
      const ch = src[i];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      if (ch === ')' || ch === ']' || ch === '}') {
        if (depth === 0) break;
        depth--;
      }
      if (ch === ',' && depth === 0) {
        args.push(arg.trim());
        arg = '';
      } else arg += ch;
    }
    if (arg.trim()) args.push(arg.trim());
    out.push(args);
    at = src.indexOf('takeDamage(', at + 1);
  }
  return out;
};

const TYPE = /^('PHYSICAL'|'MAGIC'|'TRUE'|this\.damageType)$/;

describe('ability damage is typed and labelled', () => {
  it('scans a non-trivial number of calls', () => {
    const total = files.reduce((n, f) => n + calls(readFileSync(f, 'utf8')).length, 0);
    expect(total).toBeGreaterThanOrEqual(12);
  });

  for (const file of files) {
    it(`${file.slice(root.length + 1)}: every takeDamage has a type and a label`, () => {
      for (const args of calls(readFileSync(file, 'utf8'))) {
        expect(args.length, args.join(', ')).toBeGreaterThanOrEqual(4);
        expect(args[2], args.join(', ')).toMatch(TYPE);
        expect(args[3].length, args.join(', ')).toBeGreaterThan(0);
        expect(args[3]).not.toMatch(/^(''|""|undefined)$/);
      }
    });
  }

  it('every bolt setup that sets a damage also sets damageType and label', () => {
    for (const file of files.filter(f => f.includes('spells'))) {
      const src = readFileSync(file, 'utf8');
      if (!/^\s+damage: /m.test(src)) continue;
      expect(src, file).toMatch(/damageType: '(PHYSICAL|MAGIC|TRUE)'/);
      expect(src, file).toMatch(/label: this\.name/);
    }
  });

  it('a champion deals the damage type of its role', () => {
    const physical = ['Brine', 'Skerry', 'Nacre'];
    const magic = ['Wick', 'Gull'];
    for (const [names, type] of [[physical, 'PHYSICAL'], [magic, 'MAGIC']] as const) {
      for (const name of names) {
        for (const slot of ['Q', 'W', 'E', 'R']) {
          const src = readFileSync(join(spellsDir, `${name}_${slot}.ts`), 'utf8');
          for (const m of src.matchAll(/'(PHYSICAL|MAGIC|TRUE)'/g)) expect(m[1], `${name}_${slot}`).toBe(type);
        }
      }
    }
  });
});

describe('roster roles', () => {
  const body = (id: string) => data.champions!.find(c => c.id === id)!.defence!;
  it('Brine is the tankiest on every axis', () => {
    expect(body('brine')).toEqual(TANK);
    for (const id of ['nacre', 'wick', 'skerry', 'gull']) {
      expect(TANK.health!).toBeGreaterThan(body(id).health!);
      expect(TANK.armor!).toBeGreaterThan(body(id).armor!);
      expect(TANK.magicResist!).toBeGreaterThan(body(id).magicResist!);
    }
  });
  it('mages and supporters resist magic more than marksmen; marksman is the squishiest', () => {
    expect(body('gull')).toEqual(MAGE);
    expect(body('wick')).toEqual(SUPPORT);
    expect(body('skerry')).toEqual(SKIRMISHER);
    expect(body('nacre')).toEqual(MARKSMAN);
    expect(MARKSMAN.health!).toBeLessThan(MAGE.health!);
  });
});
