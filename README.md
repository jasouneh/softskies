# polyFly

polyFly is a browser-based Three.js free-flight prototype for GitHub Pages. The player watches and steers a procedural low-poly phoenix in third-person view while continuously flying through an infinite-feeling, bright polygon-styled world of plains, mountains, decorative rivers, and a lightweight day/night sky.

## Current status

This repository currently contains the first playable vertical slice. It includes:

- a static source page (`index.html`) that loads native browser modules from `src/`;
- a procedural low-poly phoenix with third-person chase camera framing;
- pointer-lock mouse steering, WASD/arrow flight controls, and Shift boost;
- deterministic chunked terrain streaming with explicit `MAX_CHUNKS` bounds and disposal hooks;
- bright low-poly plains, stylized mountains, simple snow caps, lowland river channels, and procedural trees/houses/dead trees/igloos from deterministic generation;
- a lightweight day/night cycle with palette changes plus low-poly sun and moon markers;
- a dependency-light Node build script that generates an ignored `dist/` static site bundle; and
- source, deterministic generation, streaming, and bundle-shape validation tests.

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

# Validate source structure, deterministic generation, streaming, and bundle shape.
node --test tests/source-entry.test.mjs tests/world-generation.test.mjs tests/chunk-coordinator.test.mjs
node scripts/build.mjs && node --test tests/bundle-shape.test.mjs
# or: npm run validate

# Preview generated dist/ locally.
node scripts/serve.mjs dist 4173
# or: npm run preview
```

## Architecture direction

`src/` is the source of truth for the browser app. `dist/` is generated output and should remain untracked. Gameplay systems grow around deterministic world generation, bounded terrain chunk streaming, procedural art, and small browser-native modules before adopting heavier tooling. The current Three.js dependency is isolated behind `src/platform/three.js` so future bundling or vendoring can change one boundary instead of every gameplay module.

See [`docs/prototype-plan.md`](docs/prototype-plan.md) for module boundaries, data flow, chunk/memory budgets, test strategy, GitHub Pages base-path handling, and staged milestones from the first rendered scene through free-flight exploration.

## Roadmap

1. Tune flight feel, camera smoothing, and low-poly phoenix/world-dressing silhouettes from browser playtesting.
2. Add lightweight deterministic cloud layers or a cloud sea without coupling them to terrain chunks.
3. Expand terrain material bands, including more deliberate snow bands, cliff accents, and river transitions.
4. Add a procedural stylized stars/Milky Way layer driven by the existing night factor.
5. Harden performance budgets, browser smoke checks, and GitHub Pages deployment.
