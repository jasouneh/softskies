import * as THREE from "../platform/three.js";

const DRAGON_PARTICLE_COUNT = 96;
const BODY_SEGMENT_COUNT = 16;
const TAU = Math.PI * 2;

const DRAGON_COLORS = Object.freeze([
  new THREE.Color(0x6fffd1),
  new THREE.Color(0x72d7ff),
  new THREE.Color(0xffdf7a),
  new THREE.Color(0xff7ac8),
]);

export function createDragonView() {
  const group = new THREE.Group();
  group.name = "procedural Chinese-inspired dragon avatar with color particle aura";

  const materials = createDragonMaterials();
  const dragonRoot = new THREE.Group();
  dragonRoot.name = "smooth serpentine dragon flight animation rig";
  group.add(dragonRoot);

  const bodySegments = createBodySegments(materials);
  for (const segment of bodySegments) {
    dragonRoot.add(segment.root);
  }

  const head = createDragonHead(materials);
  dragonRoot.add(head.root);

  const tail = createDragonTail(materials);
  dragonRoot.add(tail.root);

  const legs = createDragonLegs(materials);
  dragonRoot.add(legs.root);

  const particles = createDragonParticles(materials.particle);
  group.add(particles.mesh);

  const avatarGlow = new THREE.PointLight(0x66ffd4, 0, 10, 2);
  avatarGlow.name = "subtle dragon night visibility glow";
  avatarGlow.position.set(0, 0.18, -0.35);
  group.add(avatarGlow);

  group.scale.setScalar(1.12);

  let turnResponse = 0;
  let climbResponse = 0;

  return {
    object: group,
    update(dt, elapsed, pose, effects = {}) {
      group.position.copy(pose.position);
      group.quaternion.copy(pose.quaternion);

      const boosting = Boolean(effects.boost);
      const targetTurn = clamp((pose.bankAmount ?? 0) * 0.9 + (effects.roll ?? 0) * 0.16 + (effects.mouseYawDelta ?? 0) * 0.8, -1, 1);
      const targetClimb = clamp((pose.forward?.y ?? 0) * 2.4 + Math.max(0, effects.pitch ?? 0) * 0.7 + Math.max(0, effects.mousePitchDelta ?? 0) * 3.2, -0.7, 1);
      const blend = 1 - Math.exp(-dt * 6.5);
      turnResponse += (targetTurn - turnResponse) * blend;
      climbResponse += (targetClimb - climbResponse) * blend;

      updateDragonBody({ bodySegments, head, tail, legs, elapsed, boosting, turnResponse, climbResponse });
      updateDragonParticles(particles, elapsed, pose.speed, boosting);
      updateDragonNightGlow(materials, avatarGlow, effects.nightFactor ?? 0, dt);
    },
    dispose() {
      disposeObjectResources(group);
    },
  };
}

function createDragonMaterials() {
  const glowBase = { emissive: 0x40ffd0, emissiveIntensity: 0 };
  const standard = { roughness: 0.68, flatShading: true, ...glowBase };
  return {
    body: new THREE.MeshStandardMaterial({ name: "jade dragon body material", color: 0x2bbf7c, ...standard }),
    belly: new THREE.MeshStandardMaterial({ name: "gold dragon belly material", color: 0xf0c45a, ...standard }),
    crest: new THREE.MeshStandardMaterial({ name: "red dragon crest material", color: 0xb93635, ...standard }),
    whisker: new THREE.MeshStandardMaterial({ name: "pale dragon whisker material", color: 0xfff2bd, roughness: 0.5, flatShading: true, ...glowBase }),
    horn: new THREE.MeshStandardMaterial({ name: "low-poly dragon horn material", color: 0xffe1a3, roughness: 0.56, flatShading: true, ...glowBase }),
    eye: new THREE.MeshBasicMaterial({ name: "bright dragon eye material", color: 0xfff5a0 }),
    claw: new THREE.MeshStandardMaterial({ name: "dragon claw material", color: 0xffdf7a, roughness: 0.5, flatShading: true, ...glowBase }),
    particle: new THREE.MeshBasicMaterial({
      name: "bounded procedural dragon color particle material",
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    }),
  };
}

