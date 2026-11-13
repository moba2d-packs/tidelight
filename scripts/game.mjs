#!/usr/bin/env node
/**
 * Run or build Tidelight as a game of its own — without touching core.
 *
 *   node scripts/game.mjs dev   [--port 5311] [--host]   # play it, with HMR
 *   node scripts/game.mjs build                          # static site -> dist-game/
 *   node scripts/game.mjs preview [--port 5312] [--host] # serve dist-game/
 *   node scripts/game.mjs dev --runtime [--port 5313]    # bare core, to install this pack by URL
 *
 * Core is an engine with a lobby; which packs that lobby offers is decided by
 * one generated file, `src/generated/installedPacks.ts`, which other people's
 * work is writing to. So instead of editing it, this runs core's own Vite
 * config with one extra plugin that *answers* that module from memory with a
 * list of exactly one pack: this one, straight from source.
 *
 * The same plugin seeds a first-run lobby (Driftglass Reef, 3v3, heroes from
 * this pack only) so the first click on "Play" lands in a Tidelight match.
 * It seeds once per browser profile and never overwrites what you set after.
 */
import { realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACK = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = realpathSync(join(PACK, 'node_modules', '@moba2d', 'core'));
const INSTALLED = join(CORE, 'src', 'generated', 'installedPacks.ts');

const { createServer, build, preview } = await import(
  pathToFileURL(join(CORE, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href
);

const fsPath = file => JSON.stringify(file.split('\\').join('/'));

const INSTALLED_SOURCE = `
import code, { data } from ${fsPath(join(PACK, 'pack.ts'))};
import { assetManifest } from ${fsPath(join(PACK, 'generated', 'assetManifest.ts'))};
export const installedPacks = [
  { id: data.manifest.id, name: 'tidelight', packageName: '@moba2d/content-tidelight', data, code, assetManifest },
];
export const installedPackNames = ['reference', 'tidelight'];
`;

const bot = () => ({
  mode: 'champion',
  championName: 'random',
  summonerD: 'Charm_Riptide',
  summonerF: 'Charm_Lampglass',
});

/** First-run lobby: this map, 3v3, jungle slots on (the Heart lives in one). */
const SEED = {
  config: {
    mapId: 'tidelight:driftglass',
    playerTeam: 'team-blue',
    player: { mode: 'champion', championName: 'Wick', summonerD: 'Charm_Riptide', summonerF: 'Charm_Lampglass' },
    ai: {
      count: 5,
      bots: [bot(), bot(), bot(), bot(), bot()],
      botTeams: ['team-blue', 'team-blue', 'team-red', 'team-red', 'team-red'],
    },
    world: { jungle: true, minions: true },
  },
  pool: { disabledPacks: ['reference'] },
};

const SEED_SCRIPT = `
(function () {
  try {
    var done = 'tidelight:lobby-seeded:v5';
    if (localStorage.getItem(done)) return;
    localStorage.setItem('moba2d:pregameConfig:v1', ${JSON.stringify(JSON.stringify(SEED.config))});
    localStorage.setItem('moba2d:championPool:v1', ${JSON.stringify(JSON.stringify(SEED.pool))});
    // Core offers to download a default pack on a first boot. This build is
    // one game, so tell it the offer was already made (unless packs exist).
    if (!localStorage.getItem('moba2d:packs:v1')) localStorage.setItem('moba2d:packs:seeded:v1', '1');
    localStorage.setItem(done, '1');
  } catch (e) {}
})();
`;

// `--runtime`: core as it is deployed — no pack compiled in, no seeded lobby —
// so this pack can be installed into it from a manifest URL, the way a player
// would (`npm run build && npm run serve`, then the Packs screen).
const RUNTIME = process.argv.includes('--runtime');
const RUNTIME_SOURCE = `
export const installedPacks = [];
export const installedPackNames = ['reference'];
`;

const tidelightOnly = () => ({
  name: 'tidelight-only',
  enforce: 'pre',
  load(id) {
    if (id.split('?')[0].split('\\').join('/') === INSTALLED.split('\\').join('/')) {
      return RUNTIME ? RUNTIME_SOURCE : INSTALLED_SOURCE;
    }
    return null;
  },
  transformIndexHtml(html) {
    if (RUNTIME) return html;
    return {
      html: html.replace(/<title>[^<]*<\/title>/, '<title>Tidelight — Triều Đăng</title>'),
      tags: [{ tag: 'script', children: SEED_SCRIPT, injectTo: 'head-prepend' }],
    };
  },
});

const args = process.argv.slice(2);
const command = args[0] ?? 'dev';
const flag = name => {
  const at = args.indexOf(`--${name}`);
  return at < 0 ? null : (args[at + 1] ?? '');
};
const host = args.includes('--host') ? true : '127.0.0.1';

const shared = {
  configFile: join(CORE, 'vite.config.ts'),
  root: CORE,
  plugins: [tidelightOnly()],
  cacheDir: join(PACK, 'node_modules', '.vite-game'),
};

if (command === 'dev') {
  const server = await createServer({
    ...shared,
    server: {
      port: Number(flag('port')) || 5311,
      strictPort: true,
      host,
      fs: { allow: [CORE, PACK] },
    },
  });
  await server.listen();
  server.printUrls();
} else if (command === 'build') {
  await build({
    ...shared,
    build: { outDir: join(PACK, 'dist-game'), emptyOutDir: true },
  });
  console.log(`\ntidelight: built to ${join(PACK, 'dist-game')}`);
} else if (command === 'preview') {
  const server = await preview({
    ...shared,
    build: { outDir: join(PACK, 'dist-game') },
    preview: { port: Number(flag('port')) || 5312, strictPort: true, host },
  });
  server.printUrls();
} else {
  console.error(`unknown command "${command}" — use dev, build or preview`);
  process.exit(1);
}
