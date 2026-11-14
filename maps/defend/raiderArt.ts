import type { MinionBodyDraw } from '@moba2d/core/content/ContentPack';

/**
 * The raiders' own bodies — seven sea creatures in place of core's lane soldier
 * and caster (core contract 26, `MinionTypeDef.draw`).
 *
 * Every body is drawn in the frame core already rotated to the raider's aim:
 * the origin is its centre, `+x` is forward, `view.size` is its diameter.
 *
 * What each one has to say at phone zoom, in this order:
 *   - whose it is: the big shape is always `colors.body`, outlined in `colors.trim`;
 *   - which way it faces: the weapon (claws, snout, fists, spark, trident) is out front;
 *   - melee or ranged: a melee body carries something that *reaches* (`view.reach`
 *     slides it), a ranged one carries a lit dot at its mouth that swells with
 *     `view.charge`.
 *
 * Budget: a wave reaches 80 bodies, so a body is counted in painted paths
 * (`fill` / `stroke` calls). `RAIDER_OP_BUDGET` is the ceiling per kind and
 * `tests/defendRaiderArt.test.ts` holds every body to it. `view.thin` is the
 * drowning-machine variant: team colour and facing, nothing else.
 */

const TAU = Math.PI * 2;

const SHELL = '#efe3c4';
const STONE = '#9a958b';
const ACID = '#baff6b';
const SPARK = '#ffe95e';
const PEARL = '#fff7e2';
const GOLD = '#ffd24a';
const INK = '#2b1742';
const EYE = '#ffffff';
const DARK = '#141018';

/** Adds a full circle to the current path. */
const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void => {
  ctx.moveTo(x + radius, y);
  ctx.arc(x, y, radius, 0, TAU);
};

/** Adds a pincer to the current path: a disc with a wedge of `gap` radians bitten out of its front. */
const pincer = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, gap: number): void => {
  ctx.moveTo(x, y);
  ctx.arc(x, y, radius, gap, TAU - gap);
  ctx.closePath();
};

/** Cua Rạn — melee. A wide shell, six legs, two claws that haul back and snap. */
const crab: MinionBodyDraw = (ctx, v) => {
  const r = v.size / 2;
  const clawX = r * 0.92 + v.reach;
  const gap = 0.32 + 0.5 * v.charge;

  if (v.thin) {
    ctx.fillStyle = v.colors.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.82, r * 1.05, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = v.colors.bar;
    ctx.beginPath();
    pincer(ctx, clawX, -r * 0.66, r * 0.5, 0.4);
    pincer(ctx, clawX, r * 0.66, r * 0.5, 0.4);
    ctx.fill();
    return;
  }

  const step = Math.sin(v.timeMs * 0.012 + v.seed) * r * 0.16;
  ctx.strokeStyle = v.colors.trim;
  ctx.lineWidth = Math.max(1.5, r * 0.17);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = -1; i <= 1; i++) {
    const x = i * r * 0.4 - r * 0.12;
    const sway = i === 0 ? -step : step;
    ctx.moveTo(x, -r * 0.7);
    ctx.lineTo(x - r * 0.25 + sway, -r * 1.55);
    ctx.moveTo(x, r * 0.7);
    ctx.lineTo(x - r * 0.25 - sway, r * 1.55);
  }
  ctx.stroke();

  ctx.fillStyle = v.colors.bar;
  ctx.beginPath();
  pincer(ctx, clawX, -r * 0.66, r * 0.52, gap);
  pincer(ctx, clawX, r * 0.66, r * 0.52, gap);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = v.colors.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.82, r * 1.05, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = EYE;
  ctx.beginPath();
  dot(ctx, r * 0.62, -r * 0.3, r * 0.15);
  dot(ctx, r * 0.62, r * 0.3, r * 0.15);
  ctx.fill();
};

