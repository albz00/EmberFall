# Emberfall

A static Three.js kit arena with thirteen selectable characters, instant sword input, nine named AI fighters, a usable bow, three magic staffs, consumable potions, local progression, an equipment economy, and supply-crate giveaways. The dungeon entrance is closed. Inventory and rank are saved in this browser; opponents and AI chat are simulated locally.

## Controls

- WASD move; Shift sprint; Space jump; press Space again in the air for a diving roll, or Alt for a ground roll; Q/E perform quick left/right dodges; hold C or Ctrl to crouch. V toggles first and third person. Touch has crouch and camera controls.
- 1 selects the equipped sword or staff; left click strikes immediately or casts the staff spell; right click guards.
- 2 selects the bow; hold left click to draw, release to fire. Full draw takes 0.8 seconds. Arrow flight has gravity and collision. KOs and returning to the ledge refill arrows.
- I opens and closes inventory; drag items to move or swap them. F interacts with stations and dropped items. X drinks the selected potion; Z changes potion.
- R or `/spawn` channels a return to the ledge for three seconds. Combat blocks and interrupts it.
- T opens ranked local chat; Tab shows the leaderboard; Escape pauses. The leaderboard is also available from the pause menu.
- Touch controls and drag-look fallback are included.

## Combat and progression

Vanguard, Rogue, and Sentinel have 300, 260, and 330 HP. Instant attacks use a shared 0.5-second hurt-resistance window; falling strikes crit, guard reduces frontal damage, and armor reduces incoming attacks.

Nine named AI fighters have distinct reaction times, aim error, and click profiles from 2.9 to 12.2 CPS, including a 9.4 CPS opponent. They respawn on the same ledge and physically run and jump down. Their plans include dueling, flanking, roaming, recovering, collecting supplies, and seeking advantageous positions. Bots plan lava crossings before jumping, check a dry landing footprint, and commit to the crossing. Three-, five-, and ten-KO streaks gain progressively brighter auras and rings. High-streak fighters attract more attention.

KOs award coins and rank points; deaths reduce rank points. Earned coins buy weapons, body armor, a separately wearable helmet, and potions. Helmet and cuirass reduction combine multiplicatively. Helmet fitting follows the chosen character’s head. A crate costs 650 coins and awards a weapon with disclosed 52/32/13/3 percent common/rare/epic/legendary odds. Variants have bonus damage and emissive materials; inventory supports equip and salvage. Original profile storage is preserved. Staffs also appear in equipment chest rolls and gain rarity damage bonuses.

Frost staffs deal 60 base damage and slow movement 35% for two seconds. Venom staffs deal 56, then four 6-damage poison ticks. Arcane staffs deal 80 and chain to up to two nearby targets for 18 each. Actual projectiles collide with arena geometry and use 0.65–0.9 second cast intervals. Existing sword input remains immediate.

Healing potions restore 115 health; haste grants 25% movement speed for 12 seconds; guard reduces combat damage 25% for 10 seconds. X consumes one saved bottle, Z cycles type, and the exact supplied bottle appears during drinking. Active buffs show their remaining time and expire on death. Healing stock refills to a minimum of three on respawn or return; purchased extra stock is retained. The supplied wizard table stands on the ledge with all three supplied potion models displayed. The original equipment chest stays in place.

Supply giveaways drop four actual supplied crate models. Pickups grant coins, arrows and health. Cave-ins and eruptions are disabled, and bots no longer seek event shelter.

The player health bar sits beneath the bottom-center hotbar, with one overhead bar per opponent. The duplicate target panel was removed. Bottom-left chat retains its DOM nodes between updates. Kills appear in a separate, subtle top-left feed with at most four entries, fading after six seconds. Item previews use padded orthographic framing. First person renders only the weapon, with no body or hand meshes. Blocking angles the blade inward to the left. Third person shows the full selected character with equipment and a collision-aware chase camera. Crouching lowers the camera, slows movement, changes the sword target height, and visibly bends/lowers the character.

Audio includes an original 34.29-second, 112 BPM minor string-and-drum loop, separate music and environment volumes, wood and stone footsteps, stereo wind gusts and drips, nearby lava sound, event rumbles, and layered impact sounds. Successful hits combine transient, body, and metallic decay with pitch variation; criticals add weight. The environmental bus drops 72% during combat sounds and eases back afterward. Lava fades out by seven metres and accounts for player elevation. The music audio element starts directly from Play or Resume, retries on the next gesture if blocked, and does not depend on the rendering loop. Settings also include Play music. The lava streams emit 620 rising embers, reduced to 240 in performance mode; the particles start on the actual lava paths and fade as they rise.

