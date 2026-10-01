import { clamp, hash2, lerp, normalizeSeed, smoothstep } from "../world/generation/noise.js";

const TAU = Math.PI * 2;
const SUN_PHASE_OFFSET = -0.25;
const DEFAULT_DAY_LENGTH_SECONDS = 180;
const DEFAULT_TIME_SCALE = 0.5;
const DEFAULT_DAWN_DURATION_SECONDS = 60;
const DEFAULT_DUSK_DURATION_SECONDS = 60;
const DEFAULT_TWILIGHT_SEED = "softskies-sunrise-sunset-v1";

export const DAY_NIGHT_PALETTE = Object.freeze([
  { t: 0, sky: 0x050b18, fog: 0x071326, hemi: 0x0b1830, ground: 0x111827 },
  { t: 1 / 6, sky: 0x141335, fog: 0x181f43, hemi: 0x20214d, ground: 0x17182c },
  { t: 0.25, sky: 0xe077c5, fog: 0xd997ca, hemi: 0xd489d0, ground: 0x414159 },
  { t: 1 / 3, sky: 0x80d8ff, fog: 0xcaf2ff, hemi: 0xe0f7ff, ground: 0x6ab464 },
  { t: 2 / 3, sky: 0x6fd4ff, fog: 0xc8f0ff, hemi: 0xe4f8ff, ground: 0x70bf68 },
  { t: 0.75, sky: 0xd971d3, fog: 0xd69ad8, hemi: 0xcf88d6, ground: 0x45435f },
  { t: 5 / 6, sky: 0x121333, fog: 0x182142, hemi: 0x1e2149, ground: 0x17182c },
  { t: 1, sky: 0x050b18, fog: 0x071326, hemi: 0x0b1830, ground: 0x111827 },
]);

export function normalizePhase(phase) {
  return ((phase % 1) + 1) % 1;
}

export function advanceAtmospherePhase(elapsed, config = {}) {
  const timeScale = config.timeScale ?? DEFAULT_TIME_SCALE;
  const dayLengthSeconds = config.dayLengthSeconds ?? DEFAULT_DAY_LENGTH_SECONDS;
  return normalizePhase((config.startPhase ?? 0) + (elapsed * timeScale) / dayLengthSeconds);
}

export function getAtmospherePhaseDurations(config = {}) {
  const timeScale = Math.max(0.0001, config.timeScale ?? DEFAULT_TIME_SCALE);
  const dayLengthSeconds = config.dayLengthSeconds ?? DEFAULT_DAY_LENGTH_SECONDS;
  const cycleSeconds = config.cycleLengthSeconds ?? (dayLengthSeconds / timeScale);
  const dawnSeconds = Math.min(config.dawnDurationSeconds ?? DEFAULT_DAWN_DURATION_SECONDS, cycleSeconds * 0.45);
  const duskSeconds = Math.min(config.duskDurationSeconds ?? DEFAULT_DUSK_DURATION_SECONDS, cycleSeconds * 0.45);
  const dawnPhase = dawnSeconds / cycleSeconds;
  const duskPhase = duskSeconds / cycleSeconds;
  const dawnStart = 0.25 - dawnPhase / 2;
  const dawnEnd = 0.25 + dawnPhase / 2;
  const duskStart = 0.75 - duskPhase / 2;
  const duskEnd = 0.75 + duskPhase / 2;
  const dayPhase = Math.max(0, duskStart - dawnEnd);
  const nightPhase = Math.max(0, 1 - dawnPhase - dayPhase - duskPhase);

  return {
    cycleSeconds,
    dawnSeconds,
    daySeconds: dayPhase * cycleSeconds,
    duskSeconds,
    nightSeconds: nightPhase * cycleSeconds,
    dawnStart,
    dawnEnd,
    duskStart,
    duskEnd,
  };
}

export function sampleTwilightIntensity(elapsed, config = {}) {
  const timeScale = config.timeScale ?? DEFAULT_TIME_SCALE;
  const dayLengthSeconds = config.dayLengthSeconds ?? DEFAULT_DAY_LENGTH_SECONDS;
  const elapsedTurns = (config.startPhase ?? 0) + (elapsed * timeScale) / dayLengthSeconds;
  const dayIndex = Math.floor(elapsedTurns);
  const seedHash = normalizeSeed(config.twilightSeed ?? DEFAULT_TWILIGHT_SEED);
  return 0.74 + hash2(seedHash, dayIndex, 0x5c2e7) * 0.52;
}