function createBodySegments(materials) {
  const bodyGeometry = new THREE.IcosahedronGeometry(0.5, 0);
  bodyGeometry.name = "low-poly dragon body segment geometry";
  const bellyGeometry = new THREE.BoxGeometry(0.34, 0.08, 0.32);
  bellyGeometry.name = "dragon belly scale geometry";
  const spineGeometry = new THREE.ConeGeometry(0.12, 0.44, 4);
  spineGeometry.name = "dragon dorsal spine geometry";
  const segments = [];

  for (let index = 0; index < BODY_SEGMENT_COUNT; index += 1) {
    const root = new THREE.Group();
    root.name = `smooth dragon body segment ${index}`;
    const taper = 1 - index / BODY_SEGMENT_COUNT;
    const body = new THREE.Mesh(bodyGeometry, materials.body);
    body.name = `faceted jade dragon body scale ${index}`;
    body.scale.set(0.84 + taper * 0.28, 0.56 + taper * 0.18, 0.72 + taper * 0.22);
    root.add(body);

    const belly = new THREE.Mesh(bellyGeometry, materials.belly);
    belly.name = `gold dragon belly scale ${index}`;
    belly.position.y = -0.34 - index * 0.002;
    belly.scale.set(1.0 - index * 0.016, 1, 1.0);
    root.add(belly);

    if (index < BODY_SEGMENT_COUNT - 2) {
      const spine = new THREE.Mesh(spineGeometry, materials.crest);
      spine.name = `red dragon flowing dorsal spine ${index}`;
      spine.position.y = 0.42 + taper * 0.08;
      spine.rotation.x = Math.PI;
      spine.scale.setScalar(0.8 + taper * 0.25);
      root.add(spine);
    }
    segments.push({ root, body, belly });
  }
  return segments;
}

function createDragonHead(materials) {
  const root = new THREE.Group();
  root.name = "Chinese-inspired dragon expressive head";

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 0), materials.body);
  head.name = "faceted dragon head";
  head.scale.set(0.95, 0.78, 1.18);
  root.add(head);

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 5), materials.body);
  snout.name = "tapered dragon snout";
  snout.rotation.x = -Math.PI / 2;
  snout.position.set(0, -0.02, -0.58);
  root.add(snout);

  for (const sign of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.065, 0), materials.eye);
    eye.name = `${sign < 0 ? "left" : "right"} glowing dragon eye`;
    eye.position.set(sign * 0.2, 0.18, -0.52);
    root.add(eye);

    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.72, 5), materials.horn);
    horn.name = `${sign < 0 ? "left" : "right"} swept dragon horn`;
    horn.position.set(sign * 0.2, 0.42, -0.1);
    horn.rotation.set(0.62, sign * 0.24, sign * 0.1);
    root.add(horn);

    const cheek = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.8, 4), materials.whisker);
    cheek.name = `${sign < 0 ? "left" : "right"} floating dragon cheek whisker`;
    cheek.position.set(sign * 0.34, 0.03, -0.5);
    cheek.rotation.set(Math.PI / 2, 0, sign * 0.78);
    root.add(cheek);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.1), materials.crest);
    brow.name = `${sign < 0 ? "left" : "right"} red dragon brow plume`;
    brow.position.set(sign * 0.18, 0.28, -0.45);
    brow.rotation.z = sign * 0.28;
    root.add(brow);
  }

  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.72, 5), materials.whisker);
  beard.name = "flowing dragon chin whisker";
  beard.position.set(0, -0.38, -0.36);
  beard.rotation.x = Math.PI * 0.42;
  root.add(beard);

  return { root, head };
}

