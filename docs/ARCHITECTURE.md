# Emberfall architecture: data-driven content

Direction: content and tuning live in validated JSON; behavior stays in JavaScript. One loader and validator, with no browser dependencies, serves the game, the tests, future tools, and a future match server.

Status (v0.50): Phase 1 (audit and plan), Phase 2 (combat, equipment, economy, progression, bots, arena events), and Phase 3 steps 1 to 6 (static arena map data, prefabs with colliders, every collider in the map with collision in `shared/`, walkable surfaces on map objects, parented placements, and the first map editor in v0.46) are complete. Multiplayer is not started.

## Layout

```
dist/config/*.json          content, one canonical copy of each value
dist/shared/schema.js       generic validator: types, units, limits, ids, refs, freeze, content hash
dist/shared/config-schema.js  Emberfall schemas, persisted-id list, cross-file rules, parseConfig()
dist/shared/config.js       browser/Node entry: imports the bundled JSON, validates, freezes, exports CONFIG + CONFIG_VERSION
dist/maps/emberfall.json    the arena layout: bounds, lava, regions, spawns, stations, navigation points, supply drops, prefabs (colliders and walkable surfaces), objects, string lights
dist/shared/map-schema.js   map schema, placement rules, parseMap()
dist/shared/map-queries.js  pure ground, lava, safe-zone and bridge-cover queries, collider and surface placement, and collision (`createCollision`), built from a parsed map
dist/shared/map.js          browser/Node entry: imports the bundled map (or, at index.html?draft, the editor draft), validates, freezes, exports MAP + MAP_VERSION + queries
dist/map-props.js           places the map's GLB model props; shared by game.js and the editor
dist/editor.html, editor.js the map editor: draws a draft with buildWorld and placeMapProps, overlays, input, panels
dist/editor-model.js        DOM-free edits on raw map JSON: moves, reparenting, add/remove, issue targets, export formatting
dist/combat.js, progression.js, charged-melee.js, arena-events.js   behavior; read tuning from CONFIG
```

JSON is loaded with standard import attributes (`import x from './x.json?v=26' with {type:'json'}`). This needs Chrome 123+, Safari 17.2+, Firefox 138+, or Node 22. There is no build step and no fetch race: tuning is ready before any game module runs.

`shared/` and `config/` never touch the DOM or the network. The one exception to staying out of browser storage is `shared/map.js`: when the page URL has `?draft`, it reads the editor's draft from `localStorage` instead of the bundled map. Under Node there is no `location`, so it always loads the bundled map. A server can import `dist/shared/config.js` directly, or call `parseConfig(raw)` on JSON it loaded itself.

## Config files

| File | Contents |
| --- | --- |
| `combat.json` | kits, movement multipliers, melee rules and hitbox, knockback and steering, heavy charge, bow |
| `weapons.json` | weapons, staff spell parameters, bleed/frost/fire status effects |
| `armor.json` | chestplates and helmets |
| `consumables.json` | potions |
| `cosmetics.json` | auras and nameplates (prices and colors) |
| `progression.json` | inventory sizes, storage, starter kit, rarities, chest odds and rolls, salvage, KO/death/2v2 rewards, all 31 ranks |
| `bots.json` | nine bot skill tiers, bot cap, extra names, generated-bot ranges, click jitter, bot income and shop threshold, potion threshold and cooldown, target-priority weights |
| `events.json` | event schedule, event types (`kind: hazard` with damage, fire, ambient damage; `kind: supply`), hazard pulses and impact, supply-crate rewards for players and bots, killstreak tiers |

The map lives in `dist/maps/emberfall.json`; see the map plan below. Armor and potions were split because their schemas share nothing. Cosmetics got their own file because the six-file layout keeps each schema readable.

## Validation (load time)

- `schemaVersion` must equal `SCHEMA_VERSION` (1). An incompatible file is rejected, never guessed at.
- Exact object shapes: unknown fields (typos) and missing required fields are errors.
- Every number has a unit (`s`, `m`, `m/s`, `hp`, `coins`, `×`, `%`) and limits. Integers are enforced where fractional values would corrupt state (prices, health, slots).
- Ids are lowercase `a-z0-9-`. Cross-references (`chest.weapons`, `starterKit`, `weapon.spell`, `weapon.rarity`) must resolve.
- Rules: rarity weights total 100%; ranks start at 0 and strictly increase; staffs need spell, cooldown, projectile speed, and color; `armor.none` is empty; the heavy windup is shorter than full charge; the arrow cap is at least the quiver size; frost cannot reach 100% slow; the chest pool cannot contain absolute-damage weapons.
- Persisted ids (`PERSISTED_IDS`) cannot be removed. Saves store weapon, armor, potion, cosmetic, nameplate, rarity, status-effect, kit, and forged-title ids. Removing one would silently strip owned items when a profile loads.
- Every problem is collected and thrown together as a `ConfigError` with `file → field: message`. In the browser, the existing "Unable to load" panel shows the list. In Node, the error stops the process.
- The validated tree is deep-frozen. `CONFIG_VERSION` (`1-<fnv32 of the raw JSON>`) identifies the exact content, so a server and its clients can confirm they match.

Field metadata (`unit`, `description`) is part of the schema, so a future editor can build its forms from the same source.

## Persistence compatibility