/** Ốc Phun — ranged. A spiral shell riding a pale foot, with a spit bead at the mouth. */
const spitter: MinionBodyDraw = (ctx, v) => {
  const r = v.size / 2;
  const shellX = -r * 0.28;

  ctx.fillStyle = SHELL;
  ctx.beginPath();
  ctx.ellipse(r * 0.3, 0, r * 1.0, r * 0.5, 0, 0, TAU);
  ctx.fill();
  if (!v.thin) {
    // outlined, or a pale foot melts into pale sand
    ctx.strokeStyle = v.colors.trim;
    ctx.lineWidth = Math.max(1.5, r * 0.17);
    ctx.stroke();
  }

  ctx.fillStyle = v.colors.body;
  ctx.beginPath();
  dot(ctx, shellX, 0, r * 0.84);
  ctx.fill();

  ctx.fillStyle = ACID;
  ctx.beginPath();
  dot(ctx, r * 1.28, 0, r * (0.2 + 0.42 * v.charge));
  ctx.fill();
  if (v.thin) return;

  ctx.strokeStyle = v.colors.trim;
  ctx.lineWidth = Math.max(1.5, r * 0.17);
  ctx.lineCap = 'round';
  ctx.beginPath();
  dot(ctx, shellX, 0, r * 0.84);
  ctx.moveTo(shellX + r * 0.52, 0);
  ctx.arc(shellX, 0, r * 0.52, 0, 4.4);
  ctx.arc(shellX - r * 0.08, r * 0.02, r * 0.24, 4.4, 9);
  ctx.stroke();

  const nod = Math.sin(v.timeMs * 0.004 + v.seed) * r * 0.1;
  ctx.strokeStyle = SHELL;
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(r * 0.95, -r * 0.2);
  ctx.lineTo(r * 1.3, -r * 0.62 + nod);
  ctx.moveTo(r * 0.95, r * 0.2);
  ctx.lineTo(r * 1.3, r * 0.62 - nod);
  ctx.stroke();
};

/** Hà Đá — melee. A slab of barnacled rock with two stone fists that punch. */
const BRUTE_ROCK = [1.0, 0.1, 0.62, 0.86, -0.3, 1.0, -0.98, 0.5, -0.9, -0.42, -0.2, -1.0, 0.66, -0.8];
const brute: MinionBodyDraw = (ctx, v) => {
  const r = v.size / 2;
  const fistX = r * 0.98 + v.reach;

  ctx.fillStyle = v.colors.body;
  ctx.beginPath();
  ctx.moveTo(BRUTE_ROCK[0] * r, BRUTE_ROCK[1] * r);
  for (let i = 2; i < BRUTE_ROCK.length; i += 2) ctx.lineTo(BRUTE_ROCK[i] * r, BRUTE_ROCK[i + 1] * r);
  ctx.closePath();
  ctx.fill();

  if (v.thin) {
    ctx.fillStyle = STONE;
    ctx.beginPath();
    dot(ctx, fistX, -r * 0.6, r * 0.42);
    dot(ctx, fistX, r * 0.6, r * 0.42);
    ctx.fill();
    return;
  }

  ctx.strokeStyle = v.colors.trim;
  ctx.lineWidth = Math.max(2, r * 0.15);
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.fillStyle = STONE;
  ctx.beginPath();
  dot(ctx, fistX, -r * 0.6, r * (0.42 + 0.08 * v.charge));
  dot(ctx, fistX, r * 0.6, r * (0.42 + 0.08 * v.charge));
  ctx.fill();
  ctx.stroke();

  // the barnacle: a pale six-plated cone with a dark slit that breathes — a
  // round hole here reads as an eyeball
  const cx = -r * 0.15;
  ctx.fillStyle = SHELL;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6;
    ctx.lineTo(cx + Math.cos(a) * r * 0.56, Math.sin(a) * r * 0.56);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const open = 0.1 + 0.05 * Math.sin(v.timeMs * 0.003 + v.seed);
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.moveTo(cx + r * open, 0);
  ctx.lineTo(cx, r * 0.34);
  ctx.lineTo(cx - r * open, 0);
  ctx.lineTo(cx, -r * 0.34);
  ctx.closePath();
  ctx.fill();
};

