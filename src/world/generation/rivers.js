import { WORLD_SEED, WORLD_CONFIG } from "../../config/game.js";
import { sampleBaseTerrain, sampleBaseTerrainGrade } from "./base-terrain.js";
import { clamp, hash2, normalizeSeed, smoothstep, valueNoise2 } from "./noise.js";

const BASIN_SIZE = 560;
const LOOKUP_RADIUS = 2;
const PATH_CACHE_LIMIT = 768;
const RIVER_DENSITY = 0.92;
const START_GRID = 4;
const TARGET_PROBES = 18;
const PATH_STEP = 30;
const MAX_PATH_STEPS = 30;
const MIN_PATH_POINTS = 7;
const MAX_UPHILL_STEP = 2.45;
const MAX_UPHILL_TOTAL = 5.4;
const INFLUENCE_MARGIN = 58;
const EMPTY_PATH = Object.freeze({ active: false, points: [], segments: [], width: 0 });

const pathCache = new Map();

export function sampleRiver(seed = WORLD_SEED, worldX = 0, worldZ = 0) {
  const seedHash = normalizeSeed(seed);
  const basinX = Math.floor(worldX / BASIN_SIZE);
  const basinZ = Math.floor(worldZ / BASIN_SIZE);
  let best = null;

  for (let dz = -LOOKUP_RADIUS; dz <= LOOKUP_RADIUS; dz += 1) {
    for (let dx = -LOOKUP_RADIUS; dx <= LOOKUP_RADIUS; dx += 1) {
      const path = getRiverPath(seedHash, basinX + dx, basinZ + dz);
      if (!path.active || !pointNearBounds(worldX, worldZ, path.bounds, path.width * 3.6)) {
        continue;
      }
      const candidate = nearestPointOnPath(path, worldX, worldZ);
      if (candidate && (!best || candidate.distance < best.distance)) {
        best = candidate;
      }
    }
  }

  if (!best) {
    return emptyRiver(worldX, worldZ);
  }

  const coreStrength = 1 - smoothstep(best.width * 0.35, best.width, best.distance);
  const bankStrength = 1 - smoothstep(best.width * 1.05, best.width * 3.3, best.distance);
  if (coreStrength <= 0 && bankStrength <= 0) {
    return {
      ...best,
      strength: 0,
      bankStrength: 0,
      isRiver: false,
    };
  }

  const base = sampleBaseTerrain(seedHash, worldX, worldZ);
  const grade = best.distance < best.width * 3.2 ? sampleBaseTerrainGrade(seedHash, worldX, worldZ, 18) : 0;
  const localSuitability = riverTerrainSuitability(base, grade);
  const strength = clamp(coreStrength * localSuitability);
  const banks = clamp(bankStrength * localSuitability);

  return {
    ...best,
    strength,
    bankStrength: banks,
    isRiver: strength > 0,
  };
}

export function listChunkRiverInfluences(seed = WORLD_SEED, chunkX = 0, chunkZ = 0, {
  chunkSize = WORLD_CONFIG.chunkSize,
} = {}) {
  const seedHash = normalizeSeed(seed);
  const minX = chunkX * chunkSize;
  const minZ = chunkZ * chunkSize;
  const maxX = minX + chunkSize;
  const maxZ = minZ + chunkSize;
  const reach = BASIN_SIZE * (LOOKUP_RADIUS + 0.5);
  const basinMinX = Math.floor((minX - reach) / BASIN_SIZE);
  const basinMaxX = Math.floor((maxX + reach) / BASIN_SIZE);
  const basinMinZ = Math.floor((minZ - reach) / BASIN_SIZE);
  const basinMaxZ = Math.floor((maxZ + reach) / BASIN_SIZE);
  const chunkBounds = expandBounds({ minX, minZ, maxX, maxZ }, INFLUENCE_MARGIN);
  const influences = [];

  for (let basinZ = basinMinZ; basinZ <= basinMaxZ; basinZ += 1) {
    for (let basinX = basinMinX; basinX <= basinMaxX; basinX += 1) {
      const path = getRiverPath(seedHash, basinX, basinZ);
      if (!path.active || !boundsIntersect(path.bounds, chunkBounds)) {
        continue;
      }
      const segments = path.segments.filter((segment) => boundsIntersect(segment.bounds, chunkBounds));
      if (segments.length === 0) {
        continue;
      }
      influences.push({
        id: path.id,
        basinX,
        basinZ,
        width: Number(path.width.toFixed(3)),
        segmentCount: segments.length,
        minX: Number(Math.max(minX, path.bounds.minX).toFixed(3)),
        minZ: Number(Math.max(minZ, path.bounds.minZ).toFixed(3)),
        maxX: Number(Math.min(maxX, path.bounds.maxX).toFixed(3)),
        maxZ: Number(Math.min(maxZ, path.bounds.maxZ).toFixed(3)),
      });
    }
  }

  return influences.sort((a, b) => a.id.localeCompare(b.id));
}

