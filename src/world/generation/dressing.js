import { MATERIAL_IDS, WORLD_CONFIG, WORLD_SEED } from "../../config/game.js";
import { hash2, normalizeSeed } from "./noise.js";
import { sampleTerrain } from "./terrain.js";

const DEFAULT_CELLS = 8;
const DEFAULT_MAX_FEATURES = 52;
const FEATURE_TYPES = ["tree", "house", "dead-tree", "igloo"];

export function generateChunkDressing(seed = WORLD_SEED, chunkX = 0, chunkZ = 0, {
  chunkSize = WORLD_CONFIG.chunkSize,
  cells = DEFAULT_CELLS,
  maxFeatures = DEFAULT_MAX_FEATURES,
} = {}) {
  const seedHash = normalizeSeed(seed);
  const features = [];
  const counts = Object.fromEntries(FEATURE_TYPES.map((type) => [type, 0]));
  const cellSize = chunkSize / cells;
  const minX = chunkX * chunkSize;
  const minZ = chunkZ * chunkSize;

  for (let iz = 0; iz < cells; iz += 1) {
    for (let ix = 0; ix < cells; ix += 1) {
      if (features.length >= maxFeatures) {
        break;
      }
      const worldCellX = chunkX * cells + ix;
      const worldCellZ = chunkZ * cells + iz;
      const x = minX + (ix + 0.18 + hash2(seedHash ^ 0x81a7c15, worldCellX, worldCellZ) * 0.64) * cellSize;
      const z = minZ + (iz + 0.18 + hash2(seedHash ^ 0x417dbabe, worldCellX, worldCellZ) * 0.64) * cellSize;
      const terrain = sampleTerrain(seed, x, z);
      const roll = hash2(seedHash ^ 0xd3c012, worldCellX, worldCellZ);

      if (isPlainDressingGround(terrain)) {
        if (roll < 0.34) {
          pushFeature(features, counts, {
            type: "tree",
            x,
            y: terrain.height,
            z,
            yaw: hash2(seedHash ^ 0xa11ce, worldCellX, worldCellZ) * Math.PI * 2,
            scale: 0.78 + hash2(seedHash ^ 0x73ee51, worldCellX, worldCellZ) * 0.72,
          }, maxFeatures);
        }
      } else if (isSnowDressingGround(terrain)) {
        if (roll < 0.22) {
          pushFeature(features, counts, {
            type: "dead-tree",
            x,
            y: terrain.height,
            z,
            yaw: hash2(seedHash ^ 0xded7e3e, worldCellX, worldCellZ) * Math.PI * 2,
            scale: 0.72 + hash2(seedHash ^ 0x51a7e, worldCellX, worldCellZ) * 0.62,
          }, maxFeatures);
        } else if (roll < 0.36 && terrain.slope < 0.7) {
          pushFeature(features, counts, {
            type: "igloo",
            x,
            y: terrain.height,
            z,
            yaw: hash2(seedHash ^ 0x1600, worldCellX, worldCellZ) * Math.PI * 2,
            scale: 0.86 + hash2(seedHash ^ 0x1ce, worldCellX, worldCellZ) * 0.34,
          }, maxFeatures);
        }
      }
    }
  }

  if (counts.tree + counts.house === 0) {
    addFallbackFeatures(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, isPlainDressingGround, "tree");
  }
  if (counts["dead-tree"] + counts.igloo === 0) {
    addFallbackFeatures(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, isSnowDressingGround, "dead-tree", "igloo");
  }
  addVillage(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures);
  features.sort((a, b) => `${a.type}:${a.x.toFixed(3)}:${a.z.toFixed(3)}`.localeCompare(`${b.type}:${b.x.toFixed(3)}:${b.z.toFixed(3)}`));

  return {
    key: `${chunkX},${chunkZ}`,
    seed,
    chunkX,
    chunkZ,
    features,
    stats: {
      counts,
      total: features.length,
      maxFeatures,
    },
  };
}

