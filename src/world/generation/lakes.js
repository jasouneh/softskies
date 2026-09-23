import { WORLD_CONFIG } from "../../config/game.js";
import { sampleBaseTerrain } from "./base-terrain.js";
import { hash2, normalizeSeed, smoothstep } from "./noise.js";
import { sampleRiver } from "./rivers.js";

const LAKE_CELL_CHUNKS = 2;
const NEIGHBOR_RADIUS = 1;
const LAKE_CACHE_LIMIT = 768;

const lakeDefinitionCache = new Map();

export function sampleLake(seed, worldX, worldZ, { chunkSize = WORLD_CONFIG.chunkSize } = {}) {
  const seedHash = normalizeSeed(seed);
  const cellSize = chunkSize * LAKE_CELL_CHUNKS;
  const cellX = Math.floor(worldX / cellSize);
  const cellZ = Math.floor(worldZ / cellSize);
  let best = createEmptyLakeSample();

  for (let z = cellZ - NEIGHBOR_RADIUS; z <= cellZ + NEIGHBOR_RADIUS; z += 1) {
    for (let x = cellX - NEIGHBOR_RADIUS; x <= cellX + NEIGHBOR_RADIUS; x += 1) {
      const candidate = sampleLakeCandidate(seedHash, x, z, worldX, worldZ, cellSize);
      if (candidate.strength > best.strength) {
        best = candidate;
      }
    }
  }

  return best;
}

export function clearLakeDefinitionCache() {
  lakeDefinitionCache.clear();
}

export function listChunkLakeInfluences(seed, chunkX, chunkZ, { chunkSize = WORLD_CONFIG.chunkSize } = {}) {
  const seedHash = normalizeSeed(seed);
  const cellSize = chunkSize * LAKE_CELL_CHUNKS;
  const minX = chunkX * chunkSize;
  const minZ = chunkZ * chunkSize;
  const maxX = minX + chunkSize;
  const maxZ = minZ + chunkSize;
  const cellMinX = Math.floor(minX / cellSize) - NEIGHBOR_RADIUS;
  const cellMaxX = Math.floor(maxX / cellSize) + NEIGHBOR_RADIUS;
  const cellMinZ = Math.floor(minZ / cellSize) - NEIGHBOR_RADIUS;
  const cellMaxZ = Math.floor(maxZ / cellSize) + NEIGHBOR_RADIUS;
  const lakes = [];

  for (let z = cellMinZ; z <= cellMaxZ; z += 1) {
    for (let x = cellMinX; x <= cellMaxX; x += 1) {
      const lake = createLakeDefinition(seedHash, x, z, cellSize);
      if (!lake) {
        continue;
      }
      if (lake.centerX + lake.radius + lake.bankWidth < minX
        || lake.centerX - lake.radius - lake.bankWidth > maxX
        || lake.centerZ + lake.radius + lake.bankWidth < minZ
        || lake.centerZ - lake.radius - lake.bankWidth > maxZ) {
        continue;
      }
      lakes.push(lake);
    }
  }

  return lakes.sort((a, b) => `${a.cellX},${a.cellZ}`.localeCompare(`${b.cellX},${b.cellZ}`));
}

function sampleLakeCandidate(seedHash, cellX, cellZ, worldX, worldZ, cellSize) {
  const lake = createLakeDefinition(seedHash, cellX, cellZ, cellSize);
  if (!lake) {
    return createEmptyLakeSample();
  }

  const dx = worldX - lake.centerX;
  const dz = worldZ - lake.centerZ;
  const distance = Math.hypot(dx, dz);
  const strength = 1 - smoothstep(lake.radius * 0.72, lake.radius, distance);
  const bankStrength = 1 - smoothstep(lake.radius, lake.radius + lake.bankWidth, distance);

  return {
    ...lake,
    distance,
    strength,
    bankStrength,
    isLake: strength > 0,
  };
}

function createLakeDefinition(seedHash, cellX, cellZ, cellSize) {
  const key = `${seedHash}:${cellSize}:${cellX},${cellZ}`;
  if (lakeDefinitionCache.has(key)) {
    const cached = lakeDefinitionCache.get(key);
    lakeDefinitionCache.delete(key);
    lakeDefinitionCache.set(key, cached);
    return cached;
  }

  const lake = buildLakeDefinition(seedHash, cellX, cellZ, cellSize);
  lakeDefinitionCache.set(key, lake);
  if (lakeDefinitionCache.size > LAKE_CACHE_LIMIT) {
    lakeDefinitionCache.delete(lakeDefinitionCache.keys().next().value);
  }
  return lake;
}

function buildLakeDefinition(seedHash, cellX, cellZ, cellSize) {
  const densityRoll = hash2(seedHash ^ 0x1a4e5, cellX, cellZ);
  if (densityRoll > 0.54) {
    return null;
  }

  let centerX = (cellX + 0.24 + hash2(seedHash ^ 0x1a4e51, cellX, cellZ) * 0.52) * cellSize;
  let centerZ = (cellZ + 0.24 + hash2(seedHash ^ 0x1a4e52, cellX, cellZ) * 0.52) * cellSize;
  const radius = cellSize * (0.12 + hash2(seedHash ^ 0x1a4e53, cellX, cellZ) * 0.13);
  const bankWidth = cellSize * (0.035 + hash2(seedHash ^ 0x1a4e54, cellX, cellZ) * 0.03);
  const wantsConnection = hash2(seedHash ^ 0x1a4e55, cellX, cellZ) < 0.46;
  const riverAnchor = wantsConnection ? findNearbyRiverAnchor(seedHash, centerX, centerZ, cellSize) : null;
  const connected = Boolean(riverAnchor);
  if (riverAnchor) {
    centerX = riverAnchor.x + (hash2(seedHash ^ 0x1a4e56, cellX, cellZ) - 0.5) * radius * 0.45;
    centerZ = riverAnchor.z + (hash2(seedHash ^ 0x1a4e57, cellX, cellZ) - 0.5) * radius * 0.45;
  }

  const centerTerrain = sampleBaseTerrain(seedHash, centerX, centerZ);

  return {
    lakeId: `${cellX},${cellZ}`,
    cellX,
    cellZ,
    centerX,
    centerZ,
    level: centerTerrain.height,
    radius,
    bankWidth,
    connected,
    strength: 0,
    bankStrength: 0,
    distance: Infinity,
    isLake: false,
  };
}

function findNearbyRiverAnchor(seedHash, centerX, centerZ, cellSize) {
  let best = null;
  const probes = 5;
  const spacing = cellSize * 0.2;
  for (let z = -2; z <= 2; z += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const probeX = centerX + x * spacing;
      const probeZ = centerZ + z * spacing;
      const river = sampleRiver(seedHash, probeX, probeZ);
      const score = river.bankStrength - Math.hypot(x, z) * 0.04;
      if (river.bankStrength > 0.16 && (!best || score > best.score)) {
        best = { x: probeX, z: probeZ, score };
      }
    }
  }
  return best;
}

function createEmptyLakeSample() {
  return {
    lakeId: null,
    cellX: 0,
    cellZ: 0,
    centerX: 0,
    centerZ: 0,
    level: 0,
    radius: 0,
    bankWidth: 0,
    connected: false,
    strength: 0,
    bankStrength: 0,
    distance: Infinity,
    isLake: false,
  };
}
