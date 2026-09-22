import { WORLD_CONFIG } from "../config/game.js";

export function chunkCoordsForWorld(position, chunkSize = WORLD_CONFIG.chunkSize) {
  return {
    x: Math.floor(position.x / chunkSize),
    z: Math.floor(position.z / chunkSize),
  };
}

export function chunkKey(chunkX, chunkZ) {
  return `${chunkX},${chunkZ}`;
}

export function parseChunkKey(key) {
  const [x, z] = String(key).split(",").map((part) => Number.parseInt(part, 10));
  return { x, z };
}

export class ChunkCoordinator {
  constructor({
    chunkSize = WORLD_CONFIG.chunkSize,
    preloadRadius = WORLD_CONFIG.preloadRadius,
    maxChunks = WORLD_CONFIG.maxChunks,
    chunksPerUpdate = WORLD_CONFIG.chunksPerUpdate,
    createChunk = ({ key }) => ({ key }),
    disposeChunk = () => {},
  } = {}) {
    this.chunkSize = chunkSize;
    this.preloadRadius = preloadRadius;
    this.maxChunks = maxChunks;
    this.chunksPerUpdate = chunksPerUpdate;
    this.createChunk = createChunk;
    this.disposeChunk = disposeChunk;
    this.loaded = new Map();
    this.queue = [];
    this.tick = 0;
    this.totalCreated = 0;
    this.totalDisposed = 0;
    this.lastCenter = { x: 0, z: 0 };
  }

  update(position) {
    this.tick += 1;
    const center = chunkCoordsForWorld(position, this.chunkSize);
    this.lastCenter = center;
    const desiredEntries = collectDesiredEntries(center, this.preloadRadius);
    const desired = new Set(desiredEntries.map((entry) => entry.key));
    const disposed = [];
    const created = [];

    for (const key of [...this.loaded.keys()]) {
      const record = this.loaded.get(key);
      if (!record) {
        continue;
      }
      if (desired.has(key)) {
        record.lastTouched = this.tick;
      } else {
        disposed.push(this.unload(key, "outside-radius"));
      }
    }

    const queued = new Map(this.queue.map((entry) => [entry.key, entry]));
    for (const entry of desiredEntries) {
      if (!this.loaded.has(entry.key) && !queued.has(entry.key)) {
        queued.set(entry.key, entry);
      }
    }
    this.queue = [...queued.values()]
      .filter((entry) => desired.has(entry.key) && !this.loaded.has(entry.key))
      .sort((a, b) => a.distanceSq - b.distanceSq || a.key.localeCompare(b.key));

    while (created.length < this.chunksPerUpdate && this.queue.length > 0) {
      const entry = this.queue.shift();
      if (!desired.has(entry.key) || this.loaded.has(entry.key)) {
        continue;
      }
      while (this.loaded.size >= this.maxChunks) {
        const evicted = this.evictOne(center, desired);
        if (!evicted) {
          break;
        }
        disposed.push(evicted);
      }
      if (this.loaded.size >= this.maxChunks) {
        break;
      }

      const chunk = this.createChunk({
        key: entry.key,
        chunkX: entry.x,
        chunkZ: entry.z,
        center,
      });
      const record = {
        key: entry.key,
        chunkX: entry.x,
        chunkZ: entry.z,
        chunk,
        lastTouched: this.tick,
        createdAt: this.tick,
      };
      this.loaded.set(entry.key, record);
      this.totalCreated += 1;
      created.push(record);
    }

    while (this.loaded.size > this.maxChunks) {
      const evicted = this.evictOne(center, desired);
      if (!evicted) {
        break;
      }
      disposed.push(evicted);
    }

    return {
      center,
      centerKey: chunkKey(center.x, center.z),
      desiredCount: desired.size,
      loadedCount: this.loaded.size,
      queuedCount: this.queue.length,
      created,
      disposed: disposed.filter(Boolean),
      loadedKeys: [...this.loaded.keys()].sort(),
      queuedKeys: this.queue.map((entry) => entry.key),
    };
  }

  evictOne(center, desired = new Set()) {
    let candidate = null;
    let candidateScore = -Infinity;

    for (const record of this.loaded.values()) {
      const isDesired = desired.has(record.key);
      const distanceSq = squaredDistance(record.chunkX, record.chunkZ, center.x, center.z);
      const score = (isDesired ? 0 : 1_000_000) + distanceSq * 1_000 - record.lastTouched;
      if (score > candidateScore) {
        candidate = record;
        candidateScore = score;
      }
    }

    if (!candidate) {
      return null;
    }
    return this.unload(candidate.key, "capacity");
  }

  unload(key, reason = "manual") {
    const record = this.loaded.get(key);
    if (!record) {
      return null;
    }
    this.loaded.delete(key);
    this.totalDisposed += 1;
    this.disposeChunk(record.chunk, { ...record, reason });
    return { ...record, reason };
  }

  disposeAll(reason = "dispose-all") {
    const disposed = [];
    for (const key of [...this.loaded.keys()]) {
      disposed.push(this.unload(key, reason));
    }
    this.queue = [];
    return disposed.filter(Boolean);
  }

  getStats() {
    return {
      loadedCount: this.loaded.size,
      queuedCount: this.queue.length,
      maxChunks: this.maxChunks,
      totalCreated: this.totalCreated,
      totalDisposed: this.totalDisposed,
      centerKey: chunkKey(this.lastCenter.x, this.lastCenter.z),
    };
  }
}

function collectDesiredEntries(center, radius) {
  const entries = [];
  for (let dz = -radius; dz <= radius; dz += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = center.x + dx;
      const z = center.z + dz;
      entries.push({
        x,
        z,
        key: chunkKey(x, z),
        distanceSq: dx * dx + dz * dz,
      });
    }
  }
  return entries.sort((a, b) => a.distanceSq - b.distanceSq || a.key.localeCompare(b.key));
}

function squaredDistance(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}