/** Lươn Điện — ranged. A long body that swims in place, a spark held at the snout. */
const eel: MinionBodyDraw = (ctx, v) => {
  const r = v.size / 2;
  const swim = Math.sin(v.timeMs * 0.008 + v.seed) * r * 0.5;
  const flick = v.thin ? 1 : 0.85 + 0.15 * Math.sin(v.timeMs * 0.03 + v.seed);

  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r * 0.5, 0);
  ctx.quadraticCurveTo(-r * 0.3, swim, -r * 1.0, -swim * 0.4);
  ctx.quadraticCurveTo(-r * 1.6, -swim, -r * 2.1, swim * 0.7);
  if (!v.thin) {
    ctx.strokeStyle = v.colors.trim;
    ctx.lineWidth = r * 0.78;
    ctx.stroke();
  }
  ctx.strokeStyle = v.colors.body;
  ctx.lineWidth = r * 0.52;
  ctx.stroke();
  if (!v.thin) {
    ctx.strokeStyle = SPARK;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.stroke();
  }

  ctx.fillStyle = v.colors.body;
  ctx.beginPath();
  ctx.ellipse(r * 0.55, 0, r * 0.62, r * 0.46, 0, 0, TAU);
  ctx.fill();

  // the spark: a four-point star, bigger as the bolt gathers
  const s = r * (0.3 + 0.5 * v.charge) * flick;
  const x = r * 1.4;
  ctx.fillStyle = SPARK;
  ctx.beginPath();
  ctx.moveTo(x + s, 0);
  ctx.lineTo(x + s * 0.25, s * 0.25);
  ctx.lineTo(x, s);
  ctx.lineTo(x - s * 0.25, s * 0.25);
  ctx.lineTo(x - s, 0);
  ctx.lineTo(x - s * 0.25, -s * 0.25);
  ctx.lineTo(x, -s);
  ctx.lineTo(x + s * 0.25, -s * 0.25);
  ctx.closePath();
  ctx.fill();
  if (v.thin) return;

  ctx.fillStyle = EYE;
  ctx.beginPath();
  dot(ctx, r * 0.72, -r * 0.24, r * 0.13);
  dot(ctx, r * 0.72, r * 0.24, r * 0.13);
  ctx.fill();
};

/** Sứa Ngọc — ranged. A pulsing bell trailing tentacles, a pearl lit inside it. */
const jelly: MinionBodyDraw = (ctx, v) => {
  const r = v.size / 2;
  const pulse = v.thin ? 0 : Math.sin(v.timeMs * 0.005 + v.seed);
  const drift = pulse * r * 0.22;

  ctx.strokeStyle = v.colors.bar;
  ctx.lineWidth = Math.max(1.5, r * 0.13);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = -1.5; i <= 1.5; i++) {
    const y = i * r * 0.36;
    const sway = i > 0 ? drift : -drift;
    ctx.moveTo(-r * 0.5, y);
    ctx.quadraticCurveTo(-r * 1.1, y + sway, -r * 1.75, y * 0.7 - sway);
  }
  ctx.stroke();

  ctx.fillStyle = v.colors.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * (0.84 - 0.05 * pulse), r * (0.96 + 0.06 * pulse), 0, 0, TAU);
  ctx.fill();
  if (!v.thin) ctx.stroke();

  ctx.fillStyle = PEARL;
  ctx.beginPath();
  dot(ctx, r * 0.3, 0, r * (0.26 + 0.3 * v.charge));
  ctx.fill();
  if (v.thin) return;

  // the dome's sheen: a crescent on the leading edge
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, -1.0, 1.0);
  ctx.stroke();
};

