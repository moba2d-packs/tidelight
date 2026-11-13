/**
 * Which Tidelight map is running, and the one way a map's rule object gets into
 * a match whatever the lobby's jungle switch says.
 *
 * In a real match `game.activeMapId` is *qualified* — `'tidelight:hill'` — while
 * each map declares its bare id (`'hill'`). Comparing the two with `===` is never
 * true in the game and always true in a test that sets the bare id, which is how
 * every map's rule object went missing in play while its tests passed.
 */
export function onMap(game: any, bareId: string): boolean {
  const active = game?.activeMapId;
  if (typeof active !== 'string') return false;
  return active === bareId || active.endsWith(`:${bareId}`);
}

const ensured = new WeakMap<object, Set<string>>();

/**
 * Neutral slots are filled only with the jungle on, so a map whose rules live in
 * a slot object would be a map with no rules in a jungle-off lobby. Hero passives
 * call this on cast: on `bareId`'s map it makes sure `create(game)` is in the
 * match exactly once (the slot may already have put it there). Returns whether
 * this is that map.
 */
export function ensureOn(game: any, bareId: string, create: (game: any) => any): boolean {
  if (!onMap(game, bareId)) return false;
  const done = ensured.get(game) ?? new Set<string>();
  if (done.has(bareId)) return true;
  const made = create(game);
  const om = game.objectManager;
  if (made && !om.objects.includes(made) && !om._objectToBeAdd.includes(made)) om.addObject(made);
  done.add(bareId);
  ensured.set(game, done);
  return true;
}