export function sampleSunCycle(phase, config = {}) {
  const wrapped = normalizePhase(phase);
  const timing = getAtmospherePhaseDurations(config);
  const angle = (wrapped + SUN_PHASE_OFFSET) * TAU;
  const sunY = Math.sin(angle);
  const sunZ = Math.cos(angle);
  const dawnProgress = rangeProgress(wrapped, timing.dawnStart, timing.dawnEnd);
  const duskProgress = rangeProgress(wrapped, timing.duskStart, timing.duskEnd);
  const isDawn = dawnProgress >= 0 && dawnProgress <= 1;
  const isDusk = duskProgress >= 0 && duskProgress <= 1;
  const dayFactor = isDawn
    ? smoothstep(0, 1, dawnProgress)
    : isDusk
      ? 1 - smoothstep(0, 1, duskProgress)
      : wrapped > timing.dawnEnd && wrapped < timing.duskStart
        ? 1
        : 0;
  const nightFactor = 1 - dayFactor;
  const dawnFactor = isDawn ? twilightPulse(dawnProgress) : 0;
  const duskFactor = isDusk ? twilightPulse(duskProgress) : 0;
  const twilightFactor = Math.max(dawnFactor, duskFactor);
  const starFactor = smoothstep(0.68, 0.94, nightFactor) * (1 - twilightFactor * 0.22);

  return {
    phase: wrapped,
    angle,
    sunY,
    sunZ,
    dayFactor,
    nightFactor,
    starFactor,
    dawnFactor,
    duskFactor,
    twilightFactor,
  };
}

export function sampleAtmospherePalette(phase, { config = {}, twilightIntensity = 1 } = {}) {
  const wrapped = normalizePhase(phase);
  let lower = DAY_NIGHT_PALETTE[0];
  let upper = DAY_NIGHT_PALETTE[DAY_NIGHT_PALETTE.length - 1];

  for (let index = 0; index < DAY_NIGHT_PALETTE.length - 1; index += 1) {
    if (wrapped >= DAY_NIGHT_PALETTE[index].t && wrapped <= DAY_NIGHT_PALETTE[index + 1].t) {
      lower = DAY_NIGHT_PALETTE[index];
      upper = DAY_NIGHT_PALETTE[index + 1];
      break;
    }
  }

  const t = lower === upper ? 0 : smoothstep(0, 1, (wrapped - lower.t) / (upper.t - lower.t));
  const palette = {
    sky: lerpHexColor(lower.sky, upper.sky, t),
    fog: lerpHexColor(lower.fog, upper.fog, t),
    hemi: lerpHexColor(lower.hemi, upper.hemi, t),
    ground: lerpHexColor(lower.ground, upper.ground, t),
  };
  return applyTwilightTint(palette, sampleSunCycle(wrapped, config), twilightIntensity);
}

export function hexChannel(hex, channel) {
  const shift = channel === "r" ? 16 : channel === "g" ? 8 : 0;
  return (hex >> shift) & 0xff;
}

function rangeProgress(value, start, end) {
  if (value < start || value > end) {
    return -1;
  }
  return (value - start) / Math.max(0.0001, end - start);
}

function twilightPulse(progress) {
  return Math.sin(clamp(progress) * Math.PI);
}

function applyTwilightTint(palette, cycle, twilightIntensity) {
  if (cycle.twilightFactor <= 0) {
    return palette;
  }

  const intensity = clamp(twilightIntensity, 0.7, 1.3);
  const warmPink = lerpHexColor(0xffa0c8, 0xff64c6, clamp((intensity - 0.7) / 0.6));
  const purpleBlue = lerpHexColor(0x786aff, 0x9a70ff, clamp((intensity - 0.7) / 0.6));
  const skyTint = lerpHexColor(purpleBlue, warmPink, cycle.duskFactor > cycle.dawnFactor ? 0.62 : 0.54);
  const fogTint = lerpHexColor(0xb69cff, 0xffb0d7, cycle.duskFactor > cycle.dawnFactor ? 0.58 : 0.48);
  const hemiTint = lerpHexColor(0x9b80ff, 0xff8fd3, 0.56);
  const tintStrength = clamp(cycle.twilightFactor * (0.12 + intensity * 0.18));

  return {
    sky: lerpHexColor(palette.sky, skyTint, tintStrength),
    fog: lerpHexColor(palette.fog, fogTint, tintStrength * 0.74),
    hemi: lerpHexColor(palette.hemi, hemiTint, tintStrength * 0.8),
    ground: lerpHexColor(palette.ground, 0x5b4a78, tintStrength * 0.42),
  };
}

function lerpHexColor(from, to, t) {
  const amount = clamp(t);
  const r = Math.round(lerp(hexChannel(from, "r"), hexChannel(to, "r"), amount));
  const g = Math.round(lerp(hexChannel(from, "g"), hexChannel(to, "g"), amount));
  const b = Math.round(lerp(hexChannel(from, "b"), hexChannel(to, "b"), amount));
  return (r << 16) | (g << 8) | b;
}
