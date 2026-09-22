import { WORLD_SEED, WORLD_CONFIG } from "../../config/game.js";
import { clamp, hash2, normalizeSeed, smoothstep, valueNoise2 } from "./noise.js";

const HORIZONTAL_SPACING = 620;
const VERTICAL_SPACING = 920;

export function sampleRiver(seed = WORLD_SEED, worldX = 0, worldZ = 0) {
  const seedHash = normalizeSeed(seed);
  const horizontal = sampleHorizontalRiver(seedHash, worldX, worldZ);
  const vertical = sampleVerticalRiver(seedHash, worldX, worldZ);
  const best = horizontal.distance <= vertical.distance ? horizontal : vertical;
  const coreStrength = 1 - smoothstep(best.width * 0.28, best.width, best.distance);
  const bankStrength = 1 - smoothstep(best.width * 1.1, best.width * 3.6, best.distance);

  return {
    direction: best.direction,
    distance: best.distance,
    width: best.width,
    centerX: best.centerX,
    centerZ: best.centerZ,
    strength: clamp(coreStrength),
    bankStrength: clamp(bankStrength),
    isRiver: coreStrength > 0,
  };
}

export function listChunkRiverInfluences(seed = WORLD_SEED, chunkX = 0, chunkZ = 0, {
  chunkSize = WORLD_CONFIG.chunkSize,
} = {}) {
  const minX = chunkX * chunkSize;
  const minZ = chunkZ * chunkSize;
  const maxX = minX + chunkSize;
  const maxZ = minZ + chunkSize;
  const probes = [];

  for (let t = 0; t <= 1; t += 0.25) {
    probes.push(sampleRiver(seed, minX + (maxX - minX) * t, minZ));
    probes.push(sampleRiver(seed, minX + (maxX - minX) * t, maxZ));
    probes.push(sampleRiver(seed, minX, minZ + (maxZ - minZ) * t));
    probes.push(sampleRiver(seed, maxX, minZ + (maxZ - minZ) * t));
  }

  return probes
    .filter((probe) => probe.distance < probe.width * 1.75)
    .map((probe) => ({
      direction: probe.direction,
      centerX: Number(probe.centerX.toFixed(3)),
      centerZ: Number(probe.centerZ.toFixed(3)),
      width: Number(probe.width.toFixed(3)),
    }))
    .sort((a, b) => `${a.direction}:${a.centerX}:${a.centerZ}`.localeCompare(`${b.direction}:${b.centerX}:${b.centerZ}`));
}

function sampleHorizontalRiver(seedHash, worldX, worldZ) {
  const band = Math.floor((worldZ + HORIZONTAL_SPACING * 0.5) / HORIZONTAL_SPACING);
  const offset = (hash2(seedHash ^ 0x345a1f2d, band, 11) - 0.5) * HORIZONTAL_SPACING * 0.38;
  const phase = hash2(seedHash ^ 0x913a7f4c, band, 23) * Math.PI * 2;
  const amplitude = 54 + hash2(seedHash ^ 0x639e18a9, band, 37) * 54;
  const frequency = 0.0028 + hash2(seedHash ^ 0xb5c0ffee, band, 41) * 0.0012;
  const secondaryFrequency = frequency * (1.8 + hash2(seedHash ^ 0x91e5ed19, band, 43) * 0.8);
  const centerZ = band * HORIZONTAL_SPACING + offset
    + Math.sin(worldX * frequency + phase) * amplitude
    + Math.sin(worldX * secondaryFrequency + phase * 1.71) * amplitude * 0.36
    + (valueNoise2(seedHash ^ 0x7f4a7c15, worldX, band * 131, 0.0037) - 0.5) * amplitude * 0.9;
  const width = 10 + hash2(seedHash ^ 0x51ed270b, band, 53) * 11;

  return {
    direction: "east-west",
    distance: Math.abs(worldZ - centerZ),
    width,
    centerX: worldX,
    centerZ,
  };
}

function sampleVerticalRiver(seedHash, worldX, worldZ) {
  const band = Math.floor((worldX + VERTICAL_SPACING * 0.5) / VERTICAL_SPACING);
  const offset = (hash2(seedHash ^ 0x19f14ac3, band, 67) - 0.5) * VERTICAL_SPACING * 0.28;
  const phase = hash2(seedHash ^ 0x00c0a57a, band, 71) * Math.PI * 2;
  const amplitude = 42 + hash2(seedHash ^ 0x7ad93b2f, band, 79) * 42;
  const frequency = 0.0026 + hash2(seedHash ^ 0x55aa33cc, band, 83) * 0.0011;
  const secondaryFrequency = frequency * (1.7 + hash2(seedHash ^ 0x2b9d18e1, band, 87) * 0.9);
  const centerX = band * VERTICAL_SPACING + offset
    + Math.sin(worldZ * frequency + phase) * amplitude
    + Math.sin(worldZ * secondaryFrequency + phase * 1.63) * amplitude * 0.32
    + (valueNoise2(seedHash ^ 0x3ca871e5, band * 149, worldZ, 0.0034) - 0.5) * amplitude * 0.8;
  const width = 8 + hash2(seedHash ^ 0x4781d00d, band, 89) * 8;

  return {
    direction: "north-south",
    distance: Math.abs(worldX - centerX),
    width,
    centerX,
    centerZ: worldZ,
  };
}