Save formats are unchanged: profile v4 under `emberfall.profile.v2`, plus `emberfall.kit`, `emberfall.loot.v1`, settings, and stats. No migration was needed because no stored id or shape changed. The v2/v3 conversion in `makeProfile` reads the starter count and stack limit from config. New profiles take that same path, so a hardcoded copy there would override the configured starter kit; `tests/config.mjs` catches this.

Future rules:
- Ids are permanent. Rename display names freely; retire an item by removing it from shops or chests, not by deleting its id.
- A config change that alters stored meaning (for example, a stack limit below existing stacks) needs a profile version bump and a `makeProfile` migration, with a test using a literal old save.
- Rank identity is the threshold index. Reordering ranks changes rank icons but no saved data.

## Audit: what remains hardcoded

Moved in v0.26: the first six files in the Config files table, plus copies that used to live in `game.js`: block and crouch speed, arrow quiver, refill, cap, and KO bonus, bow draw time, the critical-hit shop display, frost/venom/arcane spell values, status-effect intervals, damage, and slow, and 2v2 rewards. Kit cards and the help text for immunity, heavy attacks, and 2v2 rewards are filled from config at startup.

Still in code, by planned destination:

Moved in v0.29: `bots.json` and `events.json`. `game.js` now checks an event's `kind` and `fire` flag instead of comparing ids like `rush` or `eruption`, so a new hazard or supply event needs only a JSON entry. The supply-crate chat message is built from the configured rewards; it had said +68 health while healing 60.

- Bot AI heuristics (later, possibly `bots.json` once they are stable): `itemScore` and `targetScore` weights in `bot-strategy.js`, bot bow reaction timing, retreat and shop-return conditions, and steering weights in `chooseSteer`. The generated-bot seed formula stays in code because changing it renames existing bots.
Moved in v0.33: the static arena map (see Map plan).

Moved in v0.39: every collider in `buildWorld` (see Map plan, step 2). Moved in v0.41: the station, crate, rock and volcano colliders, the string-light anchors, and collision itself (step 3). Moved in v0.44: the ledge, bridge and ramp meshes and their walkable surfaces (step 4). Moved in v0.45: the ledge's and bridge's dependents now follow them (step 5).

- Visual-only scenery still uses literal coordinates in `buildWorld`: the cavern walls, the ruin's standard and torches by the portal, and the crystal seams. `game.js` places the pumpkin groups, and the 2v2 courtyard lives in `duels.js`. These stay literal on purpose. The editor draws them but cannot select or move them. The crate model scale (1.15) and the rock and volcano model fits are drawing code, not layout.
- The ledge and bridge meshes are drawn relative to their object, but their sizes are literal in the builders, like collider sizes beside their meshes. Changing a surface's width or height in the map does not resize those meshes; the ramp mesh does follow its surface.
- Parents carry positions only. Moving the ledge or bridge does not resize regions, and the ramps are separate objects, so moving the bridge alone opens a gap at the ramp tops. Validation reports unsupported spawns, stations and destinations; it does not check that ramps meet the deck.
- The 2v2 courtyard (`MINI`, `MINI_COVER`, `miniGround` in `duels.js`) is a second map and is not converted yet.
- `powers.json` (or `cosmetics.json` once behavior is generalized): `PRESSURE` {28 m, 68%} and `ASCENSION` {72 m, wind 17, 2–3 dps}, charge-orb timings.
- Physics, deliberately left for later: gravity 22, jump 7.8, lava-jump planning constants, arrow speed (26 + 31 × charge) and gravity 10, projectile life, return channel 3 s, combat lockout 5 s, loot expiry 5 min, lava and burning damage.
- Presentation (not gameplay tuning): particle colors, animation timing, camera, gait stride thresholds, sounds.
- Text copies: weapon and potion `description` strings repeat their numbers ("Chills movement by 35% for 2 seconds", "Restores 115 health") but now sit next to those values in the same JSON entry. `README.md` prose also repeats numbers.
- Save identity, kept in code on purpose: starter item ids (`starter`, `starter-bow`, `starter-healing`), the v1 coin conversion (`kills × 25`), and "forged rolls only on legendary".

## Map plan (Phase 3)

Step 1 is done (v0.33). `dist/maps/emberfall.json` holds the arena bounds, lava channels, ledge, bridge and ramp surfaces, the safe and bridge-cover regions, player and bot spawns, the bots' ledge-exit route, shop station positions, bot destinations, bridge cover points, crates, and supply landing spots. `groundHeight`, `isLava`, `lavaDistance`, `safeZone`, and `isUnderBridge` now live in `shared/map-queries.js` with no THREE dependency; `world.js` and `arena-events.js` re-export them, so existing imports are unchanged. Heights on the ledge, stations, and spawns all come from `ledge.height`.

Map validation, in addition to types, units, and limits:
- edges are ordered (`minZ < maxZ`, `innerX < outerX`, `topZ < bottomZ`), and the lava rim is not inside the wall;
- the player spawn, all four corners of the bot spawn strip, and every station are on the ledge inside the safe region;
- the ledge exit approach is on the ledge, and its drop point is off the front;
- destinations are inside the wall, not in lava, and on a walkable surface at their stated height; bridge cover points are inside the cover region; crates and supply drops are not in lava.

Those rules call the same query functions the game uses. Problems are reported as `maps/emberfall.json → field: message` through the same `ConfigError` panel.

