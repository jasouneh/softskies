import assert from "node:assert/strict";
import test from "node:test";

import { WORLD_CONFIG, WORLD_MAPS, WORLD_SEED } from "../src/config/game.js";
import { generateChunkDressing } from "../src/world/generation/dressing.js";
import { getChunkBorderHeights, generateTerrainChunk, sampleTerrain } from "../src/world/generation/terrain.js";
import { listChunkRiverInfluences, sampleRiver } from "../src/world/generation/rivers.js";

const TEST_SEED = "softskies-test-seed";
const ABOVE_GROUND_TYPES = new Set([
  "house",
  "blacksmith",
  "farm",
  "snow-house",
  "snow-farm",
  "igloo",
  "jungle-hut",
  "rainforest-shrine",
  "desert-camp",
  "desert-ruin",
  "waterfall",
  "stone-pillar",
  "china-house",
  "china-hall",
  "china-road",
  "china-courtyard",
  "mountain-temple",
  "pagoda-tower",
  "village-lantern",
]);
const LEVEL_PATCH_TYPES = new Set([
  "house",
  "blacksmith",
  "farm",
  "snow-house",
  "snow-farm",
  "igloo",
  "jungle-hut",
  "rainforest-shrine",
  "desert-camp",
  "desert-ruin",
  "stone-pillar",
  "china-house",
  "china-hall",
  "china-road",
  "china-courtyard",
  "mountain-temple",
  "pagoda-tower",
  "village-lantern",
]);

test("terrain samples are deterministic for the same seed and coordinates", () => {
  const first = sampleTerrain(TEST_SEED, 123.5, -77.25);
  const second = sampleTerrain(TEST_SEED, 123.5, -77.25);
  const otherSeed = sampleTerrain(`${TEST_SEED}-other`, 123.5, -77.25);

  assert.deepEqual(second, first);
  assert.notEqual(otherSeed.height, first.height);
});

test("adjacent terrain chunks share exact border heights", () => {
  const options = { chunkSize: WORLD_CONFIG.chunkSize, segments: WORLD_CONFIG.chunkSegments };
  const center = generateTerrainChunk(TEST_SEED, 0, 0, options);
  const east = generateTerrainChunk(TEST_SEED, 1, 0, options);
  const south = generateTerrainChunk(TEST_SEED, 0, 1, options);

  assert.deepEqual(getChunkBorderHeights(center, "east"), getChunkBorderHeights(east, "west"));
  assert.deepEqual(getChunkBorderHeights(center, "south"), getChunkBorderHeights(south, "north"));
});

test("chunk generation exposes bounded sample data and deterministic river influences", () => {
  const chunk = generateTerrainChunk(TEST_SEED, -2, 3);
  const repeated = generateTerrainChunk(TEST_SEED, -2, 3);

  assert.equal(chunk.samples.length, (WORLD_CONFIG.chunkSegments + 1) ** 2);
  assert.equal(chunk.chunkSize, WORLD_CONFIG.chunkSize);
  assert.ok(Number.isFinite(chunk.stats.minHeight));
  assert.ok(chunk.stats.maxHeight >= chunk.stats.minHeight);
  assert.deepEqual(repeated.rivers, chunk.rivers);
});

test("river sampling is deterministic and seed-sensitive", () => {
  const first = sampleRiver(TEST_SEED, -2000, 1240);
  const second = sampleRiver(TEST_SEED, -2000, 1240);
  const otherSeed = sampleRiver(`${TEST_SEED}-other`, -2000, 1240);

  assert.deepEqual(second, first);
  assert.ok(first.strength > 0.3, "fixture should sample a visible deterministic river core");
  assert.notDeepEqual(otherSeed, first);
  assert.deepEqual(
    listChunkRiverInfluences(TEST_SEED, 0, 0),
    listChunkRiverInfluences(TEST_SEED, 0, 0),
  );
});

