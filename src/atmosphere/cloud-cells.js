import { CLOUD_CONFIG, WORLD_SEED } from "../config/game.js";
import { hash2, lerp, normalizeSeed } from "../world/generation/noise.js";

export function resolveCloudConfig(config = CLOUD_CONFIG) {
  const merged = { ...CLOUD_CONFIG, ...config };
  const cellRadius = Math.max(0, Math.floor(merged.cellRadius));
  const maxCells = Math.max(1, Math.floor(merged.maxCells));
  const minPuffsPerCell = Math.max(1, Math.floor(merged.minPuffsPerCell));
  const maxPuffsPerCell = Math.max(minPuffsPerCell, Math.floor(merged.maxPuffsPerCell));
  return {
    ...merged,
    cellRadius,
    maxCells,
    minPuffsPerCell,
    maxPuffsPerCell,
    density: Math.min(1, Math.max(0, merged.density)),
    maxPuffs: Math.max(1, Math.floor(merged.maxPuffs ?? maxCells * maxPuffsPerCell)),
  };
}

export function cloudCellCoordsForWorld(worldX = 0, worldZ = 0, cellSize = CLOUD_CONFIG.cellSize) {
  return {
    x: Math.floor(worldX / cellSize),
    z: Math.floor(worldZ / cellSize),
  };
}

export function cloudCellKey(cellX, cellZ) {
  return `${cellX},${cellZ}`;
}

export function listCloudCellEntries(center, { cellRadius = CLOUD_CONFIG.cellRadius, maxCells = CLOUD_CONFIG.maxCells } = {}) {
  const entries = [];
  for (let dz = -cellRadius; dz <= cellRadius; dz += 1) {
    for (let dx = -cellRadius; dx <= cellRadius; dx += 1) {
      const x = center.x + dx;
      const z = center.z + dz;
      entries.push({
        x,
        z,
        key: cloudCellKey(x, z),
        distanceSq: dx * dx + dz * dz,
      });
    }
  }
  return entries
    .sort((a, b) => a.distanceSq - b.distanceSq || a.key.localeCompare(b.key))
    .slice(0, maxCells);
}

export function generateCloudCell(seed = WORLD_SEED, cellX = 0, cellZ = 0, config = CLOUD_CONFIG) {
  const cfg = resolveCloudConfig(config);
  const seedHash = normalizeSeed(seed);
  const key = cloudCellKey(cellX, cellZ);
  const activeRoll = hash2(seedHash ^ 0xc10dce11, cellX, cellZ);
  const minX = cellX * cfg.cellSize;
  const minZ = cellZ * cfg.cellSize;

  if (activeRoll > cfg.density) {
    return { key, cellX, cellZ, active: false, puffs: [] };
  }

  const centerX = minX + cfg.cellSize * lerp(0.22, 0.78, hash2(seedHash ^ 0x51a7c10d, cellX, cellZ));
  const centerZ = minZ + cfg.cellSize * lerp(0.22, 0.78, hash2(seedHash ^ 0x5a11c10d, cellX, cellZ));
  const centerY = cfg.altitude + (hash2(seedHash ^ 0xa1717de, cellX, cellZ) - 0.5) * cfg.altitudeJitter;
  const elongation = lerp(0.74, 1.36, hash2(seedHash ^ 0xe10e6a7e, cellX, cellZ));
  const yaw = hash2(seedHash ^ 0xc10d7a11, cellX, cellZ) * Math.PI * 2;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const puffRange = cfg.maxPuffsPerCell - cfg.minPuffsPerCell + 1;
  const puffCount = cfg.minPuffsPerCell + Math.floor(hash2(seedHash ^ 0x9c10d5, cellX, cellZ) * puffRange);
  const puffs = [];

  for (let index = 0; index < puffCount; index += 1) {
    const hashX = cellX * 97 + index * 17;
    const hashZ = cellZ * 101 - index * 19;
    const angle = hash2(seedHash ^ 0xaddc10d, hashX, hashZ) * Math.PI * 2;
    const distance = Math.sqrt(hash2(seedHash ^ 0xd15cc10d, hashX, hashZ)) * cfg.clusterRadius;
    const localX = Math.cos(angle) * distance * elongation;
    const localZ = Math.sin(angle) * distance / Math.max(0.5, elongation);
    const rotatedX = localX * cos - localZ * sin;
    const rotatedZ = localX * sin + localZ * cos;
    const scaleRoll = hash2(seedHash ^ 0x5ca1ec10, hashX, hashZ);

    puffs.push({
      id: `${key}:${index}`,
      x: centerX + rotatedX,
      y: centerY + (hash2(seedHash ^ 0x711dc10d, hashX, hashZ) - 0.5) * cfg.verticalSpread,
      z: centerZ + rotatedZ,
      radiusX: lerp(cfg.minPuffRadiusX, cfg.maxPuffRadiusX, scaleRoll),
      radiusY: lerp(cfg.minPuffRadiusY, cfg.maxPuffRadiusY, hash2(seedHash ^ 0x7a11c10d, hashX, hashZ)),
      radiusZ: lerp(cfg.minPuffRadiusZ, cfg.maxPuffRadiusZ, 1 - scaleRoll * 0.72),
      yaw: yaw + (hash2(seedHash ^ 0xc10d5b1d, hashX, hashZ) - 0.5) * 0.9,
    });
  }

  return {
    key,
    cellX,
    cellZ,
    active: true,
    centerX,
    centerY,
    centerZ,
    puffs,
  };
}

export function generateCloudField(seed = WORLD_SEED, worldX = 0, worldZ = 0, config = CLOUD_CONFIG) {
  const cfg = resolveCloudConfig(config);
  const center = cloudCellCoordsForWorld(worldX, worldZ, cfg.cellSize);
  const entries = listCloudCellEntries(center, cfg);
  const cells = [];
  const puffs = [];

  for (const entry of entries) {
    const cell = generateCloudCell(seed, entry.x, entry.z, cfg);
    cells.push(cell);
    for (const puff of cell.puffs) {
      if (puffs.length >= cfg.maxPuffs) {
        break;
      }
      puffs.push(puff);
    }
  }

  return {
    seed,
    center,
    cellSize: cfg.cellSize,
    cells,
    puffs,
    stats: {
      cells: cells.length,
      activeCells: cells.filter((cell) => cell.active).length,
      puffs: puffs.length,
      maxCells: cfg.maxCells,
      maxPuffs: cfg.maxPuffs,
    },
  };
}
