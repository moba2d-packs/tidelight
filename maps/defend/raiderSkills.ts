import type { AttackableUnit } from '@moba2d/core/content/types';
import { api } from '../../packApi';
import type { burst as Burst, enemiesAt as EnemiesAt, fireBolt as FireBolt, layZone as LayZone, slow as Slow, Vec } from '../../world/fx';

/**
 * `world/fx.ts` builds engine classes when it is evaluated, so the data half
 * (which reaches this file through the map's slot object) must not import it.
 * fx hands its helpers over instead, from its own last line.
 */
export interface RaiderFx {
  burst: typeof Burst;
  enemiesAt: typeof EnemiesAt;
  fireBolt: typeof FireBolt;
  layZone: typeof LayZone;
  slow: typeof Slow;
}
let fx: RaiderFx | null = null;
export const provideRaiderFx = (helpers: RaiderFx): void => {
  fx = helpers;
};
const burst: typeof Burst = (...a) => fx!.burst(...a);
const enemiesAt: typeof EnemiesAt = (...a) => fx!.enemiesAt(...a);
const fireBolt: typeof FireBolt = (...a) => fx!.fireBolt(...a);
const layZone: typeof LayZone = (...a) => fx!.layZone(...a);
const slow: typeof Slow = (...a) => fx!.slow(...a);
import { INK, type Rgb } from '../../world/palette';
import type { RaiderKind } from './waves';

/**
 * What the raiders of Thủ Đèn do besides walk and swing — reported as
 * "lính chỉ to thôi thì ko vui lắm". Every skill telegraphs first (a ring and
 * the skill's name over the caster for `windupMs`), then lands: something a
 * defender can read and step out of.
 *
 * The director owns the clock and calls `RaiderSkills.step`; nothing here reads
 * `deltaTime`. Damage scales with the wave's `damageMult`, like the swing does.
 */
export interface RaiderSkill {
  name: string;
  cooldownMs: number;
  /** How near a defender must be, centre to centre. */
  range: number;
  windupMs: number;
  /** Delay before the first cast after the body appears. */
  firstMs: number;
  tint: Rgb;
}

export const RAIDER_SKILLS: Partial<Record<RaiderKind, RaiderSkill>> = {
  spitter: { name: 'Phun Mực', cooldownMs: 6_000, range: 300, windupMs: 450, firstMs: 2_500, tint: [168, 110, 235] },
  brute: { name: 'Dập Rạn', cooldownMs: 7_000, range: 150, windupMs: 800, firstMs: 1_500, tint: INK.CORAL },
  eel: { name: 'Phóng Điện', cooldownMs: 5_000, range: 460, windupMs: 350, firstMs: 1_500, tint: INK.LANTERN_HOT },
  jelly: { name: 'Sứa Hồi Sinh', cooldownMs: 6_000, range: 300, windupMs: 500, firstMs: 3_000, tint: INK.TIDE },
  tidelord: { name: 'Sóng Thần', cooldownMs: 8_000, range: 240, windupMs: 1_000, firstMs: 2_000, tint: INK.TIDE },
  kraken: { name: 'Xúc Tu', cooldownMs: 7_000, range: 520, windupMs: 750, firstMs: 2_000, tint: INK.CORAL },
};

export const SPIT_RADIUS = 105;
export const SPIT_LIFE_MS = 2_600;
export const SPIT_TICK_MS = 500;
export const SPIT_DAMAGE = 5;
export const SPIT_SLOW = 0.35;

export const SLAM_RADIUS = 150;
export const SLAM_DAMAGE = 20;
export const SLAM_STUN_MS = 700;

export const SPARK_DAMAGE = 14;
export const SPARK_SLOW = 0.45;
export const SPARK_SLOW_MS = 1_200;

/** A jelly heals every raider round it (itself too) by this share of their max health. */
export const JELLY_HEAL_SHARE = 0.15;
/** It casts only when someone in reach is below this share. */
export const JELLY_HURT_SHARE = 0.85;

export const WAVE_RADIUS = 240;
export const WAVE_DAMAGE = 30;
export const WAVE_PUSH = 170;

export const TENTACLE_TARGETS = 3;
export const TENTACLE_DAMAGE = 16;
export const TENTACLE_ROOT_MS = 1_400;

/** The Chúa Triều calls crabs when it falls past each of these shares of its health. */
export const SUMMON_AT = [0.66, 0.33] as const;
export const SUMMON_COUNT = 3;

