# Emberfall update conventions

- Continue this project in place and preserve its audience and existing assets. It is a static site served from `dist/` (no build step); run it locally with `python3 -m http.server 8080 --directory dist`.
- Each new game-update request, including a new user message adding scope during an update, advances `GAME_VERSION` in `dist/changelog.js` by exactly 0.01 and prepends a factual changelog entry. Do not bump for status, pricing, or other non-update questions, or multiple implementation passes for the same request. Multiple new requests can be published together while retaining their separate changelog entries. Current version: 0.69.
- Keep version query strings for changed modules and assets synchronized so published updates replace cached files.
- Preserve the user's clean cartoon UI: no marketing quips, mini headers, redundant location labels, or duplicate health bars.
- Bots and their chat are local simulations. Do not claim online multiplayer or LLM conversation without implementing those services.
- Focus verification on affected gameplay, persistence and actual model integration. Run `npm run check` (all test files; `npm install` first) after changes.
- Gameplay tuning lives only in `dist/config/*.json`, validated by `dist/shared/config-schema.js`; arena layout data lives only in `dist/maps/*.json`, validated by `dist/shared/map-schema.js` (see `docs/ARCHITECTURE.md`). Read values from `CONFIG` or the module exports built from it; never add a second literal copy. New fields need a schema entry with units and limits. Never delete ids in `PERSISTED_IDS`; changing stored meaning needs a profile migration. Every local import carries a `?v=` cache version, including the JSON imports in `dist/shared/config.js`.

- Physical gear uses individual copies in a 20-slot carried inventory: `carrySlots[0..8]` are the actual hotbar slots, with eleven backpack slots after them; `hotbar` is derived compatibility data, never another inventory. Preserve physical slot positions and the v4 save migration. Buying never grants permanent equipment ownership. Rare or better carried gear drops on death, common carried gear is lost, starter kit remains, and chest storage survives. Cosmetics and nameplates remain permanent unlocks. Preserve existing collections during migrations.

- Charged melee preserves an immediate light swing on pointer-down; holding winds up a heavy follow-up. Direct-hit immunity is zero by user request: every eligible aimed click lands immediately. Ordinary light clicks remain available during heavy recovery; only the charged follow-up retains its recovery across sword slot changes.
- Charge orbs are physical legendary items requiring equipped, owned Ascension. `/chargeorb on` latches the held orb for free-camera viewing; manual charges cancel on interrupted input.

- Restore material color caches through `material-state.js`; THREE material clones serialize Color userData as numbers. Lower-body distance-driven motion must continue during attacks on all character rigs.

- First-person sword animation restarts on every accepted click. Third-person body swing timing is separate and never gates damage or input. Preserve authored arm motion outside explicit blocking poses; only correct the blade at the wrist.

- Custom emblems save validated vector layers in the existing profile. Keep badge and shape ids in `emblems.js` stable so older designs survive. Draft edits stay separate until Save; never store arbitrary SVG, URLs or HTML as an emblem.

- Skills are permanent validated node ids in `profile.skills`; prerequisites and bonuses come from progression JSON. Purchase level gates apply only to buying new copies; never strip, lock or unequip existing/found gear. A 2v2 ends only when the round-score lead reaches `match.winBy`; round rewards are not paid separately.

- Ledge-entry protection is mutual: fighters cannot deal or take damage during the descent or the configured three seconds after first contact with ground/lava. Ordinary arena jumps never renew it. Reset temporary entry state on respawn/return/match teleports; match countdowns retain their own safety rules. Death timers are shared by player and bots. Roll steering keeps one normalized velocity and one roll cooldown; Q/E can steer an active roll without stacking a second dodge burst.