Step 2 is done (v0.39). The map file has `prefabs` and `objects`:

- A prefab names a mesh builder (`visual`) and lists its colliders: centered or offset `circle` (`r`) and axis-aligned `box` (`w`, `d`) shapes with `minY`/`maxY`.
- An object places a prefab at `x`, `z`, and optional `y`, `rotation`, and `scale`. Offsets, sizes, and `maxY` scale with the object; `minY` keeps its buried depth. `objectColliders` in `shared/map-queries.js` does that placement for `buildWorld`, the validator, and a future server.
- `buildWorld` walks `objects` in order, calls the prefab's mesh builder, and appends that object's colliders, so a mesh cannot move without its collision. Collider order matches the old code, which matters because `resolveCollision` resolves colliders in sequence.
- The mesh builders live in `world.js` (`crag`, `boulder`, `tower`, the three ledge rails, `portal`); `portal.js` now draws the gateway relative to its object. `PREFAB_VISUALS` in `map-schema.js` records which builders honor `scale` (boulder) or `rotation` (tower), and which may be placed only once (crag, portal). `buildWorld` throws if a listed visual has no builder.

Object validation rejects unknown visuals and prefab ids, duplicate object ids, inverted collider heights, `scale` or `rotation` on visuals that ignore them, off-center or box colliders on rotated objects, a second crag or portal, and any collider within the player's 0.38 m radius of a spawn, station, destination, bridge cover point, or supply drop.

Verification: the 15 placed colliders were identical to the hand-written list (exact JSON comparison). The 130,321-point grid snapshot, including `blocked`, `resolveCollision`, and `lineBlocked`, matched the v0.33 baseline. An order-independent fingerprint of every triangle, light, and sprite `buildWorld` creates (68 material groups, 62,551 primitives, rounded to 0.01 mm) was identical. The seeded random sequence for rock and torch variation is unchanged because the newly ordered pieces (rails and portal) draw no random numbers.

Step 3 is done (v0.41). Every collider the game uses now comes from the map:

- The crates, ten rock clusters, and three volcanoes are map objects with `crate`, `rock-cluster`, and `volcano` prefabs. Their visuals are `model` visuals placed from the map once the GLB files load (`placeMapProps` in `map-props.js`, shared by `game.js` and the editor since v0.46); rock objects carry their model `variant`. A collider may set `scaleTop: false` so its top stays fixed while its radius scales, matching the volcanoes.
- Stations name a prefab: `station-pedestal` for weapons and chest, `potion-table` for potions. `stationObjects` places them at the ledge height. Station visuals cannot be used as free objects.
- `mapColliders(map)` returns the objects' colliders followed by the stations', and `world.js` exports it as `colliders` when the module loads, before any model arrives. `createCollision(map, colliders)` in `shared/map-queries.js` provides `resolveCollision`, `blocked`, and `lineBlocked` with no THREE dependency; `world.js` re-exports them.
- The three station colliders moved from just after the world colliders to the end of the list. That cannot change sequential resolution: they span y 8 to 10 and every collider after their old position tops out at 2.8 m, so no position touches both.
- `stringLights` lists spans between object ids with a `sag`. Towers and the ledge side rails are anchor visuals, and anchor points and roof posts are derived from those objects.
- Validation also covers rock variants, station prefabs, string-light endpoints, and clearance from every prop and station. Writing the station exclusion exposed a bug where clearance checks skipped object colliders; the test suite caught it before release.

Verification: the 35 runtime colliders after models load were the same set as before. A runtime grid of 15 series at 83,521 points (blocking at five heights and two paddings, collision resolution at floor and ledge height, 600 line-of-sight pairs) had zero differences. Crate, rock and volcano models matched their old positions, rotations, and variants. The `buildWorld` fingerprint, now including string lights and roof posts, was identical. `tests/map.mjs` checks that the shared collision matches `world.js` over a full-arena grid without a scene.

Step 4 is done (v0.44). The top-level `ledge`, `bridge`, and `ramps` blocks are gone (map `schemaVersion` 2):

- Prefabs may list `surfaces` as well as, or instead of, `colliders`. A `flat` surface is a footprint (`w`, `d`, optional `x`/`z` offset) at a `height` above the object's base. Feet at or above `height − stepUp` land on it, and lower feet pass beneath, so players can walk under the bridge. A `ramp` surface rises toward one side (`rises`: `-z`, `+z`, `-x`, `+x`) to `height`, and catches feet within `stepUp` below the slope. Flat surfaces exclude their edges; ramps include both ends of the slope so they meet the floor and the deck.
- `objectSurfaces` places them, and `groundHeight` returns the highest surface that catches the feet, over the floor or the lava bed. Placed edges and heights are rounded to 1 nm, so an object position plus an offset produces the same number as writing that decimal directly. Without this, 0.8 + 10.8 gives 11.600000000000001 and 5.2 − 0.48 gives 4.720000000000001.
- The ledge (`0, 25.2`), the bridge (`0, −10`), and the two ramps (`±25.1, 0.8`) are objects with `ledge`, `bridge`, and `ramp` visuals, appended after the props so the seeded random sequence for torch flames keeps its order. Their builders draw relative to the object. The ramp builder reads its surface for the slope, length, and plank heights, and the `ramp` visual requires exactly one ramp surface rising toward −z.
- The spawn ledge is whatever surface is under `spawns.player`. Stations stand at the ground height under them, and `game.js` uses the player spawn's ground height for bot spawns, returns, and the bots' ledge exit. Validation requires the bot strip corners, the stations, and `ledgeExit.approachZ` to share that height inside the safe region, and `ledgeExit.dropZ` to be below it. Objects with surfaces cannot be rotated or scaled.