test("lakes are deterministic and can stand alone or meet rivers", () => {
  const isolated = generateTerrainChunk(WORLD_SEED, -8, -6);
  const connected = generateTerrainChunk(WORLD_SEED, 1, 2);

  assert.ok(isolated.lakes.length > 0, "some chunks should expose lake influence records");
  assert.ok(connected.lakes.some((lake) => lake.connected), "some generated lakes should connect into river corridors");
  assert.ok(isolated.samples.some((sample) => sample.lakeStrength > 0.24 && sample.riverStrength === 0), "lakes should appear away from rivers too");
  assert.ok([...isolated.samples, ...connected.samples]
    .filter((sample) => sample.lakeStrength > 0.24)
    .every((sample) => sample.mountain < 0.23 && sample.slope < 0.34 && sample.height < 37),
  "lake water should stay in low, gentle basins instead of climbing hillsides");
  assert.deepEqual(generateTerrainChunk(WORLD_SEED, -8, -6).lakes, isolated.lakes);
});

test("visible river materials stay in lowland valleys on gentle terrain", () => {
  let riverSamples = 0;
  let bankSamples = 0;
  const badRiverSamples = [];
  const badBankSamples = [];

  for (let chunkZ = -5; chunkZ <= 5; chunkZ += 1) {
    for (let chunkX = -5; chunkX <= 5; chunkX += 1) {
      const chunk = generateTerrainChunk(WORLD_SEED, chunkX, chunkZ);
      for (const sample of chunk.samples) {
        if (sample.materialName === "river") {
          riverSamples += 1;
          if (sample.mountain > 0.3 || sample.slope > 0.42 || sample.height > 32) {
            badRiverSamples.push(sample);
          }
        }
        if (sample.riverBankStrength > 0.18 || sample.riverStrength > 0.05) {
          bankSamples += 1;
          if (sample.mountain > 0.34 || sample.slope > 0.48 || sample.height > 38) {
            badBankSamples.push(sample);
          }
        }
      }
    }
  }

  assert.ok(riverSamples > 0, "the playable area should still include lowland rivers");
  assert.ok(bankSamples > riverSamples, "river banks should feather rivers into the plains");
  assert.deepEqual(badRiverSamples, [], "river water should not visibly climb mountains, snow caps, or high slopes");
  assert.deepEqual(badBankSamples, [], "river banks should remain lowland and gentle too");
});

test("sunspice wilds map has jungle, rainforest, hilly desert, and themed structures", () => {
  const wilds = WORLD_MAPS.find((map) => map.id === "sunspice-wilds");
  const biomes = new Set();
  const structureCounts = new Map();
  let hillyDesertSamples = 0;
  let wetBiomeWaterSamples = 0;
  let oasisSamples = 0;
  let desertChunks = 0;
  let redSandChunks = 0;
  let desertStructureCount = 0;

  for (let chunkZ = -4; chunkZ <= 4; chunkZ += 1) {
    for (let chunkX = -4; chunkX <= 4; chunkX += 1) {
      const chunk = generateTerrainChunk(wilds.seed, chunkX, chunkZ, { ...WORLD_CONFIG, map: wilds });
      let hasDesert = false;
      let hasRedSand = false;
      for (const sample of chunk.samples) {
        biomes.add(sample.biome);
        if ((sample.biome === "jungle" || sample.biome === "rainforest") && sample.waterStrength > 0.05) {
          wetBiomeWaterSamples += 1;
        }
        if (sample.biome === "desert") {
          hasDesert = true;
          if (sample.height > 28 || sample.slope > 0.45) {
            hillyDesertSamples += 1;
          }
          if (sample.waterStrength > 0.05) {
            oasisSamples += 1;
          }
          if ((sample.redSandStrength ?? 0) > 0.35) {
            hasRedSand = true;
          }
        }
      }
      if (hasDesert) {
        desertChunks += 1;
      }
      if (hasRedSand) {
        redSandChunks += 1;
      }

      const dressing = generateChunkDressing(wilds.seed, chunkX, chunkZ, { ...WORLD_CONFIG, map: wilds });
      desertStructureCount += (dressing.stats.counts.cactus ?? 0)
        + (dressing.stats.counts["desert-camp"] ?? 0)
        + (dressing.stats.counts["desert-ruin"] ?? 0)
        + (dressing.stats.counts["desert-palm"] ?? 0);
      for (const [type, count] of Object.entries(dressing.stats.counts)) {
        structureCounts.set(type, (structureCounts.get(type) ?? 0) + count);
      }
    }
  }

  assert.ok(biomes.has("jungle"));
  assert.ok(biomes.has("rainforest"));
  assert.ok(biomes.has("desert"));
  assert.ok(wetBiomeWaterSamples > 200, "jungle and rainforest should retain coherent river/lake water features");
  assert.ok(hillyDesertSamples > 200, "desert biomes should include substantial hilly terrain");
  assert.ok(oasisSamples > 20, "desert should include occasional oases");
  assert.ok(redSandChunks / desertChunks >= 0.05 && redSandChunks / desertChunks <= 0.25, "red sand patches should be findable in about a tenth of desert regions");
  assert.ok((structureCounts.get("jungle-hut") ?? 0) > 0, "jungle should generate huts");
  assert.ok((structureCounts.get("rainforest-shrine") ?? 0) > 0, "rainforest should generate shrines");
  assert.ok((structureCounts.get("waterfall") ?? 0) > 0, "hilly wet biomes should generate waterfalls");
  assert.ok((structureCounts.get("cactus") ?? 0) > 0, "desert should generate cacti");
  assert.ok((structureCounts.get("desert-camp") ?? 0) + (structureCounts.get("desert-ruin") ?? 0) > 0, "desert should generate camps or ruins");
  assert.ok(desertStructureCount > 250, "desert coverage should be dense enough to avoid barren fly-throughs");
});

