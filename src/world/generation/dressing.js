import { MATERIAL_IDS, WORLD_CONFIG, WORLD_SEED } from "../../config/game.js";
import { hash2, normalizeSeed, valueNoise2 } from "./noise.js";
import { sampleTerrain } from "./terrain.js";

const DEFAULT_CELLS = 10;
const DEFAULT_MAX_FEATURES = 96;
const FEATURE_TYPES = [
  "tree",
  "house",
  "blacksmith",
  "farm",
  "snow-house",
  "snow-farm",
  "dead-tree",
  "igloo",
  "jungle-tree",
  "rainforest-tree",
  "desert-palm",
  "jungle-hut",
  "rainforest-shrine",
  "desert-camp",
  "desert-ruin",
  "cactus",
  "waterfall",
  "stone-pillar",
  "mist-pine",
  "china-house",
  "china-hall",
  "china-road",
  "china-courtyard",
  "mountain-temple",
  "pagoda-tower",
  "village-lantern",
];

export function generateChunkDressing(seed = WORLD_SEED, chunkX = 0, chunkZ = 0, {
  chunkSize = WORLD_CONFIG.chunkSize,
  cells = DEFAULT_CELLS,
  maxFeatures = DEFAULT_MAX_FEATURES,
  map,
  profile,
} = {}) {
  const dressingProfile = resolveDressingProfile(seed, { map, profile });
  if (dressingProfile === "sunspice-wilds") {
    return generateSunspiceChunkDressing(seed, chunkX, chunkZ, { chunkSize, cells, maxFeatures, map, profile: dressingProfile });
  }
  if (dressingProfile === "jade-provinces") {
    return generateJadeChunkDressing(seed, chunkX, chunkZ, { chunkSize, cells, maxFeatures, map, profile: dressingProfile });
  }

  return generateHighlandsChunkDressing(seed, chunkX, chunkZ, { chunkSize, cells, maxFeatures });
}

