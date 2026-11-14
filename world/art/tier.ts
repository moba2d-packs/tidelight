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