test("jade provinces map has stone forests, snowy temple mountains, and large villages", () => {
  const jade = WORLD_MAPS.find((map) => map.id === "jade-provinces");
  const biomes = new Set();
  const structureCounts = new Map();
  let tallStoneSamples = 0;
  let highSnowSamples = 0;
  let villageBiomeSamples = 0;

  for (let chunkZ = -5; chunkZ <= 5; chunkZ += 1) {
    for (let chunkX = -5; chunkX <= 5; chunkX += 1) {
      const chunk = generateTerrainChunk(jade.seed, chunkX, chunkZ, { ...WORLD_CONFIG, map: jade });
      for (const sample of chunk.samples) {
        biomes.add(sample.biome);
        if (sample.biome === "stone-forest" && sample.height > 45) {
          tallStoneSamples += 1;
        }
        if (sample.biome === "snowy-mountain" && sample.height > 60) {
          highSnowSamples += 1;
        }
        if (sample.biome === "plains" || sample.biome === "forest") {
          villageBiomeSamples += 1;
        }
      }

      const dressing = generateChunkDressing(jade.seed, chunkX, chunkZ, { ...WORLD_CONFIG, map: jade });
      for (const [type, count] of Object.entries(dressing.stats.counts)) {
        structureCounts.set(type, (structureCounts.get(type) ?? 0) + count);
      }
    }
  }

  assert.ok(biomes.has("stone-forest"));
  assert.ok(biomes.has("snowy-mountain"));
  assert.ok(biomes.has("plains"));
  assert.ok(biomes.has("forest"));
  assert.ok(tallStoneSamples > 1000, "stone forest should include tall rock-tree mountain samples");
  assert.ok(highSnowSamples > 1000, "snowy mountain biome should include high peaks");
  assert.ok(villageBiomeSamples > 1000, "normal plains and forests should occupy meaningful village terrain");
  assert.ok((structureCounts.get("stone-pillar") ?? 0) > 0, "stone forest should generate rock-tree pillars");
  assert.ok((structureCounts.get("mountain-temple") ?? 0) > 0, "snowy mountains should generate temples");
  assert.ok((structureCounts.get("pagoda-tower") ?? 0) > 0, "Chinese-inspired map should generate pagoda towers");
  assert.ok((structureCounts.get("china-house") ?? 0) > 100, "plains and forests should generate large villages");
  assert.ok((structureCounts.get("china-hall") ?? 0) > 0, "large villages should include central halls");
  assert.ok((structureCounts.get("china-road") ?? 0) > 0, "large villages should include connecting roads");
  assert.ok((structureCounts.get("china-courtyard") ?? 0) > 0, "large villages should include a central courtyard");
});

