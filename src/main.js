import * as THREE from "./platform/three.js";
import { createCloudLayer } from "./atmosphere/clouds.js";
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
import { generateChunkDressing } from "./world/generation/dressing.js";
import { generateTerrainChunk, sampleTerrain } from "./world/generation/terrain.js";
import {
  createDressingChunkObject,
  createDressingMaterial,
  disposeDressingChunkObject,
  disposeDressingMaterial,
} from "./world/mesh/dressing-mesh.js";
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
  let paused = false;
  let playableElapsed = 0;
  const hud = createHud(root, {
    onPauseToggle() {
      setPaused(!paused);
    },
  });
  const controls = createFlightControls({ domElement: renderer.domElement });
  const atmosphere = createAtmosphere(scene);
  const cloudLayer = createCloudLayer(scene);
  const terrainMaterials = createTerrainMaterialPalette();
  const dressingMaterial = createDressingMaterial();

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
      const terrainObject = createTerrainChunkObject(data, { materials: terrainMaterials });
      const dressing = generateChunkDressing(WORLD_SEED, chunkX, chunkZ, WORLD_CONFIG);
      const dressingObject = createDressingChunkObject(dressing, { material: dressingMaterial });
      const object = new THREE.Group();
      object.name = `streamed world chunk ${key}`;
      object.userData.chunkKey = key;
      object.add(terrainObject, dressingObject);
      scene.add(object);
      return { key, data, dressing, object, terrainObject, dressingObject };
    },
    disposeChunk(chunk) {
      scene.remove(chunk.object);
      disposeTerrainChunkObject(chunk.terrainObject);
      disposeDressingChunkObject(chunk.dressingObject);
    },
  });

  let atmosphereState = atmosphere.update(0, { camera });
  let cloudState = cloudLayer.update({
    camera,
    playerPosition: controller.getPose().position,
    elapsed: playableElapsed,
    atmosphere: atmosphereState,
  });
  chunks.update(controller.getPose().position);

  function revealHud() {
    hud.show();
  }

  function setPaused(nextPaused) {
    paused = nextPaused;
    if (paused) {
      document.exitPointerLock?.();
    }
    hud.show();
    hud.setPaused(paused);
  }

  function handlePauseKey(event) {
    if (event.code !== "Space" || event.repeat || isUiControl(event.target)) {
      return;
    }
    event.preventDefault();
    setPaused(!paused);
  }

  root.addEventListener("mousemove", revealHud, { passive: true });
  document.addEventListener("mousemove", revealHud, { passive: true });
  document.addEventListener("keydown", handlePauseKey);

  const loop = new GameLoop({
    update({ dt }) {
      const intent = controls.snapshot();
      const pose = controller.getPose();
      let terrainHeight = sampleTerrain(WORLD_SEED, pose.position.x, pose.position.z).height;

      if (!paused) {
        playableElapsed += dt;
        controller.update(dt, intent);
        const updatedPose = controller.getPose();
        terrainHeight = sampleTerrain(WORLD_SEED, updatedPose.position.x, updatedPose.position.z).height;
        chunks.update(updatedPose.position);
        phoenix.update(dt, playableElapsed, updatedPose, {
          boost: intent.boost,
          pitch: intent.pitch,
          roll: intent.roll,
          mousePitchDelta: intent.mousePitchDelta,
          mouseYawDelta: intent.mouseYawDelta,
        });
        chaseCamera.update(dt, updatedPose, { boost: intent.boost });
        atmosphereState = atmosphere.update(playableElapsed, { camera });
        cloudState = cloudLayer.update({
          camera,
          playerPosition: updatedPose.position,
          elapsed: playableElapsed,
          atmosphere: atmosphereState,
        });
      }

      hud.update({
        pose: controller.getPose(),
        terrainHeight,
        chunkStats: chunks.getStats(),
        atmosphere: atmosphereState,
        clouds: cloudState,
        pointerLocked: intent.pointerLocked,
        paused,
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
      root.removeEventListener("mousemove", revealHud);
      document.removeEventListener("mousemove", revealHud);
      document.removeEventListener("keydown", handlePauseKey);
      chunks.disposeAll();
      cloudLayer.dispose();
      scene.remove(phoenix.object);
      phoenix.dispose?.();
      disposeTerrainMaterialPalette(terrainMaterials);
      disposeDressingMaterial(dressingMaterial);
      hud.dispose();
      rendererContext.dispose();
      root.remove();
    },
  };
}

function isUiControl(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  return target.closest("button, select, input, textarea, [contenteditable='true']") !== null;
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