function addFallbackFeatures(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, predicate, primaryType, secondaryType = primaryType) {
  const minX = chunkX * chunkSize;
  const minZ = chunkZ * chunkSize;
  const probes = 12;
  for (let iz = 0; iz < probes && features.length < maxFeatures; iz += 1) {
    for (let ix = 0; ix < probes && features.length < maxFeatures; ix += 1) {
      const x = minX + (ix + 0.5) * (chunkSize / probes);
      const z = minZ + (iz + 0.5) * (chunkSize / probes);
      const terrain = sampleTerrain(seed, x, z);
      if (!predicate(terrain)) {
        continue;
      }
      const typeRoll = hash2(seedHash ^ 0xfa11bac, chunkX * probes + ix, chunkZ * probes + iz);
      const type = terrain.slope < 0.7 && typeRoll < 0.35 ? secondaryType : primaryType;
      pushFeature(features, counts, {
        type,
        x,
        y: terrain.height,
        z,
        yaw: hash2(seedHash ^ 0xfa11, chunkX * probes + ix, chunkZ * probes + iz) * Math.PI * 2,
        scale: 0.82 + hash2(seedHash ^ 0x5ca1e, chunkX * probes + ix, chunkZ * probes + iz) * 0.42,
      }, maxFeatures);
      if (counts[primaryType] + counts[secondaryType] >= 4) {
        return;
      }
    }
  }
}

function addVillage(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures) {
  if (features.length >= maxFeatures || hash2(seedHash ^ 0x711a9e, chunkX, chunkZ) > 0.24) {
    return;
  }

  const minX = chunkX * chunkSize;
  const minZ = chunkZ * chunkSize;
  const centerX = minX + chunkSize * (0.26 + hash2(seedHash ^ 0x1234abcd, chunkX, chunkZ) * 0.48);
  const centerZ = minZ + chunkSize * (0.26 + hash2(seedHash ^ 0xabcddcba, chunkX, chunkZ) * 0.48);
  const offsets = [
    [0, 0],
    [16, 10],
    [-15, 12],
    [12, -16],
    [-18, -10],
    [0, 24],
  ];
  const villageYaw = hash2(seedHash ^ 0x6120f00d, chunkX, chunkZ) * Math.PI * 2;
  const cos = Math.cos(villageYaw);
  const sin = Math.sin(villageYaw);

  for (let index = 0; index < offsets.length && features.length < maxFeatures; index += 1) {
    if (index > 2 && hash2(seedHash ^ 0x405e, chunkX * 17 + index, chunkZ * 19) < 0.34) {
      continue;
    }
    const [ox, oz] = offsets[index];
    const x = centerX + ox * cos - oz * sin;
    const z = centerZ + ox * sin + oz * cos;
    if (x < minX + 8 || x > minX + chunkSize - 8 || z < minZ + 8 || z > minZ + chunkSize - 8) {
      continue;
    }
    const terrain = sampleTerrain(seed, x, z);
    if (!isPlainDressingGround(terrain)) {
      continue;
    }
    pushFeature(features, counts, {
      type: "house",
      x,
      y: terrain.height,
      z,
      yaw: villageYaw + (hash2(seedHash ^ 0x49cab, chunkX * 13 + index, chunkZ * 13) - 0.5) * 0.7,
      scale: 0.84 + hash2(seedHash ^ 0x4065e, chunkX * 11 + index, chunkZ * 11) * 0.36,
    }, maxFeatures);
  }
}

function pushFeature(features, counts, feature, maxFeatures) {
  if (features.length >= maxFeatures) {
    return;
  }
  features.push(feature);
  counts[feature.type] += 1;
}

function isPlainDressingGround(terrain) {
  return (terrain.material === MATERIAL_IDS.grass || terrain.material === MATERIAL_IDS.meadow)
    && terrain.mountain < 0.24
    && terrain.slope < 0.46
    && terrain.riverBankStrength < 0.12
    && terrain.riverStrength < 0.04;
}

function isSnowDressingGround(terrain) {
  return terrain.material === MATERIAL_IDS.snow
    && terrain.slope < 0.76
    && terrain.riverStrength < 0.04;
}