Verification: the 39-series grid snapshot at 130,321 points (ground height at ten feet heights including the 4.72 and 7.5 thresholds, plus every lava, blocking, region, cover, and collision series) had zero differences. A separate edge probe compared the v0.43 formula with the new surfaces at every surface edge and threshold and the two floats on either side: 414,375 cases, zero differences. The same probe finds 46,894 differences if the 1 nm rounding is removed. The `buildWorld` fingerprint, including every ledge, bridge, and ramp mesh, torch light, and banner, was identical.

Step 5 is done (v0.45). Objects, stations, both spawns, both regions, the ledge exit, navigation points and supply drops may name a `parent` object. Their positions are offsets from it, and `parseMap` resolves them to absolute values (rounded to 1 nm) before validation, so everything after parsing reads absolute coordinates as before. Regions and the ledge exit gained an optional center `x` (0 when omitted), which `safeZone`, `isUnderBridge`, and the bots' exit lane now use. Parents must be top-level, unrotated, unscaled objects.

- The ledge's children: its five rails, `regions.safe`, both spawns, all four stations, and `ledgeExit`.
- The bridge's children: `regions.bridgeCover` and the six cover points. The portal builder places the dormant rune on the bridge deck's center.
- The two deck destinations at the ramp tops follow their ramps.

Verification: the parsed map was identical to v0.44 apart from the new `parent` links and zero center `x` fields. The 39-series grid, the 414,375-case surface edge probe, and the `buildWorld` fingerprint all had zero differences. A first comparison caught `DESTINATIONS` copying the new `parent` key into bot navigation data; it now copies only positions. Tests shift the ledge and bridge and check that spawns, stations, rails, the safe region, bridge cover, the deck height, and the rune follow.

Step 6 is done (v0.46). `editor.html` (or `/edit` in chat) opens a map editor on the real arena:

- It edits the raw, parented JSON. `editor-model.js` holds every edit as a pure function on that JSON, so tests drive it without a browser. A move changes the entry's own stored offset by the snapped distance to the target, which keeps the 0.1 m grid at the resolved position and lets children follow their parent. Changing a parent keeps the entry where it stands. Renaming an object updates its children and string lights. Removing an object leaves its children at their resolved positions and drops its string lights. Stations and spawns cannot be removed, and each point list keeps at least one entry.
- `inspectMap(raw)` in `map-schema.js` returns every issue plus the resolved map whenever fields and references are valid. `parseMap` is `inspectMap` that throws. The editor therefore draws a draft that breaks a placement rule, lists the messages, and links each one to its entry. Play draft is disabled while any issue remains.
- The world is drawn by the game's own `buildWorld(scene, map)` and `placeMapProps`, so the editor shows what the game builds. `buildWorld` takes a map argument (default `MAP`). The clipped floor geometry is cached by lava paths and bounds, and the moon texture pixels by size, so a rebuild takes about 0.1 s instead of 1 s. Rebuilds are throttled to five a second while dragging, and the overlays follow every frame.
- Overlays: colliders, walkable surfaces, the safe and bridge-cover regions, the bot spawn strip, the ledge exit, and one handle per editable entry (objects, stations, spawns, destinations, cover points, supply drops). Each layer can be toggled.
- The draft autosaves to `localStorage` (`emberfall.mapDraft`). Export downloads it in the bundled file's layout, so an unedited export is byte-identical and an edit changes only its own line. Import accepts any file the editor can draw. Reset replaces the draft with the bundled map, and undo brings the edits back. Nothing is written to the server.
- Play draft opens `index.html?draft`, which loads the saved draft in place of the bundled map and says so in chat. Progress earned in a draft match saves to the normal profile.

Verification: the `buildWorld` fingerprint is identical on the bundled path and when given a parsed copy of the map. The grid snapshot matched apart from the v0.47 merchant stand's collider, which another change added. `tests/editor.mjs` covers the export layout, parented moves, reparenting, renaming, the palette, removal, issue targets, prefab switches, and draft loading in `map.js`. It also checks that the editor makes no network calls. In the browser, a dragged boulder snapped to the grid and saved, a supply drop moved into lava raised an issue and disabled Play draft, undo and redo restored exact values, a moved ledge kept its children's offsets, and Play draft started a match on the edited map.

Before step 1, the coordinates below were repeated as literals across modules:

- `groundHeight`: ledge `|x| < 9.35, z > 18.9 → y 8`; bridge `|x| < 27, −11.9 < z < −8.1 → y 5.2`; side ramps.
- `safeZone`: `y > 7.65, |x| < 9.5, z > 18.7`. `isLava` and `lavaDistance` use `lavaPaths` and the radius 33.7 rim.
- Other modules depend on the same geometry: `arena-events.js` (`BRIDGE_COVER_POINTS` z −10, `isUnderBridge`, `DESTINATIONS`), `game.js` (ledge exits z 15/22 y 8, spawn points, station positions), `duels.js` (`MINI` courtyard at x 96 with `MINI_COVER`), `MAP_CRATES`, and the embers and burning systems along `lavaPaths`.

