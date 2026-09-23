import assert from "node:assert/strict";
import test from "node:test";

import { ATMOSPHERE_CONFIG, CLOUD_CONFIG, WORLD_SEED } from "../src/config/game.js";
import {
  generateCloudCell,
  generateCloudField,
  listCloudCellEntries,
} from "../src/atmosphere/cloud-cells.js";

test("cloud fields are deterministic, bounded, and visible around the default flight path", () => {
  const first = generateCloudField(WORLD_SEED, 0, 0);
  const repeated = generateCloudField(WORLD_SEED, 0, 0);

  assert.deepEqual(repeated, first);
  assert.equal(first.stats.cells, CLOUD_CONFIG.maxCells);
  assert.ok(first.stats.activeCells > 0, "default view should have active cloud cells");
  assert.ok(first.stats.puffs > 0, "default view should produce visible cloud puffs");
  assert.ok(first.stats.puffs <= CLOUD_CONFIG.maxPuffs);
  assert.ok(
    first.puffs.some((puff) => puff.z < -120 && Math.abs(puff.x) < 420 && puff.y >= 110 && puff.y <= 170),
    "at least one deterministic cloud cluster should sit in the ordinary forward view volume",
  );
});

test("cloud generation is seed-sensitive and uses large deterministic cells", () => {
  const first = generateCloudCell(WORLD_SEED, -1, -1);
  const otherSeed = generateCloudCell("softskies-other-cloud-seed", -1, -1);
  const entries = listCloudCellEntries({ x: 10, z: -4 }, CLOUD_CONFIG);

  assert.notDeepEqual(otherSeed, first);
  assert.equal(entries.length, CLOUD_CONFIG.maxCells);
  assert.equal(entries[0].key, "10,-4");
  assert.ok(entries.every((entry) => Number.isInteger(entry.x) && Number.isInteger(entry.z)));
});

test("day-night phase advances at half speed", () => {
  assert.equal(ATMOSPHERE_CONFIG.timeScale, 0.5);
});
