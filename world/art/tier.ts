import { api } from '../../packApi';

/**
 * How much this frame's art may give up: 0 everything, 1 decoration goes,
 * 2 the picture itself gets simpler. Core's own answer (`api.render`, the
 * player's Tự động / Cao / Thấp resolved against the measured frame rate) —
 * never a rule of this pack's.
 *
 * `api.render` arrived in core contract 24 and this pack's floor is older, so
 * the read is guarded: on a core that cannot answer, the answer is 0 and the
 * art is the full art. A simplification must never be what an old core gets.
 */
export const renderTier = (game: unknown): 0 | 1 | 2 => {
  const ask = (api as { render?: { stressTier?: (game: any) => 0 | 1 | 2 } }).render?.stressTier;
  return ask ? ask(game) : 0;
};

/**
 * The player's "Nền bản đồ: Đơn giản": core is drawing its solid walls and
 * kelp again, so this pack's art leaves out what only decorates and keeps what
 * has to be read to play. Core's own answer, never a rule of this pack's.
 *
 * `api.render.plainGround` arrived in core contract 25, later than this pack's
 * floor, so the read is guarded the way `renderTier` is. On a core that cannot
 * answer, the answer is `false`: that core draws nothing under a
 * `paintsOwnTerrain` map, and skipping the art there would leave no ground.
 */
export const plainGround = (game: unknown): boolean => {
  const ask = (api as { render?: { plainGround?: (game: any) => boolean } }).render?.plainGround;
  return ask ? ask(game) === true : false;
};
