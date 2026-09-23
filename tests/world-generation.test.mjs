import assert from "node:assert/strict";
import test from "node:test";

import { WORLD_CONFIG, WORLD_SEED } from "../src/config/game.js";
import { generateChunkDressing } from "../src/world/generation/dressing.js";
import { getChunkBorderHeights, generateTerrainChunk, sampleTerrain } from "../src/world/generation/terrain.js";
import { listChunkRiverInfluences, sampleRiver } from "../src/world/generation/rivers.js";

const TEST_SEED = "softskies-test-seed";

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

test("chunk dressing is deterministic and bounded", () => {
  const plains = generateChunkDressing(TEST_SEED, -10, -10);
  const repeated = generateChunkDressing(TEST_SEED, -10, -10);
  const snow = generateChunkDressing(WORLD_SEED, -20, -20);

  assert.deepEqual(repeated, plains);
  assert.ok(plains.features.length <= plains.stats.maxFeatures);
  assert.ok(snow.features.length <= snow.stats.maxFeatures);
  assert.ok(plains.stats.counts.tree + plains.stats.counts.house > 0, "plains should gain trees or homes");
  assert.ok(snow.stats.counts["dead-tree"] + snow.stats.counts.igloo > 0, "snow chunks should gain dead trees or igloos");
  assert.ok([...plains.features, ...snow.features].every((feature) => Number.isFinite(feature.x) && Number.isFinite(feature.y) && Number.isFinite(feature.z)));
});