export function clearRiverPathCache() {
  pathCache.clear();
}

function getRiverPath(seedHash, basinX, basinZ) {
  const key = `${seedHash}:${basinX},${basinZ}`;
  if (pathCache.has(key)) {
    const cached = pathCache.get(key);
    pathCache.delete(key);
    pathCache.set(key, cached);
    return cached;
  }

  const path = buildRiverPath(seedHash, basinX, basinZ);
  pathCache.set(key, path);
  if (pathCache.size > PATH_CACHE_LIMIT) {
    pathCache.delete(pathCache.keys().next().value);
  }
  return path;
}

function buildRiverPath(seedHash, basinX, basinZ) {
  if (hash2(seedHash ^ 0x4d15ea5e, basinX, basinZ) > RIVER_DENSITY) {
    return EMPTY_PATH;
  }

  const start = pickRiverStart(seedHash, basinX, basinZ);
  if (!start) {
    return EMPTY_PATH;
  }

  const width = 8.5 + hash2(seedHash ^ 0x51ed270b, basinX, basinZ) * 7.5;
  const downstream = pickDownstreamTarget(seedHash, basinX, basinZ, start);
  const points = [start];
  let heading = downstream.heading;
  let current = start;
  let climbTotal = 0;

  for (let step = 0; step < MAX_PATH_STEPS; step += 1) {
    const next = pickNextPoint(seedHash, basinX, basinZ, step, current, heading, downstream, points);
    if (!next) {
      break;
    }

    if (next.climb > 0) {
      climbTotal += next.climb;
    } else {
      climbTotal = Math.max(0, climbTotal + next.climb * 0.45);
    }
    if (climbTotal > MAX_UPHILL_TOTAL) {
      break;
    }

    points.push(next.point);
    heading = next.angle;
    current = next.point;
  }

  if (points.length < MIN_PATH_POINTS) {
    return EMPTY_PATH;
  }

  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq <= 0.001) {
      continue;
    }
    segments.push({
      a,
      b,
      dx,
      dz,
      lengthSq,
      bounds: {
        minX: Math.min(a.x, b.x) - width * 3.6,
        minZ: Math.min(a.z, b.z) - width * 3.6,
        maxX: Math.max(a.x, b.x) + width * 3.6,
        maxZ: Math.max(a.z, b.z) + width * 3.6,
      },
    });
  }

  if (segments.length === 0) {
    return EMPTY_PATH;
  }

  return {
    active: true,
    id: `${basinX},${basinZ}`,
    basinX,
    basinZ,
    width,
    points,
    segments,
    bounds: computePathBounds(points, width),
  };
}

function pickRiverStart(seedHash, basinX, basinZ) {
  const minX = basinX * BASIN_SIZE;
  const minZ = basinZ * BASIN_SIZE;
  const cell = BASIN_SIZE / START_GRID;
  let best = null;

  for (let iz = 0; iz < START_GRID; iz += 1) {
    for (let ix = 0; ix < START_GRID; ix += 1) {
      const probeKeyX = basinX * 37 + ix;
      const probeKeyZ = basinZ * 41 + iz;
      const x = minX + (ix + 0.18 + hash2(seedHash ^ 0x81a7c15, probeKeyX, probeKeyZ) * 0.64) * cell;
      const z = minZ + (iz + 0.18 + hash2(seedHash ^ 0x417dbabe, probeKeyX, probeKeyZ) * 0.64) * cell;
      const base = sampleBaseTerrain(seedHash, x, z);
      const grade = sampleBaseTerrainGrade(seedHash, x, z, 22);
      const suitability = riverTerrainSuitability(base, grade);
      if (suitability < 0.22) {
        continue;
      }
      const valley = sampleValleyDepth(seedHash, x, z, 46);
      const heightPenalty = Math.max(0, base.height - 28) * 0.08 + Math.max(0, -8 - base.height) * 0.12;
      const jitter = hash2(seedHash ^ 0xa77e55, probeKeyX, probeKeyZ) * 0.18;
      const score = suitability * 4.4 + clamp(valley / 9, -0.45, 1) * 1.4 - heightPenalty + jitter;
      if (!best || score > best.score) {
        best = { x, z, height: base.height, base, grade, score };
      }
    }
  }

  return best && best.score > 1.08 ? stripScore(best) : null;
}