Each of those is a dependency that must move together. Moving a mesh without its collider, walkable surface, cover region, and bot destinations breaks combat and navigation without any error.

Proposed `dist/maps/emberfall.json` (schema `emberfall.map/1`, validated by the same toolkit):

```
{ schemaVersion, id, bounds: {radius, rimRadius},
  prefabs: { "<id>": { visual: {model | procedural, materials},
                      colliders: [{type: box|circle|segment, ...}],
                      surfaces: [{type: flat|ramp, height, footprint}],
                      tags: ["cover", "walkable", ...] } },
  objects: [{ id, prefab, position, rotation, scale }],
  regions: [{ id, type: safe|lava|cover|spawn|shop|arena, shape }],
  paths:   { lava: [{points, width}] },
  navigation: { destinations: [...], exits: [...], crossings: [...] },
  spawns: { player, bots, supplies, crates } }
```

Rules:
- A prefab owns its visual, collision, walkable surfaces, and tags. Placing an object places all of them, so visuals and collision cannot drift.
- Gameplay regions are data, queried by one shared function (`regionAt(p)`) that replaces `safeZone`, `isUnderBridge`, and `isLava`. The server uses the same function.
- Collision and region queries live in `dist/shared/map.js` with no THREE dependency. Rendering builds meshes from the same parsed map in `world.js`.
- Validation checks that object prefab refs exist, regions have positive area, navigation points are on walkable surfaces and outside lava, spawns are inside the safe region, and colliders don't overlap spawn footprints.

Migration order, each step reviewable on its own:
1. Done in v0.33. Extract static data (`lavaPaths`, `MAP_CRATES`, cover points, destinations, safe/ledge/bridge numbers) into the map file and read it from code. A grid snapshot of 39 query series (ground height at ten feet heights, lava, blocking at four heights, safe zone, bridge cover, nearest cover, collision resolution, line of sight) at 130,321 points was identical before and after.
2. Done in v0.39. Move collider definitions next to their visuals as prefabs. Compare collider lists exactly.
3. Done in v0.41. Put every collider in the map and run collision from `shared/`; see step 3 below.
4. Done in v0.44. Replace the analytic ground height with walkable surfaces owned by prefabs; see step 4 below.
5. Done in v0.45. Parented placements, so dependents move with the ledge and bridge; see step 5 below.
6. Done in v0.46. The first usable editor; see step 6 below.

## Authoritative multiplayer (later)

- The server loads the same `dist/shared` modules and JSON, and owns damage, hit validation, immunity, prices, rewards, chest rolls, inventory and ownership, rank changes, and admin commands. Clients send intent (input, aim, purchase requests) and render server state.
- `CONFIG_VERSION` and a map content hash go in the join handshake, and mismatches are refused. Content changes ship as a new server version, never as client-side edits.
- Behavior modules are already mostly pure: `combat.js`, `progression.js`, and `charged-melee.js` take explicit state and time. The main work is pulling simulation out of `game.js` (which mixes simulation, rendering, input, and DOM) into shared modules, starting with `hurtPlayer`/`hurtFighter`, projectiles, and status effects.
- `openChest` already accepts an injected RNG, so the server supplies the randomness. Saved profiles move server-side for accounts; guest local storage stays as it is.
- Bots and chat remain local simulations until a server exists.

## Baseline and verification

Baseline before migration (v0.25): all 14 test files passed after the earlier test-harness repairs. Migration safety used a temporary snapshot of every exported table and of tuning-function outputs: damage grid, knockback cases, charged stats, 400 seeded chests, rewards, ranks, salvage, and v1/v2/v3/v4 profile loads. The diff after migration had zero changed values; the only differences were new fields such as `EFFECTS.*.kind`. The v0.29 bots/events migration repeated this with bot profiles, 40 generated bots, click jitter, event runs, streak tiers, and target priority: zero changed values, with only `EVENT_TYPES.*.kind`, `damage`, `fire`, and `ambientDamage` added.

`npm run check` now runs every test file (`tests/run-all.mjs`, about 25 s). `tests/map.mjs` covers the bundled map, 44 kinds of invalid map content (17 layout, 27 prefab, surface, object, station, string-light and parent), data-driven queries, moved objects moving their collider, blocking, mesh, and string lights together, a moved crate and station moving their colliders, a moved ramp moving its walkable height and planks, a shifted ledge and bridge carrying their children and the rune, stations standing on an edited ledge height, shared collision matching `world.js`, edited map files changing `world.js` and `arena-events.js`, and a guard against `game.js` repeating map literals or adding its own colliders. `tests/config.mjs` covers:
- the bundled config loads, is frozen, and has a version;
- clear errors for 27 kinds of invalid content;
- referenced model files exist;
- a save holding every persisted id loads without losses;
- edited JSON in a scratch copy changes gameplay results (immunity, crits, block, bow, heavy damage, chest price, storage, stack limit, starter kit, KO coins, effect text, bot click timing, generated-bot speed, target priority, killstreak tiers, event schedule);
- every local import carries one consistent cache version.

## Next bounded task

Editor round two, chosen from what the first editor cannot reach yet. Each item is small and testable on its own:

