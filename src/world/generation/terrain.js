import { MATERIAL_IDS, MATERIAL_NAMES, WORLD_CONFIG, WORLD_SEED } from "../../config/game.js";
import { clamp, fbm2, normalizeSeed, ridgedFbm2, smoothstep } from "./noise.js";
import { listChunkRiverInfluences, sampleRiver } from "./rivers.js";

export function sampleTerrain(seed = WORLD_SEED, worldX = 0, worldZ = 0) {
  const seedHash = normalizeSeed(seed);
  const plains = fbm2(seedHash ^ 0x0f00d123, worldX, worldZ, {
    frequency: 0.0024,
    octaves: 4,
    gain: 0.52,
  });
  const smallHills = fbm2(seedHash ^ 0x7ca129bb, worldX, worldZ, {
    frequency: 0.009,
    octaves: 3,
    gain: 0.44,
  });
  const mountainField = fbm2(seedHash ^ 0x4d3a12ef, worldX, worldZ, {
    frequency: 0.0018,
    octaves: 5,
    gain: 0.56,
  }) * 0.5 + 0.5;
  const ridges = ridgedFbm2(seedHash ^ 0x2a93bc17, worldX, worldZ, {
    frequency: 0.0065,
    octaves: 4,
    gain: 0.5,
  });
  const mountainMask = smoothstep(0.52, 0.82, mountainField + ridges * 0.18);
  const massif = Math.pow(mountainMask, 1.45);
  const terrace = Math.floor((smallHills * 0.5 + 0.5) * 5) / 5;

  let height = 3.5
    + plains * 10
    + terrace * 6
    + massif * (34 + ridges * 56);

  const river = sampleRiver(seedHash, worldX, worldZ);
  const riverCut = river.strength * (2.2 + massif * 4.5);
  height -= riverCut;

  const slopeProxy = clamp(ridges * massif + Math.abs(smallHills) * 0.35);
  const material = chooseMaterial({ height, massif, river, slopeProxy, plains });

  return {
    height,
    material,
    materialName: MATERIAL_NAMES[material],
    riverStrength: river.strength,
    riverDistance: river.distance,
    riverWidth: river.width,
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

  if (river.strength > 0.05) {
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