function pickDownstreamTarget(seedHash, basinX, basinZ, start) {
  const phase = hash2(seedHash ^ 0xd0a711, basinX, basinZ) * Math.PI * 2;
  let best = null;

  for (let index = 0; index < TARGET_PROBES; index += 1) {
    const angle = phase + (index / TARGET_PROBES) * Math.PI * 2;
    const radiusJitter = hash2(seedHash ^ 0x71c0ffee, basinX * 53 + index, basinZ * 59);
    const radius = BASIN_SIZE * (0.62 + (index % 3) * 0.34 + radiusJitter * 0.2);
    const x = start.x + Math.cos(angle) * radius;
    const z = start.z + Math.sin(angle) * radius;
    const base = sampleBaseTerrain(seedHash, x, z);
    if (base.height > start.height + 9 || base.mountain > 0.36 || base.slopeProxy > 0.58) {
      continue;
    }
    const suitability = riverTerrainSuitability(base, 0);
    const drop = start.height - base.height;
    const valley = sampleValleyDepth(seedHash, x, z, 54);
    const score = suitability * 2.4 + drop * 0.16 + clamp(valley / 10, -0.4, 1) * 0.9 - Math.max(0, -drop) * 0.42;
    if (!best || score > best.score) {
      best = { x, z, angle, score };
    }
  }

  if (!best) {
    return {
      x: start.x + Math.cos(phase) * BASIN_SIZE,
      z: start.z + Math.sin(phase) * BASIN_SIZE,
      heading: phase,
    };
  }

  return {
    x: best.x,
    z: best.z,
    heading: Math.atan2(best.z - start.z, best.x - start.x),
  };
}

function pickNextPoint(seedHash, basinX, basinZ, step, current, heading, downstream, points) {
  const turnOptions = [-0.9, -0.62, -0.36, -0.16, 0, 0.16, 0.36, 0.62, 0.9];
  let best = null;

  for (let index = 0; index < turnOptions.length; index += 1) {
    const turn = turnOptions[index];
    const wobble = (hash2(seedHash ^ 0x5eaf10, basinX * 101 + step, basinZ * 103 + index) - 0.5) * 0.1;
    const angle = heading + turn + wobble;
    const stride = PATH_STEP * (0.88 + hash2(seedHash ^ 0x5c0ffee, basinX * 127 + step, basinZ * 131 + index) * 0.24);
    const x = current.x + Math.cos(angle) * stride;
    const z = current.z + Math.sin(angle) * stride;
    const base = sampleBaseTerrain(seedHash, x, z);
    if (base.height > 50 || base.mountain > 0.4 || base.slopeProxy > 0.62) {
      continue;
    }
    const grade = sampleBaseTerrainGrade(seedHash, x, z, 18);
    const suitability = riverTerrainSuitability(base, grade);
    if (suitability < 0.14) {
      continue;
    }
    const climb = base.height - current.height;
    if (climb > MAX_UPHILL_STEP) {
      continue;
    }
    const valley = sampleValleyDepth(seedHash, x, z, 42);
    const targetHeading = Math.atan2(downstream.z - current.z, downstream.x - current.x);
    const targetAlignment = Math.cos(wrapAngle(angle - targetHeading));
    const meander = valueNoise2(seedHash ^ 0x6d1e5, x, z, 0.006) - 0.5;
    const selfAvoidance = points.some((point, pointIndex) => pointIndex < points.length - 3 && squaredDistance(x, z, point.x, point.z) < PATH_STEP * PATH_STEP * 0.7) ? 12 : 0;
    const score = base.height * 0.18
      + Math.max(0, climb) * 5.8
      + Math.abs(turn) * 2.1
      + (1 - suitability) * 7.5
      - Math.max(0, -climb) * 0.34
      - clamp(valley / 9, -0.4, 1.1) * 1.7
      - targetAlignment * 1.0
      + meander * 0.5
      + selfAvoidance;

    if (!best || score < best.score) {
      best = {
        score,
        climb,
        angle,
        point: { x, z, height: base.height, base, grade },
      };
    }
  }

  return best;
}