- Lava channels: drag path points, insert or remove a point, and edit a channel's width. The floor clip and the lava queries already rebuild from the map.
- Region and ledge-exit handles: drag `regions.safe`, `regions.bridgeCover` and the `ledgeExit` lane, and edit their sizes in the inspector.
- Make the ledge and bridge meshes follow their surface sizes, so changing a prefab's `w`, `d` or `height` changes the mesh as well, like the ramp already does. Then the inspector can edit prefab surfaces and colliders.
- Duplicate (Ctrl+D) and a nudge readout for exact relative moves.
- Draft matches should not award progress, or should say that they do.

Keep the bundled map's output identical: the same grid, collision and mesh snapshots.

## Generated portal dungeon (v0.54)

`maps/ashen-crypt.json` and `config/dungeon.json` use their own version 2 schemas in `shared/dungeon-data.js`. Templates describe footprints, sizes, props/colliders, lava pools and encounter packs; tuning describes mob types, spell windup/duration/damage, rewards and depth scaling. `dungeon.js` generates deterministic room graphs from a uint32 seed, chooses distinct visual templates, places safe enemies, cuts real door sockets in polygon walls, and produces the same walkable footprints used by collision. Gate locks refer to the source room's clear state. Optional chambers are branches, not required blockers for the final cache.

`dungeon-world.js` renders the generated layout, merges static architecture by material, culls room lights by distance and keeps moving environmental/set-piece geometry separate. Rebuilding disposes the previous floor's owned geometry/materials while preserving shared GLB geometry. Collision and camera/projectile obstacles refresh with the generated floor. Rooms use true rectangular, cross or octagonal outlines, not a row of identical boxes.

`dungeon-magic.js` plans seeded targets and warning/active/finished timing with no DOM or THREE dependency. `game.js` applies spell physics and shared combat rules: physical fans, delayed multi-target lightning/meteors, gravity pulling and damage, and jumpable expanding waves. A caster's death cancels its remaining ground spells. Player powers, inventory and the arena's classic click/input rules remain shared.

Each floor has a miniboss, a variable final boss and optional epic-item caches. The final cache remains a one-time grant of physical dungeon relics. Descending generates another seed/depth, removes old enemies and spell effects, retains carried inventory and scales enemies/rewards up to configured caps. Returning or respawning pauses the current instance for re-entry. The run resets on page reload; carried inventory/vault persist as before. Ground drops keep their five-minute lifetime and a `dungeonSeed` field; another generated floor cannot show or collect them. Overflow boss relics block descent until collected or expired. No multiplayer/server state has been added.

## Arena repairs and controls (v0.55)

The dungeon implementation is retained, but the arena portal returns `active: false`, has no animated veil/light, and its threshold contains a fallen block with a map-owned collider. Both the interaction prompt and `enterDungeon()` require an active portal. Existing carried relics and vault items are preserved.

The event schema now accepts supply giveaways only. The scheduler supports a single repeating event type; destructive hazard rendering/damage and the bots’ shelter plan were removed. Bots may still use the bridge as ordinary terrain.

Q/E and A/D strafe, I toggles inventory, X uses potions. Inventory slots only inspect on click; drag/drop moves or swaps, shift-click transfers and number keys move the selected carried item into the actual hotbar slot. A second Space press in the air initiates a physical directional roll without adding vertical velocity; Alt rolls directly. Duration, cooldown, speed, minimum clearance and camera dip live in validated combat JSON. Rolls have normal damage and collision, use the imported Roll clip, and do not change admin flight. Desktop attacks use `mousedown`/`mouseup` to support mouse-button chording. Melee-only aim padding is capped at 0.1 m by the schema and never extends reach or changes damage immunity.

## Popup presentation (v0.56)

`game-panels.css` is loaded after the existing HUD stylesheet. A repository-owned SVG border (`assets/ui/panel-frame.svg`) uses nine-slice scaling for sculpted transparent corners and a consistent gold/wood rim across pause, settings, equipment, match signup and leaderboard. Buttons, tabs, inventory trays and lightweight notices share the palette. The treatment does not add menu actions or explanatory labels. Small-screen and short-screen rules retain scrollable content; panel entry motion respects reduced-motion settings.

## Arena tuning and presentation (v0.57–0.58)

`panel-layout.js` computes inset scrollbar bounds from actual frame borders/padding and transforms. The scrollbar installer observes resize and completed transitions, and scans for new controls only after DOM child changes. Panel grids use shrinkable columns, wrapping actions and dedicated compact layouts.

`aim-focus.js` selects one visible enemy near the input ray for visual feedback. It does not modify input, reach, immunity or the damage ray. Character material highlights use the existing restoration path, while four small floor arcs and crosshair styling indicate focus and reach. Blood droplets share the capped particle pool, fall onto short-lived floor flecks and remain hidden on the first-person owner. The complete lit portal exposes `dungeonEnabled: false` separately from its visual `active` state.

Melee base damage, ranged damage, Sentinel HP and item prices are retuned in validated config. The unarmored starter class matrix is explicitly tested at 4–6 direct hits. `flightPose` config controls transition/response rates, maximum lean and hover amplitude; filtered velocity drives trailing feet and whole-body lean, with non-destructive saved transforms and a fade on exit.

## Multi-round matches and taller spawn (v0.59)

