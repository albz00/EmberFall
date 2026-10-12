# Emberfall v0.26 — source

This folder contains the current v0.26 game, including the JavaScript, HTML, CSS, JSON content, vendored Three.js dependencies, models, animations, audio assets, attribution files, and development tests. It was originally exported from v0.24 (source commit 070b54bf78320e456d1c98c69a25aac3d300394e).

## Run the game locally

Open a terminal in this folder and run:

```sh
python3 -m http.server 8080 --directory dist
```

Open http://localhost:8080 in your browser. Stop the local server with Ctrl+C.
On Windows, `py -m http.server 8080 --directory dist` can be used when Python is installed through the Windows launcher.

Use an HTTP server rather than opening `dist/index.html` directly, because the game loads JavaScript modules and model assets. No JavaScript build step or npm installation is needed to play this static game.

## Host it elsewhere

The contents of `dist/` are the deployable static website. Use `dist` as the output/public directory on a static host.

## What is included

- `dist/game.js`: game loop, controls, combat integration and rendering.
- `dist/world.js`: procedural arena geometry and collision.
- `dist/config/*.json`: combat, equipment, economy and progression tuning, validated at load by `dist/shared/`.
- `dist/combat.js`: movement, melee hit checks and bot skill profiles.
- `dist/progression.js`: inventory, equipment, economy and ranks.
- `dist/portal.js`, `dist/rock-runes.js`, `dist/arena-sky.js`: current map decorations.
- `dist/assets/`: local models, animations, audio and attribution.
- `dist/vendor/`: vendored rendering dependencies and licenses.
- `dist/changelog.js`: current version history.
- `tests/` and `scripts/`: development checks (`npm install`, then `npm run check`) and asset preparation tools.
- `docs/ARCHITECTURE.md`: the data-driven content plan, the validation rules, and what is still hardcoded.

For current behavior, use the source and changelog as the reference.

## Current architecture

This is a browser game with local simulated opponents and chat. Player progress is saved in the browser's local storage. This version does not contain a multiplayer server, Firebase database, account system, real-money payment system, or your browser's personal saved progress. Those features were discussed as future options and are not implemented in this version.

Bundled models, the original arena theme, animations, and rendering dependencies are local. Preserve `dist/assets/NOTICES.txt` and the in-game Credits screen when redistributing the game.

A world editor is not implemented yet; map objects and terrain are currently authored in code. Tuning values are in `dist/config/`.
