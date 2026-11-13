/**
 * Tidelight's palette — a paper-cut reef at night, lit by one lantern.
 *
 * Every colour the pack paints with is here, as an RGB triple. The look is
 * flat shapes stacked like cut paper: a dark sheet, a mid sheet offset over
 * it, a thin bright edge. No gradients, no textures, no outlines-on-everything
 * — the layering is the style, and it is cheap to draw on a phone.
 */
export type Rgb = readonly [number, number, number];

export const INK = {
  ABYSS: [9, 19, 44] as Rgb,
  DEEP: [11, 24, 52] as Rgb,
  DEEP_WAVE: [30, 58, 104] as Rgb,
  SEABED: [20, 44, 78] as Rgb,
  SEABED_MARK: [31, 62, 102] as Rgb,
  CHANNEL: [15, 34, 66] as Rgb,
  SHADOW: [5, 10, 26] as Rgb,
  REEF_BASE: [28, 84, 96] as Rgb,
  REEF_TOP: [44, 124, 122] as Rgb,
  REEF_EDGE: [142, 222, 190] as Rgb,
  SAND: [226, 204, 150] as Rgb,
  SAND_DARK: [190, 164, 112] as Rgb,
  WATER: [48, 176, 186] as Rgb,
  FOAM: [206, 246, 240] as Rgb,
  KELP: [38, 128, 96] as Rgb,
  KELP_LIGHT: [104, 196, 132] as Rgb,
  CREAM: [248, 238, 212] as Rgb,
  LANTERN: [255, 208, 112] as Rgb,
  LANTERN_HOT: [255, 244, 214] as Rgb,
  PEARL: [240, 232, 255] as Rgb,
  TIDE: [58, 210, 200] as Rgb,
  EMBER: [255, 112, 78] as Rgb,
  CORAL: [255, 138, 128] as Rgb,
  IRON: [156, 186, 204] as Rgb,
  GALE: [150, 204, 255] as Rgb,
} as const;

export const css = (c: Rgb, a = 1): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export const courtColor = (teamId: string | null): Rgb =>
  teamId === 'team-blue' ? INK.TIDE : teamId === 'team-red' ? INK.EMBER : INK.CREAM;
