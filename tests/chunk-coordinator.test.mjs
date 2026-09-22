import assert from "node:assert/strict";
import test from "node:test";

import { ChunkCoordinator, chunkCoordsForWorld, chunkKey, parseChunkKey } from "../src/world/chunk-coordinator.js";

test("chunk coordinate helpers use floor semantics across the origin", () => {
  assert.deepEqual(chunkCoordsForWorld({ x: 0, z: 0 }, 192), { x: 0, z: 0 });
  assert.deepEqual(chunkCoordsForWorld({ x: 191.9, z: -0.1 }, 192), { x: 0, z: -1 });
  assert.equal(chunkKey(-2, 5), "-2,5");
  assert.deepEqual(parseChunkKey("-2,5"), { x: -2, z: 5 });
});

test("streaming respects max chunk and per-update generation budgets", () => {
  const created = [];
  const disposed = [];
  const coordinator = new ChunkCoordinator({
    chunkSize: 100,
    preloadRadius: 2,
    maxChunks: 5,
    chunksPerUpdate: 2,
    createChunk({ key }) {
      created.push(key);
      return { key };
    },
    disposeChunk(chunk, record) {
      disposed.push({ key: chunk.key, reason: record.reason });
    },
  });

  for (let index = 0; index < 8; index += 1) {
    const result = coordinator.update({ x: 0, z: 0 });
    assert.ok(result.created.length <= 2);
    assert.ok(result.loadedCount <= 5);
  }

  assert.ok(created.length >= 5);
  assert.ok(coordinator.getStats().loadedCount <= 5);
  assert.ok(disposed.length > 0, "capacity pressure should call disposal hooks");
});

test("moving across the world evicts distant chunks with disposal hooks", () => {
  const disposed = [];
  const coordinator = new ChunkCoordinator({
    chunkSize: 100,
    preloadRadius: 1,
    maxChunks: 9,
    chunksPerUpdate: 9,
    createChunk({ key, chunkX, chunkZ }) {
      return { key, chunkX, chunkZ };
    },
    disposeChunk(chunk, record) {
      disposed.push({ key: chunk.key, reason: record.reason });
    },
  });

  const first = coordinator.update({ x: 0, z: 0 });
  assert.equal(first.loadedCount, 9);
  assert.equal(disposed.length, 0);

  const moved = coordinator.update({ x: 650, z: 0 });
  assert.equal(moved.loadedCount, 9);
  assert.ok(disposed.length >= 6);
  assert.ok(disposed.every((entry) => entry.reason === "outside-radius"));
  assert.ok(moved.loadedKeys.every((key) => Math.abs(parseChunkKey(key).x - 6) <= 1));
});