## Source and assets

- `dist/config/*.json`: all combat, equipment, economy, and progression tuning (kits, movement, melee, knockback, heavy charge, bow, weapons, spells, status effects, armor, potions, cosmetics, rarities, chests, rewards, ranks). Validated at load; see `docs/ARCHITECTURE.md`.
- `dist/shared/`: browser-independent config loader, schema, and validator, shared by the game and tests.
- `dist/game.js`: input, simulation, animation, equipment, chat, events, effects, and rendering.
- `dist/progression.js`: persistent profile, purchases, rarity rolls, salvage, rank math, character roster. Tuning comes from config.
- `dist/combat.js`: hit checks, damage, knockback, steering, AI skill profiles and click timing. Tuning comes from config.
- `dist/world.js`: batched cavern geometry, platforms, ramps, and collision.
- `dist/arena-events.js`: event timing, cover regions, destinations, streak math, bow damage.
- `dist/music.js`: gesture-started music playback, stereo environmental synthesis, and combat ducking.
- `dist/equipment.js`: rigid body/head armor fitting against the actual character rig.
- `scripts/render-music.py`: original synthesized soundtrack source, with seamless wraparound tails.
- `dist/assets/`: downloaded models and attribution. See `ADDITIONAL-CREDITS.txt`, `V3-CREDITS.txt`, and `V5-CREDITS.txt`. The ten new exact model sources and transforms are recorded in `v5-asset-info.json`.

Eight Polygonal Mind avatars were originally static: fitted skin weights and retargeted Quaternius animations were added. The new Knight retains remapped original skin weights. Hands retain the supplied geometry; the added rigs do not articulate individual fingers. All assets and dependencies are served locally.

## Verification

`npm install` once, then `npm run check` runs every test file (about 20 seconds). `node tests/config.mjs` validates the bundled config, checks error messages for invalid content, confirms saved ids survive loading, proves edited JSON changes gameplay, and checks cache-version consistency.

`node tests/verify.mjs` checks geometry, movement, damage, health, event phases, cover, streak targeting, economy, persistence, normalized models, sustained wrist animation, and UI wiring.

`node tests/runtime.mjs` exercises actual GLB and texture loading, all nine AI ledge entries, melee damage, KO rewards, respawn, return interruption, charged bow projectile hits, supply-only scheduling and rewards, killstreak auras and targeting, persistent chat nodes, full third-person bodies, camera collision, hidden first-person body/hands, crouching, inward blocking, exact map crates, the restored ledge chest, planned lava crossings, the ten new equipment models, helmet fitting for all thirteen characters, projectile cover collision, all three spell effects, potion effects and stock persistence, and the ledge table. It uses the `@napi-rs/canvas` dev dependency. Its DOM, WebGL renderer, and audio element are stubs: it does not verify browser layout, GPU output, or audible playback.

`node tests/audio.mjs` checks gesture playback, blocked-start retry, looping, volume changes, the shipped MP3, environmental ducking and recovery, proximity attenuation, and stereo gust variation. The actual MP3 was decoded and verified separately; audible browser playback remains unverified.

The nine new actors were also checked through the production GLTFLoader and sampled across their animation clips for finite, stable skin deformation. Browser visual playtesting was unavailable in this session.

## Ashen Crypt (closed)

The portal is fully built and glowing, but interaction reports that the dungeon is unavailable. The implementation below is retained for future work; there is no playable dungeon access. Existing carried or stored relics remain valid.

The retained generator works as follows. Every run generates an eight- or nine-room floor with branching routes, two optional reliquaries, a Riftweaver miniboss and either the Cinder Warden or Tempest Regent. Templates supply distinct rectangular, cross-shaped and octagonal spaces: ossuary, archive, forge, conservatory, observatory, vault and final sanctums. The seed reproduces geometry, routes and enemy packs; returning after death resumes that floor during the same session.

Enemy magic has real warning and impact phases: dodge lightning and meteors, escape gravity wells, avoid fire and frost volleys, and jump over expanding shockwaves. Forge pools use the same submerged-lava behavior as the arena. Bosses summon reinforcements below half health. Clear the floor and claim the physical relic cache, then choose the blue return portal or violet descent rift. Deeper floors generate new layouts and increase enemy strength and coin/EXP rewards. Collect any overflow relic drops before descending. Optional caches grant one epic weapon and coins, once per floor.

