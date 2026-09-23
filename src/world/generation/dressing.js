import { MATERIAL_IDS, WORLD_CONFIG, WORLD_SEED } from "../../config/game.js";
import { hash2, normalizeSeed, valueNoise2 } from "./noise.js";
import { sampleTerrain } from "./terrain.js";

const DEFAULT_CELLS = 10;
const DEFAULT_MAX_FEATURES = 96;
const FEATURE_TYPES = ["tree", "house", "blacksmith", "farm", "snow-house", "snow-farm", "dead-tree", "igloo"];

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
      const density = forestDensity(seedHash, x, z);

      if (isPlainDressingGround(terrain)) {
        const treeChance = 0.1 + density * 0.58;
        if (roll < treeChance) {
          pushFeature(features, counts, {
            type: "tree",
            x,
            y: terrain.height,
            z,
            yaw: hash2(seedHash ^ 0xa11ce, worldCellX, worldCellZ) * Math.PI * 2,
            scale: 0.72 + hash2(seedHash ^ 0x73ee51, worldCellX, worldCellZ) * (0.58 + density * 0.42),
          }, maxFeatures);
        }
      } else if (isSnowDressingGround(terrain)) {
        const snowGroveChance = 0.08 + density * 0.3;
        if (roll < snowGroveChance) {
          pushFeature(features, counts, {
            type: "dead-tree",
            x,
            y: terrain.height,
            z,
            yaw: hash2(seedHash ^ 0xded7e3e, worldCellX, worldCellZ) * Math.PI * 2,
            scale: 0.72 + hash2(seedHash ^ 0x51a7e, worldCellX, worldCellZ) * 0.68,
          }, maxFeatures);
        } else if (roll < snowGroveChance + 0.08 && terrain.slope < 0.7) {
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

  addVillage(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, false);
  addVillage(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, true);
  if (counts.tree + counts.house + counts.blacksmith + counts.farm === 0) {
    addFallbackFeatures(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, isPlainDressingGround, "tree");
  }
  if (counts["dead-tree"] + counts.igloo + counts["snow-house"] + counts["snow-farm"] === 0) {
    addFallbackFeatures(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, isSnowDressingGround, "dead-tree", "igloo");
  }
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

function forestDensity(seedHash, x, z) {
  return Math.max(0, Math.min(1, valueNoise2(seedHash ^ 0xf02e57, x, z, 0.004) * 0.5 + 0.5));
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
      if ((counts[primaryType] ?? 0) + (counts[secondaryType] ?? 0) >= 4) {
        return;
      }
    }
  }
}

function addVillage(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, snowy) {
  const villageRoll = hash2(seedHash ^ (snowy ? 0x5a09 : 0x711a9e), chunkX, chunkZ);
  if (features.length >= maxFeatures || villageRoll > (snowy ? 0.14 : 0.28)) {
    return;
  }

  const minX = chunkX * chunkSize;
  const minZ = chunkZ * chunkSize;
  const centerX = minX + chunkSize * (0.24 + hash2(seedHash ^ (snowy ? 0x1235abcd : 0x1234abcd), chunkX, chunkZ) * 0.52);
  const centerZ = minZ + chunkSize * (0.24 + hash2(seedHash ^ (snowy ? 0xabcddcbb : 0xabcddcba), chunkX, chunkZ) * 0.52);
  const predicate = snowy ? isSnowDressingGround : isPlainDressingGround;
  const offsets = [
    { ox: 0, oz: 0, type: snowy ? "snow-house" : "house", scale: 1.08 },
    { ox: 20, oz: 10, type: snowy ? "snow-house" : "house", scale: 0.96 },
    { ox: -21, oz: 12, type: snowy ? "snow-house" : "blacksmith", scale: 1.0 },
    { ox: 14, oz: -22, type: snowy ? "snow-farm" : "farm", scale: 1.0 },
    { ox: -18, oz: -19, type: snowy ? "igloo" : "house", scale: 0.88 },
    { ox: 0, oz: 30, type: snowy ? "dead-tree" : "farm", scale: 0.92 },
    { ox: 31, oz: -10, type: snowy ? "snow-house" : "house", scale: 0.78 },
    { ox: -32, oz: 1, type: snowy ? "igloo" : "house", scale: 0.76 },
    { ox: 11, oz: 29, type: snowy ? "snow-farm" : "farm", scale: 0.86 },
  ];
  const villageYaw = hash2(seedHash ^ (snowy ? 0x6120f11d : 0x6120f00d), chunkX, chunkZ) * Math.PI * 2;
  const cos = Math.cos(villageYaw);
  const sin = Math.sin(villageYaw);

  let added = 0;
  for (let index = 0; index < offsets.length && features.length < maxFeatures; index += 1) {
    if (index > 5 && hash2(seedHash ^ 0x405e, chunkX * 17 + index, chunkZ * 19) < 0.42) {
      continue;
    }
    const { ox, oz, type, scale } = offsets[index];
    const x = centerX + ox * cos - oz * sin;
    const z = centerZ + ox * sin + oz * cos;
    if (x < minX + 8 || x > minX + chunkSize - 8 || z < minZ + 8 || z > minZ + chunkSize - 8) {
      continue;
    }
    const terrain = sampleTerrain(seed, x, z);
    if (!predicate(terrain)) {
      continue;
    }
    pushFeature(features, counts, {
      type,
      x,
      y: terrain.height,
      z,
      yaw: villageYaw + (hash2(seedHash ^ 0x49cab, chunkX * 13 + index, chunkZ * 13) - 0.5) * 0.7,
      scale: scale * (0.86 + hash2(seedHash ^ 0x4065e, chunkX * 11 + index, chunkZ * 11) * 0.28),
    }, maxFeatures);
    added += 1;
  }

  if (added > 1) {
    addVillagePath(seedHash, seed, centerX, centerZ, villageYaw, snowy, features, counts, maxFeatures);
  }
}

function addVillagePath(seedHash, seed, centerX, centerZ, yaw, snowy, features, counts, maxFeatures) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const type = snowy ? "snow-farm" : "farm";
  for (let index = -2; index <= 2 && features.length < maxFeatures; index += 1) {
    const ox = index * 9;
    const oz = 4 + Math.abs(index) * 2;
    const x = centerX + ox * cos - oz * sin;
    const z = centerZ + ox * sin + oz * cos;
    const terrain = sampleTerrain(seed, x, z);
    if (!(snowy ? isSnowDressingGround(terrain) : isPlainDressingGround(terrain))) {
      continue;
    }
    pushFeature(features, counts, {
      type,
      x,
      y: terrain.height,
      z,
      yaw: yaw + Math.PI / 2,
      scale: 0.62 + hash2(seedHash ^ 0x9a7e, Math.round(x), Math.round(z)) * 0.18,
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
    && terrain.waterBankStrength < 0.12
    && terrain.waterStrength < 0.04;
}

function isSnowDressingGround(terrain) {
  return terrain.material === MATERIAL_IDS.snow
    && terrain.slope < 0.76
    && terrain.waterStrength < 0.04;
}
