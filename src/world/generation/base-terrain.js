import { WORLD_SEED } from "../../config/game.js";
import { clamp, fbm2, normalizeSeed, ridgedFbm2, smoothstep } from "./noise.js";

export function sampleBaseTerrain(seed = WORLD_SEED, worldX = 0, worldZ = 0) {
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

  const height = 3.5
    + plains * 10
    + terrace * 6
    + massif * (34 + ridges * 56);

  const slopeProxy = clamp(ridges * massif + Math.abs(smallHills) * 0.35);

  return {
    height,
    plains,
    smallHills,
    mountainField,
    ridges,
    mountain: massif,
    slopeProxy,
  };
}

export function sampleBaseTerrainGrade(seed = WORLD_SEED, worldX = 0, worldZ = 0, step = 16) {
  const east = sampleBaseTerrain(seed, worldX + step, worldZ).height;
  const west = sampleBaseTerrain(seed, worldX - step, worldZ).height;
  const south = sampleBaseTerrain(seed, worldX, worldZ + step).height;
  const north = sampleBaseTerrain(seed, worldX, worldZ - step).height;
  const dx = (east - west) / (step * 2);
  const dz = (south - north) / (step * 2);
  return Math.hypot(dx, dz);
}