Carried inventory, chest storage and death drops keep their ordinary rules. Ground drops are tagged with the floor seed so they cannot be collected on a different generated floor. Inventory and dropped items are browser-saved; the generated run itself lasts only until page reload. Dungeon-only weapons remain stronger than normal arena chest rolls.

`dist/maps/ashen-crypt.json` holds the generator constraints and room templates; `dist/config/dungeon.json` holds enemies, spells, depth scaling and rewards. `shared/dungeon-data.js` validates both; `dungeon.js` generates layouts and provides pure geometry/progression queries; `dungeon-magic.js` plans deterministic spell targets; `dungeon-world.js` draws and batches architecture and animates environmental and spell effects. The current map editor still edits the main arena, not the generated dungeon templates.

`tests/dungeon.mjs` checks 256 seeds, room/door clearance, safe spawns, flood-filled navigation, spell timing, physical loot rules and finite batched geometry. `tests/v54-gameplay.mjs` retains the previous integration scenarios for future dungeon work and is not invoked while the entrance is closed. `tests/v55-gameplay.mjs` instead verifies disabled entry, supply-only scheduling, Q/E and I controls, physical rolls, mouse-button chording, inventory interactions and repaired roof geometry. WebGL output and real browser performance require a browser playtest.

`dist/game-panels.css` and `dist/assets/ui/panel-frame.svg` provide sculpted menu frames, beveled controls and cartoon overlay styling.

The starter iron sword deals 60 damage: five unblocked hits defeat an unarmored 300-HP Vanguard. All starter class pairings take four to six hits. Armor and guard reduce damage; upgraded weapons reduce the number of hits. The direct-hit immunity window stays at 0.5 seconds.

Q/E are short directional dodges with a shared mobility cooldown, while A/D retain ordinary strafing. Hovering an opponent gives faint body/foot cues and an in-range crosshair cue without steering aim or extending reach. Red droplets accompany sword hits and bleed status ticks, with personal particles hidden in first person.

Equipment chest rolls cost 650 coins. Basic upgrades now require several KOs: dagger 250, broadsword 500, leather 300 and iron 600. A gemblade costs 1,800; golden armor costs 1,800. Existing coins, item copies, starter gear and the two million-coin items are preserved. Flight blends and pose limits are configured in combat JSON.

The unchanged spawn platform is now 20 m above the arena, with grounded posts and bracing. 2v2 plays three scored rounds with fresh health and countdowns; the final score determines the single match reward. Gear is retained during match eliminations. Inventory selection updates details without replacing the slot grid; moving unequipped copies preserves character models, and slot numbers are plain labels.

In v0.60 a liquid health bar and turquoise stamina bar share the center HUD. Sprint drains 12 stamina per second; rolls cost 24 and quicksteps cost 18. Stamina recovers at 24 per second after a 0.65-second rest; an exhausted sprint resumes above 20. Attacks do not use stamina. The under-ledge terrace is reached by two staircases, with a ground walkway beneath it. Static scenery uses a reusable spatial index for third-person camera/aim queries. Healing stays instant; attacks and slot changes immediately end its visual sip, so the sword is never attacking while hidden behind that animation.

Updates 0.61–0.62 add wind-deformed pass-through flags in one instanced draw, a second screened fighting level beneath spawn, and enterable tower ground floors. Tower doorway collision and interior floors share the map data, and bots route through intermediate stairs and doorways. Holding right-click resumes guard 0.07 seconds after a light swing (0.32 after a heavy), with the existing frontal damage and knockback reductions. Moving third-person bodies follow the cursor yaw; idle head look remains free. Streaks appear only at the top right and the knockout announcement is the single coin/EXP kill notification.

Rendering optimization keeps texture files and model geometry unchanged. Arena pose updates run separately from 90 Hz combat; distant actors update at 30 Hz and off-screen actors at 12 Hz, while nearby visible actors update each rendered frame. Material lists and bone lookups are cached, rigid props have frozen transforms and normal frustum culling, hidden lobby previews stop animating, and irrelevant HUD mutations no longer trigger menu scrollbar layout. Browser FPS and shader appearance still require an in-browser playtest.

Torch flames are also instanced into one draw while retaining their colors and individual flicker phases. The procedural arena scene now checks at 117 mesh objects, within its existing 180-mesh budget.

Collision/visibility point queries also use spatial bins, preserving their exact narrow-phase tests and the wide-query fallback.