/** Bạch Tuộc — boss, ranged. Eight arms fanned ahead of a spotted mantle, ink gathering at the beak. */
const kraken: MinionBodyDraw = (ctx, v) => {
  const r = v.size / 2;
  const curl = v.thin ? 0 : Math.sin(v.timeMs * 0.003 + v.seed);
  const mantleX = -r * 0.38;

  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    // four arms a side, fanned from nearly straight ahead to nearly straight out
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const a = side * (0.28 + k * 0.5);
    const len = r * (1.5 - k * 0.14);
    const bend = side * (0.5 + 0.22 * curl * (k % 2 ? 1 : -1));
    ctx.moveTo(r * 0.1, side * r * 0.2);
    ctx.quadraticCurveTo(
      Math.cos(a + bend) * len * 0.6,
      Math.sin(a + bend) * len * 0.6,
      Math.cos(a) * len,
      Math.sin(a) * len
    );
  }
  if (!v.thin) {
    ctx.strokeStyle = v.colors.trim;
    ctx.lineWidth = r * 0.24;
    ctx.stroke();
  }
  ctx.strokeStyle = v.colors.body;
  ctx.lineWidth = r * 0.15;
  ctx.stroke();

  if (!v.thin) {
    // the head fins, behind the mantle
    ctx.fillStyle = v.colors.trim;
    ctx.beginPath();
    ctx.moveTo(mantleX - r * 0.5, -r * 0.45);
    ctx.lineTo(mantleX - r * 1.0, -r * 0.95);
    ctx.lineTo(mantleX - r * 0.85, 0);
    ctx.lineTo(mantleX - r * 1.0, r * 0.95);
    ctx.lineTo(mantleX - r * 0.5, r * 0.45);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = v.colors.body;
  ctx.beginPath();
  ctx.ellipse(mantleX, 0, r * 0.86, r * 0.64, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = GOLD;
  ctx.beginPath();
  dot(ctx, r * 0.18, -r * 0.36, r * 0.17);
  dot(ctx, r * 0.18, r * 0.36, r * 0.17);
  ctx.fill();
  if (v.thin) return;

  ctx.strokeStyle = v.colors.trim;
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.ellipse(mantleX, 0, r * 0.86, r * 0.64, 0, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = v.colors.bar;
  ctx.beginPath();
  dot(ctx, mantleX - r * 0.45, -r * 0.18, r * 0.13);
  dot(ctx, mantleX - r * 0.4, r * 0.24, r * 0.1);
  dot(ctx, mantleX - r * 0.05, -r * 0.3, r * 0.09);
  dot(ctx, mantleX, r * 0.12, r * 0.14);
  dot(ctx, mantleX + r * 0.3, -r * 0.05, r * 0.08);
  ctx.fill();

  // slit pupils
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.ellipse(r * 0.2, -r * 0.36, r * 0.05, r * 0.13, 0, 0, TAU);
  ctx.ellipse(r * 0.2, r * 0.36, r * 0.05, r * 0.13, 0, 0, TAU);
  ctx.fill();

  // the ink, gathering at the beak
  const ink = r * (0.16 + 0.3 * v.charge);
  ctx.fillStyle = INK;
  ctx.beginPath();
  dot(ctx, r * 0.72, 0, ink);
  ctx.fill();
  ctx.fillStyle = '#b98cff';
  ctx.beginPath();
  dot(ctx, r * 0.72, 0, ink * 0.45);
  ctx.fill();
};

/** Chúa Triều — boss, melee. An armoured lobster-king: coral crown, two great claws, a trident that thrusts. */
const tidelord: MinionBodyDraw = (ctx, v) => {
  const r = v.size / 2;
  const thrust = v.reach;

  const carapace = () => {
    ctx.beginPath();
    ctx.moveTo(r * 0.95, 0);
    ctx.quadraticCurveTo(r * 0.7, -r * 0.8, -r * 0.1, -r * 0.78);
    ctx.lineTo(-r * 0.95, -r * 0.42);
    ctx.lineTo(-r * 0.95, r * 0.42);
    ctx.lineTo(-r * 0.1, r * 0.78);
    ctx.quadraticCurveTo(r * 0.7, r * 0.8, r * 0.95, 0);
    ctx.closePath();
  };
  const trident = () => {
    const tip = r * 1.75 + thrust;
    ctx.beginPath();
    ctx.moveTo(-r * 0.2 + thrust, 0);
    ctx.lineTo(tip, 0);
    ctx.moveTo(tip - r * 0.05, -r * 0.3);
    ctx.lineTo(tip - r * 0.5, -r * 0.3);
    ctx.lineTo(tip - r * 0.5, r * 0.3);
    ctx.lineTo(tip - r * 0.05, r * 0.3);
  };
  const crown = () => {
    // five coral spikes around the back of the head
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      const a = Math.PI + i * 0.42;
      const cx = r * 0.05;
      ctx.moveTo(cx + Math.cos(a - 0.2) * r * 0.32, Math.sin(a - 0.2) * r * 0.32);
      ctx.lineTo(cx + Math.cos(a) * r * (i === 0 ? 0.86 : 0.7), Math.sin(a) * r * (i === 0 ? 0.86 : 0.7));
      ctx.lineTo(cx + Math.cos(a + 0.2) * r * 0.32, Math.sin(a + 0.2) * r * 0.32);
    }
    ctx.closePath();
  };

  if (v.thin) {
    ctx.fillStyle = v.colors.body;
    carapace();
    ctx.fill();
    ctx.strokeStyle = PEARL;
    ctx.lineWidth = r * 0.11;
    trident();
    ctx.stroke();
    ctx.fillStyle = GOLD;
    crown();
    ctx.fill();
    return;
  }

  // tail fan
  const fan = Math.sin(v.timeMs * 0.004 + v.seed) * 0.12;
  ctx.fillStyle = v.colors.trim;
  ctx.beginPath();
  for (let i = -1; i <= 1; i++) {
    const a = Math.PI + i * (0.5 + fan);
    ctx.moveTo(-r * 0.8, 0);
    ctx.lineTo(-r * 0.8 + Math.cos(a - 0.24) * r * 0.75, Math.sin(a - 0.24) * r * 0.75);
    ctx.lineTo(-r * 0.8 + Math.cos(a + 0.24) * r * 0.75, Math.sin(a + 0.24) * r * 0.75);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = v.colors.trim;
  ctx.lineWidth = r * 0.09;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // the claws open as the blow is hauled back
  const gap = 0.3 + 0.45 * v.charge;
  ctx.fillStyle = v.colors.bar;
  ctx.beginPath();
  pincer(ctx, r * 0.72 + thrust * 0.5, -r * 0.98, r * 0.4, gap);
  pincer(ctx, r * 0.72 + thrust * 0.5, r * 0.98, r * 0.4, gap);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = v.colors.body;
  carapace();
  ctx.fill();
  ctx.stroke();

  // armour plates across the back
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -r * 0.66);
  ctx.quadraticCurveTo(-r * 0.15, 0, -r * 0.35, r * 0.66);
  ctx.moveTo(-r * 0.68, -r * 0.54);
  ctx.quadraticCurveTo(-r * 0.5, 0, -r * 0.68, r * 0.54);
  ctx.stroke();

  ctx.strokeStyle = PEARL;
  ctx.lineWidth = r * 0.11;
  trident();
  ctx.stroke();

  ctx.fillStyle = GOLD;
  crown();
  ctx.fill();

  ctx.fillStyle = '#8ff6ff';
  ctx.beginPath();
  dot(ctx, r * 0.52, -r * 0.24, r * 0.1);
  dot(ctx, r * 0.52, r * 0.24, r * 0.1);
  ctx.fill();
};

export const RAIDER_ART = { crab, spitter, brute, eel, jelly, kraken, tidelord } satisfies Record<string, MinionBodyDraw>;

/** Painted paths (`fill` + `stroke`) a full body may cost; a thin body gets `THIN_OP_BUDGET`. */
export const RAIDER_OP_BUDGET: Record<keyof typeof RAIDER_ART, number> = {
  crab: 8,
  spitter: 8,
  brute: 8,
  eel: 8,
  jelly: 8,
  kraken: 12,
  tidelord: 12,
};
export const THIN_OP_BUDGET = 4;

/**
 * Hangs `draw` on a minion type **without making it enumerable**.
 *
 * A core older than contract 26 validates a type's fields by name and refuses
 * the whole pack over one it does not know — `draw` would be "unknown; core
 * provides speed, size, …". Its validator walks own *enumerable* keys, so a
 * hidden `draw` passes it untouched and is never read: that core draws its own
 * soldier and caster, as before. A core that has the field reads `def.draw`
 * directly and finds it. This is what lets the art ship ahead of `coreRange`.
 */
export const withBody = <T extends object>(def: T, draw: MinionBodyDraw): T & { draw?: MinionBodyDraw } =>
  Object.defineProperty(def, 'draw', { value: draw, enumerable: false });
