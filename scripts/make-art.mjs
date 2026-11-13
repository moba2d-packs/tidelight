#!/usr/bin/env node
/**
 * Draws every image the pack ships — five portraits and twenty-five ability
 * icons — as SVG, and rasterises them into `assets/` with sharp.
 *
 *   node scripts/make-art.mjs
 *
 * The art is code on purpose: it is original by construction, it shares the
 * palette in `world/palette.ts` by copying eight hex values rather than by
 * eye, and a new hero is a function here instead of a commission. The style is
 * the same cut-paper stack the reef is painted in: a dark sheet, a flat shape
 * offset over it, one bright accent.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(OUT, { recursive: true });

const C = {
  abyss: '#070e22',
  deep: '#0b1834',
  seabed: '#142c4e',
  shadow: '#050a1a',
  cream: '#f8eed4',
  lantern: '#ffd070',
  hot: '#fff4d6',
  pearl: '#f0e8ff',
  tide: '#3ad2c8',
  ember: '#ff704e',
  coral: '#ff8a80',
  iron: '#9cbacc',
  gale: '#96ccff',
  reef: '#2c7c7a',
  kelp: '#268060',
  skin1: '#e9b48c',
  skin2: '#c98d6a',
  skin3: '#8a5a44',
};

const HERO = {
  brine: { tint: C.iron, dark: '#2b4458', mid: '#476a82' },
  nacre: { tint: C.pearl, dark: '#3c3466', mid: '#6d5fa8' },
  wick: { tint: C.lantern, dark: '#5a3a14', mid: '#a8661c' },
  skerry: { tint: C.coral, dark: '#5c1f2a', mid: '#a83a44' },
  gull: { tint: C.gale, dark: '#1f3d66', mid: '#3d6ea8' },
};

// ───────────────────────────── Portraits ─────────────────────────────

/** Shared bust: backdrop, waves, shoulders. `body` draws the head and what makes them them. */
const portrait = (hero, body) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <rect width="256" height="256" fill="${hero.dark}"/>
  <circle cx="128" cy="96" r="118" fill="${hero.mid}" opacity=".55"/>
  <circle cx="128" cy="92" r="84" fill="${hero.tint}" opacity=".22"/>
  <path d="M0 200 q32 -18 64 0 t64 0 t64 0 t64 0 V256 H0Z" fill="${C.deep}"/>
  <path d="M0 220 q32 -16 64 0 t64 0 t64 0 t64 0 V256 H0Z" fill="${C.abyss}"/>
  ${body}
