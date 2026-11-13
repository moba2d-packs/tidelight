# Tidelight — Triều Đăng

A content pack for `@moba2d/core`. One reef, one lantern, two courts, a tide.
Nothing in it is taken from another game: world, names, kits, art and map were
made for this pack.

## 1. Concept

Driftglass Reef used to be lit. The Lantern that lit it now drifts on a rail
through the reef's one channel, and two courts — the **Tide Court** (blue, west)
and the **Ember Court** (red, east) — each want to walk it to the far dock and
light their beacons with it.

There is no base to destroy and no gold curve to climb. A match is **3v3,
first to 2 Lights, capped at 6 minutes**; a typical one is meant to take 4–6.

## 2. The signature mechanic: the tide carries the Lantern

Four rules, all visible on screen at once.

1. **The Lantern moves for whoever outnumbers the other around it.** Stand
   within 270 units and you escort it. Net escort 1 / 2 / 3+ moves it at
   30 / 42 / 50 units per second toward the enemy dock; even numbers stall it.
   A minion wave counts for at most one hero. There is no last-hit, no channel,
   no carry: *where you stand* is the objective.
2. **The tide turns every 30 seconds, and it takes sides.** After 12 s of slack
   water the tide favours one court, then the other, on a fixed timetable shown
   as a clock. While it favours you:
   - the **current** drifts an unescorted Lantern your way (10 u/s — never
     enough to beat one enemy escort);
   - one of the two side **shoals** floods. For you it is a highway (+25% move
     speed); for the enemy it is mud (−30%). It is the flank route to the
     enemy's gate — but only for half a minute;
   - the *other* shoal runs dry and bares its **pearl beds**. A pearl heals 12
     and makes its carrier **glow** for 10 s: a glowing hero counts as 1.5
     escorts. The side the tide is *against* gets the easier walk to the pearls.
3. **Each court's gate is locked by a Warden tower.** The Lantern stops at an
   enemy gate while that Warden stands. Kill the Warden — or simply **hold the
   Lantern against the gate**: its light burns the Warden for 18 damage per
   second while an escort keeps it there. Pushing *is* the siege.
4. **Each harbour is guarded by a Keep.** A keep stands behind its court's
   fountain: 2400 HP, 45 damage every 0.45 s, 480 reach, back 90 s after it
   falls. It guards the harbour, never the lantern — its reach stops short of
   the berth, and it is not a warden, so it never holds a gate shut.

Deliver the Lantern to the dock: one Light, the Lantern relights in the middle
after 4 s. Two Lights win. At the 6-minute cap the court with more Lights wins,
then whichever court holds the Lantern on the enemy's half.

Why no mainstream MOBA has this: the objective is a *single shared object whose
position is the score*, moved by presence rather than damage, on a map whose
terrain value flips sides on a public clock. Every 30 seconds the right place
to stand changes for both teams, and everyone can read why.

Every hero's kit touches these rules (section 4), so the mechanic is not a mode
bolted onto generic brawlers.

## 3. Art direction — cut paper under lamplight

- **Shapes, not textures.** Everything is flat layered "paper": a dark offset
  copy underneath for a drop shadow, a lighter inset on top. Rounded
  rectangles, hexagonal islands, crescents for waves. No gradients in the
  world, no outlines except the two court colours.
- **Palette.** Night-sea navy for water, sea-green islands, sand shoals, and
  exactly one warm colour — lantern amber — reserved for the Lantern, the
  lights and pearls' glow. Tide Court is teal, Ember Court is coral. If
  something is amber, it matters.
- **The world is the HUD.** The channel carries chevrons pointing the way the
  current runs, in the favoured court's colour; a flooded shoal is visibly
  under a sheet of water with a foam line; gates are a chain from the Warden.
- **Everything is procedural.** The map is painted in code every frame
  (`world/scenery.ts`), spell effects are code (`world/fx.ts`), and the 30
  portraits/icons are generated from SVG by `scripts/make-art.mjs`. No
  third-party art.
- **HUD.** One slim strip, top-centre: tide clock pill, Lights, and a track with
  the Lantern and both gates. Vietnamese labels.

## 4. Heroes

Five, each with a passive that changes how they relate to the Lantern or tide.
All ultimates are on a 10 s cooldown — short matches, lots of plays.