Validated `progression.match` sets three rounds and four seconds between rounds. Match phases now include `round-result`; each next round resets health, effects, projectiles, ragdolls and cooldowns, while physical equipment stays with its owner. Match death bypasses arena loot/rank rewards; the final score pays the match reward once. Forfeits remain unrewarded.

The ledge object moves vertically by 12 m to place its existing surface at 20 m. Child rails, safe region, spawns, stations, navigation exit and sign follow the parent and shared ground queries. Ground-anchored posts overlap transverse crossbeams seated against the platform underside, with long side braces.

Inventory rendering returns a selection controller: inspection changes selected classes and details in place. An equipment signature avoids rebuilding character and held models for unrelated moves; refreshed panels preserve scroll, while new contexts start at the top. Repeated I/F keydown events cannot flicker menus.

## Stamina, camera indexing and under-ledge arena (v0.60)

`stamina.js` reads validated combat tuning and shares sprint exhaustion, delayed recovery and mobility costs across player/bots. Safe ledge and admin bypass restore full stamina; respawns and rounds reset it. Melee input, hurt immunity and weapon stats are unaffected. The HUD interpolates the bar widths in CSS and respects reduced motion.

`scenery-index.js` builds an X/Z grid of static world-space triangles once after asset placement. DDA ray traversal tests only crossed cells with vertical bounds; material sidedness and draw ranges are preserved. Camera collision uses four short probes; third-person aiming uses one scenery query plus the same fighter hitboxes as melee, without CPU-skinning opponents. Hover feedback reuses the rendered camera; actual combat input refreshes the indexed camera probes for immediate mouse aim. Generated dungeon indexes are separate. This does not establish a browser frame-rate measurement.

The new combat deck and both staircases are map prefabs, with surfaces shared by physics and mesh builders. Four grounded piers support the terrace above a walkable underpass. `elevation-route.js` derives ascent paths from shared flat/ramp surfaces rather than hardcoded ramp coordinates. Raised spawn garlands clear the stations; the merchant stands directly on the planks. Floating inverted cavern cones were removed.

Flight lean/IK has one owner, character-pose, with filtered travel and independent limb drift. Lower-body flight locomotion no longer adds a second lean. Potion healing remains immediate with its existing cooldown; the bottle and left-arm sip are cosmetic and cancel on attacks, slot changes, death or modal opening. KO announcements are short-lived and keep match reward accounting separate.

## Wind cloth, guard and multi-level architecture (v0.61–0.62)

`wind-cloth.js` builds a subdivided pennant and one instanced mesh for all 35 flags. Vertex deformation pins the upper hem while travelling folds and gusts affect the free cloth; matching normal perturbation and a UV sigil retain its material treatment. Fabric proxies are invisible metadata for placement and carry no camera/player collision. Only the shader time uniform changes per frame.

`render-work.js` caches unique rig material lists and freezes only stationary prop transforms. Preparation reuses cloned materials within a model while keeping character instances independent. The live frame passes `visuals=false` to fixed-step fighters, then updates nearby visuals once per rendered frame and distant/offscreen visuals at lower rates. Combat, projectiles, status effects and navigation stay fixed-step. Material restoration is skipped only when appearance state is unchanged; effect pulses remain animated. Bone lookups are cached per pose layer. Scrollbar observation ignores unrelated HUD mutations. Hidden 2v2 architecture/lights and the lobby preview do not render/update in ordinary arena play.

Guard separates held-button intent from its brief post-swing opening. Validated resume delays allow block-hitting without requiring a second right click; frontal damage/knockback rules stay unchanged. The player body follows cursor yaw during movement, retaining stationary neck/body freedom.

The map adds a 7 m mezzanine above the 3.2 m terrace, stairwell openings, connected landing surfaces, screens and cover. Elevation routing follows connected surfaces and recursively approaches intermediate ramp bases. Tower colliders use a rotated `ring` with an inner room and a doorway; shared physics, lava/floor queries and editor overlays all recognize it. Hollow shell meshes, inward doors and floor disks replace the solid tower base. Ground-level decorative rocks that overlapped the new interiors are removed.

`flame-batch.js` also batches the three authored flame lobes per torch into one instanced draw. Original transforms, colors and per-flame phase are retained; flicker runs in the vertex shader. The detached old flame meshes dispose their geometry/materials after instance data is copied. This keeps the expanded architecture within the existing mesh budget.

`createCollision` indexes pre-expanded collider bounds in 4 m cells for its repeated visibility/steering point samples. Queries with padding up to 1 m use that bin; wider probes fall back to the full collider list. The narrow phase and ordered collision resolution are unchanged, with grid comparisons against a brute-force reference.


## Merchant contracts and arena corrections (v0.63–0.64)

`config/progression.json` owns 27 bounty definitions, their action quantities, coin/EXP rewards and the three-contract limit. The schema restricts objective metrics and validates numeric units. `bounties.js` sanitizes additive profile state, accepts contracts from zero, advances matching active objectives, caps progress, abandons without reward, and pays each completed contract exactly once. Existing physical inventory and saves retain their v4 format. Actual player events advance progress; command eliminations do not. Claiming and acceptance save immediately; action progress batches writes at most once per game second, with a pagehide flush. The merchant Bounties tab lists contracts and the compact right-side tracker shows only accepted contracts. This remains browser-local progression, like the existing economy.

