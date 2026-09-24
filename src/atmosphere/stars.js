import * as THREE from "../platform/three.js";
import { WORLD_SEED } from "../config/game.js";
import { hash2, lerp, normalizeSeed, smoothstep } from "../world/generation/noise.js";

const TAU = Math.PI * 2;
const STAR_DOME_RADIUS = 640;
const BACKGROUND_STAR_COUNT = 420;
const MILKY_WAY_BAND_STARS = 620;
const MILKY_WAY_SEGMENTS = 144;
const MILKY_WAY_WIDTH_SEGMENTS = 14;
const MILKY_WAY_CORE_LONGITUDE = 0.62;
const MILKY_WAY_CORE_LATITUDE = 0.38;
const GALACTIC_NORMAL = new THREE.Vector3(0.568, -0.458, -0.683).normalize();
const GALACTIC_RIGHT = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), GALACTIC_NORMAL).normalize();
const GALACTIC_UP = new THREE.Vector3().crossVectors(GALACTIC_NORMAL, GALACTIC_RIGHT).normalize();

export function createNightSky(parent, { seed = WORLD_SEED } = {}) {
  const group = new THREE.Group();
  group.name = "subtle procedural Milky Way and night stars";
  group.frustumCulled = false;

  const seedHash = normalizeSeed(`${seed}:night-sky`);
  const milkyWayHaze = createMilkyWayHaze(seedHash);
  const starField = createStarField(seedHash);

  group.add(milkyWayHaze, starField.points);
  parent.add(group);
  setVisibility(0);

  function setVisibility(nightFactor = 0) {
    const visibility = smoothstep(0.54, 0.82, nightFactor);
    group.visible = visibility > 0.01;
    starField.material.opacity = 0.72 * visibility;
    milkyWayHaze.material.uniforms.opacity.value = visibility;
    return visibility;
  }

  function dispose() {
    parent.remove(group);
    disposeMesh(starField.points);
    disposeMesh(milkyWayHaze);
  }

  return {
    object: group,
    update({ nightFactor = 0 } = {}) {
      return { starVisibility: setVisibility(nightFactor) };
    },
    dispose,
  };
}

function createStarField(seedHash) {
  const positions = [];
  const colors = [];
  const direction = new THREE.Vector3();

  for (let index = 0; index < BACKGROUND_STAR_COUNT; index += 1) {
    const yaw = randomAt(seedHash, 0x51a7, index) * TAU;
    const y = lerp(0.02, 1, randomAt(seedHash, 0x57a2, index));
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    direction.set(Math.cos(yaw) * radius, y, Math.sin(yaw) * radius).normalize();
    pushStar(positions, colors, direction, 0.24 + randomAt(seedHash, 0x5a11, index) * 0.36, randomAt(seedHash, 0x7a11, index));
  }

  for (let index = 0; index < MILKY_WAY_BAND_STARS; index += 1) {
    const coreBias = randomAt(seedHash, 0x9a1a, index) < 0.22;
    const longitude = coreBias
      ? MILKY_WAY_CORE_LONGITUDE + gaussianAt(seedHash, 0xb4c0, index) * 0.2
      : randomAt(seedHash, 0xc0de, index) * TAU - Math.PI;
    const bandCenter = milkyWayCenterLatitude(longitude);
    const latitude = coreBias
      ? MILKY_WAY_CORE_LATITUDE + gaussianAt(seedHash, 0xd00d, index) * 0.06
      : bandCenter + gaussianAt(seedHash, 0xd00d, index) * 0.105;
    galacticDirection(longitude, latitude, direction);
    if (direction.y < 0.045) {
      continue;
    }
    const brightness = coreBias
      ? lerp(0.3, 0.56, randomAt(seedHash, 0xf10d, index))
      : lerp(0.16, 0.44, randomAt(seedHash, 0x5eed, index));
    pushStar(positions, colors, direction, brightness, randomAt(seedHash, 0xca1d, index));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = "bounded procedural star and soft Milky Way point catalog";
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    name: "subtle procedural star glow material",
    size: 1.7,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  });
  material.fog = false;

  const points = new THREE.Points(geometry, material);
  points.name = "bounded subtle procedural stars and Milky Way points";
  points.frustumCulled = false;
  points.renderOrder = -20;

  return { points, material };
}

