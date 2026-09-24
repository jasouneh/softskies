import { MATERIAL_IDS, MATERIAL_NAMES, WORLD_CONFIG, WORLD_SEED } from "../../config/game.js";
import { sampleBaseTerrain } from "./base-terrain.js";
import { sampleLake, listChunkLakeInfluences } from "./lakes.js";
import { clamp, hash2, normalizeSeed, smoothstep } from "./noise.js";
import { listChunkRiverInfluences, sampleRiver } from "./rivers.js";

export function sampleTerrain(seed = WORLD_SEED, worldX = 0, worldZ = 0, options = {}) {
  const mapOptions = resolveTerrainOptions(seed, options);
  const seedHash = normalizeSeed(seed);
  const base = sampleBaseTerrain(seedHash, worldX, worldZ, mapOptions);
  if (mapOptions.profile === "sunspice-wilds") {
    return sampleSunspiceTerrain(seedHash, base, worldX, worldZ);
  }

  const { plains, mountain: massif, slopeProxy } = base;
  const rawRiver = sampleRiver(seedHash, worldX, worldZ);
  const rawLake = sampleLake(seedHash, worldX, worldZ);
  const lowlandFactor = (1 - smoothstep(0.16, 0.34, massif)) * (1 - smoothstep(34, 50, base.height));
  const gentleBankFactor = 1 - smoothstep(0.34, 0.58, slopeProxy);
  const riverStrength = rawRiver.strength * lowlandFactor * gentleBankFactor;
  const riverBankStrength = rawRiver.bankStrength * lowlandFactor * gentleBankFactor;
  const lakeLowlandFactor = (1 - smoothstep(0.1, 0.22, massif)) * (1 - smoothstep(26, 36, base.height));
  const lakeGentleFactor = 1 - smoothstep(0.18, 0.32, slopeProxy);
  const lakeLevelFactor = 1 - smoothstep(5, 11, Math.abs(base.height - rawLake.level));
  const lakeSuitability = lakeLowlandFactor * lakeGentleFactor * lakeLevelFactor;
  const lakeStrength = rawLake.strength * lakeSuitability;
  const lakeBankStrength = rawLake.bankStrength * lakeSuitability;
  const waterStrength = Math.max(riverStrength, lakeStrength);
  const bankStrength = Math.max(riverBankStrength, lakeBankStrength);
  const riverCut = riverBankStrength * 2.2 + riverStrength * 3.4;
  const lakeCut = lakeBankStrength * 1.6 + lakeStrength * 4.8;
  const height = base.height - Math.max(riverCut, lakeCut);

  const river = {
    ...rawRiver,
    strength: riverStrength,
    bankStrength: riverBankStrength,
    isRiver: riverStrength > 0,
  };
  const lake = {
    ...rawLake,
    strength: lakeStrength,
    bankStrength: lakeBankStrength,
    isLake: lakeStrength > 0,
  };
  const material = chooseMaterial({ height, massif, waterStrength, bankStrength, slopeProxy, plains });

  return {
    height,
    material,
    materialName: MATERIAL_NAMES[material],
    riverStrength: river.strength,
    riverDistance: river.distance,
    riverWidth: river.width,
    riverBankStrength: river.bankStrength,
    lakeStrength: lake.strength,
    lakeDistance: lake.distance,
    lakeRadius: lake.radius,
    lakeBankStrength: lake.bankStrength,
    waterStrength,
    waterBankStrength: bankStrength,
    mountain: massif,
    slope: slopeProxy,
  };
}

export function generateTerrainChunk(seed = WORLD_SEED, chunkX = 0, chunkZ = 0, {
  chunkSize = WORLD_CONFIG.chunkSize,
  segments = WORLD_CONFIG.chunkSegments,
  map,
  profile,
} = {}) {
  const terrainOptions = resolveTerrainOptions(seed, { map, profile });
  const step = chunkSize / segments;
  const samples = [];
  const materialCounts = Object.fromEntries(MATERIAL_NAMES.map((name) => [name, 0]));
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  let riverSamples = 0;

  for (let iz = 0; iz <= segments; iz += 1) {
    for (let ix = 0; ix <= segments; ix += 1) {
      const worldX = chunkX * chunkSize + ix * step;
      const worldZ = chunkZ * chunkSize + iz * step;
      const sample = sampleTerrain(seed, worldX, worldZ, terrainOptions);
      samples.push({ worldX, worldZ, ...sample });
      minHeight = Math.min(minHeight, sample.height);
      maxHeight = Math.max(maxHeight, sample.height);
      materialCounts[sample.materialName] += 1;
      if (sample.waterStrength > 0) {
        riverSamples += 1;
      }
    }
  }

  return {
    key: `${chunkX},${chunkZ}`,
    seed,
    chunkX,
    chunkZ,
    chunkSize,
    segments,
    step,
    samples,
    rivers: listChunkRiverInfluences(seed, chunkX, chunkZ, { chunkSize }),
    lakes: listChunkLakeInfluences(seed, chunkX, chunkZ, { chunkSize }),
    stats: {
      minHeight,
      maxHeight,
      materialCounts,
      riverSamples,
    },
  };
}