| Hero | Role | Passive | Q | W | E | R |
|---|---|---|---|---|---|---|
| **Brine** — the ballast | Tank, melee, physical. 165 HP, armor 45, MR 35 | *Đá Dằn*: counts as 2 escorts | *Neo Móc*: hook, pull 190, 18 dmg, slow | *Dằn Thuyền*: shield 26 (42 beside the Lantern) | *Sóng Xô*: dash-slam, 20 dmg, slow | *Thả Neo*: 42 dmg, root 1.4 s, **anchors the Lantern for 5 s** (enemy escort and current ignored) |
| **Nacre** — the pearl diver | AD marksman, ranged, physical. 85 HP, armor 5, MR 0, hits 14 at 1.2/s | *Mắt Ngọc*: pearls are worth double | *Ngọc Bắn*: 24 dmg bolt, pierces when the tide is with her | *Bong Bóng*: bubble that roots | *Lặn Sâu*: dive-dash + haste | *Trăng Ngọc*: 40 dmg burst that leaves a slowing pool |
| **Wick** — the lamplighter | Support, ranged, **magic** damage, heals and shields. 100 HP, armor 8, MR 22 | *Người Giữ Đèn*: regenerates beside the Lantern | *Tia Lửa*: 18 dmg, heals an ally nearby for 12 | *Thắp Lại*: heal 16 + haste | *Chói Loà*: silence + slow flash | *Lửa Mặt Trời*: 40 dmg and **kicks the Lantern 150 units** forward |
| **Skerry** — the reef runner | AD skirmisher, melee, physical. 105 HP, armor 15, MR 10 | *Con Nước*: +15% speed while the tide is hers | *Lưỡi Sò*: 22 dmg sweep | *Lướt Nước*: +45% speed burst | *Xoáy Ngầm*: dash through, 20 dmg | *Phá Rạn*: leap, 48 dmg, stun |
| **Gull** — the stormcaller | AP mage / control, ranged, **magic**. 90 HP, armor 0, MR 15 | *Đổi Gió*: heals 10 whenever the tide turns | *Gió Giật*: 20 dmg gust, slow | *Gió Xuôi*: team haste | *Vùng Bão*: storm zone, damage over time + slow | *Gọi Triều*: 30 dmg and **turns the tide to her court for 8 s** (the tide then cannot be called again for 20 s) |

Every ability hit is labelled `takeDamage(amount, owner, type, 'Tên Chiêu')`
(Brine, Skerry, Nacre: `PHYSICAL`; Wick, Gull: `MAGIC`), so the death recap
names the spell and armor/magic resist apply by role. `tests/damageLabels.test.ts`
scans `spells/` and `world/fx.ts` and fails on any unlabelled call. Body
stats are the `TANK`/`MARKSMAN`/... constants in `pack.ts`.

Numbers live as exported constants at the top of each spell file.

## 5. Map — Driftglass Reef (3200 × 3200)

```
        ~~~~~~~~~~~~~~~~ open sea ~~~~~~~~~~~~~~~~
        ┌──────────── north shoal (pearls) ───────┐
 TIDE   │  islands · kelp · islands · kelp        │   EMBER
 dock ◉─┤▮ gate ══════ rail ══ ◈ ══ rail ══ gate ▮├─◉ dock
 (300)  │  islands · kelp · islands · kelp        │   (2900)
        └──────────── south shoal (pearls) ───────┘
        ~~~~~~~~~~~~~~~~ open sea ~~~~~~~~~~~~~~~~
```

- One **channel** with the rail (1800 long), gates at ±640 from centre, each
  chained to a Warden (320 HP, never repairs or rebuilds).
- Two **shoals** north and south: the flanks. One floods, one dries, per tide.
- Six hexagonal **islands** (walls) and eight **kelp** beds (brush) between
  channel and shoals make three short crossings on each side.
- Minions (2 melee + 1 ranged every 20 s) walk the channel and count as escort.

## 6. Controls

**PC** — right-click to move/attack, `Q W E R` to cast toward the cursor,
`D F` summoner slots. Hover a skill for its text.

**Mobile (landscape)** — left thumb: virtual joystick. Right thumb: attack
button with the four skill buttons fanned around it; **drag a skill button to
aim**, release to cast. A home button recalls. The
Tidelight strip sits top-centre between the minimap and the system buttons and
respects `env(safe-area-inset-top)`; on short screens it drops to one compact
row and hides secondary words. The end card's buttons are 48 px tall.

The joystick, skill wheel and drag-aim are core's; this pack's job was to keep
its own HUD out of their way and keep the world readable at 844 × 390:
thick shapes, one accent colour, objective state readable from the strip
without looking at the minimap.

## 7. How it is built

- `world/rules.ts` — the rules as pure functions (tide timetable, lantern
  velocity, gates, win). Unit-tested without the engine.
- `world/heart.ts` — the match object: applies the rules each frame, owns the
  Lantern, shoals, pearls, score and end card. Core has no win condition; this
  is it.