function createDragonTail(materials) {
  const root = new THREE.Group();
  root.name = "flowing dragon ribbon tail";
  const feathers = [];
  for (let index = -1; index <= 1; index += 1) {
    const streamer = new THREE.Mesh(createRibbonGeometry(0.11, 1.4 + Math.abs(index) * 0.28), index === 0 ? materials.crest : materials.belly);
    streamer.name = `dragon tail color streamer ${index + 1}`;
    streamer.position.x = index * 0.16;
    streamer.rotation.z = index * 0.18;
    root.add(streamer);
    feathers.push(streamer);
  }
  return { root, feathers };
}

function createDragonLegs(materials) {
  const root = new THREE.Group();
  root.name = "small tucked dragon legs and claws";
  const legs = [];
  for (const sign of [-1, 1]) {
    for (const z of [-0.8, 1.1]) {
      const leg = new THREE.Group();
      leg.name = `${sign < 0 ? "left" : "right"} dragon leg ${z < 0 ? "front" : "rear"}`;
      leg.position.set(sign * 0.5, -0.4, z);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.58, 0.18), materials.body);
      upper.rotation.z = sign * 0.28;
      leg.add(upper);
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 4), materials.claw);
      claw.position.set(sign * 0.11, -0.34, -0.08);
      claw.rotation.x = -Math.PI / 2;
      leg.add(claw);
      root.add(leg);
      legs.push(leg);
    }
  }
  return { root, legs };
}

function updateDragonBody({ bodySegments, head, tail, legs, elapsed, boosting, turnResponse, climbResponse }) {
  const speedPulse = boosting ? 1.22 : 1;
  const phase = elapsed * (3.0 * speedPulse) + turnResponse * 0.8;
  const frontZ = -1.58;
  const spacing = 0.42;
  const amplitude = 0.24 + Math.abs(turnResponse) * 0.18 + (boosting ? 0.06 : 0);
  const climbLift = clamp(climbResponse, -0.6, 1) * 0.18;

  for (let index = 0; index < bodySegments.length; index += 1) {
    const t = index / Math.max(1, bodySegments.length - 1);
    const wave = phase - index * 0.72;
    const side = Math.sin(wave) * amplitude * (1 - t * 0.28) - turnResponse * t * 0.2;
    const lift = Math.cos(wave * 0.82) * 0.12 * (1 - t * 0.18) + climbLift * (1 - t * 0.5);
    const z = frontZ + index * spacing;
    const segment = bodySegments[index];
    segment.root.position.set(side, lift, z);
    segment.root.rotation.y = Math.sin(wave + 0.42) * 0.22 + turnResponse * 0.16 * (1 - t);
    segment.root.rotation.x = Math.cos(wave + 0.2) * 0.07 + climbResponse * 0.08;
    segment.root.rotation.z = Math.sin(wave - 0.35) * 0.08 - turnResponse * 0.22;
  }

  const first = bodySegments[0].root.position;
  head.root.position.set(first.x * 1.08, first.y + 0.05, first.z - 0.58);
  head.root.rotation.set(climbResponse * 0.1 + Math.sin(phase) * 0.035, turnResponse * 0.32 + Math.sin(phase + 0.5) * 0.09, -turnResponse * 0.18);

  const last = bodySegments[bodySegments.length - 1].root.position;
  tail.root.position.set(last.x, last.y, last.z + 0.34);
  tail.root.rotation.set(Math.sin(phase - BODY_SEGMENT_COUNT * 0.72) * 0.08, Math.sin(phase - 1.8) * 0.3, -turnResponse * 0.3);
  for (let index = 0; index < tail.feathers.length; index += 1) {
    tail.feathers[index].rotation.y = Math.sin(elapsed * 4.2 + index * 0.75) * 0.1;
    tail.feathers[index].rotation.x = 0.18 + Math.cos(elapsed * 3.5 + index) * 0.06;
  }

  for (let index = 0; index < legs.legs.length; index += 1) {
    legs.legs[index].rotation.x = Math.sin(elapsed * 3.2 + index * 1.7) * 0.12 - climbResponse * 0.08;
    legs.legs[index].rotation.z = Math.cos(elapsed * 2.6 + index) * 0.08;
  }
}