</svg>`;

const eyes = (y, gap = 22, color = C.abyss, r = 6) =>
  `<circle cx="${128 - gap}" cy="${y}" r="${r}" fill="${color}"/><circle cx="${128 + gap}" cy="${y}" r="${r}" fill="${color}"/>`;

const PORTRAITS = {
  // Brine — broad, a brass diving collar, a beard like a wave, an anchor on the chest.
  brine: portrait(HERO.brine, `
    <path d="M30 256 q0 -84 98 -84 q98 0 98 84Z" fill="${C.shadow}" transform="translate(6 8)"/>
    <path d="M30 256 q0 -84 98 -84 q98 0 98 84Z" fill="#35566e"/>
    <rect x="72" y="158" width="112" height="30" rx="15" fill="${C.lantern}"/>
    <circle cx="128" cy="108" r="62" fill="${C.shadow}" transform="translate(5 7)"/>
    <circle cx="128" cy="108" r="62" fill="${C.skin2}"/>
    <path d="M66 96 a62 62 0 0 1 124 0 q-62 -34 -124 0Z" fill="${C.iron}"/>
    <rect x="62" y="88" width="132" height="14" rx="7" fill="${C.lantern}"/>
    ${eyes(112, 24)}
    <path d="M70 124 q14 30 30 12 q14 26 28 0 q14 26 28 0 q16 18 30 -12 q4 62 -58 62 q-62 0 -58 -62Z" fill="${C.cream}"/>
    <g stroke="${C.cream}" stroke-width="7" stroke-linecap="round" fill="none">
      <path d="M128 204 v36 M112 214 h32 M104 232 q24 22 48 0"/>
    </g>`),

  // Nacre — a scallop shell for a hood, one pearl on the brow, long calm eyes.
  nacre: portrait(HERO.nacre, `
    <g transform="translate(5 7)" fill="${C.shadow}"><path d="M128 20 L52 150 H204Z"/><circle cx="128" cy="96" r="88"/></g>
    <circle cx="128" cy="96" r="88" fill="${C.pearl}"/>
    <g stroke="${HERO.nacre.mid}" stroke-width="5" stroke-linecap="round">
      <path d="M128 150 L128 10 M128 150 L84 20 M128 150 L172 20 M128 150 L50 52 M128 150 L206 52 M128 150 L40 100 M128 150 L216 100"/>
    </g>
    <path d="M40 256 q0 -78 88 -78 q88 0 88 78Z" fill="${HERO.nacre.mid}"/>
    <path d="M96 182 q32 26 64 0 v18 q-32 22 -64 0Z" fill="${C.pearl}"/>
    <circle cx="128" cy="122" r="52" fill="${C.skin1}"/>
    <path d="M76 116 q52 -60 104 0 q-52 -26 -104 0Z" fill="${HERO.nacre.dark}"/>
    <circle cx="128" cy="86" r="11" fill="#ffffff"/><circle cx="125" cy="83" r="4" fill="${C.pearl}"/>
    <path d="M96 126 q10 -9 20 0 M140 126 q10 -9 20 0" stroke="${C.abyss}" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M116 150 q12 8 24 0" stroke="${HERO.nacre.dark}" stroke-width="5" stroke-linecap="round" fill="none"/>`),

  // Wick — a lamp for a hat with a live flame in it, a scarf, a wide grin.
  wick: portrait(HERO.wick, `
    <circle cx="128" cy="60" r="74" fill="${C.lantern}" opacity=".35"/>
    <path d="M44 256 q0 -76 84 -76 q84 0 84 76Z" fill="${C.shadow}" transform="translate(5 7)"/>
    <path d="M44 256 q0 -76 84 -76 q84 0 84 76Z" fill="#7a4a18"/>
    <path d="M78 176 h100 v22 q-50 22 -100 0Z" fill="${C.ember}"/>
    <path d="M158 190 l24 46 l-26 -8Z" fill="${C.ember}"/>
    <circle cx="128" cy="134" r="50" fill="${C.skin3}"/>
    <path d="M82 18 h92 l14 78 h-120Z" fill="${C.shadow}" transform="translate(5 6)"/>
    <path d="M82 18 h92 l14 78 h-120Z" fill="${C.lantern}"/>
    <path d="M100 18 l-6 78 M128 18 v78 M156 18 l6 78" stroke="${C.ember}" stroke-width="4" opacity=".7"/>
    <rect x="76" y="8" width="104" height="16" rx="6" fill="${C.abyss}"/>
    <rect x="60" y="90" width="136" height="16" rx="6" fill="${C.abyss}"/>
    <path d="M128 34 q22 24 0 50 q-22 -26 0 -50Z" fill="${C.hot}"/>
    ${eyes(132, 20, C.hot, 7)}
    <path d="M106 154 q22 18 44 0" stroke="${C.hot}" stroke-width="6" stroke-linecap="round" fill="none"/>`),

  // Skerry — all angle: a fin crest, a slash of a mask, two blades behind the shoulders.
  skerry: portrait(HERO.skerry, `
    <g fill="${C.cream}"><path d="M34 60 l34 132 l-28 4Z"/><path d="M222 60 l-34 132 l28 4Z"/></g>
    <path d="M52 256 q0 -70 76 -70 q76 0 76 70Z" fill="${C.shadow}" transform="translate(5 7)"/>
    <path d="M52 256 q0 -70 76 -70 q76 0 76 70Z" fill="#3a1820"/>
    <path d="M96 186 l32 34 l32 -34Z" fill="${C.coral}"/>
    <path d="M128 4 l34 96 h-68Z" fill="${C.shadow}" transform="translate(5 6)"/>
    <path d="M128 4 l34 96 h-68Z" fill="${C.coral}"/>
    <path d="M76 124 q0 -58 52 -58 q52 0 52 58 q0 60 -52 60 q-52 0 -52 -60Z" fill="${C.skin1}"/>
    <path d="M70 104 h116 l-10 34 h-96Z" fill="${C.abyss}"/>
    <path d="M90 118 l26 6 l-26 6Z M166 118 l-26 6 l26 6Z" fill="${C.coral}"/>
    <path d="M112 162 h32" stroke="#3a1820" stroke-width="5" stroke-linecap="round"/>`),

  // Gull — a feather collar like folded wings, a beaked visor, hair blown sideways.
  gull: portrait(HERO.gull, `
    <g fill="${C.shadow}" transform="translate(5 7)"><path d="M20 250 q10 -96 108 -76 q98 -20 108 76Z"/></g>
    <path d="M20 250 q10 -96 108 -76 q98 -20 108 76Z" fill="${C.cream}"/>
    <g stroke="${HERO.gull.mid}" stroke-width="5" stroke-linecap="round" fill="none">
      <path d="M54 250 q6 -50 40 -64 M90 250 q4 -40 24 -58 M202 250 q-6 -50 -40 -64 M166 250 q-4 -40 -24 -58"/>
    </g>
    <circle cx="128" cy="116" r="56" fill="${C.skin2}"/>
    <path d="M64 108 q10 -76 92 -66 q60 10 78 -22 q-6 70 -66 76 q-58 4 -104 12Z" fill="${C.gale}"/>
    <path d="M70 110 q58 -22 116 0 l-58 44Z" fill="${C.abyss}"/>
    <path d="M118 124 l10 30 l10 -30Z" fill="${C.lantern}"/>
    <path d="M92 116 l22 4 l-22 5Z M164 116 l-22 4 l22 5Z" fill="${C.gale}"/>
    <g stroke="${C.cream}" stroke-width="6" stroke-linecap="round" fill="none" opacity=".9">
      <path d="M16 60 q30 -18 52 0 M188 170 q26 -14 48 2"/>
    </g>`),
};

