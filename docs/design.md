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
first to 2 Lights, capped at 8 minutes**; a typical one is meant to take 4–6.

## 2. The signature mechanic: the tide carries the Lantern

Three rules, all visible on screen at once.

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

Deliver the Lantern to the dock: one Light, the Lantern relights in the middle
after 4 s. Two Lights win. At the 8-minute cap the court with more Lights wins,
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
| **Brine** — the ballast | Anchor, melee, 135 HP | *Đá Dằn*: counts as 2 escorts | *Neo Móc*: hook, pull 190, 18 dmg, slow | *Dằn Thuyền*: shield 26 (42 beside the Lantern) | *Sóng Xô*: dash-slam, 20 dmg, slow | *Thả Neo*: 42 dmg, root 1.4 s, **anchors the Lantern for 5 s** (enemy escort and current ignored) |
| **Nacre** — the pearl diver | Poke, ranged, 90 HP | *Mắt Ngọc*: pearls are worth double | *Ngọc Bắn*: 24 dmg bolt, pierces when the tide is with her | *Bong Bóng*: bubble that roots | *Lặn Sâu*: dive-dash + haste | *Trăng Ngọc*: 40 dmg burst that leaves a slowing pool |
| **Wick** — the lamplighter | Support, ranged, 100 HP | *Người Giữ Đèn*: regenerates beside the Lantern | *Tia Lửa*: 18 dmg, heals an ally nearby for 12 | *Thắp Lại*: heal 16 + haste | *Chói Loà*: silence + slow flash | *Lửa Mặt Trời*: 40 dmg and **kicks the Lantern 150 units** forward |
| **Skerry** — the reef runner | Skirmisher, melee, 105 HP | *Con Nước*: +15% speed while the tide is hers | *Lưỡi Sò*: 22 dmg sweep | *Lướt Nước*: +45% speed burst | *Xoáy Ngầm*: dash through, 20 dmg | *Phá Rạn*: leap, 48 dmg, stun |
| **Gull** — the stormcaller | Control, ranged, 90 HP | *Đổi Gió*: heals 10 whenever the tide turns | *Gió Giật*: 20 dmg gust, slow | *Gió Xuôi*: team haste | *Vùng Bão*: storm zone, damage over time + slow | *Gọi Triều*: 30 dmg and **turns the tide to her court for 8 s** (the tide then cannot be called again for 20 s) |

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

## 8. Known limits

- Balance is first-pass. In an unattended bot match (2 bots vs 3) the first
  Warden fell at ~2:50, the first Light came at ~4:50, and the match went to
  the 8-minute cap at 1–0 — longer than the 4–6 minute target.
- Bots fight in the channel, which escorts the Lantern as a side effect; they
  do not yet reason about tides, pearls or flooded flanks.
- Summoner slots (`D`/`F`) show a placeholder icon: this pack ships no
  summoner spells.
- The main menu and lobby are core's and still carry the engine's name.
