import { WORLD_SEED } from "../../config/game.js";
import { clamp, fbm2, normalizeSeed, ridgedFbm2, smoothstep } from "./noise.js";

export function sampleBaseTerrain(seed = WORLD_SEED, worldX = 0, worldZ = 0, { profile = "highlands" } = {}) {
  const seedHash = normalizeSeed(seed);
  if (profile === "sunspice-wilds") {
    return sampleSunspiceBaseTerrain(seedHash, worldX, worldZ);
  }
  if (profile === "jade-provinces") {
    return sampleJadeBaseTerrain(seedHash, worldX, worldZ);
  }
  return sampleHighlandsBaseTerrain(seedHash, worldX, worldZ);
}

function sampleHighlandsBaseTerrain(seedHash, worldX, worldZ) {
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

function sampleSunspiceBaseTerrain(seedHash, worldX, worldZ) {
  const plains = fbm2(seedHash ^ 0x50f75eed, worldX, worldZ, {
    frequency: 0.0021,
    octaves: 4,
    gain: 0.54,
  });
  const smallHills = fbm2(seedHash ^ 0x61a77e55, worldX, worldZ, {
    frequency: 0.0085,
    octaves: 4,
    gain: 0.5,
  });
  const ridges = ridgedFbm2(seedHash ^ 0xd35e27, worldX, worldZ, {
    frequency: 0.0058,
    octaves: 4,
    gain: 0.52,
  });
  const duneRidges = ridgedFbm2(seedHash ^ 0xde5e270b, worldX, worldZ, {
    frequency: 0.0095,
    octaves: 3,
    gain: 0.48,
  });
  const heat = fbm2(seedHash ^ 0x5a2d5ea, worldX, worldZ, {
    frequency: 0.00105,
    octaves: 3,
    gain: 0.58,
  });
  const moisture = fbm2(seedHash ^ 0xdecafbad, worldX, worldZ, {
    frequency: 0.00122,
    octaves: 4,
    gain: 0.55,
  });
  const dryness = heat * 0.62 - moisture * 0.78 + fbm2(seedHash ^ 0xa115a11d, worldX, worldZ, {
    frequency: 0.0024,
    octaves: 2,
    gain: 0.5,
  }) * 0.28;
  const desert = smoothstep(0.05, 0.42, dryness);
  const rainforest = (1 - desert) * smoothstep(0.12, 0.52, moisture - heat * 0.18);
  const jungle = (1 - desert) * (1 - rainforest);
  const hillMask = smoothstep(-0.22, 0.54, plains + ridges * 0.48 + desert * 0.28);
  const desertHills = desert * (duneRidges * 19 + hillMask * (16 + ridges * 28));
  const jungleHills = jungle * hillMask * (8 + ridges * 13);
  const rainforestHills = rainforest * smoothstep(-0.2, 0.5, plains + ridges * 0.28) * (10 + ridges * 17);
  const terrace = Math.floor((smallHills * 0.5 + 0.5) * 6) / 6;
  const height = 2.8
    + plains * 8
    + terrace * 4.8
    + desertHills
    + jungleHills
    + rainforestHills;
  const mountain = clamp(hillMask * (0.2 + desert * 0.58 + rainforest * 0.28 + jungle * 0.22));
  const slopeProxy = clamp(ridges * (0.28 + desert * 0.48 + rainforest * 0.34) + Math.abs(smallHills) * 0.38 + duneRidges * desert * 0.34);
  const biome = desert > 0.62 ? "desert" : rainforest > 0.48 ? "rainforest" : "jungle";

  return {
    height,
    plains,
    smallHills,
    mountainField: heat * 0.5 + 0.5,
    ridges,
    duneRidges,
    mountain,
    slopeProxy,
    heat,
    moisture,
    desert,
    rainforest,
    jungle,
    biome,
  };
}

function sampleJadeBaseTerrain(seedHash, worldX, worldZ) {
  const plains = fbm2(seedHash ^ 0x6a6de, worldX, worldZ, {
    frequency: 0.0019,
    octaves: 4,
    gain: 0.54,
  });
  const smallHills = fbm2(seedHash ^ 0x516675, worldX, worldZ, {
    frequency: 0.0072,
    octaves: 4,
    gain: 0.5,
  });
  const ridges = ridgedFbm2(seedHash ^ 0x5e1f, worldX, worldZ, {
    frequency: 0.0049,
    octaves: 5,
    gain: 0.53,
  });
  const pillarRidges = ridgedFbm2(seedHash ^ 0x5109e, worldX, worldZ, {
    frequency: 0.0105,
    octaves: 4,
    gain: 0.48,
  });
  const frost = fbm2(seedHash ^ 0x50a9, worldX, worldZ, {
    frequency: 0.00125,
    octaves: 4,
    gain: 0.56,
  });
  const forestField = fbm2(seedHash ^ 0xf0e57, worldX, worldZ, {
    frequency: 0.0022,
    octaves: 3,
    gain: 0.5,
  });
  const stoneField = fbm2(seedHash ^ 0x5707e, worldX, worldZ, {
    frequency: 0.00155,
    octaves: 4,
    gain: 0.58,
  });
  const snowMask = smoothstep(0.18, 0.62, frost + ridges * 0.4 + plains * 0.18);
  const stoneForest = (1 - snowMask * 0.42) * smoothstep(0.08, 0.48, stoneField + pillarRidges * 0.34 - forestField * 0.12);
  const forest = (1 - snowMask) * (1 - stoneForest * 0.55) * smoothstep(-0.2, 0.44, forestField + plains * 0.16);
  const plainsBiome = Math.max(0, 1 - Math.max(snowMask, stoneForest, forest * 0.78));
  const hillMask = smoothstep(-0.2, 0.56, plains + ridges * 0.35);
  const stoneNeedles = Math.pow(pillarRidges, 2.1) * stoneForest;
  const mountainHeight = snowMask * (34 + ridges * 66 + hillMask * 18);
  const stoneHeight = stoneForest * (10 + ridges * 24 + stoneNeedles * 74);
  const forestHeight = forest * (5 + hillMask * 12 + ridges * 8);
  const terrace = Math.floor((smallHills * 0.5 + 0.5) * 5) / 5;
  const height = 3.2
    + plains * 7.4
    + terrace * 4.2
    + mountainHeight
    + stoneHeight
    + forestHeight;
  const mountain = clamp(snowMask * 0.88 + stoneForest * (0.34 + pillarRidges * 0.44) + hillMask * 0.22);
  const slopeProxy = clamp(ridges * (0.3 + snowMask * 0.54 + stoneForest * 0.46) + Math.abs(smallHills) * 0.36 + pillarRidges * stoneForest * 0.42);
  const biome = snowMask > 0.58
    ? "snowy-mountain"
    : stoneForest > 0.56
      ? "stone-forest"
      : forest > 0.46
        ? "forest"
        : "plains";

  return {
    height,
    plains,
    smallHills,
    mountainField: frost * 0.5 + 0.5,
    ridges,
    pillarRidges,
    mountain,
    slopeProxy,
    frost,
    forestField,
    stoneField,
    snowMask,
    stoneForest,
    forest,
    plainsBiome,
    biome,
  };
}

export function sampleBaseTerrainGrade(seed = WORLD_SEED, worldX = 0, worldZ = 0, step = 16, options = {}) {
  const east = sampleBaseTerrain(seed, worldX + step, worldZ, options).height;
  const west = sampleBaseTerrain(seed, worldX - step, worldZ, options).height;
  const south = sampleBaseTerrain(seed, worldX, worldZ + step, options).height;
  const north = sampleBaseTerrain(seed, worldX, worldZ - step, options).height;
  const dx = (east - west) / (step * 2);
  const dz = (south - north) / (step * 2);
  return Math.hypot(dx, dz);
}
