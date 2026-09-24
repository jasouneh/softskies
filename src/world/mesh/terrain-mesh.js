import * as THREE from "../../platform/three.js";
import { MATERIAL_IDS } from "../../config/game.js";
import { getChunkSample } from "../generation/terrain.js";

const MATERIAL_COLORS = {
  [MATERIAL_IDS.river]: new THREE.Color(0x4aa6c4),
  [MATERIAL_IDS.meadow]: new THREE.Color(0x7dd75b),
  [MATERIAL_IDS.grass]: new THREE.Color(0x53c85d),
  [MATERIAL_IDS.rock]: new THREE.Color(0x7d8a93),
  [MATERIAL_IDS.snow]: new THREE.Color(0xf5fbff),
  [MATERIAL_IDS.sand]: new THREE.Color(0xb9bc78),
};

const BIOME_COLORS = {
  jungle: new THREE.Color(0x3fbf5c),
  rainforest: new THREE.Color(0x1f8f57),
  desert: new THREE.Color(0xd3ad5d),
  "desert-rock": new THREE.Color(0xaa8760),
  "red-sand": new THREE.Color(0xc4694a),
  oasis: new THREE.Color(0x70b96a),
};

export function createTerrainMaterialPalette() {
  const material = new THREE.MeshStandardMaterial({
    name: "terrain-low-poly-vertex-colors",
    roughness: 0.94,
    metalness: 0.02,
    flatShading: true,
    vertexColors: true,
  });
  return [material];
}

export function createTerrainChunkObject(chunk, { materials = createTerrainMaterialPalette() } = {}) {
  const positions = [];
  const colors = [];

  for (let iz = 0; iz < chunk.segments; iz += 1) {
    for (let ix = 0; ix < chunk.segments; ix += 1) {
      const nw = getChunkSample(chunk, ix, iz);
      const ne = getChunkSample(chunk, ix + 1, iz);
      const sw = getChunkSample(chunk, ix, iz + 1);
      const se = getChunkSample(chunk, ix + 1, iz + 1);
      const samples = [nw, ne, sw, se];
      const materialIndex = resolveCellMaterial(...samples);
      const waterLift = materialIndex === MATERIAL_IDS.river ? 0.22 : 0;
      const color = resolveCellColor(samples, materialIndex);

      pushTriangle(positions, colors, color, nw, sw, ne, waterLift);
      pushTriangle(positions, colors, color, sw, se, ne, waterLift);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const terrainMaterial = Array.isArray(materials) ? materials[0] : materials;
  const mesh = new THREE.Mesh(geometry, terrainMaterial);
  mesh.name = `terrain chunk ${chunk.key}`;
  mesh.userData.chunkKey = chunk.key;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();

  return mesh;
}

export function disposeTerrainChunkObject(object3d) {
  object3d.traverse((node) => {
    if (node.geometry) {
      node.geometry.dispose();
    }
  });
}

export function disposeTerrainMaterialPalette(materials) {
  const terrainMaterials = Array.isArray(materials) ? materials : [materials];
  for (const material of terrainMaterials) {
    material.dispose();
  }
}

function resolveCellMaterial(...samples) {
  const water = samples.reduce((max, sample) => Math.max(max, sample.waterStrength ?? sample.riverStrength), 0);
  if (water > 0.2) {
    return MATERIAL_IDS.river;
  }

  const counts = new Map();
  for (const sample of samples) {
    counts.set(sample.material, (counts.get(sample.material) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

function resolveCellColor(samples, materialIndex) {
  if (materialIndex === MATERIAL_IDS.river) {
    return MATERIAL_COLORS[MATERIAL_IDS.river];
  }

  const biome = majorityBiome(samples);
  if (biome === "desert") {
    if (samples.some((sample) => (sample.redSandStrength ?? 0) > 0.35)) {
      return BIOME_COLORS["red-sand"];
    }
    return materialIndex === MATERIAL_IDS.rock ? BIOME_COLORS["desert-rock"] : BIOME_COLORS.desert;
  }
  if (biome === "rainforest") {
    return materialIndex === MATERIAL_IDS.rock ? MATERIAL_COLORS[MATERIAL_IDS.rock] : BIOME_COLORS.rainforest;
  }
  if (biome === "jungle") {
    return materialIndex === MATERIAL_IDS.rock ? MATERIAL_COLORS[MATERIAL_IDS.rock] : BIOME_COLORS.jungle;
  }
  if (samples.some((sample) => sample.biome && sample.waterBankStrength > 0.12)) {
    return BIOME_COLORS.oasis;
  }

  return MATERIAL_COLORS[materialIndex] ?? MATERIAL_COLORS[MATERIAL_IDS.grass];
}

function majorityBiome(samples) {
  const counts = new Map();
  for (const sample of samples) {
    if (sample.biome) {
      counts.set(sample.biome, (counts.get(sample.biome) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

function pushTriangle(positions, colors, color, a, b, c, lift = 0) {
  pushPoint(positions, colors, color, a, lift);
  pushPoint(positions, colors, color, b, lift);
  pushPoint(positions, colors, color, c, lift);
}

function pushPoint(positions, colors, color, point, lift = 0) {
  positions.push(point.worldX, point.height + lift, point.worldZ);
  colors.push(color.r, color.g, color.b);
}
