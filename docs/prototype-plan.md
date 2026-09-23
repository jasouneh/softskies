# polyFly prototype plan

This plan turns the foundation into the first playable low-poly phoenix flight prototype without adding a heavy asset pipeline or theme-specific systems that do not serve v1.

## Goals and non-goals

Goals:

- Static browser app deployable to GitHub Pages.
- Three.js renderer with native browser modules during development and generated `dist/` output for Pages.
- Procedural/generative art only for v1: phoenix, terrain, rivers, sky bodies, and early clouds are generated in code.
- Always-flying third-person exploration with mouse-look and WASD-style input.
- Infinite-feeling deterministic terrain with bounded streaming and disposal.
- Architecture that can stage a simple day/night cycle, cloud layers, and later stylized stars without complex astronomy.

Non-goals for the first playable slice:

- Downloaded game assets, skeletal animation files, texture packs, or external map data.
- Walking, landing, combat, score goals, flock simulation, or multiplayer.
- Realistic astronomy, realistic Himalayan terrain, or heavyweight climate/biome systems.

## Proposed module boundaries

Start with small browser modules under `src/`; keep module APIs narrow so they can be tested without WebGL where possible.

- `src/main.js`: bootstraps the app, reads the Pages base path, mounts the renderer, and wires lifecycle/disposal.
- `src/engine/loop.js`: owns `requestAnimationFrame`/Three animation loop, fixed-ish update step clamps, pause/resume, and frame stats.
- `src/engine/renderer.js`: creates the Three.js renderer, scene, camera root, color management, resize handling, and render pass order.
- `src/input/controls.js`: converts pointer lock/mouse movement and keyboard state into normalized flight intents (`pitch`, `yaw`, `roll`, `throttle`, `boost`).
- `src/flight/phoenix-controller.js`: integrates velocity/orientation for an always-flying avatar. It should not create meshes.
- `src/flight/phoenix-view.js`: procedural low-poly phoenix mesh, wing/tail animation parameters, and material palette.
- `src/camera/chase-camera.js`: third-person camera rig that follows the phoenix with smoothing and collision-free altitude constraints later.
- `src/world/chunk-coordinator.js`: maps player position to chunk keys, loads/unloads chunks, enforces memory caps, and schedules generation work.
- `src/world/generation/base-terrain.js`: river-free base height fields and terrain grade helpers shared by terrain and river routing.
- `src/world/generation/terrain.js`: deterministic height/material source of truth from seed + world coordinates.
- `src/world/generation/rivers.js`: deterministic lowland river curves/strips derived from seed and chunk coordinates, routed through suitable valleys before terrain material projection.
- `src/world/generation/dressing.js`: deterministic prop placement for plains trees/houses and snow dead trees/igloos.
- `src/world/mesh/terrain-mesh.js`: converts generated chunk samples into flat-shaded Three.js geometry and disposes it.
- `src/world/mesh/dressing-geometry.js`: pure procedural prop geometry/vertex-color data for trees, houses, dead trees, and igloos; keep winding testable without WebGL.
- `src/world/mesh/dressing-mesh.js`: wraps dressing geometry data in flat-shaded Three.js buffers and disposes it.
- `src/atmosphere/sky.js`: simple palette interpolation, low-poly sun/moon meshes, fog color, and ambient/directional light updates.
- `src/atmosphere/cloud-cells.js`: deterministic large cloud-cell and puff placement, independent of terrain source data.
- `src/atmosphere/clouds.js`: bounded low-poly generated cloud layer mesh/instances, with room to expand into a cloud sea later.
- `src/atmosphere/stars.js`: later stylized star/Milky Way dome; driven by a simple night factor, not full astronomy.
- `src/ui/hud.js`: lightweight in-browser instructions and debug stats for flight tuning and streaming budgets.
- `src/config/*.js`: tunable constants for seed, chunk size, draw radius, speed, palette, and performance budgets.

## Runtime data flow

1. `main` creates `engine`, `input`, `phoenixController`, `phoenixView`, `chaseCamera`, `chunkCoordinator`, and `atmosphere`.
2. Each frame, `input` produces an intent snapshot.
3. `phoenixController.update(dt, intent)` updates deterministic player pose and velocity.
4. `chunkCoordinator.update(playerPosition)` computes desired chunk keys, queues missing chunks, and unloads distant chunks.
5. Terrain generation produces chunk sample data from pure seed/world-coordinate functions.
6. Mesh builders consume generated samples and attach/dispose Three.js objects; generated samples remain the source of truth, not the mesh.
7. `phoenixView`, `chaseCamera`, and `atmosphere` read the current pose/time and update visual state.
8. `renderer.render(scene, camera)` draws the frame.

Keep gameplay state serializable where practical: seed, time-of-day phase, phoenix pose/velocity, loaded chunk keys, and tunable config should explain the world without reading generated meshes back from Three.js.

## Terrain chunks and memory bounds

Initial constants to implement, then tune with profiling:

- `CHUNK_SIZE = 192` world units in X/Z.
- `CHUNK_SEGMENTS = 32` per side, producing low-poly flat-shaded geometry with predictable seams.
- `ACTIVE_RADIUS = 2` chunks around the player for the first playable build: at most 25 terrain chunks visible/active.
- `PRELOAD_RADIUS = 3` if generation is cheap enough: at most 49 loaded chunks including the outer ready ring.
- `MAX_CHUNKS = 49`; evict by distance first, then least-recently-used.
- Generate or mesh no more than 1-2 new chunks per frame on the main thread until a worker is justified.
- Dispose geometries, materials, and debug helpers on eviction; do not rely on garbage collection of live Three.js references.