interface Cast {
  fireAtMs: number;
  /** Where it lands (the caster's spot for a slam or a wave). */
  at: Vec;
  victims: AttackableUnit[];
}
interface Caster {
  kind: RaiderKind;
  damageMult: number;
  readyAtMs: number;
  cast: Cast | null;
  summonsDone: number;
}

/** Squid ink: violet, so it reads on the dark sea the island floats in. */
export const INK_VIOLET: Rgb = [168, 110, 235];

const isChampion = (unit: unknown): unit is AttackableUnit => unit instanceof api.units.Champion;
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const healthShare = (u: any): number => {
  const max = u.stats?.maxHealth?.value ?? 0;
  return max > 0 ? (u.stats.health.value ?? 0) / max : 1;
};

/** Defender champions in reach of `raider`, nearest first. */
function defendersNear(raider: AttackableUnit, range: number): AttackableUnit[] {
  return enemiesAt(raider, raider.position, range)
    .filter(u => isChampion(u) && !u.isDead && u.targetable !== false)
    .sort((a, b) => dist(a.position, raider.position) - dist(b.position, raider.position));
}

/** Raiders (same team, alive, not champions) within `radius` of `at`. */
function raidersNear(raider: AttackableUnit, at: Vec, radius: number): AttackableUnit[] {
  const found = raider.game.objectManager.queryObjects({
    area: new api.utils.Quadtree.Circle({ x: at.x, y: at.y, r: radius }),
    filters: [],
  }) as AttackableUnit[];
  return found.filter(u => u.teamId === raider.teamId && !u.isDead && !(u as any).toRemove && u.stats?.health);
}

export class RaiderSkills {
  private readonly casters = new Map<AttackableUnit, Caster>();
  /** Calls `spawnCrab(at)` for the Chúa Triều's summons; the director owns the spawner. */
  constructor(private readonly spawnCrab: (at: Vec, damageMult: number) => void) {}

  track(body: AttackableUnit, kind: RaiderKind, damageMult: number, nowMs: number): void {
    const skill = RAIDER_SKILLS[kind];
    if (!skill) return;
    this.casters.set(body, { kind, damageMult, readyAtMs: nowMs + skill.firstMs, cast: null, summonsDone: 0 });
  }

  /** The skill being wound up by `body` right now, for the overhead label. */
  winding(body: AttackableUnit): RaiderSkill | null {
    const c = this.casters.get(body);
    return c?.cast ? (RAIDER_SKILLS[c.kind] ?? null) : null;
  }

  get size(): number {
    return this.casters.size;
  }

  step(nowMs: number): void {
    // Before the code half has loaded there is nothing to cast with; the raiders just walk.
    if (!fx) return;
    for (const [body, c] of this.casters) {
      if (body.isDead || (body as any).toRemove) {
        this.casters.delete(body);
        continue;
      }
      if (!body.position || !body.game) continue;
      if (c.kind === 'tidelord') this.summon(body, c);
      const skill = RAIDER_SKILLS[c.kind]!;
      if (c.cast) {
        if (nowMs >= c.cast.fireAtMs) {
          // Cleared first: a skill that throws must not be re-landed every tick.
          const cast = c.cast;
          c.cast = null;
          this.land(body, c, cast);
        }
        continue;
      }
      if (nowMs < c.readyAtMs) continue;
      const cast = this.begin(body, c, skill, nowMs);
      if (!cast) continue;
      c.cast = cast;
      c.readyAtMs = nowMs + skill.cooldownMs;
      const ring = c.kind === 'brute' ? SLAM_RADIUS : c.kind === 'tidelord' ? WAVE_RADIUS : c.kind === 'spitter' ? SPIT_RADIUS : 60;
      for (const at of cast.victims.length && c.kind === 'kraken' ? cast.victims.map(v => v.position) : [cast.at])
        burst(body, at, ring, skill.tint, 'ring', skill.windupMs);
    }
  }

  /** Pick the target and the spot, or null when there is nothing to cast at. */
  private begin(body: AttackableUnit, c: Caster, skill: RaiderSkill, nowMs: number): Cast | null {
    const fireAtMs = nowMs + skill.windupMs;
    if (c.kind === 'jelly') {
      const hurt = raidersNear(body, body.position, skill.range).some(u => healthShare(u) < JELLY_HURT_SHARE);
      return hurt ? { fireAtMs, at: { x: body.position.x, y: body.position.y }, victims: [] } : null;
    }
    const near = defendersNear(body, skill.range);
    if (!near.length) return null;
    if (c.kind === 'brute' || c.kind === 'tidelord')
      return { fireAtMs, at: { x: body.position.x, y: body.position.y }, victims: [] };
    if (c.kind === 'kraken') {
      const victims = near.slice(0, TENTACLE_TARGETS);
      return { fireAtMs, at: { x: victims[0].position.x, y: victims[0].position.y }, victims };
    }
    const t = near[0].position;
    return { fireAtMs, at: { x: t.x, y: t.y }, victims: [near[0]] };
  }

