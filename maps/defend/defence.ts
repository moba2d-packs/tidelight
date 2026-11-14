import { onMap } from '../onMap';
import { api } from '../../packApi';
import { issueCharms } from '../../world/charms';
import { DefenceHud } from './hud';
import { DEFENDERS, DEFEND_MAP_ID, DEFEND_SIZE, GATES, LANTERN, RAIDERS } from './layout';
import { ensureArt } from '../../world/art/sceneryObject';
import { defendArt } from './art';
import { findLantern } from './lantern';
import { RAIDER_TYPES } from './map';
import { RaiderSkills } from './raiderSkills';
import {
  initialDefence,
  stepDefence,
  type DefenceState,
  type RaiderKind,
  type WaveSpec,
} from './waves';

/**
 * The Thủ Đèn director — the one object in the map's neutral slot.
 *
 * It owns no art of its own (`./art.ts` paints the island, the lantern is a core turret). It
 * sends each wave through core's own minion spawner, scales the bodies, keeps
 * every champion on the defenders' side, hands out the sea charms and writes
 * the banner. All *deciding* is in `waves.ts`.
 */
export interface Defence {
  readonly state: DefenceState;
  readonly raiders: any[];
  readonly skills: RaiderSkills;
  step(dtMs: number): void;
}

const defences = new WeakMap<object, Defence>();
export const getDefence = (game: unknown): Defence | null => (game ? defences.get(game as object) : null) ?? null;

const SCAN_MS = 250;