test("generated structures are placed fully above sampled even terrain footprints", () => {
  const buried = [];
  const uneven = [];

  for (const map of WORLD_MAPS) {
    for (let chunkZ = -2; chunkZ <= 2; chunkZ += 1) {
      for (let chunkX = -2; chunkX <= 2; chunkX += 1) {
        const dressing = generateChunkDressing(map.seed, chunkX, chunkZ, { ...WORLD_CONFIG, map });
        for (const feature of dressing.features) {
          if (!ABOVE_GROUND_TYPES.has(feature.type)) {
            continue;
          }
          const terrain = sampledTerrainUnderFeature(map, feature);
          if (feature.y + 1e-6 < terrain.maxHeight) {
            buried.push({ type: feature.type, x: feature.x, z: feature.z, y: feature.y, terrainHeight: terrain.maxHeight });
          }
          if (LEVEL_PATCH_TYPES.has(feature.type) && terrain.heightRange > maxAllowedFootprintHeightRange(feature) + 1e-6) {
            uneven.push({ type: feature.type, x: feature.x, z: feature.z, heightRange: terrain.heightRange });
          }
        }
      }
    }
  }

  assert.deepEqual(buried, [], "structures should sit on top of terrain instead of being embedded");
  assert.deepEqual(uneven, [], "large-footprint stones, floors, and structure bases should use even terrain patches");
});

test("chunk dressing is deterministic and bounded", () => {
  const plains = generateChunkDressing(TEST_SEED, -10, -10);
  const repeated = generateChunkDressing(TEST_SEED, -10, -10);
  const snow = generateChunkDressing(WORLD_SEED, -20, -20);

  assert.deepEqual(repeated, plains);
  assert.ok(plains.features.length <= plains.stats.maxFeatures);
  assert.ok(snow.features.length <= snow.stats.maxFeatures);
  assert.ok(plains.stats.counts.tree + plains.stats.counts.house + plains.stats.counts.blacksmith + plains.stats.counts.farm > 0, "plains should gain trees, homes, blacksmiths, or farms");
  assert.ok(snow.stats.counts["dead-tree"] + snow.stats.counts.igloo + snow.stats.counts["snow-house"] + snow.stats.counts["snow-farm"] > 0, "snow chunks should gain dead trees, igloos, or snow village features");
  assert.ok([...plains.features, ...snow.features].every((feature) => Number.isFinite(feature.x) && Number.isFinite(feature.y) && Number.isFinite(feature.z)));
});

function sampledTerrainUnderFeature(map, feature) {
  const footprint = featureFootprint(feature);
  const yaw = feature.yaw ?? 0;
  const xDivisions = Math.max(2, Math.min(5, Math.ceil(footprint.halfWidth / 4)));
  const zDivisions = Math.max(2, Math.min(8, Math.ceil(footprint.halfDepth / 5)));
  let minHeight = Infinity;
  let maxHeight = -Infinity;

  for (let ix = -xDivisions; ix <= xDivisions; ix += 1) {
    for (let iz = -zDivisions; iz <= zDivisions; iz += 1) {
      const localX = footprint.halfWidth * (ix / xDivisions);
      const localZ = footprint.halfDepth * (iz / zDivisions);
      const offset = rotateLocal(localX, localZ, yaw);
      const terrain = sampleTerrain(map.seed, feature.x + offset.x, feature.z + offset.z, { map });
      minHeight = Math.min(minHeight, terrain.height);
      maxHeight = Math.max(maxHeight, terrain.height);
    }
  }

  return { minHeight, maxHeight, heightRange: maxHeight - minHeight };
}

function maxAllowedFootprintHeightRange(feature) {
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
    case "village-lantern":
    default:
      return { halfWidth: 1.0 * s, halfDepth: 1.0 * s };
  }
}

function rotateLocal(localX, localZ, yaw) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: localX * cos - localZ * sin,
    z: localX * sin + localZ * cos,
  };
}
