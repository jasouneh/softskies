import * as THREE from "./platform/three.js";
import { createAtmosphere } from "./atmosphere/sky.js";
import { createChaseCamera } from "./camera/chase-camera.js";
import { WORLD_CONFIG, WORLD_SEED } from "./config/game.js";
import { GameLoop } from "./engine/loop.js";
import { createRenderer } from "./engine/renderer.js";
import { createPhoenixController } from "./flight/phoenix-controller.js";
import { createPhoenixView } from "./flight/phoenix-view.js";
import { createFlightControls } from "./input/controls.js";
import { createHud } from "./ui/hud.js";
import { ChunkCoordinator } from "./world/chunk-coordinator.js";
import { generateTerrainChunk, sampleTerrain } from "./world/generation/terrain.js";
import {
  createTerrainChunkObject,
  createTerrainMaterialPalette,
  disposeTerrainChunkObject,
  disposeTerrainMaterialPalette,
} from "./world/mesh/terrain-mesh.js";

export function createPolyFlyShell({ mountNode = document.body } = {}) {
  const root = document.createElement("section");
  root.className = "polyfly-shell";
  root.setAttribute("data-polyfly", "playable-prototype");
  root.dataset.threeRevision = THREE.REVISION ?? "0.170.0";
  mountNode.replaceChildren(root);

  const rendererContext = createRenderer({ root });
  const { scene, camera, renderer } = rendererContext;
  const hud = createHud(root);
  const controls = createFlightControls({ domElement: renderer.domElement });
  const atmosphere = createAtmosphere(scene);
  const terrainMaterials = createTerrainMaterialPalette();

  const controller = createPhoenixController({
    getTerrainHeight(worldX, worldZ) {
      return sampleTerrain(WORLD_SEED, worldX, worldZ).height;
    },
  });
  const phoenix = createPhoenixView();
  scene.add(phoenix.object);
  const chaseCamera = createChaseCamera(camera);

  const chunks = new ChunkCoordinator({
    ...WORLD_CONFIG,
    createChunk({ key, chunkX, chunkZ }) {
      const data = generateTerrainChunk(WORLD_SEED, chunkX, chunkZ, WORLD_CONFIG);
      const object = createTerrainChunkObject(data, { materials: terrainMaterials });
      object.name = `streamed terrain ${key}`;
      scene.add(object);
      return { key, data, object };
    },
    disposeChunk(chunk) {
      scene.remove(chunk.object);
      disposeTerrainChunkObject(chunk.object);
    },
  });

  let atmosphereState = atmosphere.update(0, { camera });
  chunks.update(controller.getPose().position);

  const loop = new GameLoop({
    update({ dt, elapsed }) {
      const intent = controls.snapshot();
      controller.update(dt, intent);
      const pose = controller.getPose();
      const terrainHeight = sampleTerrain(WORLD_SEED, pose.position.x, pose.position.z).height;

      chunks.update(pose.position);
      phoenix.update(dt, elapsed, pose);
      chaseCamera.update(dt, pose, { boost: intent.boost });
      atmosphereState = atmosphere.update(elapsed, { camera });
      hud.update({
        pose,
        terrainHeight,
        chunkStats: chunks.getStats(),
        atmosphere: atmosphereState,
        pointerLocked: intent.pointerLocked,
      });
    },
    render() {
      rendererContext.render();
    },
  });
  loop.start();

  return {
    camera,
    renderer,
    scene,
    controls,
    controller,
    chunks,
    dispose() {
      loop.dispose();
      controls.dispose();
      chunks.disposeAll();
      disposeTerrainMaterialPalette(terrainMaterials);
      hud.dispose();
      rendererContext.dispose();
      root.remove();
    },
  };
}

export function mountPolyFlyShell() {
  const mountNode = document.querySelector("#app") ?? document.body;
  return createPolyFlyShell({ mountNode });
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    mountPolyFlyShell();
  }, { once: true });
}