function generateHighlandsChunkDressing(seed = WORLD_SEED, chunkX = 0, chunkZ = 0, {
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
  finalizeFeaturePlacements(seed, "highlands", features, counts);
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

function resolveDressingProfile(seed, { map, profile } = {}) {
  return profile ?? map?.terrainProfile ?? (String(seed).includes("sunspice-wilds") ? "sunspice-wilds" : String(seed).includes("jade-provinces") ? "jade-provinces" : "highlands");
}

function generateSunspiceChunkDressing(seed, chunkX, chunkZ, {
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
  const seenBiomes = new Set();

  for (let iz = 0; iz < cells; iz += 1) {
    for (let ix = 0; ix < cells; ix += 1) {
      if (features.length >= maxFeatures) {
        break;
      }
      const worldCellX = chunkX * cells + ix;
      const worldCellZ = chunkZ * cells + iz;
      const x = minX + (ix + 0.15 + hash2(seedHash ^ 0x51a7f00d, worldCellX, worldCellZ) * 0.7) * cellSize;
      const z = minZ + (iz + 0.15 + hash2(seedHash ^ 0xdec0de15, worldCellX, worldCellZ) * 0.7) * cellSize;
      const terrain = sampleTerrain(seed, x, z, { profile: "sunspice-wilds" });
      const roll = hash2(seedHash ^ 0x57e11a, worldCellX, worldCellZ);
      const density = forestDensity(seedHash, x, z);
      if (isWaterfallGround(terrain) && roll < 0.055) {
        pushFeature(features, counts, createSunspiceFeature(seedHash, "waterfall", terrain, x, z, worldCellX, worldCellZ, 0.88, 0.38), maxFeatures);
        seenBiomes.add(terrain.biome);
        continue;
      }
      if (!isSunspiceDressingGround(terrain)) {
        continue;
      }
      seenBiomes.add(terrain.biome);
      if (terrain.biome === "desert") {
        addDesertDressing(seedHash, features, counts, terrain, x, z, worldCellX, worldCellZ, roll, maxFeatures);
      } else if (terrain.biome === "rainforest") {
        addRainforestDressing(seedHash, features, counts, terrain, x, z, worldCellX, worldCellZ, roll, density, maxFeatures);
      } else {
        addJungleDressing(seedHash, features, counts, terrain, x, z, worldCellX, worldCellZ, roll, density, maxFeatures);
      }
    }
  }

  addBiomeCluster(seedHash, seed, chunkX, chunkZ, chunkSize, "jungle", features, counts, maxFeatures, seenBiomes);
  addBiomeCluster(seedHash, seed, chunkX, chunkZ, chunkSize, "rainforest", features, counts, maxFeatures, seenBiomes);
  addBiomeCluster(seedHash, seed, chunkX, chunkZ, chunkSize, "desert", features, counts, maxFeatures, seenBiomes);
  finalizeFeaturePlacements(seed, "sunspice-wilds", features, counts);
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

function generateJadeChunkDressing(seed, chunkX, chunkZ, {
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
  const seenBiomes = new Set();

  for (let iz = 0; iz < cells; iz += 1) {
    for (let ix = 0; ix < cells; ix += 1) {
      if (features.length >= maxFeatures) {
        break;
      }
      const worldCellX = chunkX * cells + ix;
      const worldCellZ = chunkZ * cells + iz;
      const x = minX + (ix + 0.14 + hash2(seedHash ^ 0x6a0d15, worldCellX, worldCellZ) * 0.72) * cellSize;
      const z = minZ + (iz + 0.14 + hash2(seedHash ^ 0x6a0d16, worldCellX, worldCellZ) * 0.72) * cellSize;
      const terrain = sampleTerrain(seed, x, z, { profile: "jade-provinces" });
      const roll = hash2(seedHash ^ 0x6a0d17, worldCellX, worldCellZ);
      const density = forestDensity(seedHash, x, z);
      seenBiomes.add(terrain.biome);

      if (terrain.biome === "stone-forest") {
        if (roll < 0.16) {
          pushFeature(features, counts, createJadeFeature(seedHash, "stone-pillar", terrain, x, z, worldCellX, worldCellZ, 1.65, 0.9), maxFeatures);
        } else if (roll < 0.58 && terrain.slope < 0.82) {
          pushFeature(features, counts, createJadeFeature(seedHash, "mist-pine", terrain, x, z, worldCellX, worldCellZ, 0.9, 0.56), maxFeatures);
        }
      } else if (terrain.biome === "snowy-mountain") {
        if (isJadeTempleGround(terrain) && roll < 0.16) {
          pushFeature(features, counts, createJadeFeature(seedHash, "mountain-temple", terrain, x, z, worldCellX, worldCellZ, 0.9, 0.34), maxFeatures);
        } else if (isJadeTempleGround(terrain) && roll < 0.24) {
          pushFeature(features, counts, createJadeFeature(seedHash, "pagoda-tower", terrain, x, z, worldCellX, worldCellZ, 0.82, 0.28), maxFeatures);
        } else if (roll < 0.34 && terrain.slope < 0.68) {
          pushFeature(features, counts, createJadeFeature(seedHash, "mist-pine", terrain, x, z, worldCellX, worldCellZ, 0.76, 0.44), maxFeatures);
        }
      } else if (isJadeVillageGround(terrain)) {
        if (terrain.biome === "forest" && roll < 0.38 + density * 0.2) {
          pushFeature(features, counts, createJadeFeature(seedHash, "mist-pine", terrain, x, z, worldCellX, worldCellZ, 0.9, 0.58), maxFeatures);
        } else if (roll < 0.2) {
          pushFeature(features, counts, createJadeFeature(seedHash, "china-house", terrain, x, z, worldCellX, worldCellZ, 0.96, 0.36), maxFeatures);
        } else if (roll < 0.28) {
          pushFeature(features, counts, createJadeFeature(seedHash, "village-lantern", terrain, x, z, worldCellX, worldCellZ, 0.78, 0.28), maxFeatures);
        }
      }
    }
  }

  addJadeVillageCluster(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, seenBiomes);
  addJadeTempleCluster(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, seenBiomes);
  addStoneForestCluster(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, seenBiomes);
  finalizeFeaturePlacements(seed, "jade-provinces", features, counts);
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

function createJadeFeature(seedHash, type, terrain, x, z, worldCellX, worldCellZ, baseScale, scaleJitter) {
  return {
    type,
    x,
    y: terrain.height,
    z,
    yaw: hash2(seedHash ^ 0x6a0d18, worldCellX, worldCellZ) * Math.PI * 2,
    scale: baseScale + hash2(seedHash ^ 0x6a0d19, worldCellX, worldCellZ) * scaleJitter,
  };
}

function finalizeFeaturePlacements(seed, profile, features, counts) {
  for (let index = features.length - 1; index >= 0; index -= 1) {
    const feature = features[index];
    const placement = findFeaturePlacement(seed, profile, feature);
    if (!placement) {
      features.splice(index, 1);
      counts[feature.type] = Math.max(0, (counts[feature.type] ?? 1) - 1);
      continue;
    }
    feature.x = placement.x;
    feature.y = placement.y;
    feature.z = placement.z;
  }
}

function findFeaturePlacement(seed, profile, feature) {
  if (!requiresLevelPatch(feature)) {
    if (feature.type === "waterfall") {
      const metrics = sampleFeatureFootprint(seed, profile, feature);
      return { x: feature.x, y: metrics.maxHeight + 0.015, z: feature.z };
    }
    const terrain = sampleTerrain(seed, feature.x, feature.z, { profile });
    return { x: feature.x, y: terrain.height + 0.015, z: feature.z };
  }

  for (const offset of candidatePlacementOffsets(feature)) {
    const x = feature.x + offset.x;
    const z = feature.z + offset.z;
    const metrics = sampleFeatureFootprint(seed, profile, feature, x, z);
    if (!isFeatureTerrainCompatible(profile, feature, metrics.centerTerrain)) {
      continue;
    }
    if (metrics.heightRange <= maxFootprintHeightRange(feature)) {
      return { x, y: metrics.maxHeight + 0.015, z };
    }
  }

  return null;
}

function sampleFeatureFootprint(seed, profile, feature, x = feature.x, z = feature.z) {
  const footprint = featureFootprint(feature);
  const yaw = feature.yaw ?? 0;
  const xDivisions = Math.max(2, Math.min(5, Math.ceil(footprint.halfWidth / 4)));
  const zDivisions = Math.max(2, Math.min(8, Math.ceil(footprint.halfDepth / 5)));
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  const centerTerrain = sampleTerrain(seed, x, z, { profile });

  for (let ix = -xDivisions; ix <= xDivisions; ix += 1) {
    for (let iz = -zDivisions; iz <= zDivisions; iz += 1) {
      const localX = footprint.halfWidth * (ix / xDivisions);
      const localZ = footprint.halfDepth * (iz / zDivisions);
      const offset = transformLocal(localX, localZ, yaw);
      const terrain = sampleTerrain(seed, x + offset.x, z + offset.z, { profile });
      minHeight = Math.min(minHeight, terrain.height);
      maxHeight = Math.max(maxHeight, terrain.height);
    }
  }

  return {
    minHeight,
    maxHeight,
    heightRange: maxHeight - minHeight,
    centerTerrain,
  };
}

function candidatePlacementOffsets(feature) {
  const footprint = featureFootprint(feature);
  const radius = Math.min(12, Math.max(2.5, Math.min(footprint.halfWidth, footprint.halfDepth) * 0.8));
  return [
    { x: 0, z: 0 },
    { x: radius, z: 0 },
    { x: -radius, z: 0 },
    { x: 0, z: radius },
    { x: 0, z: -radius },
    { x: radius * 0.7, z: radius * 0.7 },
    { x: -radius * 0.7, z: radius * 0.7 },
    { x: radius * 0.7, z: -radius * 0.7 },
    { x: -radius * 0.7, z: -radius * 0.7 },
  ];
}

function requiresLevelPatch(feature) {
  switch (feature.type) {
    case "house":
    case "blacksmith":
    case "farm":
    case "snow-house":
    case "snow-farm":
    case "igloo":
    case "jungle-hut":
    case "rainforest-shrine":
    case "desert-camp":
    case "desert-ruin":
    case "stone-pillar":
    case "china-house":
    case "china-hall":
    case "china-road":
    case "china-courtyard":
    case "mountain-temple":
    case "pagoda-tower":
    case "village-lantern":
      return true;
    default:
      return false;
  }
}

function maxFootprintHeightRange(feature) {
  switch (feature.type) {
    case "china-road":
      return 0.72;
    case "china-courtyard":
      return 0.62;
    case "farm":
    case "snow-farm":
      return 0.52;
    case "stone-pillar":
      return 0.58;
    case "village-lantern":
      return 0.42;
    case "mountain-temple":
    case "china-hall":
      return 0.8;
    case "rainforest-shrine":
    case "desert-ruin":
      return 0.76;
    default:
      return 0.68;
  }
}

function isFeatureTerrainCompatible(profile, feature, terrain) {
  if (terrain.waterStrength > 0.18 || terrain.material === MATERIAL_IDS.river) {
    return false;
  }
  if (profile === "jade-provinces") {
    if (feature.type === "stone-pillar") {
      return isJadeStoneGround(terrain);
    }
    if (feature.type === "mountain-temple") {
      return isJadeTempleGround(terrain);
    }
    if (feature.type === "pagoda-tower") {
      return isJadeTempleGround(terrain) || isJadeVillageGround(terrain);
    }
    if (feature.type.startsWith("china-") || feature.type === "village-lantern") {
      return isJadeVillageGround(terrain);
    }
  }
  if (profile === "sunspice-wilds") {
    if (feature.type.startsWith("desert-") || feature.type === "cactus" || feature.type === "desert-palm") {
      return terrain.biome === "desert" && isSunspiceDressingGround(terrain);
    }
    if (feature.type === "jungle-hut") {
      return terrain.biome === "jungle" && isSunspiceDressingGround(terrain);
    }
    if (feature.type === "rainforest-shrine") {
      return terrain.biome === "rainforest" && isSunspiceDressingGround(terrain);
    }
  }
  if (feature.type === "snow-house" || feature.type === "snow-farm" || feature.type === "igloo") {
    return isSnowDressingGround(terrain);
  }
  if (feature.type === "house" || feature.type === "blacksmith" || feature.type === "farm") {
    return isPlainDressingGround(terrain);
  }
  return true;
}

function featureFootprint(feature) {
  const s = feature.scale ?? 1;
  switch (feature.type) {
    case "house":
    case "snow-house":
      return { halfWidth: 2.25 * s, halfDepth: 2.1 * s };
    case "blacksmith":
      return { halfWidth: 2.75 * s, halfDepth: 2.35 * s };
    case "farm":
    case "snow-farm":
      return { halfWidth: 3.0 * s, halfDepth: 2.35 * s };
    case "jungle-hut":
      return { halfWidth: 2.25 * s, halfDepth: 2.1 * s };
    case "rainforest-shrine":
      return { halfWidth: 2.45 * s, halfDepth: 2.45 * s };
    case "desert-camp":
      return { halfWidth: 2.25 * s, halfDepth: 2.05 * s };
    case "desert-ruin":
      return { halfWidth: 2.75 * s, halfDepth: 2.35 * s };
    case "waterfall":
      return { halfWidth: 1.7 * s, halfDepth: 2.8 * s };
    case "stone-pillar":
      return { halfWidth: 2.6 * s, halfDepth: 2.6 * s };
    case "china-house":
      return { halfWidth: 2.7 * s, halfDepth: 2.4 * s };
    case "china-hall":
      return { halfWidth: 3.75 * s, halfDepth: 3.0 * s };
    case "china-road":
      return { halfWidth: (feature.width ?? 3.2 * s) / 2, halfDepth: (feature.length ?? 18 * s) / 2 };
    case "china-courtyard":
      return { halfWidth: (feature.width ?? 16 * s) / 2, halfDepth: (feature.length ?? 14 * s) / 2 };
    case "mountain-temple":
      return { halfWidth: 3.0 * s, halfDepth: 2.6 * s };
    case "pagoda-tower":
      return { halfWidth: 1.95 * s, halfDepth: 1.8 * s };
    case "igloo":
      return { halfWidth: 2.45 * s, halfDepth: 2.55 * s };
    case "tree":
    case "jungle-tree":
    case "rainforest-tree":
    case "desert-palm":
    case "dead-tree":
    case "mist-pine":
      return { halfWidth: 1.55 * s, halfDepth: 1.55 * s };
    case "cactus":
    case "village-lantern":
    default:
      return { halfWidth: 1.0 * s, halfDepth: 1.0 * s };
  }
}

function addJadeVillageCluster(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, seenBiomes) {
  if (!(seenBiomes.has("plains") || seenBiomes.has("forest")) || hash2(seedHash ^ 0xc417a, chunkX, chunkZ) > 0.56) {
    return;
  }
  const minX = chunkX * chunkSize;
  const minZ = chunkZ * chunkSize;
  const centerX = minX + chunkSize * (0.22 + hash2(seedHash ^ 0xc417b, chunkX, chunkZ) * 0.56);
  const centerZ = minZ + chunkSize * (0.22 + hash2(seedHash ^ 0xc417c, chunkX, chunkZ) * 0.56);
  const yaw = hash2(seedHash ^ 0xc417d, chunkX, chunkZ) * Math.PI * 2;
  const offsets = [
    { ox: 0, oz: 0, type: "china-courtyard", scale: 1.05, width: 18, length: 16, yawJitter: 0 },
    { ox: 0, oz: -24, type: "china-hall", scale: 1.34, yawJitter: 0.16 },
    { ox: 0, oz: -15, type: "china-road", scale: 1, width: 3.4, length: 14, yawJitter: 0 },
    { ox: 0, oz: 16, type: "china-road", scale: 1, width: 3.2, length: 18, yawJitter: 0 },
    { ox: 0, oz: 34, type: "china-road", scale: 1, width: 3.2, length: 16, yawJitter: 0 },
    { ox: -18, oz: 8, type: "china-road", scale: 1, width: 3.1, length: 24, yawOffset: Math.PI / 2, yawJitter: 0 },
    { ox: 18, oz: 8, type: "china-road", scale: 1, width: 3.1, length: 24, yawOffset: Math.PI / 2, yawJitter: 0 },
    { ox: -31, oz: -6, type: "china-road", scale: 1, width: 3.0, length: 18, yawOffset: Math.PI / 2, yawJitter: 0 },
    { ox: 31, oz: -7, type: "china-road", scale: 1, width: 3.0, length: 18, yawOffset: Math.PI / 2, yawJitter: 0 },
    { ox: 28, oz: 12, type: "china-house", scale: 1.08 },
    { ox: -28, oz: 11, type: "china-house", scale: 1.1 },
    { ox: 17, oz: -31, type: "china-house", scale: 1.04 },
    { ox: -19, oz: -30, type: "pagoda-tower", scale: 0.9 },
    { ox: 38, oz: -11, type: "china-house", scale: 1.0 },
    { ox: -39, oz: -7, type: "china-house", scale: 0.98 },
    { ox: 9, oz: 34, type: "village-lantern", scale: 0.86 },
    { ox: -9, oz: 34, type: "village-lantern", scale: 0.86 },
    { ox: 32, oz: 32, type: "china-house", scale: 0.94 },
    { ox: -32, oz: 31, type: "china-house", scale: 0.96 },
    { ox: 0, oz: 42, type: "village-lantern", scale: 0.82 },
  ];
  addJadeClusterFeatures(seedHash, seed, centerX, centerZ, yaw, offsets, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, isJadeVillageGround);
}

function addJadeTempleCluster(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, seenBiomes) {
  if (!seenBiomes.has("snowy-mountain") || hash2(seedHash ^ 0x7e4f1e, chunkX, chunkZ) > 0.5) {
    return;
  }
  const minX = chunkX * chunkSize;
  const minZ = chunkZ * chunkSize;
  const centerX = minX + chunkSize * (0.2 + hash2(seedHash ^ 0x7e4f1f, chunkX, chunkZ) * 0.6);
  const centerZ = minZ + chunkSize * (0.2 + hash2(seedHash ^ 0x7e4f20, chunkX, chunkZ) * 0.6);
  const yaw = hash2(seedHash ^ 0x7e4f21, chunkX, chunkZ) * Math.PI * 2;
  const offsets = [
    { ox: 0, oz: 0, type: "mountain-temple", scale: 1.04 },
    { ox: 18, oz: 10, type: "pagoda-tower", scale: 0.78 },
    { ox: -18, oz: 12, type: "mountain-temple", scale: 0.72 },
    { ox: 10, oz: -18, type: "mist-pine", scale: 0.7 },
    { ox: -12, oz: -20, type: "mist-pine", scale: 0.68 },
  ];
  addJadeClusterFeatures(seedHash, seed, centerX, centerZ, yaw, offsets, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, isJadeTempleGround);
}

function addStoneForestCluster(seedHash, seed, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, seenBiomes) {
  if (!seenBiomes.has("stone-forest") || hash2(seedHash ^ 0x5707e1, chunkX, chunkZ) > 0.72) {
    return;
  }
  const minX = chunkX * chunkSize;
  const minZ = chunkZ * chunkSize;
  const centerX = minX + chunkSize * (0.18 + hash2(seedHash ^ 0x5707e2, chunkX, chunkZ) * 0.64);
  const centerZ = minZ + chunkSize * (0.18 + hash2(seedHash ^ 0x5707e3, chunkX, chunkZ) * 0.64);
  const yaw = hash2(seedHash ^ 0x5707e4, chunkX, chunkZ) * Math.PI * 2;
  const offsets = [
    { ox: 0, oz: 0, type: "stone-pillar", scale: 2.1 },
    { ox: 28, oz: 12, type: "stone-pillar", scale: 1.55 },
    { ox: -26, oz: 16, type: "stone-pillar", scale: 1.35 },
    { ox: 14, oz: -24, type: "mist-pine", scale: 0.86 },
    { ox: -18, oz: -28, type: "mist-pine", scale: 0.82 },
  ];
  addJadeClusterFeatures(seedHash, seed, centerX, centerZ, yaw, offsets, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, isJadeStoneGround);
}

function addJadeClusterFeatures(seedHash, seed, centerX, centerZ, yaw, offsets, chunkX, chunkZ, chunkSize, features, counts, maxFeatures, predicate) {
  const minX = chunkX * chunkSize;
  const minZ = chunkZ * chunkSize;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  for (let index = 0; index < offsets.length && features.length < maxFeatures; index += 1) {
    const { ox, oz, type, scale, yawOffset = 0, yawJitter = 0.58, length, width } = offsets[index];
    const x = centerX + ox * cos - oz * sin;
    const z = centerZ + ox * sin + oz * cos;
    if (x < minX + 8 || x > minX + chunkSize - 8 || z < minZ + 8 || z > minZ + chunkSize - 8) {
      continue;
    }
    const terrain = sampleTerrain(seed, x, z, { profile: "jade-provinces" });
    if (!predicate(terrain)) {
      continue;
    }
    const featureScale = scale * (0.86 + hash2(seedHash ^ 0x9add1f, chunkX * 41 + index, chunkZ * 43) * 0.3);
    const feature = {
      type,
      x,
      y: terrain.height,
      z,
      yaw: yaw + yawOffset + (hash2(seedHash ^ 0x9add1e, chunkX * 31 + index, chunkZ * 37) - 0.5) * yawJitter,
      scale: featureScale,
    };
    if (length !== undefined) {
      feature.length = length * featureScale;
    }
    if (width !== undefined) {
      feature.width = width * featureScale;
    }
    pushFeature(features, counts, feature, maxFeatures);
  }
}

function isJadeVillageGround(terrain) {
  return (terrain.biome === "plains" || terrain.biome === "forest")
    && terrain.waterStrength < 0.08
    && terrain.waterBankStrength < 0.16
    && terrain.slope < 0.58;
}

function isJadeTempleGround(terrain) {
  return terrain.biome === "snowy-mountain"
    && terrain.height > 48
    && terrain.waterStrength < 0.05
    && terrain.slope < 0.82;
}

function isJadeStoneGround(terrain) {
  return terrain.biome === "stone-forest"
    && terrain.waterStrength < 0.1
    && terrain.slope < 0.95;
}

function addJungleDressing(seedHash, features, counts, terrain, x, z, worldCellX, worldCellZ, roll, density, maxFeatures) {
  const treeChance = 0.32 + density * 0.42;
  if (roll < treeChance) {
    pushFeature(features, counts, createSunspiceFeature(seedHash, "jungle-tree", terrain, x, z, worldCellX, worldCellZ, 1.18, 0.78), maxFeatures);
  } else if (roll < treeChance + 0.09 && terrain.slope < 0.45) {
    pushFeature(features, counts, createSunspiceFeature(seedHash, "jungle-hut", terrain, x, z, worldCellX, worldCellZ, 0.9, 0.36), maxFeatures);
  }
}

function addRainforestDressing(seedHash, features, counts, terrain, x, z, worldCellX, worldCellZ, roll, density, maxFeatures) {
  const treeChance = 0.42 + density * 0.46;
  if (roll < treeChance) {
    pushFeature(features, counts, createSunspiceFeature(seedHash, "rainforest-tree", terrain, x, z, worldCellX, worldCellZ, 1.34, 0.9), maxFeatures);
  } else if (roll < treeChance + 0.08 && terrain.slope < 0.5) {
    pushFeature(features, counts, createSunspiceFeature(seedHash, "rainforest-shrine", terrain, x, z, worldCellX, worldCellZ, 0.76, 0.32), maxFeatures);
  }
}

function addDesertDressing(seedHash, features, counts, terrain, x, z, worldCellX, worldCellZ, roll, maxFeatures) {
  if (terrain.waterBankStrength > 0.1 && roll < 0.72) {
    pushFeature(features, counts, createSunspiceFeature(seedHash, "desert-palm", terrain, x, z, worldCellX, worldCellZ, 0.84, 0.56), maxFeatures);
  } else if (roll < 0.12 && terrain.slope < 0.6) {
    pushFeature(features, counts, createSunspiceFeature(seedHash, "desert-camp", terrain, x, z, worldCellX, worldCellZ, 0.86, 0.34), maxFeatures);
  } else if (roll < 0.28 && terrain.slope < 0.74) {
    pushFeature(features, counts, createSunspiceFeature(seedHash, "desert-ruin", terrain, x, z, worldCellX, worldCellZ, 0.78, 0.48), maxFeatures);
  } else if (roll < 0.74 && terrain.slope < 0.78) {
    pushFeature(features, counts, createSunspiceFeature(seedHash, "cactus", terrain, x, z, worldCellX, worldCellZ, 0.78, 0.74), maxFeatures);
  }
}

function createSunspiceFeature(seedHash, type, terrain, x, z, worldCellX, worldCellZ, baseScale, scaleJitter) {
  return {
    type,
    x,
    y: terrain.height,
    z,
    yaw: hash2(seedHash ^ 0x5a1ad, worldCellX, worldCellZ) * Math.PI * 2,
    scale: baseScale + hash2(seedHash ^ 0x5ca1ed, worldCellX, worldCellZ) * scaleJitter,
  };
}

function addBiomeCluster(seedHash, seed, chunkX, chunkZ, chunkSize, biome, features, counts, maxFeatures, seenBiomes) {
  const structureTypes = {
    jungle: ["jungle-hut", "jungle-tree", "waterfall"],
    rainforest: ["rainforest-shrine", "rainforest-tree", "waterfall"],
    desert: ["desert-ruin", "desert-camp", "cactus"],
  };
  const primaryStructure = structureTypes[biome][0];
  const roll = hash2(seedHash ^ biomeSeed(biome), chunkX, chunkZ);
  const clusterChance = biome === "desert" ? 0.64 : 0.42;
  if (!seenBiomes.has(biome) || roll > clusterChance || features.length >= maxFeatures) {
    return;
  }

  const minX = chunkX * chunkSize;
  const minZ = chunkZ * chunkSize;
  const centerX = minX + chunkSize * (0.24 + hash2(seedHash ^ (biomeSeed(biome) + 1), chunkX, chunkZ) * 0.52);
  const centerZ = minZ + chunkSize * (0.24 + hash2(seedHash ^ (biomeSeed(biome) + 2), chunkX, chunkZ) * 0.52);
  const offsets = [
    { ox: 0, oz: 0, type: primaryStructure, scale: 1.12 },
    { ox: 16, oz: 12, type: structureTypes[biome][1], scale: 0.92 },
    { ox: -18, oz: 9, type: structureTypes[biome][2], scale: 0.86 },
    { ox: 8, oz: -17, type: primaryStructure, scale: 0.82 },
  ];
  const yaw = hash2(seedHash ^ (biomeSeed(biome) + 3), chunkX, chunkZ) * Math.PI * 2;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);

  for (let index = 0; index < offsets.length && features.length < maxFeatures; index += 1) {
    const { ox, oz, type, scale } = offsets[index];
    const x = centerX + ox * cos - oz * sin;
    const z = centerZ + ox * sin + oz * cos;
    if (x < minX + 8 || x > minX + chunkSize - 8 || z < minZ + 8 || z > minZ + chunkSize - 8) {
      continue;
    }
    const terrain = sampleTerrain(seed, x, z, { profile: "sunspice-wilds" });
    if (terrain.biome !== biome || (type === "waterfall" ? !isWaterfallGround(terrain) : !isSunspiceDressingGround(terrain))) {
      continue;
    }
    pushFeature(features, counts, {
      type,
      x,
      y: terrain.height,
      z,
      yaw: yaw + (hash2(seedHash ^ 0x61a7c, chunkX * 17 + index, chunkZ * 19) - 0.5) * 0.72,
      scale: scale * (0.88 + hash2(seedHash ^ 0x5cab1e, chunkX * 23 + index, chunkZ * 29) * 0.28),
    }, maxFeatures);
  }
}

function biomeSeed(biome) {
  return biome === "desert" ? 0xde5e27 : biome === "rainforest" ? 0x4a1f0257 : 0x1a671e;
}

function transformLocal(localX, localZ, yaw) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: localX * cos - localZ * sin,
    z: localX * sin + localZ * cos,
  };
}

function isSunspiceDressingGround(terrain) {
  return terrain.waterStrength < 0.2
    && terrain.slope < (terrain.biome === "desert" ? 0.78 : 0.68)
    && terrain.material !== MATERIAL_IDS.river;
}

function isWaterfallGround(terrain) {
  return (terrain.biome === "jungle" || terrain.biome === "rainforest")
    && terrain.height > 18
    && terrain.slope > 0.46
    && terrain.slope < 0.82
    && terrain.waterStrength < 0.18;
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