export function getChunkSample(chunk, ix, iz) {
  const clampedX = Math.min(chunk.segments, Math.max(0, ix));
  const clampedZ = Math.min(chunk.segments, Math.max(0, iz));
  return chunk.samples[clampedZ * (chunk.segments + 1) + clampedX];
}

export function getChunkBorderHeights(chunk, side) {
  const values = [];
  if (side === "west" || side === "east") {
    const ix = side === "west" ? 0 : chunk.segments;
    for (let iz = 0; iz <= chunk.segments; iz += 1) {
      values.push(getChunkSample(chunk, ix, iz).height);
    }
    return values;
  }

  const iz = side === "north" ? 0 : chunk.segments;
  for (let ix = 0; ix <= chunk.segments; ix += 1) {
    values.push(getChunkSample(chunk, ix, iz).height);
  }
  return values;
}

function resolveTerrainOptions(seed, { map, profile } = {}) {
  return {
    profile: profile ?? map?.terrainProfile ?? (String(seed).includes("sunspice-wilds") ? "sunspice-wilds" : "highlands"),
    map,
  };
}

function sampleSunspiceTerrain(seedHash, base, worldX, worldZ) {
  const { plains, mountain: massif, slopeProxy, biome } = base;
  const wetWater = sampleWetBiomeWater(seedHash, worldX, worldZ, base);
  const oasis = sampleOasis(seedHash, worldX, worldZ, base);
  const redSandStrength = sampleRedSandPatch(seedHash, worldX, worldZ, base);
  const waterStrength = Math.max(wetWater.riverStrength, wetWater.lakeStrength, oasis.strength);
  const bankStrength = Math.max(wetWater.riverBankStrength, wetWater.lakeBankStrength, oasis.bankStrength);
  const wetCut = Math.max(
    wetWater.riverBankStrength * 2 + wetWater.riverStrength * 3.2,
    wetWater.lakeBankStrength * 1.5 + wetWater.lakeStrength * 4.2,
  );
  const height = base.height - Math.max(wetCut, oasis.bankStrength * 1.2 + oasis.strength * 3.2);
  const material = chooseSunspiceMaterial({ height, biome, waterStrength, bankStrength, slopeProxy, massif });

  return {
    height,
    material,
    materialName: MATERIAL_NAMES[material],
    biome,
    biomeName: biome,
    riverStrength: wetWater.riverStrength,
    riverDistance: wetWater.riverDistance,
    riverWidth: wetWater.riverWidth,
    riverBankStrength: wetWater.riverBankStrength,
    lakeStrength: Math.max(wetWater.lakeStrength, oasis.strength),
    lakeDistance: Math.min(wetWater.lakeDistance, oasis.distance),
    lakeRadius: Math.max(wetWater.lakeRadius, oasis.radius),
    lakeBankStrength: Math.max(wetWater.lakeBankStrength, oasis.bankStrength),
    waterStrength,
    waterBankStrength: bankStrength,
    mountain: massif,
    slope: slopeProxy,
    plains,
    desert: base.desert,
    rainforest: base.rainforest,
    jungle: base.jungle,
    redSandStrength,
  };
}

function sampleWetBiomeWater(seedHash, worldX, worldZ, base) {
  if (base.biome === "desert") {
    return {
      riverStrength: 0,
      riverDistance: Infinity,
      riverWidth: 0,
      riverBankStrength: 0,
      lakeStrength: 0,
      lakeDistance: Infinity,
      lakeRadius: 0,
      lakeBankStrength: 0,
    };
  }

  const wetness = base.biome === "rainforest" ? 1.08 : 0.82;
  const terrainSuitability = wetness
    * (1 - smoothstep(0.58, 0.86, base.slopeProxy))
    * (1 - smoothstep(54, 76, base.height))
    * (0.78 + base.rainforest * 0.28 + base.jungle * 0.16);
  const rawRiver = sampleRiver(seedHash, worldX, worldZ);
  const rawLake = sampleLake(seedHash, worldX, worldZ);
  const riverStrength = clamp(rawRiver.strength * terrainSuitability * 1.2);
  const riverBankStrength = clamp(rawRiver.bankStrength * terrainSuitability * 1.08);
  const lakeStrength = clamp(rawLake.strength * terrainSuitability * 1.05);
  const lakeBankStrength = clamp(rawLake.bankStrength * terrainSuitability);

  return {
    riverStrength,
    riverDistance: rawRiver.distance,
    riverWidth: rawRiver.width,
    riverBankStrength,
    lakeStrength,
    lakeDistance: rawLake.distance,
    lakeRadius: rawLake.radius,
    lakeBankStrength,
  };
}

