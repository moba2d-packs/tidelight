#!/usr/bin/env node
/**
 * Drive a real browser through a Tidelight match and save what it looked like.
 *
 *   node scripts/game.mjs dev &          # the game has to be running
 *   node scripts/shoot.mjs               # -> docs/screenshots/*.png
 *
 * Two passes, desktop (1440x900, mouse + keys) and phone landscape (844x390,
 * touch): the lobby, the opening, a fight at the lantern after a few casts, a
 * turned tide, and the end card. Playwright comes from core's own devDeps.
 *
 * `--url`, `--only desktop|phone|portrait` and `--hero <name>` narrow a run;
 * `--cpu 4` throttles the CPU 4x to stand in for a mid-range phone.
 */
import { mkdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = realpathSync(join(PACK, 'node_modules', '@moba2d', 'core'));
const { chromium } = createRequire(join(CORE, 'package.json'))('playwright');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at < 0 ? fallback : args[at + 1];
};
const URL_BASE = flag('url', 'http://127.0.0.1:5311/');
const ONLY = flag('only', '');
const HERO = flag('hero', '');
const CPU = Number(flag('cpu', '1')) || 1;
// `--install <manifest url>`: the page is a bare core; install this pack into
// it through the Packs screen first, the way a player does, then play.
const INSTALL = flag('install', '');
const PREFIX = flag('prefix', '');

