# polyFly

polyFly is planned as a browser-based Three.js flight game for GitHub Pages. The player will watch and steer a procedural low-poly phoenix in third-person view while continuously flying through an infinite, bright polygon-styled world of plains, mountains, decorative rivers, and staged atmosphere effects.

## Current status

This repository currently contains the maintainable project foundation, not the full playable prototype. It includes:

- a static source page (`index.html`) that loads native browser modules from `src/`;
- a small Three.js foundation scene used to verify rendering integration;
- a dependency-light Node build script that generates an ignored `dist/` site bundle;
- source and bundle-shape validation tests;
- a GitHub Pages deployment workflow; and
- an implementation-ready prototype plan in [`docs/prototype-plan.md`](docs/prototype-plan.md).

## Intended v1 scope

- Phoenix avatar built from procedural/generative low-poly geometry; no downloaded game assets for v1.
- Third-person always-flying controls: mouse-look plus WASD-style flight input, with no walking or landing yet.
- Infinite deterministic terrain streaming from procedural source data: bright plains, stylized mountains, snow bands on peaks, and decorative rivers.
- Free-flight exploration only; no goals, score loop, or combat in the first playable slice.
- Architecture kept open for a simple day/night cycle, low-poly sun/moon palettes, cloud layers or cloud sea, and later star/Milky Way styling without implementing heavyweight astronomy early.

## Local commands

The scripts use only Node.js 20+ today. `package.json` provides npm-compatible script names, but every command can also be run directly with `node`.

```bash
# Serve the source page with native browser modules.
node scripts/serve.mjs . 5173
# or: npm run dev

# Generate the static production bundle in ignored dist/.
node scripts/build.mjs
# or: npm run build

# Build with the GitHub Pages project base path.
BASE_PATH=/polyFly/ node scripts/build.mjs

# Validate the source entry and generated bundle shape.
node --test tests/source-entry.test.mjs
node scripts/build.mjs && node --test tests/bundle-shape.test.mjs
# or: npm run validate

# Preview generated dist/ locally.
node scripts/serve.mjs dist 4173
# or: npm run preview
```

## Architecture direction

`src/` is the source of truth for the browser app. `dist/` is generated output and should remain untracked. Gameplay systems should grow around deterministic world generation, bounded terrain chunk streaming, procedural art, and small browser-native modules before adopting heavier tooling. The current Three.js dependency is isolated behind `src/platform/three.js` so future bundling or vendoring can change one boundary instead of every gameplay module.

See [`docs/prototype-plan.md`](docs/prototype-plan.md) for module boundaries, data flow, chunk/memory budgets, test strategy, GitHub Pages base-path handling, and staged milestones from the first rendered scene through free-flight exploration.

## Roadmap

1. Replace the foundation scene with a first scene module, renderer loop, and debug HUD.
2. Add a procedural phoenix placeholder, chase camera, and mouse/WASD flight controls.
3. Implement deterministic chunk generation and bounded streaming around the player.
4. Add terrain materials, mountains with snow bands, and decorative rivers.
5. Stage atmosphere: simple day/night palettes first, then clouds/cloud sea, then stylized stars later.
6. Harden performance budgets, browser smoke checks, and GitHub Pages deployment.
