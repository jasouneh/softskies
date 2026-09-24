import { clamp, lerp, smoothstep } from "../world/generation/noise.js";

const TAU = Math.PI * 2;
const SUN_PHASE_OFFSET = -0.25;

export const DAY_NIGHT_PALETTE = Object.freeze([
  { t: 0, sky: 0x050b18, fog: 0x071326, hemi: 0x0b1830, ground: 0x111827 },
  { t: 0.2, sky: 0x07172f, fog: 0x102340, hemi: 0x14264a, ground: 0x171c2c },
  { t: 0.25, sky: 0xd77458, fog: 0xd69c74, hemi: 0xd29b7e, ground: 0x37463f },
  { t: 0.3, sky: 0x72d8ff, fog: 0xc8f3ff, hemi: 0xdff7ff, ground: 0x6ab464 },
  { t: 0.7, sky: 0x65cfff, fog: 0xc6f0ff, hemi: 0xe4f8ff, ground: 0x70bf68 },
  { t: 0.75, sky: 0xd86f55, fog: 0xe09a70, hemi: 0xd5997c, ground: 0x3b4748 },
  { t: 0.8, sky: 0x07172f, fog: 0x102340, hemi: 0x14264a, ground: 0x171c2c },
  { t: 1, sky: 0x050b18, fog: 0x071326, hemi: 0x0b1830, ground: 0x111827 },
]);

export function normalizePhase(phase) {
  return ((phase % 1) + 1) % 1;
}

export function advanceAtmospherePhase(elapsed, config) {
  const timeScale = config.timeScale ?? 1;
  return normalizePhase(config.startPhase + (elapsed * timeScale) / config.dayLengthSeconds);
}

export function sampleSunCycle(phase) {
  const wrapped = normalizePhase(phase);
  const angle = (wrapped + SUN_PHASE_OFFSET) * TAU;
  const sunY = Math.sin(angle);
  const sunZ = Math.cos(angle);
  const dayFactor = smoothstep(-0.22, 0.22, sunY);
  const nightFactor = 1 - dayFactor;
  const starFactor = smoothstep(0.62, 0.9, nightFactor);

  return {
    phase: wrapped,
    angle,
    sunY,
    sunZ,
    dayFactor,
    nightFactor,
    starFactor,
  };
}

export function sampleAtmospherePalette(phase) {
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
  return {
    sky: lerpHexColor(lower.sky, upper.sky, t),
    fog: lerpHexColor(lower.fog, upper.fog, t),
    hemi: lerpHexColor(lower.hemi, upper.hemi, t),
    ground: lerpHexColor(lower.ground, upper.ground, t),
  };
}

export function hexChannel(hex, channel) {
  const shift = channel === "r" ? 16 : channel === "g" ? 8 : 0;
  return (hex >> shift) & 0xff;
}

function lerpHexColor(from, to, t) {
  const amount = clamp(t);
  const r = Math.round(lerp(hexChannel(from, "r"), hexChannel(to, "r"), amount));
  const g = Math.round(lerp(hexChannel(from, "g"), hexChannel(to, "g"), amount));
  const b = Math.round(lerp(hexChannel(from, "b"), hexChannel(to, "b"), amount));
  return (r << 16) | (g << 8) | b;
}
