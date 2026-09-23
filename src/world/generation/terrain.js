import { MATERIAL_IDS, MATERIAL_NAMES, WORLD_CONFIG, WORLD_SEED } from "../../config/game.js";
import { sampleBaseTerrain } from "./base-terrain.js";
import { normalizeSeed, smoothstep } from "./noise.js";
import { listChunkRiverInfluences, sampleRiver } from "./rivers.js";

export function sampleTerrain(seed = WORLD_SEED, worldX = 0, worldZ = 0) {
  const seedHash = normalizeSeed(seed);
  const base = sampleBaseTerrain(seedHash, worldX, worldZ);
  const { plains, mountain: massif, slopeProxy } = base;
  const rawRiver = sampleRiver(seedHash, worldX, worldZ);
  const lowlandFactor = (1 - smoothstep(0.16, 0.34, massif)) * (1 - smoothstep(34, 50, base.height));
  const gentleBankFactor = 1 - smoothstep(0.34, 0.58, slopeProxy);
  const riverStrength = rawRiver.strength * lowlandFactor * gentleBankFactor;
  const bankStrength = rawRiver.bankStrength * lowlandFactor * gentleBankFactor;
  const riverCut = bankStrength * 2.2 + riverStrength * 3.4;
  const height = base.height - riverCut;

  const river = {
    ...rawRiver,
    strength: riverStrength,
    bankStrength,
    isRiver: riverStrength > 0,
  };
  const material = chooseMaterial({ height, massif, river, slopeProxy, plains });

  return {
    height,
    material,
    materialName: MATERIAL_NAMES[material],
    riverStrength: river.strength,
    riverDistance: river.distance,
    riverWidth: river.width,
    riverBankStrength: river.bankStrength,
    mountain: massif,
    slope: slopeProxy,
  };
}

export function generateTerrainChunk(seed = WORLD_SEED, chunkX = 0, chunkZ = 0, {
  chunkSize = WORLD_CONFIG.chunkSize,
  segments = WORLD_CONFIG.chunkSegments,
} = {}) {
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
      const sample = sampleTerrain(seed, worldX, worldZ);
      samples.push({ worldX, worldZ, ...sample });
      minHeight = Math.min(minHeight, sample.height);
      maxHeight = Math.max(maxHeight, sample.height);
      materialCounts[sample.materialName] += 1;
      if (sample.riverStrength > 0) {
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

function chooseMaterial({ height, massif, river, slopeProxy, plains }) {
  if (river.strength > 0.24) {
    return MATERIAL_IDS.river;
  }

  if (river.bankStrength > 0.18 || river.strength > 0.05) {
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