function build() {
  const { Champion } = api.units;

  class DefenceObject extends api.GameObject implements Defence {
    alwaysVisible = true;
    // Above the units: it paints the casting labels over the raiders' heads.
    zIndex = api.layers.OBJECTIVE_Z_INDEX + 2;
    readonly state = initialDefence();
    raiders: any[] = [];
    readonly skills = new RaiderSkills((at, damageMult) => this.spawnAt('crab', at, damageMult));
    private flash: { text: string; untilMs: number } | null = null;
    private clockMs = 0;
    private scanClock = 0;
    private hudClock = 0;
    private spawnerOff = false;
    private hud: DefenceHud;

    constructor(game: any) {
      super({ game, position: createVector(LANTERN.x, LANTERN.y) });
      defences.set(game, this);
      this.hud = new DefenceHud(() => {
        if (typeof game.onRestartRequested === 'function') game.onRestartRequested();
        else if (typeof location !== 'undefined') location.reload();
      });
    }

    private get world(): any {
      return this.game;
    }

    private say(text: string, ms = 3_000): void {
      this.flash = { text, untilMs: this.clockMs + ms };
    }

    /** Everyone fights for the lantern: no champion may stay on the raiders' side. */
    private adopt(): void {
      const champions = this.world.objectManager.queryObjects({
        area: new api.utils.Quadtree.Circle({ x: LANTERN.x, y: LANTERN.y, r: DEFEND_SIZE }),
        filters: [],
      });
      for (const unit of champions) {
        if (!(unit instanceof Champion)) continue;
        if (unit.teamId === RAIDERS) {
          unit.teamId = DEFENDERS;
          const home = this.world.randomSpawnPoint?.(DEFENDERS);
          if (home) {
            unit.position.set(home.x, home.y);
            unit.destination.set(home.x, home.y);
          }
        }
        issueCharms(unit);
      }
    }

    private spawn(kind: RaiderKind, gate: number, healthMult: number, damageMult: number): any {
      const body = this.world.minionSpawner?.spawn({ teamId: RAIDERS, lane: GATES[gate].id, kind });
      if (!body) return null;
      const base = RAIDER_TYPES[kind];
      const hp = Math.round(base.health * healthMult);
      body.stats.maxHealth.baseValue = hp;
      body.stats.health.baseValue = hp;
      body.damage = Math.round(base.damage * damageMult);
      this.raiders.push(body);
      this.skills.track(body, kind, damageMult, this.clockMs);
      return body;
    }

    /** A summoned body: spawned at the first gate, then put where it was called. */
    private spawnAt(kind: RaiderKind, at: { x: number; y: number }, damageMult: number): void {
      const body = this.spawn(kind, 0, 1 + (damageMult - 1) * 0.8, damageMult);
      if (!body?.position) return;
      body.position.set(at.x, at.y);
      body.destination?.set?.(at.x, at.y);
    }

    private send(wave: WaveSpec): void {
      for (const { kind, gate } of wave.spawns) this.spawn(kind, gate, wave.healthMult, wave.damageMult);
      const bosses = wave.spawns
        .filter(s => s.kind === 'tidelord' || s.kind === 'kraken')
        .map(s => RAIDER_TYPES[s.kind].name);
      this.say(bosses.length ? `Sóng ${wave.number}: ${bosses.join(' và ')} xuất hiện!` : `Sóng ${wave.number}!`);
    }

    step(dtMs: number): void {
      this.clockMs += dtMs;
      // The spawner is built after the neutral slots, so it can only be silenced from here.
      const spawner = this.world.minionSpawner;
      if (!this.spawnerOff && spawner) {
        spawner.setEnabled?.(false);
        this.spawnerOff = true;
      }
      this.scanClock += dtMs;
      if (this.scanClock >= SCAN_MS) {
        this.scanClock = 0;
        this.adopt();
      }
      this.raiders = this.raiders.filter(m => !m.isDead && !m.toRemove);
      const lantern = findLantern(this.world);
      // No lantern yet means the turrets are not built: not a loss.
      const wave = stepDefence(this.state, dtMs, {
        lanternAlive: lantern ? !lantern.isDead : true,
        hostiles: this.raiders.length,
      });
      if (wave) this.send(wave);
      this.skills.step(this.clockMs);
    }

    update(): void {
      this.step(deltaTime);
      this.hudClock += deltaTime;
      if (this.hudClock < 120) return;
      this.hudClock = 0;
      const lantern = findLantern(this.world);
      this.hud.render({
        wave: this.state.wave,
        nextWaveInS: Math.max(0, Math.ceil(this.state.nextWaveInMs / 1000)),
        lanternHp: lantern ? Math.max(0, lantern.stats.health.value) : 0,
        lanternMax: lantern ? lantern.stats.maxHealth.value : 0,
        raiders: this.raiders.length,
        outcome: this.state.outcome,
        flash: this.flash && this.flash.untilMs > this.clockMs ? this.flash.text : null,
      });
    }

    /** The skill a raider is winding up, named over its head in the skill's colour. */
    draw(): void {
      for (const body of this.raiders) {
        const skill = this.skills.winding(body);
        if (!skill || !body.position || body.visibleToPlayerTeam === false) continue;
        const r = (RAIDER_TYPES[body.kind ?? '']?.size ?? 40) / 2;
        push();
        textAlign(CENTER, CENTER);
        textSize(18);
        textStyle(BOLD);
        stroke(0, 0, 0, 200);
        strokeWeight(4);
        fill(skill.tint[0], skill.tint[1], skill.tint[2]);
        text(skill.name + '!', body.position.x, body.position.y - r - 34);
        pop();
      }
    }

    getDisplayBoundingBox() {
      return this.squareDisplayBoundingBox(DEFEND_SIZE * 2);
    }

    /** Core's restart/exit does not remove objects one by one: let go of the DOM here too. */
    onMatchTeardown(): void {
      this.onRemoved();
    }

    onRemoved(): void {
      this.hud.destroy();
    }
  }
  return DefenceObject;
}

let DefenceClass: ReturnType<typeof build> | null = null;

/** Build the director at the map's neutral slot. One per match. */
export function createDefence(game: any) {
  // The slot object and the passives' `ensureDefence` both come through here, so the island is painted with the jungle on or off.
  if (onMap(game, DEFEND_MAP_ID)) ensureArt(game, DEFEND_MAP_ID, DEFEND_SIZE, defendArt);
  DefenceClass ??= build();
  return (defences.get(game) as InstanceType<typeof DefenceClass> | undefined) ?? new DefenceClass(game);
}

/** For hero passives: make sure a Thủ Đèn match has its director even with the jungle switched off. */
export function ensureDefence(game: any): Defence | null {
  const existing = defences.get(game);
  if (existing) return existing;
  if (!onMap(game, DEFEND_MAP_ID)) return null;
  const made = createDefence(game);
  game.objectManager.addObject(made as any);
  return made;
}