Removed all ten under-ledge screen/cover objects and suspended mezzanine torches. The open floors, stairwell clearances, support timbers and routes remain. Tower banners sit centered above the doorway, corner timbers begin at floor height, and the inset stone floor top is separated from the base disk. Cloth uses a deterministic placement hash for speed, amplitude and phase while preserving pinned hems and one instanced draw.

Projectile wall tests now query the existing static triangle index with the original 0.001 m near plane and exact segment length. Impact locations come from the nearest indexed hit; victim-versus-wall ordering is unchanged. `render-warmup.js` deduplicates and uploads scene/model textures in yielding batches and awaits compilation for arena, weapon and hero views before enabling Play. This addresses identifiable hot paths, not a measured browser FPS claim: actual WebGL shader rendering and intermittent stalls still require browser profiling.

Both vital bars remain beneath the real hotbar, without a heart icon. Fine filigree, colored enamel gradients and flowing highlights use CSS, honoring reduced-motion settings. Unavailable notices are red. Leaderboard columns color kills green and deaths red across all tables.


## Immediate hits, crossing stairs and advanced rendering (v0.65)

The user replaced classic 0.5-second immunity with unlocked direct hits. `combat.melee.hurtWindow` is zero, shared by player and bots. Each valid mouse-down swings and resolves its ray immediately, even when no simulation step has elapsed since the preceding click. The first-person pose updates in that handler, with a visible initial slash and immediate hit marker. A light click is no longer rejected during heavy recovery; only charged follow-ups check that recovery. Holding still never auto-attacks. Existing aim/reach, guarding and knockback caps remain. `combat.presentation.damageFlash` configures the stronger immediate red overlay and its fade.

The second stair set consists of four diagonal ramp surfaces joining the 3.2 m deck, a shared 5.3 m landing and the 7 m rear balcony. Optional per-ramp surface rotation transforms both the footprint and rise. Shared local/world coordinate helpers drive height queries, mesh steps, editor overlays and elevation route endpoints. Existing non-rotated surfaces retain exact query thresholds. The upper balcony leaves the flights open above their approach rather than placing a ceiling across them.

`shader-quality.js` adds an opt-in Advanced shaders path. A multisampled HDR color target retains sharp scene color. Extracted bright light alone is downsampled, blurred in two passes and added during tone mapping/color grading. There is no previous-frame history, velocity-based sampling, motion blur or depth of field. First-person equipment and lobby composition remain in the same image. Three targets resize with the drawing buffer and dispose on leaving advanced mode; unsupported float color buffers use an unsigned-byte fallback. High and Performance bypass all post-processing. World quality also raises shadow resolution, lava shader detail and rising ember count. Presentation parameters are validated in combat config; reduced settings use their existing lower particle counts. GPU appearance and device FPS still need live-browser verification.


## Movement cues, quiet hotbar and personal emblems (v0.66)

`movement-streaks.js` reads local velocity, actual movement speed and active roll/dodge timing. It renders a bounded set of straight edge strokes plus two roll crescents into one transparent 2D canvas. The center stays empty. It does not touch the camera, simulation, particles or post-processing and never samples a previous frame. Idle effects fade once and stop canvas work; chat, pause, death, free camera, flight, the Settings switch and reduced-motion preferences suppress them. Sprint still uses its existing FOV response. The combat hotbar keeps the same nine physical slots, with all visual overrides scoped to the HUD rather than inventory/chest grids.

`emblems.js` stores only validated badge ids, shape ids, hex colors and bounded transforms. Twelve immutable vector shape definitions support up to twelve layers. SVG generation uses these definitions and sanitized scalar properties; user-supplied SVG, URLs, paths and markup never enter the result. Profile normalization adds an optional emblem while preserving v4 inventory and all existing possessions. The personal Emblem tab edits a separate draft, with drag/keyboard placement, transform controls, copy/delete/order, a bounded undo stack and explicit Save/Cancel/Remove. Saved emblems render as isolated SVG data images in the player leaderboard row. The leaderboard signature includes the saved design, so save/removal updates an otherwise unchanged scoreboard. Emblem data remains browser-local alongside the existing account progression.


## Presentation and ledge cleanup (v0.67)

The Tab-only Player list uses a 44px emblem/rank crest leading each identity column. Saved emblem validation and inventory persistence are unchanged. Pause actions use a two-column secondary grid below Resume. Chest storage reserves 21px of right padding for the existing six-pixel custom scroll track.

The upper under-ledge route is now two parallel straight ramps, with matching visible steps and walkable surfaces, from the 3.2m deck to the 7m rear balcony. Diagonal crossing geometry is removed; generic oriented-ramp support remains covered by synthetic rotated-surface probes. Merchant speech requires the main safe ledge region, matching height, an alive player and ordinary arena play; stepping off the ledge stops a playing clip.

Torch lobes use a shared tapered flame geometry and GPU tip flutter in one instanced draw. Burning characters use the same bounded particle count with tapered flame sprites. The wind-cloth shader draws a winged sword/shield crest without adding textures or draws. `arrow-model.js` makes three merged material groups per arrow, with each projectile owning its resources for the existing cleanup path. Movement-line opacity/width and hotbar presentation changed; combat timing, camera physics and motion-blur policy are unchanged.