const LOBBY = {
  mapId: 'tidelight:driftglass',
  playerTeam: 'team-blue',
  player: { mode: 'champion', championName: 'Wick', summonerD: 'Charm_Riptide', summonerF: 'Charm_Lampglass' },
  ai: {
    count: 5,
    bots: Array.from({ length: 5 }, () => ({
      mode: 'champion',
      championName: 'random',
      summonerD: 'Charm_Riptide',
      summonerF: 'Charm_Lampglass',
    })),
    botTeams: ['team-blue', 'team-blue', 'team-red', 'team-red', 'team-red'],
  },
  world: { jungle: true, minions: true },
};
const OUT = join(PACK, 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(done => setTimeout(done, ms));

async function run(name, viewport, touch) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: touch ? 2 : 1,
    hasTouch: touch,
    isMobile: touch,
  });
  const page = await context.newPage();
  if (CPU > 1) {
    // Stand in for a mid-range phone: slow the main thread down by this factor.
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  }
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const shot = async label => {
    await page.screenshot({ path: join(OUT, `${PREFIX}${name}-${label}.png`) });
    console.log(`  ${PREFIX}${name}-${label}.png`);
  };

  if (HERO) {
    await page.addInitScript(hero => {
      try {
        const key = 'moba2d:pregameConfig:v1';
        const config = JSON.parse(localStorage.getItem(key) ?? 'null');
        if (config && !sessionStorage.getItem('tl-hero')) {
          config.player.championName = hero;
          localStorage.setItem(key, JSON.stringify(config));
          sessionStorage.setItem('tl-hero', '1');
        }
      } catch {}
    }, HERO);
  }

  if (INSTALL) {
    // Core's Packs shelf paints this pack's logo from where it will be
    // published. Until it is, answer that one URL from the local pack server.
    const local = INSTALL.replace(/manifest\.json$/, '');
    await page.route('https://moba2d-packs.github.io/tidelight/**', async route => {
      const file = route.request().url().split('/tidelight/')[1];
      const response = await fetch(local + file);
      await route.fulfill({
        status: response.status,
        headers: { 'content-type': response.headers.get('content-type') ?? '', 'access-control-allow-origin': '*' },
        body: Buffer.from(await response.arrayBuffer()),
      });
    });
    // No default-pack download on this first boot: the proof is this pack alone.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('moba2d:packs:seeded:v1', '1');
      } catch {}
    });
  }
  await page.goto(URL_BASE + (touch ? '?touch=1' : ''));
  if (HERO) await page.reload();
  await page.waitForSelector('#play-btn', { timeout: 60_000 });
  if (INSTALL) {
    await page.click('#packs-btn');
    await page.waitForSelector('#packs-tab-browse', { timeout: 30_000 });
    await page.click('#packs-tab-browse');
    await page.fill('#pack-url-input', INSTALL);
    await page.click('#pack-url-check');
    await page.waitForSelector('#pack-confirm-install', { timeout: 30_000 });
    await sleep(300);
    await shot('0-install');
    await page.click('#pack-confirm-install');
    await page.waitForSelector('#pack-confirm-install', { state: 'detached', timeout: 60_000 });
    await sleep(2500);
    await shot('0-installed');
    await page.evaluate(lobby => {
      localStorage.setItem('moba2d:pregameConfig:v1', JSON.stringify(lobby));
      localStorage.setItem('moba2d:championPool:v1', JSON.stringify({ disabledPacks: ['reference'] }));
    }, LOBBY);
    await page.reload();
    await page.waitForSelector('#play-btn', { timeout: 60_000 });
  }
  await sleep(600);
  await shot('1-menu');
  await page.click('#play-btn');
  await page.waitForSelector('#pregame-start-btn', { timeout: 30_000 });
  await sleep(500);
  await shot('2-lobby');
  await page.click('#pregame-start-btn');
  const nudge = await page.$('#pack-nudge-play');
  if (nudge) await nudge.click().catch(() => {});
  await page.waitForSelector('#tidelight-hud', { timeout: 60_000 });
  await sleep(3500);
  await shot('3-opening');

  // Walk to the lantern and throw the kit around.
  const game = () => page.evaluate(() => {
    const g = window.__tidelight?.game;
    return g ? { t: g.matchTimeMs, x: g.player.position.x, y: g.player.position.y } : null;
  });
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  if (touch) {
    // Joystick: bottom-left. Drag right and hold.
    const jx = viewport.width * 0.14;
    const jy = viewport.height * 0.72;
    await page.touchscreen.tap(jx, jy).catch(() => {});
  }
  // Teleport-free: let the debug hook move the player onto the rail if present.
  await page.evaluate(() => {
    const g = window.__tidelight?.game;
    if (g) g.player.position.set(1500, 1640);
  });
  await sleep(1400);
  if (!touch) {
    await page.mouse.move(cx + 220, cy - 30);
    for (const key of ['q', 'e', 'w', 'r']) {
      await page.keyboard.press(key);
      await sleep(260);
    }
  }
  await sleep(500);
  await shot('4-lantern');

  // Jump the clock into the first tide so the shoals and current show.
  await page.evaluate(() => {
    const g = window.__tidelight?.game;
    if (g) {
      g.matchTimeMs = Math.max(g.matchTimeMs, 22_000);
    }
  });
  await sleep(4500);
  await page.evaluate(() => {
    const t = window.__tidelight;
    if (t) t.game.player.position.set(t.heart.lanternPos.x - 90, t.heart.lanternPos.y + 50);
  });
  await sleep(1300);
  if (!touch) {
    await page.mouse.move(cx - 200, cy + 40);
    await page.keyboard.press('q');
    await sleep(200);
    await page.keyboard.press('e');
  }
  // A kill, so core's feed and banner are on screen with the Lantern strip.
  const killed = await page.evaluate(() => {
    const t = window.__tidelight;
    if (!t) return null;
    const me = t.game.player;
    const foe = t.heart
      .unitsNear({ x: 1500, y: 1500 }, 5000)
      .find(unit => unit.avatar && unit.spells?.length >= 5 && unit.teamId !== me.teamId && !unit.isDead);
    if (!foe) return 'no foe';
    foe.takeDamage(99_999, me);
    return foe.name ?? 'foe';
  });
  console.log(`  kill: ${killed}`);
  await sleep(900);
  await shot('5-tide');

  // A shoal, flooded or dry.
  await page.evaluate(() => {
    const g = window.__tidelight?.game;
    if (g) g.player.position.set(1500, 960);
  });
  await sleep(2500);
  await shot('6-shoal');

  // The end card.
  await page.evaluate(() => {
    const h = window.__tidelight?.heart;
    if (h) {
      h.score.blue = 2;
    }
  });
  await sleep(1500);
  await shot('7-end');

  const fps = await page.evaluate(() => (typeof frameRate === 'function' ? Math.round(frameRate()) : null));
  console.log(`  ${name}: fps≈${fps}, state=${JSON.stringify(await game())}, errors=${errors.length}`);
  for (const error of errors.slice(0, 8)) console.log(`    ! ${error.slice(0, 300)}`);
  await browser.close();
}

if (!ONLY || ONLY === 'desktop') await run('desktop', { width: 1440, height: 900 }, false);
if (!ONLY || ONLY === 'phone') await run('phone', { width: 844, height: 390 }, true);
if (!ONLY || ONLY === 'portrait') await run('portrait', { width: 390, height: 844 }, true);