function nearestPointOnPath(path, worldX, worldZ) {
  let best = null;
  for (let index = 0; index < path.segments.length; index += 1) {
    const segment = path.segments[index];
    if (!pointNearBounds(worldX, worldZ, segment.bounds, 0)) {
      continue;
    }
    const wx = worldX - segment.a.x;
    const wz = worldZ - segment.a.z;
    const t = clamp((wx * segment.dx + wz * segment.dz) / segment.lengthSq);
    const centerX = segment.a.x + segment.dx * t;
    const centerZ = segment.a.z + segment.dz * t;
    const dist = Math.hypot(worldX - centerX, worldZ - centerZ);
    if (!best || dist < best.distance) {
      const direction = Math.abs(segment.dx) >= Math.abs(segment.dz) ? "east-west" : "north-south";
      best = {
        riverId: path.id,
        basinX: path.basinX,
        basinZ: path.basinZ,
        segmentIndex: index,
        direction,
        distance: dist,
        width: path.width,
        centerX,
        centerZ,
      };
    }
  }
  return best;
}

function emptyRiver(worldX, worldZ) {
  return {
    riverId: null,
    basinX: null,
    basinZ: null,
    segmentIndex: null,
    direction: "none",
    distance: Infinity,
    width: 0,
    centerX: worldX,
    centerZ: worldZ,
    strength: 0,
    bankStrength: 0,
    isRiver: false,
  };
}

function riverTerrainSuitability(base, grade = 0) {
  const slope = Math.max(base.slopeProxy, clamp(grade / 0.9));
  const mountainGate = 1 - smoothstep(0.18, 0.36, base.mountain);
  const heightGate = 1 - smoothstep(34, 50, base.height);
  const slopeGate = 1 - smoothstep(0.36, 0.64, slope);
  return clamp(mountainGate * heightGate * slopeGate);
}

function sampleValleyDepth(seedHash, x, z, radius) {
  const center = sampleBaseTerrain(seedHash, x, z).height;
  const neighborAverage = (
    sampleBaseTerrain(seedHash, x + radius, z).height
    + sampleBaseTerrain(seedHash, x - radius, z).height
    + sampleBaseTerrain(seedHash, x, z + radius).height
    + sampleBaseTerrain(seedHash, x, z - radius).height
  ) / 4;
  return neighborAverage - center;
}

function computePathBounds(points, width) {
  const padding = width * 3.6;
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minZ = Math.min(minZ, point.z);
    maxX = Math.max(maxX, point.x);
    maxZ = Math.max(maxZ, point.z);
  }
  return { minX: minX - padding, minZ: minZ - padding, maxX: maxX + padding, maxZ: maxZ + padding };
}

function stripScore(point) {
  return { x: point.x, z: point.z, height: point.height, base: point.base, grade: point.grade };
}

function expandBounds(bounds, amount) {
  return {
    minX: bounds.minX - amount,
    minZ: bounds.minZ - amount,
    maxX: bounds.maxX + amount,
    maxZ: bounds.maxZ + amount,
  };
}

function boundsIntersect(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

function pointNearBounds(x, z, bounds, padding) {
  return x >= bounds.minX - padding && x <= bounds.maxX + padding && z >= bounds.minZ - padding && z <= bounds.maxZ + padding;
}

function squaredDistance(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

function wrapAngle(angle) {
  let wrapped = angle;
  while (wrapped <= -Math.PI) {
    wrapped += Math.PI * 2;
  }
  while (wrapped > Math.PI) {
    wrapped -= Math.PI * 2;
  }
  return wrapped;
}
