import * as THREE from "./platform/three.js";
import { createCloudLayer } from "./atmosphere/clouds.js";
import { createAtmosphere } from "./atmosphere/sky.js";
import { createChaseCamera } from "./camera/chase-camera.js";
import { AVATAR_OPTIONS, DEFAULT_AVATAR_ID, FLIGHT_CONFIG, DEFAULT_MAP_ID, WORLD_CONFIG, WORLD_MAPS, getWorldMap } from "./config/game.js";
import { GameLoop } from "./engine/loop.js";
import { createRenderer } from "./engine/renderer.js";
import { createPhoenixController } from "./flight/phoenix-controller.js";
import { createDragonView } from "./flight/dragon-view.js";
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

export function createSoftSkiesShell({ mountNode = document.body } = {}) {
  const root = document.createElement("section");
  root.className = "softskies-shell";
  root.setAttribute("data-softskies", "playable-prototype");
  root.dataset.threeRevision = THREE.REVISION ?? "0.170.0";
  mountNode.replaceChildren(root);

  const rendererContext = createRenderer({ root });
  const { scene, camera, renderer } = rendererContext;
  let paused = false;
  let mapPickerOpen = false;
  let playableElapsed = 0;
  let activeMap = getWorldMap(DEFAULT_MAP_ID);
  let activeAvatarId = DEFAULT_AVATAR_ID;
  const hud = createHud(root, {
    avatars: AVATAR_OPTIONS,
    selectedAvatar: activeAvatarId,
    maps: WORLD_MAPS,
    selectedMapId: activeMap.id,
    onPauseToggle() {
      setPaused(!paused);
    },
    onMapOpenChange(open) {
      setMapPickerOpen(open);
    },
    onMapChange(mapId) {
      setActiveMap(mapId);
    },
    onAvatarChange(avatarId) {
      setActiveAvatar(avatarId);
    },
  });
  const controls = createFlightControls({ domElement: renderer.domElement });
  const atmosphere = createAtmosphere(scene);
  const cloudLayer = createCloudLayer(scene);
  const terrainMaterials = createTerrainMaterialPalette();
  const dressingMaterial = createDressingMaterial();

  const controller = createPhoenixController({
    getTerrainHeight(worldX, worldZ) {
      return sampleTerrain(activeMap.seed, worldX, worldZ, { map: activeMap }).height;
    },
  });
  let avatar = createAvatarView(activeAvatarId);
  scene.add(avatar.object);
  const chaseCamera = createChaseCamera(camera);

  const chunks = new ChunkCoordinator({
    ...WORLD_CONFIG,
    createChunk({ key, chunkX, chunkZ }) {
      const data = generateTerrainChunk(activeMap.seed, chunkX, chunkZ, { ...WORLD_CONFIG, map: activeMap });
      const terrainObject = createTerrainChunkObject(data, { materials: terrainMaterials });
      const dressing = generateChunkDressing(activeMap.seed, chunkX, chunkZ, { ...WORLD_CONFIG, map: activeMap });
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

  function isFlightPaused() {
    return paused || mapPickerOpen;
  }

  function syncHudPaused() {
    hud.setPaused(isFlightPaused());
  }

  function setPaused(nextPaused) {
    paused = nextPaused;
    if (isFlightPaused()) {
      document.exitPointerLock?.();
    }
    hud.show();
    syncHudPaused();
  }

  function setMapPickerOpen(open) {
    mapPickerOpen = open;
    if (mapPickerOpen) {
      document.exitPointerLock?.();
    }
    syncHudPaused();
  }

  function setActiveMap(mapId) {
    const nextMap = getWorldMap(mapId);
    if (!nextMap || nextMap.id === activeMap.id) {
      return;
    }
    activeMap = nextMap;
    hud.updateMapSelection(activeMap.id);
    chunks.disposeAll("map-change");
    const pose = controller.getPose();
    const terrainHeight = sampleTerrain(activeMap.seed, pose.position.x, pose.position.z, { map: activeMap }).height;
    pose.position.y = Math.max(pose.position.y, terrainHeight + FLIGHT_CONFIG.minTerrainClearance + 18);
    chunks.update(pose.position);
  }

  function setActiveAvatar(avatarId) {
    if (!AVATAR_OPTIONS.some((option) => option.id === avatarId) || avatarId === activeAvatarId) {
      return;
    }
    const nextAvatar = createAvatarView(avatarId);
    scene.remove(avatar.object);
    avatar.dispose?.();
    activeAvatarId = avatarId;
    avatar = nextAvatar;
    scene.add(avatar.object);
    avatar.update(0, playableElapsed, controller.getPose(), { nightFactor: atmosphereState.nightFactor });
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
      let terrainHeight = sampleTerrain(activeMap.seed, pose.position.x, pose.position.z, { map: activeMap }).height;

      if (!isFlightPaused()) {
        playableElapsed += dt;
        controller.update(dt, intent);
        const updatedPose = controller.getPose();
        terrainHeight = sampleTerrain(activeMap.seed, updatedPose.position.x, updatedPose.position.z, { map: activeMap }).height;
        chunks.update(updatedPose.position);
        avatar.update(dt, playableElapsed, updatedPose, {
          boost: intent.boost,
          pitch: intent.pitch,
          roll: intent.roll,
          mousePitchDelta: intent.mousePitchDelta,
          mouseYawDelta: intent.mouseYawDelta,
          nightFactor: atmosphereState.nightFactor,
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
        paused: isFlightPaused(),
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
      scene.remove(avatar.object);
      avatar.dispose?.();
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

function createAvatarView(avatarId) {
  if (avatarId === "dragon") {
    return createDragonView();
  }
  return createPhoenixView();
}

export function mountSoftSkiesShell() {
  const mountNode = document.querySelector("#app") ?? document.body;
  return createSoftSkiesShell({ mountNode });
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    mountSoftSkiesShell();
  }, { once: true });
}