function sampleOasis(seedHash, worldX, worldZ, base) {
  if (base.biome !== "desert") {
    return { strength: 0, bankStrength: 0, distance: Infinity, radius: 0 };
  }

  const cellSize = 560;
  const cellX = Math.floor(worldX / cellSize);
  const cellZ = Math.floor(worldZ / cellSize);
  let best = { strength: 0, bankStrength: 0, distance: Infinity, radius: 0 };
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = cellX + dx;
      const z = cellZ + dz;
      if (hash2(seedHash ^ 0x0a51515, x, z) > 0.42) {
        continue;
      }
      const centerX = (x + 0.22 + hash2(seedHash ^ 0x0a51516, x, z) * 0.56) * cellSize;
      const centerZ = (z + 0.22 + hash2(seedHash ^ 0x0a51517, x, z) * 0.56) * cellSize;
      const radius = 34 + hash2(seedHash ^ 0x0a51518, x, z) * 42;
      const bankWidth = 22 + hash2(seedHash ^ 0x0a51519, x, z) * 28;
      const distance = Math.hypot(worldX - centerX, worldZ - centerZ);
      const hillSuitability = 1 - smoothstep(0.66, 0.9, base.mountain);
      const strength = (1 - smoothstep(radius * 0.65, radius, distance)) * hillSuitability;
      const bankStrength = (1 - smoothstep(radius, radius + bankWidth, distance)) * hillSuitability;
      if (strength > best.strength || bankStrength > best.bankStrength) {
        best = { strength: clamp(strength), bankStrength: clamp(bankStrength), distance, radius };
      }
    }
  }
  return best;
}

function sampleRedSandPatch(seedHash, worldX, worldZ, base) {
  if (base.biome !== "desert") {
    return 0;
  }

  const cellSize = 420;
  const cellX = Math.floor(worldX / cellSize);
  const cellZ = Math.floor(worldZ / cellSize);
  let strength = 0;
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = cellX + dx;
      const z = cellZ + dz;
      if (hash2(seedHash ^ 0xed5a0d, x, z) > 0.2) {
        continue;
      }
      const centerX = (x + 0.2 + hash2(seedHash ^ 0xed5a0e, x, z) * 0.6) * cellSize;
      const centerZ = (z + 0.2 + hash2(seedHash ^ 0xed5a0f, x, z) * 0.6) * cellSize;
      const radius = cellSize * (0.18 + hash2(seedHash ^ 0xed5a10, x, z) * 0.18);
      const distance = Math.hypot(worldX - centerX, worldZ - centerZ);
      strength = Math.max(strength, 1 - smoothstep(radius * 0.55, radius, distance));
    }
  }
  return clamp(strength);
}

function chooseSunspiceMaterial({ height, biome, waterStrength, bankStrength, slopeProxy, massif }) {
  if (waterStrength > 0.24) {
    return MATERIAL_IDS.river;
  }

  if (biome === "desert") {
    if (bankStrength > 0.16 || waterStrength > 0.04) {
      return MATERIAL_IDS.meadow;
    }
    if ((massif > 0.58 && height > 34) || slopeProxy > 0.7) {
      return MATERIAL_IDS.rock;
    }
    return MATERIAL_IDS.sand;
  }

  if (bankStrength > 0.18 || waterStrength > 0.05) {
    return MATERIAL_IDS.meadow;
  }

  if (slopeProxy > 0.72 && height > 32) {
    return MATERIAL_IDS.rock;
  }

  return biome === "rainforest" ? MATERIAL_IDS.meadow : MATERIAL_IDS.grass;
}

function chooseMaterial({ height, massif, waterStrength, bankStrength, slopeProxy, plains }) {
  if (waterStrength > 0.24) {
    return MATERIAL_IDS.river;
  }

  if (bankStrength > 0.18 || waterStrength > 0.05) {
    return MATERIAL_IDS.sand;
  }

  if (height > 74 && massif > 0.52) {
    return MATERIAL_IDS.snow;
  }

  if (massif > 0.45 || height > 42 || slopeProxy > 0.58) {
    return MATERIAL_IDS.rock;
  }

  if (plains < -0.18) {
    return MATERIAL_IDS.meadow;
  }

  return MATERIAL_IDS.grass;
}