Chunk keys are `floor(worldX / CHUNK_SIZE), floor(worldZ / CHUNK_SIZE)`. Neighboring chunks must sample shared borders from identical world coordinates so there are no cracks. Mesh generation can duplicate border vertices per chunk for simple disposal, but height/material functions must be continuous at chunk boundaries.

## Deterministic generation

- Use a seed string in config, hashed to integer state once.
- Avoid `Math.random()` in generation paths. Use deterministic hash/value-noise helpers keyed by seed + chunk/world coordinates.
- Terrain height source can start as layered value noise/fBm with domain warping kept modest for low-poly readability.
- Mountains should be stylized height ridges or cone-like massifs from deterministic feature points, not realistic terrain simulation.
- Snow bands are material decisions from height and slope thresholds, not separate assets.
- Rivers are decorative strips/curves projected onto terrain. They can be generated from deterministic control points per region and clipped to chunks.
- The mesh is a cache. The source of truth is seed + generator functions + chunk coordinates.

## Phoenix, camera, and input responsibilities

- Input stores raw keyboard/pointer state and emits normalized intents only.
- Flight controller owns motion: forward speed baseline, pitch/yaw/roll response, banking visual hints, altitude floor above terrain later, and gentle damping.
- Phoenix view owns visuals: procedural body, wings, tail flames/feathers, palette, and animation from controller state.
- Chase camera owns framing: offset behind/above the phoenix, smoothing, field-of-view changes for boost, and no gameplay decisions.
- Terrain queries should be read-only for flight. Do not make terrain chunks depend on phoenix mesh state.

First playable controls:

- Mouse movement: look/steer yaw and pitch while pointer lock is active.
- `W/S`: pitch down/up or speed trim, depending on tuning.
- `A/D`: roll/yaw bank.
- Optional `Shift`: temporary boost once baseline flight feels stable.
- `Esc`: release pointer lock through browser default behavior.

## Rendering and atmosphere stages

Stage atmosphere in layers:

1. **Palette sky:** background/fog/light colors interpolate over a simple normalized day phase.
2. **Sun/moon markers:** low-poly discs or simple meshes parented to a sky rig; no true astronomy.
3. **Terrain material bands:** plains, mountain rock, snow caps/bands, and river colors from generated material IDs.
4. **Cloud layer/cloud sea:** generated billboard/mesh clusters with deterministic placement by large cloud cells; keep independent from terrain chunks. The v1 layer uses bounded low-poly puff clusters and can expand toward denser cloud seas later.
5. **Stars/Milky Way:** stylized point/dome layer enabled by night factor. Keep data procedural and cheap; avoid high-resolution textures unless a later decision allows assets.

Use flat shading, limited palettes, and geometry silhouettes before textures. Prefer material reuse and instancing where it reduces draw calls without obscuring simple code.

## Performance budgets

Initial desktop browser budgets:

- Target 60 FPS on a current laptop browser; remain playable near 30 FPS on integrated graphics.
- Main-thread update budget: under 4 ms average for gameplay + streaming, excluding rendering.
- Draw calls: keep under 200 for the first playable slice.
- Terrain triangles: keep active terrain under roughly 120k-180k triangles until profiling justifies more.
- Loaded terrain memory: keep comfortably under 100 MB including geometry attributes.
- Avoid long chunk-generation spikes: cap per-frame generation and expose a debug counter for queued chunks.

If a feature needs workers, texture generation, or more dependencies, document the reason and keep the fallback/simple path clear.

## Test strategy

Keep the current structural checks and add focused tests as modules appear:

- Source entry test: `index.html` loads `src/main.js` as a native module and does not point at `dist/`.
- Bundle shape test: `scripts/build.mjs` emits `dist/index.html`, `dist/assets/polyfly.js`, and the expected base path.
- Generator determinism tests: same seed/coordinates produce identical heights/materials/rivers; different seeds differ.
- Chunk seam tests: adjacent chunks produce identical shared border heights.
- Streaming tests: loaded chunk keys stay within `MAX_CHUNKS` and evicted chunks call disposal hooks.
- Dressing geometry tests: generated prop faces that rely on front-side rendering keep outward triangle winding.
- Input tests: key/pointer snapshots map to stable normalized intents.
- Cloud generation tests: default seed/view produces visible bounded puffs, remains deterministic, and is seed-sensitive.
- Browser smoke tests can be added later only if the dependency cost is justified.

## GitHub Pages base-path handling

- Never hard-code root-relative app asset paths like `/assets/...` in source.
- `scripts/build.mjs` accepts `BASE_PATH`; the workflow builds with `/${repositoryName}/` for project Pages.
- Local builds default to relative `./` paths so `dist/` can be previewed from the repository root server.
- Future asset URLs should resolve through one helper fed by the build/base-path metadata, not scattered string concatenation.
- The Pages workflow should continue publishing only generated `dist/` as an artifact; `dist/` remains ignored in git.

## Milestones

1. **Foundation (landed):** source page, Three.js boundary, generated bundle, tests, Pages workflow, and this plan.
2. **First playable slice (current):** renderer/loop modules, procedural phoenix, chase camera, pointer-lock mouse/WASD flight, bounded deterministic terrain chunks, plains/mountains/lowland rivers, procedural chunk dressing, focused generation/streaming/cloud tests, a lightweight day/night atmosphere, and the first bounded deterministic cloud layer.
3. **Flight and world tuning:** tune speed/turn/camera feel, terrain scale, river/cloud readability, and draw-call/triangle budgets through browser smoke passes.
4. **Cloud layer/cloud sea expansion:** tune/expand deterministic generated cloud cells independent of terrain chunks.
5. **Stylized night sky:** add cheap procedural stars/Milky Way styling driven by the existing night factor.
6. **Pages hardening:** production base-path smoke check, performance budget review, README screenshots/GIF only if generated or explicitly licensed later.