function createMilkyWayHaze(seedHash) {
  const positions = [];
  const colors = [];
  const alphas = [];
  const indices = [];
  const direction = new THREE.Vector3();

  for (let column = 0; column <= MILKY_WAY_SEGMENTS; column += 1) {
    const longitude = (column / MILKY_WAY_SEGMENTS) * TAU - Math.PI;
    const centerLatitude = milkyWayCenterLatitude(longitude);
    const lane = dustLane(seedHash, longitude);
    const core = coreFalloff(longitude);
    const width = 0.16 + core * 0.055;

    for (let row = 0; row <= MILKY_WAY_WIDTH_SEGMENTS; row += 1) {
      const t = row / MILKY_WAY_WIDTH_SEGMENTS;
      const offset = t * 2 - 1;
      const latitude = centerLatitude + offset * width;
      galacticDirection(longitude, latitude, direction);
      const horizon = smoothstep(0.035, 0.18, direction.y);
      const edge = Math.pow(Math.max(0, 1 - Math.abs(offset)), 1.65);
      const darkLane = 1 - 0.5 * Math.exp(-((offset + 0.22 + Math.sin(longitude * 1.7) * 0.08) ** 2) / 0.018);
      const softKnots = 0.66 + 0.34 * dustLane(seedHash ^ 0x517a, longitude * 1.9 + offset * 0.45);
      const alpha = (0.045 + lane * 0.038 + core * 0.09) * edge * darkLane * softKnots * horizon;
      const warmth = core * 0.18;

      positions.push(direction.x * STAR_DOME_RADIUS * 0.986, direction.y * STAR_DOME_RADIUS * 0.986, direction.z * STAR_DOME_RADIUS * 0.986);
      colors.push(0.42 + warmth, 0.52 + warmth, 0.82);
      alphas.push(alpha);
    }
  }

  const rowStride = MILKY_WAY_WIDTH_SEGMENTS + 1;
  for (let column = 0; column < MILKY_WAY_SEGMENTS; column += 1) {
    for (let row = 0; row < MILKY_WAY_WIDTH_SEGMENTS; row += 1) {
      const base = column * rowStride + row;
      indices.push(base, base + rowStride, base + 1, base + 1, base + rowStride, base + rowStride + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = "soft feathered procedural Milky Way haze";
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("alpha", new THREE.Float32BufferAttribute(alphas, 1));
  geometry.setIndex(indices);

  const material = new THREE.ShaderMaterial({
    name: "soft feathered procedural Milky Way haze material",
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      opacity: { value: 0 },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float alpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = alpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float alpha = opacity * vAlpha;
        if (alpha < 0.002) {
          discard;
        }
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });
  material.fog = false;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "soft layered sky-bound procedural Milky Way haze";
  mesh.frustumCulled = false;
  mesh.renderOrder = -30;
  return mesh;
}

function milkyWayCenterLatitude(longitude) {
  const core = coreFalloff(longitude);
  return Math.sin(longitude * 2.1 + 0.8) * 0.024
    + Math.sin(longitude * 4.7) * 0.012
    + core * MILKY_WAY_CORE_LATITUDE;
}

function coreFalloff(longitude) {
  const delta = wrapAngle(longitude - MILKY_WAY_CORE_LONGITUDE);
  return Math.exp(-(delta * delta) / 0.18);
}

function dustLane(seedHash, value) {
  const x = Math.floor((value + Math.PI) * 9);
  const z = Math.floor((value + Math.PI) * 17);
  const t = (value + Math.PI) * 9 - x;
  return lerp(hash2(seedHash ^ 0x6d15c, x, z), hash2(seedHash ^ 0x6d15c, x + 1, z + 1), smoothstep(0, 1, t));
}

function galacticDirection(longitude, latitude, out) {
  const latitudeCos = Math.cos(latitude);
  return out
    .copy(GALACTIC_RIGHT)
    .multiplyScalar(Math.cos(longitude) * latitudeCos)
    .addScaledVector(GALACTIC_UP, Math.sin(longitude) * latitudeCos)
    .addScaledVector(GALACTIC_NORMAL, Math.sin(latitude))
    .normalize();
}

function pushStar(positions, colors, direction, brightness, warmth) {
  positions.push(direction.x * STAR_DOME_RADIUS, direction.y * STAR_DOME_RADIUS, direction.z * STAR_DOME_RADIUS);

  if (warmth > 0.88) {
    colors.push(brightness, brightness * 0.8, brightness * 0.62);
    return;
  }

  colors.push(brightness * 0.72, brightness * 0.84, brightness);
}

function randomAt(seedHash, stream, index) {
  return hash2(seedHash ^ stream, index, index * 101 + stream);
}

function gaussianAt(seedHash, stream, index) {
  const u1 = Math.max(randomAt(seedHash, stream, index), 0.000001);
  const u2 = randomAt(seedHash, stream ^ 0x6a09, index);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(TAU * u2);
}

function wrapAngle(angle) {
  let wrapped = angle;
  while (wrapped > Math.PI) {
    wrapped -= TAU;
  }
  while (wrapped < -Math.PI) {
    wrapped += TAU;
  }
  return wrapped;
}

function disposeMesh(object) {
  object.geometry?.dispose?.();
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) {
    material?.dispose?.();
  }
}
