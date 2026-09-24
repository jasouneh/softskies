import * as THREE from "../platform/three.js";
import { WORLD_SEED } from "../config/game.js";
import { hash2, lerp, normalizeSeed, smoothstep } from "../world/generation/noise.js";

const TAU = Math.PI * 2;
const STAR_DOME_RADIUS = 640;
const BACKGROUND_STAR_COUNT = 360;
const MILKY_WAY_BAND_STARS = 760;
const MILKY_WAY_RIBBON_SEGMENTS = 96;
const GALACTIC_NORMAL = new THREE.Vector3(0.568, -0.458, -0.683).normalize();
const GALACTIC_RIGHT = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), GALACTIC_NORMAL).normalize();
const GALACTIC_UP = new THREE.Vector3().crossVectors(GALACTIC_NORMAL, GALACTIC_RIGHT).normalize();

export function createNightSky(parent, { seed = WORLD_SEED } = {}) {
  const group = new THREE.Group();
  group.name = "procedural Milky Way and night stars";
  group.frustumCulled = false;

  const starField = createStarField(seed);
  const broadRibbon = createMilkyWayRibbon({
    name: "broad procedural Milky Way haze",
    width: 0.18,
    radius: STAR_DOME_RADIUS * 0.985,
    color: 0x7f9dff,
  });
  const coreRibbon = createMilkyWayRibbon({
    name: "bright procedural Milky Way core haze",
    width: 0.064,
    radius: STAR_DOME_RADIUS * 0.982,
    color: 0xd8e5ff,
  });

  group.add(broadRibbon, coreRibbon, starField.points);
  parent.add(group);
  setVisibility(0);

  function setVisibility(nightFactor = 0) {
    const visibility = smoothstep(0.72, 0.96, nightFactor);
    group.visible = visibility > 0.01;
    starField.material.opacity = 0.92 * visibility;
    broadRibbon.material.opacity = 0.06 * visibility;
    coreRibbon.material.opacity = 0.105 * visibility;
    return visibility;
  }

  function dispose() {
    parent.remove(group);
    disposeMesh(starField.points);
    disposeMesh(broadRibbon);
    disposeMesh(coreRibbon);
  }

  return {
    object: group,
    update({ nightFactor = 0 } = {}) {
      return { starVisibility: setVisibility(nightFactor) };
    },
    dispose,
  };
}

function createStarField(seed) {
  const seedHash = normalizeSeed(`${seed}:night-sky`);
  const positions = [];
  const colors = [];
  const direction = new THREE.Vector3();

  for (let index = 0; index < BACKGROUND_STAR_COUNT; index += 1) {
    const yaw = randomAt(seedHash, 0x51a7, index) * TAU;
    const y = lerp(-0.08, 1, randomAt(seedHash, 0x57a2, index));
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    direction.set(Math.cos(yaw) * radius, y, Math.sin(yaw) * radius).normalize();
    pushStar(positions, colors, direction, 0.42 + randomAt(seedHash, 0x5a11, index) * 0.44, randomAt(seedHash, 0x7a11, index));
  }

  for (let index = 0; index < MILKY_WAY_BAND_STARS; index += 1) {
    const coreBias = randomAt(seedHash, 0x9a1a, index) < 0.32;
    const longitude = coreBias
      ? 2.62 + gaussianAt(seedHash, 0xb4c0, index) * 0.34
      : randomAt(seedHash, 0xc0de, index) * TAU - Math.PI;
    const latitude = gaussianAt(seedHash, 0xd00d, index) * (coreBias ? 0.045 : 0.105);
    galacticDirection(longitude, latitude, direction);
    const brightness = coreBias
      ? lerp(0.62, 1, randomAt(seedHash, 0xf10d, index))
      : lerp(0.34, 0.86, randomAt(seedHash, 0x5eed, index));
    pushStar(positions, colors, direction, brightness, randomAt(seedHash, 0xca1d, index));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = "bounded procedural star and Milky Way point catalog";
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    name: "procedural star glow material",
    size: 2.1,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  });
  material.fog = false;

  const points = new THREE.Points(geometry, material);
  points.name = "bounded procedural stars and Milky Way points";
  points.frustumCulled = false;
  points.renderOrder = -20;

  return { points, material };
}

function createMilkyWayRibbon({ name, width, radius, color }) {
  const positions = [];
  const indices = [];
  const direction = new THREE.Vector3();

  for (let index = 0; index <= MILKY_WAY_RIBBON_SEGMENTS; index += 1) {
    const longitude = (index / MILKY_WAY_RIBBON_SEGMENTS) * TAU - Math.PI;
    const ripple = Math.sin(longitude * 2.6 + 0.8) * 0.018 + Math.sin(longitude * 5.1) * 0.009;
    galacticDirection(longitude, -width + ripple, direction);
    positions.push(direction.x * radius, direction.y * radius, direction.z * radius);
    galacticDirection(longitude, width + ripple, direction);
    positions.push(direction.x * radius, direction.y * radius, direction.z * radius);
  }

  for (let index = 0; index < MILKY_WAY_RIBBON_SEGMENTS; index += 1) {
    const base = index * 2;
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = name;
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);

  const material = new THREE.MeshBasicMaterial({
    name: `${name} material`,
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  material.fog = false;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.renderOrder = -30;
  return mesh;
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

  if (warmth > 0.86) {
    colors.push(brightness, brightness * 0.78, brightness * 0.58);
    return;
  }

  colors.push(brightness * 0.74, brightness * 0.86, brightness);
}

function randomAt(seedHash, stream, index) {
  return hash2(seedHash ^ stream, index, index * 101 + stream);
}

function gaussianAt(seedHash, stream, index) {
  const u1 = Math.max(randomAt(seedHash, stream, index), 0.000001);
  const u2 = randomAt(seedHash, stream ^ 0x6a09, index);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(TAU * u2);
}

function disposeMesh(object) {
  object.geometry?.dispose?.();
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) {
    material?.dispose?.();
  }
}