- `world/scenery.ts`, `world/palette.ts`, `world/hud.ts`, `world/fx.ts` —
  painter, colours, DOM strip, shared spell effects.
- `spells/` — 25 abilities. `map.ts`, `geometry.ts`, `pack.ts` — the data half.
- `scripts/game.mjs` — runs core with *only this pack* by answering core's
  generated pack list from memory; core's files are not modified.

## 7b. The reef art kit (`world/art/`)

Painting a map from a description instead of hand-drawing it. Walls stay the gameplay truth (`geometry.terrain.wall`); the art follows the same polygons, so it never shows a wall where there is none and never hides one.

- `world/art/reef.ts`: `ReefDescription { size, tint?, styles?, sea, rocks, kelp, floor?, bakeFloor?, bake?, live? }`. `wallsOf(desc)` = `sea` + every rock part: feed the geometry from it. `ReefLayer.paint(ctx, view, scale, ms)` bakes still art into tiles and draws live art (kelp sway, glints) on top.
- `world/art/shapes.ts`: `hull`, `blob`, `arc`, `ribbon`, `mirror`/`flipX`/`flipY`, `isConvex`, `distToPoly`, `convexOverlap`. Core collides convex polygons only, so organic shapes are chains or hulls of convex pieces.
- `world/art/tiles.ts` + `draw.ts`: the shared tile cache (512px world tiles, baked at camera scale, 1:1 whole-pixel blit, settle frames, memory cap) and drawing primitives. Driftglass stays on its own painter (`world/scenery.ts`) but runs on this same `TileCache` and primitives, so its look and cost are unchanged.
- `world/art/sceneryObject.ts`: `ensureArt(game, mapId, size, describe)`, idempotent per game. Call it from both the map's `ensure()` and its slot object so the art exists with the jungle on or off. Check the map with `maps/onMap.ts` (the id is qualified, e.g. `tidelight:maze`).

Recipe for a map: (1) `layout.ts` pure data: `*_SEA` frame rects, `*_ROCKS: RockSpec[]` (`parts`, `style`, `detail`, `lift`), `*_KELP` polys; (2) `geometry.ts` uses `terrain: { wall: wallsOf-equivalent, bush: KELP }`; (3) `art.ts` returns the description plus `floor` patches (sand, channel, pool, mud) and optional `bakeFloor`/`bake`/`live` hooks for set pieces; (4) `map.ts` sets `paintsOwnTerrain: true`; (5) tests: convexity, symmetry, 28px hero clearance by BFS, and `tests/reefArt.test.ts`-style checks that art equals geometry. Raw `drawingContext` use goes inside `save()`/`restore()`. Examples: `maps/maze` (shipwreck graveyard), `maps/duel` (clam amphitheatre).

## 8. Sea charms (D / F)

Two summoner-style spells of this pack's own, on core's `summonerShelf` row:

| Key | Charm | What it does |
|---|---|---|
| D | **Sóng Rút** (Riptide) | Short dash, no mana, 12 s. Half as far again while the tide runs your way. |
| F | **Kính Đèn** (Lampglass) | 22 shield for 2.5 s, 12 s. 36 inside the Lantern's glow. |

Core has **one** D/F shelf for a whole install (the first pack that declares
one), and a saved loadout names spells by id. So with another pack installed
in front of this one, or with a saved `Flash`/`Heal`, a hero would arrive with
someone else's spells — or with one charm in both slots. `world/charms.ts`
therefore makes it a rule of the map: on Driftglass Reef the Heart hands every
hero both charms (and leaves alone a hero who already carries both, in either
order).

## 9. HUD layout

Core's score strip owns the top 34 px and its kill feed starts right under it.
The Lantern strip takes the row between them, and while a Tidelight match is
up `body.tidelight-on` moves core's `.kill-callouts` one row down — CSS from
the pack, removed when the match ends, no core change. Announcements ("Triều
Lam dâng!") replace the tide pill for their two seconds instead of floating
under the feed. Under 520 px wide the strip stacks into two rows.

## 10. Known limits

- Balance is first-pass. Bots fight in the channel, which escorts the Lantern
  as a side effect; they do not reason about tides, pearls or flooded flanks.
  The match is capped at 6:00 (most Lights wins). One unattended bot match
  (2 bots vs 3, player idle) ended 0–2 at 5:56: first Light at ~4:30.
- Sea charms replace whatever D/F a hero brought, on this map only — a player
  who picked another pack's summoner spells does not keep them here.
- The main menu and lobby are core's, shared by every pack.
- Not tested on a real phone; portrait is laid out but core itself asks the
  player to rotate.
