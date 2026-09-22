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
  baseSpeed: 42,
  boostSpeed: 72,
  acceleration: 2.4,
  pitchRate: 1.35,
  yawRate: 1.25,
  bankYawRate: 0.58,
  maxPitch: 0.72,
  minPitch: -0.78,
  maxRoll: 0.95,
  rollResponsiveness: 5.2,
  autoLevel: 1.8,
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
  startPhase: 0.34,
});