  private land(body: AttackableUnit, c: Caster, cast: Cast): void {
    const m = c.damageMult;
    const name = RAIDER_SKILLS[c.kind]!.name;
    switch (c.kind) {
      case 'spitter':
        layZone(
          body,
          cast.at,
          SPIT_RADIUS,
          SPIT_LIFE_MS,
          SPIT_TICK_MS,
          target => {
            target.takeDamage(Math.round(SPIT_DAMAGE * m), body, 'MAGIC', name);
            slow(body, target, SPIT_SLOW, SPIT_TICK_MS + 200, 'tidelight:raider-ink');
          },
          { tint: INK_VIOLET, glyph: 'pool' }
        );
        return;
      case 'brute':
        for (const enemy of enemiesAt(body, body.position, SLAM_RADIUS)) {
          enemy.takeDamage(Math.round(SLAM_DAMAGE * m), body, 'PHYSICAL', name);
          if (isChampion(enemy)) enemy.addBuff(new api.buffs.Stun(SLAM_STUN_MS, body, enemy));
        }
        burst(body, body.position, SLAM_RADIUS, INK.CORAL, 'crater', 520);
        return;
      case 'eel':
        // A p5 vector: core's aim helpers call `.copy()` on it.
        fireBolt(body, createVector(cast.at.x, cast.at.y), RAIDER_SKILLS.eel!.range + 60, {
          damage: Math.round(SPARK_DAMAGE * m),
          damageType: 'MAGIC',
          label: name,
          shape: 'spark',
          tint: INK.LANTERN_HOT,
          speed: 15,
          afterHit: target => slow(body, target, SPARK_SLOW, SPARK_SLOW_MS, 'tidelight:raider-spark'),
        });
        return;
      case 'jelly':
        for (const ally of raidersNear(body, body.position, RAIDER_SKILLS.jelly!.range)) {
          const max = ally.stats.maxHealth.value;
          ally.takeHeal(Math.round(max * JELLY_HEAL_SHARE));
        }
        burst(body, body.position, RAIDER_SKILLS.jelly!.range, INK.TIDE, 'splash', 520);
        return;
      case 'tidelord':
        for (const enemy of enemiesAt(body, body.position, WAVE_RADIUS)) {
          enemy.takeDamage(Math.round(WAVE_DAMAGE * m), body, 'PHYSICAL', name);
          if (isChampion(enemy)) push(body, enemy, WAVE_PUSH);
        }
        burst(body, body.position, WAVE_RADIUS, INK.TIDE, 'splash', 700);
        return;
      case 'kraken':
        for (const victim of cast.victims) {
          if (victim.isDead) continue;
          victim.takeDamage(Math.round(TENTACLE_DAMAGE * m), body, 'MAGIC', name);
          victim.addBuff(new api.buffs.Root(TENTACLE_ROOT_MS, body, victim));
          burst(body, victim.position, 70, INK.CORAL, 'crater', 600);
        }
        return;
    }
  }

  private summon(body: AttackableUnit, c: Caster): void {
    const share = healthShare(body);
    while (c.summonsDone < SUMMON_AT.length && share <= SUMMON_AT[c.summonsDone]) {
      c.summonsDone++;
      for (let i = 0; i < SUMMON_COUNT; i++) {
        const a = (i / SUMMON_COUNT) * Math.PI * 2;
        this.spawnCrab({ x: body.position.x + Math.cos(a) * 90, y: body.position.y + Math.sin(a) * 90 }, c.damageMult);
      }
      burst(body, body.position, 160, INK.TIDE, 'splash', 600);
    }
  }
}

/** Shove `target` straight away from `from` by `distance`, as a short dash. */
function push(from: AttackableUnit, target: AttackableUnit, distance: number): void {
  if (!api.buffs.Dash.CanDash(target)) return;
  const dx = target.position.x - from.position.x;
  const dy = target.position.y - from.position.y;
  const len = Math.hypot(dx, dy) || 1;
  const dash = new api.buffs.Dash(400, from, target);
  dash.dashDestination = createVector(target.position.x + (dx / len) * distance, target.position.y + (dy / len) * distance);
  dash.dashSpeed = 18;
  target.addBuff(dash);
}
