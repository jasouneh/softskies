export const WORLD_SEED = "polyfly-v1-launch";

export const WORLD_CONFIG = Object.freeze({
  chunkSize: 192,
  chunkSegments: 32,
  activeRadius: 2,
  preloadRadius: 3,
  maxChunks: 49,
  chunksPerUpdate: 2,
});

export const MATERIAL_IDS = Object.freeze({
  river: 0,
  meadow: 1,
  grass: 2,
  rock: 3,
  snow: 4,
  sand: 5,
});

export const MATERIAL_NAMES = Object.freeze([
  "river",
  "meadow",
  "grass",
  "rock",
  "snow",
  "sand",
]);

export const FLIGHT_CONFIG = Object.freeze({
  startAltitude: 86,
  minTerrainClearance: 24,
  baseSpeed: 30,
  boostSpeed: 50,
  acceleration: 2.1,
  pitchRate: 0.98,
  yawRate: 0.98,
  bankYawRate: 0.43,
  maxPitch: 0.58,
  minPitch: -0.62,
  maxRoll: 0.82,
  rollResponsiveness: 4.4,
  autoLevel: 1.7,
});

export const CAMERA_CONFIG = Object.freeze({
  chaseDistance: 24,
  chaseHeight: 9,
  lookAhead: 30,
  smoothing: 5.8,
  lookSmoothing: 7.5,
  baseFov: 62,
  boostFov: 70,
});

export const ATMOSPHERE_CONFIG = Object.freeze({
  dayLengthSeconds: 180,
  timeScale: 0.5,
  startPhase: 0.34,
});

export const CLOUD_CONFIG = Object.freeze({
  cellSize: 520,
  cellRadius: 2,
  maxCells: 25,
  density: 0.72,
  altitude: 138,
  altitudeJitter: 24,
  verticalSpread: 12,
  clusterRadius: 90,
  minPuffsPerCell: 3,
  maxPuffsPerCell: 6,
  maxPuffs: 144,
  minPuffRadiusX: 18,
  maxPuffRadiusX: 42,
  minPuffRadiusY: 7,
  maxPuffRadiusY: 16,
  minPuffRadiusZ: 15,
  maxPuffRadiusZ: 34,
  driftSpeed: 1.6,
  driftDirection: 0.62,
  opacity: 0.86,
});
