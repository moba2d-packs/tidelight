/**
 * The Heart in a real (headless) match: heroes standing by the lantern move
 * it, a hero's ultimate can shove it, and delivering it scores and wins.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApi, createGame, indexObjects, stubGameGlobals, type TestGame } from '@moba2d/core/testing';
import { BLUE, CENTER, GATE_S, KEEPS, RAIL_HALF, RED, WARDENS } from '../world/layout';
import { LIGHTS_TO_WIN, SLACK_MS } from '../world/rules';
import { createHeart, getHeart, tideTraits, type Heart } from '../world/heart';

const { Champion } = buildTestApi().units;
let game: TestGame;
let heart: Heart;

const hero = (teamId: string, dx = 0) => {
  const unit = new Champion({ game, teamId }) as any;
  unit.position.set(CENTER.x + dx, CENTER.y + 40);
  unit.destination.set(CENTER.x + dx, CENTER.y + 40);
  unit.stats.health.baseValue = 100;
  unit.stats.maxHealth.baseValue = 100;
  return unit;
};
const run = (ms: number, units: unknown[]) => {
  for (let t = 0; t < ms; t += 50) {
    indexObjects(game, units as never[]);
    (game as any).matchTimeMs += 50;
    heart.step(50);
  }
};

beforeEach(() => {
  stubGameGlobals();
  vi.stubGlobal('deltaTime', 16);
  game = createGame(4_000);
  (game as any).matchTimeMs = 1_000; // slack water: no current to account for
  (game as any).turrets = [];
  const watcher = new Champion({ game, teamId: BLUE }) as any;
  watcher.position.set(-5_000, -5_000); // the camera's hero, far from the reef
  game.setPlayer(watcher);
  heart = createHeart(game) as unknown as Heart;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the Heart of the reef', () => {
  it('is one per match', () => {
    expect(createHeart(game)).toBe(heart);
    expect(getHeart(game)).toBe(heart);
  });

  it('leaves the lantern alone when nobody escorts it', () => {
    run(1_000, []);
    expect(heart.lanternS).toBe(0);
  });

  it('moves it toward the enemy dock for whoever stands by it', () => {
    run(1_000, [hero(BLUE)]);
    expect(heart.lanternS).toBeGreaterThan(0);
  });

  it('stalls it when both courts stand by it', () => {
    run(1_000, [hero(BLUE), hero(RED)]);
    expect(heart.lanternS).toBe(0);
  });

  it('counts a ballast hero for two', () => {
    const anchor = hero(BLUE);
    tideTraits.set(anchor, { escortBonus: 1 });
    run(1_000, [anchor, hero(RED)]);
    expect(heart.lanternS).toBeGreaterThan(0);
  });

  it('holds it at a gate while that warden stands, and kicks cannot cheat it', () => {
    (game as any).turrets = [{ teamId: RED, isDead: false }];
    heart.kick(BLUE, GATE_S + 300);
    expect(heart.lanternS).toBe(GATE_S);
    (game as any).turrets = [{ teamId: RED, isDead: true }];
    heart.kick(BLUE, 100);
    expect(heart.lanternS).toBe(GATE_S + 100);
  });

  it('opens the gate when the warden falls, whatever the keep at home is doing', () => {
    const keep = { teamId: RED, isDead: false, position: { ...KEEPS[RED] } };
    (game as any).turrets = [keep, { teamId: RED, isDead: true, position: { ...WARDENS[RED] } }];
    heart.kick(BLUE, GATE_S + 200);
    expect(heart.lanternS).toBe(GATE_S + 200);
  });

  it('burns the warden under the lantern, never the keep', () => {
    const keep = { teamId: RED, isDead: false, health: 2400, position: { ...KEEPS[RED] }, takeDamage(n: number) { this.health -= n; } };
    const warden = { teamId: RED, isDead: false, health: 320, position: { ...WARDENS[RED] }, takeDamage(n: number) { this.health -= n; } };
    (game as any).turrets = [keep, warden];
    heart.kick(BLUE, GATE_S);
    run(2_000, [hero(BLUE, GATE_S)]);
    expect(keep.health).toBe(2400);
    expect(warden.health).toBeLessThan(320);
  });

  it('burns a warden down while an escort holds the lantern on its gate', () => {
    const warden = { teamId: RED, isDead: false, health: 320, takeDamage(amount: number) { this.health -= amount; } };
    (game as any).turrets = [warden];
    heart.kick(BLUE, GATE_S);
    const pusher = hero(BLUE, GATE_S);
    run(2_000, [pusher]);
    expect(heart.lanternS).toBe(GATE_S);
    expect(warden.health).toBeLessThan(320);
    const after = warden.health;
    run(1_000, []); // nobody holding it: the warden is left alone
    expect(warden.health).toBe(after);
  });

  it('never scores off a kick — the last step is walked', () => {
    heart.kick(BLUE, RAIL_HALF * 3);
    expect(heart.score.blue).toBe(0);
    expect(heart.lanternS).toBeLessThan(RAIL_HALF);
  });

  it('scores a light on delivery, relights in the middle, and ends the match at enough lights', () => {
    const pushers = [hero(BLUE), hero(BLUE), hero(BLUE)];
    const follow = () => pushers.forEach(unit => unit.position.set(heart.lanternPos.x, heart.lanternPos.y + 40));
    for (let lit = 1; lit <= LIGHTS_TO_WIN; lit++) {
      for (let guard = 0; guard < 4_000 && heart.score.blue < lit; guard++) {
        follow();
        run(50, pushers);
      }
      expect(heart.score.blue).toBe(lit);
      if (lit < LIGHTS_TO_WIN) expect(heart.lanternS).toBe(0);
    }
    expect(heart.winner).toBe(BLUE);
  });

  it('lets a hero call the tide, which then carries an unescorted lantern', () => {
    (game as any).matchTimeMs = SLACK_MS - 5_000;
    heart.overrideTide(RED, 8_000);
    expect(heart.tide().favoured).toBe(RED);
    run(1_000, []);
    expect(heart.lanternS).toBeLessThan(0);
  });

  it('answers one call at a time: a second call inside the lock changes nothing', () => {
    (game as any).matchTimeMs = SLACK_MS - 5_000;
    heart.overrideTide(RED, 8_000);
    heart.overrideTide(BLUE, 8_000);
    expect(heart.tide().favoured).toBe(RED);
  });
});
