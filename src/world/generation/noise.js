const UINT32_MAX = 4_294_967_295;

export function hashStringToUint32(value) {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function normalizeSeed(seed) {
  return typeof seed === "number" ? seed >>> 0 : hashStringToUint32(seed);
}

export function hash2(seed, x, z) {
  let hash = normalizeSeed(seed);
  hash ^= Math.imul(x | 0, 0x9e3779b1);
  hash ^= Math.imul(z | 0, 0x85ebca77);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / UINT32_MAX;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function valueNoise2(seed, x, z, frequency = 1) {
  const sampleX = x * frequency;
  const sampleZ = z * frequency;
  const x0 = Math.floor(sampleX);
  const z0 = Math.floor(sampleZ);
  const xT = smoothstep(0, 1, sampleX - x0);
  const zT = smoothstep(0, 1, sampleZ - z0);

  const v00 = hash2(seed, x0, z0);
  const v10 = hash2(seed, x0 + 1, z0);
  const v01 = hash2(seed, x0, z0 + 1);
  const v11 = hash2(seed, x0 + 1, z0 + 1);

  return lerp(lerp(v00, v10, xT), lerp(v01, v11, xT), zT);
}

export function fbm2(seed, x, z, {
  frequency = 0.01,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
} = {}) {
  let amplitude = 1;
  let totalAmplitude = 0;
  let value = 0;
  let currentFrequency = frequency;

  for (let octave = 0; octave < octaves; octave += 1) {
    const octaveSeed = (normalizeSeed(seed) + Math.imul(octave + 1, 0x9e3779b9)) >>> 0;
    value += (valueNoise2(octaveSeed, x, z, currentFrequency) * 2 - 1) * amplitude;
    totalAmplitude += amplitude;
    amplitude *= gain;
    currentFrequency *= lacunarity;
  }

  return totalAmplitude === 0 ? 0 : value / totalAmplitude;
}

export function ridgedFbm2(seed, x, z, options = {}) {
  const normalized = fbm2(seed, x, z, options) * 0.5 + 0.5;
  return 1 - Math.abs(normalized * 2 - 1);
}
