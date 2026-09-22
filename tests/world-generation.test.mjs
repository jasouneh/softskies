import assert from "node:assert/strict";
import test from "node:test";

import { WORLD_CONFIG } from "../src/config/game.js";
import { getChunkBorderHeights, generateTerrainChunk, sampleTerrain } from "../src/world/generation/terrain.js";
import { listChunkRiverInfluences, sampleRiver } from "../src/world/generation/rivers.js";

const TEST_SEED = "polyfly-test-seed";

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
  const first = sampleRiver(TEST_SEED, 48, 96);
  const second = sampleRiver(TEST_SEED, 48, 96);
  const otherSeed = sampleRiver(`${TEST_SEED}-other`, 48, 96);

  assert.deepEqual(second, first);
  assert.notDeepEqual(otherSeed, first);
  assert.deepEqual(
    listChunkRiverInfluences(TEST_SEED, 0, 0),
    listChunkRiverInfluences(TEST_SEED, 0, 0),
  );
});