// ───────────────────────────── Icons ─────────────────────────────

/** Icon tile: dark sheet, hero-tinted disc, glyph with a drop sheet under it. */
const icon = (hero, glyph, ult = false) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="26" fill="${ult ? hero.mid : hero.dark}"/>
  <circle cx="64" cy="64" r="${ult ? 58 : 50}" fill="${ult ? hero.dark : hero.mid}" opacity=".7"/>
  ${ult ? `<circle cx="64" cy="64" r="56" fill="none" stroke="${C.lantern}" stroke-width="5"/>` : ''}
  <g transform="translate(3 5)" opacity=".55">${glyph(C.shadow, C.shadow)}</g>
  ${glyph(hero.tint, C.cream)}
</svg>`;

const S = (c, w = 9) => `stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;

const GLYPHS = {
  brine: {
    // Ballast: two stacked stones.
    p: (a, b) => `<ellipse cx="64" cy="84" rx="36" ry="18" fill="${a}"/><ellipse cx="64" cy="54" rx="26" ry="15" fill="${b}"/>`,
    // Hook on a line.
    q: (a, b) => `<path d="M88 22 L52 70" ${S(b, 6)}/><path d="M52 70 q-26 22 -2 38 q22 10 32 -14" ${S(a, 11)}/>`,
    // Shield with a waterline.
    w: (a, b) => `<path d="M64 20 l36 14 v30 q0 30 -36 46 q-36 -16 -36 -46 v-30Z" fill="${a}"/><path d="M36 66 q14 -12 28 0 t28 0" ${S(b, 7)}/>`,
    // Shoulder charge: a wave with a prow.
    e: (a, b) => `<path d="M16 86 q22 -40 54 -34 l34 -22 l-8 38 q12 22 -8 36Z" fill="${a}"/><path d="M22 100 q20 -12 40 0 t40 0" ${S(b, 7)}/>`,
    // The great anchor.
    r: (a, b) => `<circle cx="64" cy="26" r="10" ${S(b, 7)}/><path d="M64 36 v64 M42 52 h44 M26 78 q38 46 76 0" ${S(a, 11)}/>`,
  },
  nacre: {
    p: (a, b) => `<path d="M24 84 a40 40 0 0 1 80 0Z" fill="${a}"/><circle cx="64" cy="76" r="15" fill="${b}"/>`,
    q: (a, b) => `<path d="M18 96 L62 62" ${S(a, 8)}/><circle cx="84" cy="46" r="24" fill="${a}"/><circle cx="76" cy="38" r="8" fill="${b}"/>`,
    w: (a, b) => `<circle cx="64" cy="64" r="38" ${S(a, 9)}/><path d="M44 52 q8 -14 22 -14" ${S(b, 6)}/><circle cx="64" cy="76" r="9" fill="${b}"/>`,
    e: (a, b) => `<path d="M26 40 q54 -8 62 62" ${S(a, 11)}/><path d="M74 88 l16 16 l10 -22" ${S(a, 11)}/><path d="M18 100 q12 -8 24 0" ${S(b, 6)}/>`,
    r: (a, b) => `<path d="M88 24 a42 42 0 1 0 12 62 a32 32 0 1 1 -12 -62Z" fill="${a}"/><circle cx="74" cy="60" r="13" fill="${b}"/>`,
  },
  wick: {
    p: (a, b) => `<rect x="38" y="42" width="52" height="60" rx="18" fill="${a}"/><rect x="44" y="28" width="40" height="12" rx="5" fill="${b}"/><path d="M64 54 q14 16 0 34 q-14 -18 0 -34Z" fill="${b}"/>`,
    q: (a, b) => `<path d="M64 14 l12 36 l36 14 l-36 14 l-12 36 l-12 -36 l-36 -14 l36 -14Z" fill="${a}"/><circle cx="64" cy="64" r="11" fill="${b}"/>`,
    w: (a, b) => `<path d="M64 16 q34 36 0 80 q-34 -44 0 -80Z" fill="${a}"/><path d="M64 96 v18 M48 74 h32 M64 58 v32" ${S(b, 7)}/>`,
    e: (a, b) => `<circle cx="64" cy="64" r="20" fill="${b}"/><path d="M64 14 v18 M64 96 v18 M14 64 h18 M96 64 h18 M28 28 l13 13 M87 87 l13 13 M100 28 l-13 13 M41 87 l-13 13" ${S(a, 9)}/>`,
    r: (a, b) => `<circle cx="64" cy="64" r="30" fill="${a}"/><circle cx="64" cy="64" r="15" fill="${b}"/><path d="M64 8 l8 18 h-16Z M64 120 l8 -18 h-16Z M8 64 l18 8 v-16Z M120 64 l-18 8 v-16Z" fill="${a}"/>`,
  },
  skerry: {
    p: (a, b) => `<path d="M24 96 q20 -70 78 -72 q-22 34 -14 72Z" fill="${a}"/><path d="M18 104 q14 -10 28 0 t28 0 t28 0" ${S(b, 6)}/>`,
    q: (a, b) => `<path d="M64 18 a46 46 0 0 1 46 46 l-20 -6 a28 28 0 0 0 -26 -22Z" fill="${a}"/><path d="M64 110 a46 46 0 0 1 -46 -46 l20 6 a28 28 0 0 0 26 22Z" fill="${a}"/><circle cx="64" cy="64" r="9" fill="${b}"/>`,
    w: (a, b) => `<path d="M20 44 h62 M34 64 h70 M20 84 h52" ${S(a, 10)}/><path d="M92 36 l16 8 l-16 8 M82 76 l16 8 l-16 8" ${S(b, 7)}/>`,
    e: (a, b) => `<path d="M64 64 m-36 0 a36 36 0 1 1 36 36 a22 22 0 1 1 -22 -22 a10 10 0 1 1 10 10" ${S(a, 10)}/><circle cx="96" cy="30" r="7" fill="${b}"/>`,
    r: (a, b) => `<path d="M22 100 q8 -78 70 -78 l-12 20 l26 4 q-34 6 -42 54Z" fill="${a}"/><path d="M26 108 l14 -14 M52 112 l8 -18 M80 108 l2 -18" ${S(b, 7)}/>`,
  },
  gull: {
    p: (a, b) => `<path d="M30 100 q4 -62 70 -76 q-10 60 -52 80Z" fill="${a}"/><path d="M34 98 L86 38" ${S(b, 5)}/>`,
    q: (a, b) => `<path d="M16 50 h62 q20 0 20 -14 q0 -14 -14 -12" ${S(a, 10)}/><path d="M16 78 h82 q16 0 14 14 q-2 12 -14 8" ${S(b, 8)}/>`,
    w: (a, b) => `<path d="M24 86 l40 -50 l40 50" ${S(a, 11)}/><path d="M40 106 l24 -30 l24 30" ${S(b, 8)}/>`,
    e: (a, b) => `<path d="M30 60 a22 22 0 0 1 28 -26 a26 26 0 0 1 46 12 a18 18 0 0 1 -6 34 h-58 a16 16 0 0 1 -10 -20Z" fill="${a}"/><path d="M58 84 l-10 18 h18 l-8 16" ${S(b, 7)}/>`,
    r: (a, b) => `<path d="M12 78 q22 -44 52 -12 q30 32 52 -12 v52 h-104Z" fill="${a}"/><path d="M44 34 a26 26 0 1 1 20 30" ${S(b, 7)}/><path d="M36 22 l8 14 l14 -8" ${S(b, 7)}/>`,
  },
};

const jobs = [];
for (const [name, svg] of Object.entries(PORTRAITS)) {
  jobs.push(sharp(Buffer.from(svg)).png().toFile(join(OUT, `champ_${name}.png`)));
}
for (const [name, glyphs] of Object.entries(GLYPHS)) {
  for (const [slot, glyph] of Object.entries(glyphs)) {
    const svg = icon(HERO[name], glyph, slot === 'r');
    jobs.push(sharp(Buffer.from(svg)).png().toFile(join(OUT, `spell_${name}_${slot}.png`)));
  }
}
await Promise.all(jobs);
console.log(`make-art: wrote ${jobs.length} images to ${OUT}`);