function createDragonParticles(material) {
  const geometry = new THREE.TetrahedronGeometry(1, 0);
  geometry.name = "low-poly dragon color particle geometry";
  const mesh = new THREE.InstancedMesh(geometry, material, DRAGON_PARTICLE_COUNT);
  mesh.name = "bounded procedural color particles flying around dragon";
  mesh.count = DRAGON_PARTICLE_COUNT;
  mesh.frustumCulled = false;
  if (mesh.instanceMatrix.setUsage && THREE.DynamicDrawUsage) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  return {
    mesh,
    matrix: new THREE.Matrix4(),
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
    color: new THREE.Color(),
  };
}

function updateDragonParticles(particles, elapsed, speed, boosting) {
  const speedFactor = clamp((speed - 26) / 34, 0, 1);
  const intensity = 0.72 + speedFactor * 0.3 + (boosting ? 0.22 : 0);
  for (let index = 0; index < DRAGON_PARTICLE_COUNT; index += 1) {
    const seed = pseudoRandom(index * 23 + 5);
    const age = fract(elapsed * (0.12 + seed * 0.12) + seed);
    const angle = elapsed * (1.2 + seed * 1.7) + seed * TAU + index * 0.31;
    const z = -1.9 + age * 6.4;
    const radius = (0.62 + pseudoRandom(index * 31 + 9) * 0.95) * intensity;
    const bob = Math.sin(elapsed * 3.2 + index) * 0.12;
    const size = (0.045 + pseudoRandom(index * 17 + 3) * 0.08) * (1 - age * 0.34) * intensity;
    particles.position.set(Math.cos(angle) * radius, Math.sin(angle * 0.8) * 0.48 + bob, z + Math.sin(angle) * 0.22);
    particles.scale.setScalar(size);
    particles.matrix.compose(particles.position, particles.quaternion, particles.scale);
    particles.mesh.setMatrixAt(index, particles.matrix);
    particles.mesh.setColorAt(index, DRAGON_COLORS[index % DRAGON_COLORS.length]);
  }
  particles.mesh.instanceMatrix.needsUpdate = true;
  if (particles.mesh.instanceColor) {
    particles.mesh.instanceColor.needsUpdate = true;
  }
}

function updateDragonNightGlow(materials, glowLight, nightFactor, dt) {
  const glow = clamp(nightFactor, 0, 1);
  const blend = 1 - Math.exp(-dt * 3.2);
  glowLight.intensity += (glow * 0.46 - glowLight.intensity) * blend;
  const targetEmissive = glow * 0.06;
  for (const material of Object.values(materials)) {
    if (material.emissive && typeof material.emissiveIntensity === "number") {
      material.emissiveIntensity += (targetEmissive - material.emissiveIntensity) * blend;
    }
  }
}

function createRibbonGeometry(width, length) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      0, 0.12, 0,
      -width, 0, length * 0.35,
      0, -0.08, length,
      0, 0.12, 0,
      0, -0.08, length,
      width, 0, length * 0.35,
    ], 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function disposeObjectResources(object) {
  const geometries = new Set();
  const materials = new Set();
  object.traverse((child) => {
    if (child.geometry) {
      geometries.add(child.geometry);
    }
    if (Array.isArray(child.material)) {
      for (const material of child.material) {
        materials.add(material);
      }
    } else if (child.material) {
      materials.add(child.material);
    }
  });
  for (const geometry of geometries) {
    geometry.dispose();
  }
  for (const material of materials) {
    material.dispose();
  }
}

function pseudoRandom(value) {
  return fract(Math.sin(value * 12.9898) * 43758.5453123);
}

function fract(value) {
  return value - Math.floor(value);
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}
