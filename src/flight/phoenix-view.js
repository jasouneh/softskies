import * as THREE from "../platform/three.js";

const FIRE_PARTICLE_COUNT = 72;
const WIND_STREAKS_PER_SIDE = 5;
const TAU = Math.PI * 2;

const PALETTE = Object.freeze({
  body: 0xf47a2f,
  chest: 0xffa33e,
  gold: 0xffd166,
  amber: 0xffb347,
  orange: 0xff7a2f,
  red: 0xf34235,
  crimson: 0xb91f2e,
  magenta: 0xd14375,
  deepRed: 0x7b1724,
  copper: 0xc0522d,
  plum: 0x662345,
  sunlit: 0xffe07a,
  beak: 0xfff0a0,
  eye: 0x2d1722,
  wind: 0xcff8ff,
});

const FIRE_GRADIENT = [
  new THREE.Color(0xfff4a6),
  new THREE.Color(0xffbd4a),
  new THREE.Color(0xff552f),
  new THREE.Color(0x7c1026),
];

export function createPhoenixView() {
  const group = new THREE.Group();
  group.name = "procedural colorful low-poly phoenix avatar";

  const materials = createPhoenixMaterials();

  const body = new THREE.Mesh(new THREE.ConeGeometry(0.58, 2.48, 7), materials.body);
  body.name = "phoenix faceted tapered flame body";
  body.rotation.x = -Math.PI / 2;
  body.position.z = -0.03;
  group.add(body);

  const chest = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), materials.chest);
  chest.name = "phoenix golden faceted chest";
  chest.scale.set(0.88, 0.76, 1.02);
  chest.position.set(0, 0.04, -0.25);
  group.add(chest);

  const belly = new THREE.Mesh(createDiamondGeometry(0.34, 0.78), materials.gold);
  belly.name = "phoenix bright breast facet";
  belly.position.set(0, -0.2, -0.68);
  belly.rotation.x = -0.18;
  group.add(belly);

  const flankFacets = createBodyFlameFacets(materials);
  group.add(flankFacets);

  const neck = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.78, 5), materials.orange);
  neck.name = "phoenix angular neck";
  neck.rotation.x = -0.55;
  neck.position.set(0, 0.19, -1.12);
  group.add(neck);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), materials.body);
  head.name = "phoenix faceted head";
  head.scale.set(0.9, 0.82, 1.05);
  head.position.set(0, 0.3, -1.55);
  group.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.54, 4), materials.beak);
  beak.name = "phoenix angular beak";
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.28, -1.94);
  group.add(beak);

  const lowerBeak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 4), materials.gold);
  lowerBeak.name = "phoenix smaller lower beak facet";
  lowerBeak.rotation.x = -Math.PI / 2;
  lowerBeak.position.set(0, 0.2, -1.84);
  group.add(lowerBeak);

  const leftEye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), materials.eye);
  leftEye.name = "left phoenix ember eye";
  leftEye.position.set(-0.13, 0.39, -1.84);
  const rightEye = leftEye.clone();
  rightEye.name = "right phoenix ember eye";
  rightEye.position.x = 0.13;
  group.add(leftEye, rightEye);

  const headDetails = createHeadDetails(materials);
  group.add(headDetails.root);

  const crest = createCrest(materials);
  group.add(crest.root);

  const leftWing = createWing("left", materials);
  const rightWing = createWing("right", materials);
  group.add(leftWing.root, rightWing.root);

  const tail = createTail(materials);
  group.add(tail.root);

  const fireTrail = createFireTrail(materials.fire);
  group.add(fireTrail.mesh);

  const avatarGlow = new THREE.PointLight(0xffb86b, 0, 9, 2);
  avatarGlow.name = "subtle phoenix night visibility glow";
  avatarGlow.position.set(0, 0.28, -0.25);
  group.add(avatarGlow);

  group.scale.setScalar(1.18);

  let windIntensity = 0;
  let climbResponse = 0;
  let turnResponse = 0;
  let wingBeatPhase = -Math.PI / 2;
  let levelFlightTime = 0;

  return {
    object: group,
    update(dt, elapsed, pose, effects = {}) {
      group.position.copy(pose.position);
      group.quaternion.copy(pose.quaternion);

      const boosting = Boolean(effects.boost);
      const climbTarget = getWingClimbTarget(pose, effects);
      const turnTarget = getWingTurnTarget(pose, effects);
      const responseBlend = 1 - Math.exp(-dt * 7.25);
      climbResponse += (climbTarget - climbResponse) * responseBlend;
      turnResponse += (turnTarget - turnResponse) * responseBlend;

      const verticalIntent = Math.abs(effects.pitch ?? 0) + Math.abs(pose.forward?.y ?? 0);
      levelFlightTime = verticalIntent < 0.045 ? levelFlightTime + dt : 0;
      const wingMotion = updatePhoenixWingMotion({
        dt,
        boosting,
        climbResponse,
        turnResponse,
        wingBeatPhase,
        idleFlap: levelFlightTime > 1.15,
      });
      wingBeatPhase = wingMotion.phase;

      leftWing.root.rotation.z = 0.13 + wingMotion.climbLift + wingMotion.rootFlap - wingMotion.turnLean;
      rightWing.root.rotation.z = -0.13 - wingMotion.climbLift - wingMotion.rootFlap - wingMotion.turnLean;
      leftWing.root.rotation.x = -0.035 - wingMotion.angleOfAttack + wingMotion.turnMagnitude * 0.035;
      rightWing.root.rotation.x = -0.035 - wingMotion.angleOfAttack + wingMotion.turnMagnitude * 0.035;
      leftWing.root.rotation.y = wingMotion.turnResponse * 0.045;
      rightWing.root.rotation.y = wingMotion.turnResponse * 0.045;
      leftWing.tip.rotation.z = -0.12 - wingMotion.tipFlap - wingMotion.turnLean * 0.34;
      rightWing.tip.rotation.z = 0.12 + wingMotion.tipFlap - wingMotion.turnLean * 0.34;
      leftWing.tip.rotation.x = wingMotion.angleOfAttack * 0.54 + wingMotion.turnResponse * 0.075;
      rightWing.tip.rotation.x = wingMotion.angleOfAttack * 0.54 - wingMotion.turnResponse * 0.075;
      updateWingFeatherMotion(leftWing, -1, wingMotion);
      updateWingFeatherMotion(rightWing, 1, wingMotion);

      tail.root.rotation.y = Math.sin(elapsed * 2.3) * 0.08 + pose.bankAmount * 0.16;
      tail.root.rotation.x = Math.sin(elapsed * 3.4) * 0.05;
      for (let index = 0; index < tail.feathers.length; index += 1) {
        tail.feathers[index].rotation.y = Math.sin(elapsed * 4.2 + index) * 0.055;
      }
      for (let index = 0; index < crest.feathers.length; index += 1) {
        crest.feathers[index].rotation.y = Math.sin(elapsed * 5.1 + index * 0.8) * 0.035;
      }
      chest.scale.y = 0.76 + Math.sin(elapsed * 5.2) * 0.025;

      updateFireTrail(fireTrail, elapsed, pose.speed, boosting);
      windIntensity += ((boosting ? 1 : 0) - windIntensity) * clamp(dt * 7.5, 0, 1);
      materials.wind.opacity = 0.48 * windIntensity;
      updateWingtipWind(leftWing.wind, windIntensity, elapsed);
      updateWingtipWind(rightWing.wind, windIntensity, elapsed);
      updateAvatarNightGlow(materials, avatarGlow, effects.nightFactor ?? 0, dt);
    },
    dispose() {
      disposeObjectResources(group);
    },
  };
}

function getWingClimbTarget(pose, effects) {
  const climbFromFlightPath = clamp(((pose.forward?.y ?? 0) - 0.035) / 0.24, 0, 1);
  const keyboardClimb = Math.max(0, effects.pitch ?? 0) * 0.9;
  const mouseClimb = Math.max(0, effects.mousePitchDelta ?? 0) * 4.5;
  return clamp(Math.max(climbFromFlightPath, keyboardClimb, mouseClimb), 0, 1);
}

function getWingTurnTarget(pose, effects) {
  const bankTurn = clamp(pose.bankAmount ?? 0, -1, 1) * 0.9;
  const keyboardTurn = clamp(effects.roll ?? 0, -1, 1) * 0.18;
  const mouseTurn = clamp(effects.mouseYawDelta ?? 0, -0.16, 0.16) * 0.85;
  return clamp(bankTurn + keyboardTurn + mouseTurn, -1, 1);
}

function updatePhoenixWingMotion({ dt, boosting, climbResponse, turnResponse, wingBeatPhase, idleFlap = false }) {
  const turnMagnitude = Math.abs(turnResponse);
  const activeIntensity = clamp(Math.max(climbResponse * 1.08, turnMagnitude * 0.86), 0, 1);
  const actionIntensity = Math.max(activeIntensity, idleFlap ? 0.28 : 0);
  const shouldFlap = actionIntensity > 0.025;
  let phase = wingBeatPhase;
  if (shouldFlap) {
    phase += dt * ((idleFlap && activeIntensity < 0.08 ? 2.55 : 3.65) + climbResponse * 1.45 + turnMagnitude * 0.9 + (boosting ? 0.22 : 0));
    if (phase > TAU || phase < -TAU) {
      phase -= Math.trunc(phase / TAU) * TAU;
    }
  }

  const sine = shouldFlap ? Math.sin(phase) : 0;
  const laggedSine = shouldFlap ? Math.sin(phase - 0.58) : 0;
  const downstroke = Math.max(0, sine);
  const upstroke = Math.max(0, -sine);
  const idleAmplitude = idleFlap && activeIntensity < 0.08 ? 0.1 : 0;
  const rootAmplitude = (0.18 + idleAmplitude + climbResponse * 0.24 + turnMagnitude * 0.08) * actionIntensity;
  const tipAmplitude = (0.16 + idleAmplitude * 0.9 + climbResponse * 0.25 + turnMagnitude * 0.1) * actionIntensity;
  const rootFlap = (downstroke * 1.04 - upstroke * 0.66) * rootAmplitude;
  const tipLag = laggedSine * tipAmplitude;
  const climbLift = climbResponse * 0.12;
  const turnLean = turnResponse * 0.28;
  const angleOfAttack = climbResponse * 0.12 + downstroke * actionIntensity * 0.055 - upstroke * actionIntensity * 0.028;

  return {
    phase,
    actionIntensity,
    turnResponse,
    turnMagnitude,
    downstroke,
    upstroke,
    rootFlap,
    tipFlap: climbLift * 0.58 + rootFlap * 0.42 + tipLag * 0.72,
    tipLag,
    climbLift,
    turnLean,
    angleOfAttack,
  };
}

function updateWingFeatherMotion(wing, side, motion) {
  for (let index = 0; index < wing.secondaryFeathers.length; index += 1) {
    const feather = wing.secondaryFeathers[index];
    const base = feather.userData.baseRotation;
    const indexScale = 1 + index * 0.08;
    feather.rotation.x = base.x + (motion.downstroke * 0.04 - motion.upstroke * 0.026) * motion.actionIntensity * indexScale;
    feather.rotation.y = base.y + side * motion.tipLag * 0.022 * indexScale - motion.turnResponse * 0.014;
    feather.rotation.z = base.z + side * (motion.rootFlap * 0.05 + motion.tipLag * 0.035) * indexScale - motion.turnResponse * 0.016;
  }

  for (let index = 0; index < wing.primaryFeathers.length; index += 1) {
    const feather = wing.primaryFeathers[index];
    const base = feather.userData.baseRotation;
    const indexScale = 1 + index * 0.045;
    feather.rotation.x = base.x + (motion.downstroke * 0.07 - motion.upstroke * 0.045) * motion.actionIntensity * indexScale + motion.tipLag * 0.03;
    feather.rotation.y = base.y + side * motion.tipLag * 0.055 * indexScale - motion.turnResponse * 0.024;
    feather.rotation.z = base.z + side * (motion.rootFlap * 0.08 + motion.tipLag * 0.07) * indexScale - motion.turnResponse * 0.02;
  }
}

function createPhoenixMaterials() {
  const glowBase = { emissive: 0xff8a2a, emissiveIntensity: 0 };
  const flat = { roughness: 0.72, flatShading: true, ...glowBase };
  const wing = { roughness: 0.7, flatShading: true, side: THREE.DoubleSide, ...glowBase };

  return {
    body: new THREE.MeshStandardMaterial({ color: PALETTE.body, ...flat }),
    chest: new THREE.MeshStandardMaterial({ color: PALETTE.chest, ...flat }),
    gold: new THREE.MeshStandardMaterial({ color: PALETTE.gold, ...wing }),
    amber: new THREE.MeshStandardMaterial({ color: PALETTE.amber, ...wing }),
    orange: new THREE.MeshStandardMaterial({ color: PALETTE.orange, ...wing }),
    red: new THREE.MeshStandardMaterial({ color: PALETTE.red, ...wing }),
    crimson: new THREE.MeshStandardMaterial({ color: PALETTE.crimson, ...wing }),
    magenta: new THREE.MeshStandardMaterial({ color: PALETTE.magenta, ...wing }),
    deepRed: new THREE.MeshStandardMaterial({ color: PALETTE.deepRed, ...wing }),
    copper: new THREE.MeshStandardMaterial({ color: PALETTE.copper, ...wing }),
    plum: new THREE.MeshStandardMaterial({ color: PALETTE.plum, ...wing }),
    sunlit: new THREE.MeshStandardMaterial({ color: PALETTE.sunlit, ...wing }),
    beak: new THREE.MeshStandardMaterial({ color: PALETTE.beak, roughness: 0.62, flatShading: true, ...glowBase }),
    eye: new THREE.MeshBasicMaterial({ color: PALETTE.eye }),
    fire: new THREE.MeshBasicMaterial({
      name: "procedural phoenix fire particle material",
      color: 0xffffff,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    wind: new THREE.MeshBasicMaterial({
      name: "boost wingtip wind material",
      color: PALETTE.wind,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  };
}

function updateAvatarNightGlow(materials, glowLight, nightFactor, dt) {
  const glow = clamp(nightFactor, 0, 1);
  const blend = 1 - Math.exp(-dt * 3.2);
  const targetLight = glow * 0.42;
  glowLight.intensity += (targetLight - glowLight.intensity) * blend;

  const targetEmissive = glow * 0.055;
  for (const material of Object.values(materials)) {
    if (material.emissive && typeof material.emissiveIntensity === "number") {
      material.emissiveIntensity += (targetEmissive - material.emissiveIntensity) * blend;
    }
  }
}

function createBodyFlameFacets(materials) {
  const root = new THREE.Group();
  root.name = "phoenix layered body flame facets";

  const facetRows = [
    { z: -0.72, y: -0.12, width: 0.13, length: 0.66, material: materials.sunlit, roll: 0.32 },
    { z: -0.18, y: -0.04, width: 0.16, length: 0.74, material: materials.orange, roll: 0.42 },
    { z: 0.34, y: -0.1, width: 0.17, length: 0.82, material: materials.red, roll: 0.5 },
    { z: 0.78, y: -0.18, width: 0.15, length: 0.72, material: materials.crimson, roll: 0.58 },
  ];

  for (const sign of [-1, 1]) {
    for (let index = 0; index < facetRows.length; index += 1) {
      const row = facetRows[index];
      const facet = new THREE.Mesh(createDiamondGeometry(row.width, row.length), row.material);
      facet.name = `${sign < 0 ? "left" : "right"} phoenix side flame body facet ${index}`;
      facet.position.set(sign * (0.36 + index * 0.035), row.y, row.z);
      facet.rotation.set(-0.34 + index * 0.035, sign * row.roll, sign * (0.1 + index * 0.04));
      root.add(facet);
    }
  }

  const backMaterials = [materials.gold, materials.orange, materials.red, materials.crimson];
  for (let index = 0; index < backMaterials.length; index += 1) {
    const plume = new THREE.Mesh(createFeatherGeometry(0.07 + index * 0.012, 0.5 + index * 0.08), backMaterials[index]);
    plume.name = `phoenix raised dorsal flame plume ${index}`;
    plume.position.set(0, 0.44 - index * 0.03, -0.7 + index * 0.42);
    plume.rotation.x = -0.74 + index * 0.08;
    root.add(plume);
  }

  return root;
}

function createHeadDetails(materials) {
  const root = new THREE.Group();
  root.name = "phoenix angular face mask and cheek plumes";

  for (const sign of [-1, 1]) {
    const cheek = new THREE.Mesh(createDiamondGeometry(0.08, 0.34), sign < 0 ? materials.sunlit : materials.gold);
    cheek.name = `${sign < 0 ? "left" : "right"} phoenix golden cheek mask`;
    cheek.position.set(sign * 0.22, 0.28, -1.71);
    cheek.rotation.set(-0.9, sign * 0.42, sign * 0.42);
    root.add(cheek);

    const sidePlume = new THREE.Mesh(createFeatherGeometry(0.07, 0.58), sign < 0 ? materials.crimson : materials.magenta);
    sidePlume.name = `${sign < 0 ? "left" : "right"} phoenix swept cheek flame plume`;
    sidePlume.position.set(sign * 0.23, 0.47, -1.42);
    sidePlume.rotation.set(-0.36, sign * 0.28, sign * 0.48);
    root.add(sidePlume);
  }

  const throat = new THREE.Mesh(createFeatherGeometry(0.12, 0.48), materials.sunlit);
  throat.name = "phoenix bright throat feather facet";
  throat.position.set(0, 0.1, -1.36);
  throat.rotation.x = -0.22;
  root.add(throat);

  return { root };
}

function createCrest(materials) {
  const root = new THREE.Group();
  root.name = "phoenix flame crest fan";
  root.position.set(0, 0.57, -1.43);

  const feathers = [
    { x: -0.18, width: 0.09, length: 0.56, rotationZ: -0.42, material: materials.crimson },
    { x: -0.09, width: 0.11, length: 0.72, rotationZ: -0.22, material: materials.red },
    { x: 0, width: 0.14, length: 0.9, rotationZ: 0, material: materials.sunlit },
    { x: 0.09, width: 0.11, length: 0.72, rotationZ: 0.22, material: materials.gold },
    { x: 0.18, width: 0.09, length: 0.56, rotationZ: 0.42, material: materials.magenta },
  ].map((data, index) => {
    const feather = new THREE.Mesh(createFeatherGeometry(data.width, data.length), data.material);
    feather.name = `phoenix flame crest feather ${index}`;
    feather.position.set(data.x, 0, 0);
    feather.rotation.x = -0.52;
    feather.rotation.z = data.rotationZ;
    root.add(feather);
    return feather;
  });

  return { root, feathers };
}

function createWing(side, materials) {
  const sign = side === "left" ? -1 : 1;
  const root = new THREE.Group();
  root.name = `${side} phoenix wing root`;
  root.position.set(sign * 0.42, 0.05, -0.32);

  const shoulder = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), materials.body);
  shoulder.name = `${side} phoenix faceted shoulder`;
  shoulder.position.set(sign * 0.08, 0.01, 0.02);
  root.add(shoulder);

  const inner = new THREE.Mesh(createWingGeometry(sign, 1.08), materials.amber);
  inner.name = `${side} phoenix amber inner wing plane`;
  root.add(inner);

  const innerGold = new THREE.Mesh(createWingGeometry(sign, 0.68), materials.gold);
  innerGold.name = `${side} phoenix golden upper wing facet`;
  innerGold.position.set(sign * 0.08, 0.035, 0.08);
  root.add(innerGold);

  const innerSun = new THREE.Mesh(createWingGeometry(sign, 0.42), materials.sunlit);
  innerSun.name = `${side} phoenix sunlit shoulder wing facet`;
  innerSun.position.set(sign * 0.16, 0.07, -0.04);
  root.add(innerSun);

  const leadingFacet = new THREE.Mesh(createLeadingWingFacetGeometry(sign), materials.orange);
  leadingFacet.name = `${side} phoenix orange leading wing facet`;
  leadingFacet.position.y = 0.045;
  root.add(leadingFacet);

  const secondaryFeathers = [];
  const secondaryMaterials = [materials.sunlit, materials.gold, materials.amber, materials.orange, materials.red];
  for (let index = 0; index < secondaryMaterials.length; index += 1) {
    const secondary = new THREE.Mesh(createFeatherGeometry(0.12 + index * 0.012, 0.82 + index * 0.08), secondaryMaterials[index]);
    secondary.name = `${side} phoenix layered secondary feather ${index}`;
    secondary.position.set(sign * (0.34 + index * 0.25), -0.035 - index * 0.014, 0.54 + index * 0.08);
    secondary.rotation.x = 0.08 + index * 0.02;
    secondary.rotation.y = sign * (0.04 + index * 0.018);
    secondary.rotation.z = sign * (0.15 + index * 0.055);
    rememberBaseRotation(secondary);
    root.add(secondary);
    secondaryFeathers.push(secondary);
  }

  const tip = new THREE.Group();
  tip.name = `${side} phoenix colorful primary wing tip hinge`;
  tip.position.set(sign * 1.65, -0.02, -0.08);

  const wrist = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), materials.red);
  wrist.name = `${side} phoenix faceted wing wrist`;
  tip.add(wrist);

  const outer = new THREE.Mesh(createWingGeometry(sign, 0.8), materials.red);
  outer.name = `${side} phoenix red outer wing facet`;
  outer.position.set(sign * -1.65, 0, 0);
  tip.add(outer);

  const outerHighlight = new THREE.Mesh(createWingGeometry(sign, 0.5), materials.magenta);
  outerHighlight.name = `${side} phoenix magenta outer wing highlight`;
  outerHighlight.position.set(sign * -1.32, 0.04, 0.08);
  tip.add(outerHighlight);

  const shadowFacet = new THREE.Mesh(createWingGeometry(sign, 0.34), materials.plum);
  shadowFacet.name = `${side} phoenix deep trailing wing facet`;
  shadowFacet.position.set(sign * -1.08, -0.035, 0.22);
  tip.add(shadowFacet);

  const primaryFeathers = [];
  const primaryMaterials = [
    materials.sunlit,
    materials.gold,
    materials.amber,
    materials.orange,
    materials.red,
    materials.crimson,
    materials.magenta,
    materials.deepRed,
  ];
  for (let index = 0; index < primaryMaterials.length; index += 1) {
    const feather = new THREE.Mesh(createFeatherGeometry(0.15 + index * 0.017, 1.24 - index * 0.035), primaryMaterials[index]);
    feather.name = `${side} phoenix low-poly primary feather ${index}`;
    feather.position.set(sign * (0.03 + index * 0.22), -0.035 - index * 0.013, 0.3 + index * 0.082);
    feather.rotation.x = 0.04 + index * 0.014;
    feather.rotation.y = sign * (0.02 + index * 0.016);
    feather.rotation.z = sign * (0.08 + index * 0.05);
    rememberBaseRotation(feather);
    tip.add(feather);
    primaryFeathers.push(feather);
  }

  root.add(tip);

  const wind = createWingtipWind(side, materials.wind);
  root.add(wind.group);

  return { root, tip, wind, secondaryFeathers, primaryFeathers };
}

function rememberBaseRotation(object) {
  object.userData.baseRotation = object.rotation.clone();
}

function createTail(materials) {
  const root = new THREE.Group();
  root.name = "phoenix long flame tail fan";
  root.position.set(0, -0.05, 1.08);

  const feathers = [];
  const materialCycle = [
    materials.plum,
    materials.deepRed,
    materials.crimson,
    materials.red,
    materials.orange,
    materials.sunlit,
    materials.gold,
    materials.orange,
    materials.red,
    materials.crimson,
    materials.deepRed,
  ];
  for (let index = -5; index <= 5; index += 1) {
    const abs = Math.abs(index);
    const feather = new THREE.Mesh(createFeatherGeometry(0.14 + abs * 0.022, 2.92 - abs * 0.17), materialCycle[index + 5]);
    feather.name = `phoenix flowing tail feather ${index + 5}`;
    feather.position.set(index * 0.105, -0.04 * abs, 0.22 + abs * 0.06);
    feather.rotation.x = Math.PI * 0.065 + abs * 0.014;
    feather.rotation.y = -index * 0.052;
    feather.rotation.z = index * 0.115;
    root.add(feather);
    feathers.push(feather);
  }

  for (const sign of [-1, 1]) {
    const streamer = new THREE.Mesh(createFeatherGeometry(0.09, 2.55), sign < 0 ? materials.magenta : materials.crimson);
    streamer.name = `${sign < 0 ? "left" : "right"} phoenix long side tail streamer`;
    streamer.position.set(sign * 0.3, 0.03, 0.16);
    streamer.rotation.x = Math.PI * 0.055;
    streamer.rotation.y = -sign * 0.16;
    streamer.rotation.z = sign * 0.28;
    root.add(streamer);
    feathers.push(streamer);
  }

  const centralSpark = new THREE.Mesh(createFeatherGeometry(0.12, 2.25), materials.sunlit);
  centralSpark.name = "phoenix bright central tail spark";
  centralSpark.position.set(0, 0.05, 0.12);
  centralSpark.rotation.x = Math.PI * 0.075;
  root.add(centralSpark);
  feathers.push(centralSpark);

  return { root, feathers };
}

function createFireTrail(material) {
  const geometry = new THREE.TetrahedronGeometry(1, 0);
  geometry.name = "low-poly procedural fire particle geometry";
  const mesh = new THREE.InstancedMesh(geometry, material, FIRE_PARTICLE_COUNT);
  mesh.name = "bounded procedural phoenix fire particle trail";
  mesh.count = FIRE_PARTICLE_COUNT;
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

function updateFireTrail(trail, elapsed, speed, boosting) {
  const speedFactor = clamp((speed - 38) / 38, 0, 1);
  const cycleSpeed = (0.62 + speedFactor * 0.48 + (boosting ? 0.16 : 0)) * 0.75;
  const trailLength = 9.1 + speedFactor * 3.2 + (boosting ? 3.4 : 0);

  for (let index = 0; index < FIRE_PARTICLE_COUNT; index += 1) {
    const seed = pseudoRandom(index + 1);
    const age = fract(elapsed * cycleSpeed + seed);
    const driftSeed = pseudoRandom(index * 19 + 7);
    const sideSeed = pseudoRandom(index * 31 + 11) - 0.5;
    const liftSeed = pseudoRandom(index * 43 + 17) - 0.5;
    const flicker = 0.78 + Math.sin(elapsed * 14.5 + seed * TAU) * 0.18;
    const spread = 0.32 + age * (1.34 + (boosting ? 0.42 : 0));
    const fade = 1 - age;
    const swirl = Math.sin(age * TAU * 1.7 + seed * TAU + elapsed * 1.15) * age;
    const size = (0.11 + fade * 0.28 + Math.sin(age * Math.PI) * 0.09) * flicker;

    trail.position.set(
      sideSeed * spread + swirl * 0.22,
      -0.08 + liftSeed * (0.22 + age * 0.22) + age * 0.36 + Math.sin(elapsed * 3.8 + driftSeed * TAU) * 0.075,
      1.58 + age * trailLength,
    );
    trail.scale.set(
      size * (0.86 + driftSeed * 0.36 + age * 0.15),
      size * (0.92 + age * 0.42),
      size * (1.34 + speedFactor * 0.42 + age * 0.2),
    );
    trail.matrix.compose(trail.position, trail.quaternion, trail.scale);
    trail.mesh.setMatrixAt(index, trail.matrix);
    trail.mesh.setColorAt(index, sampleFireColor(age, trail.color));
  }

  trail.mesh.instanceMatrix.needsUpdate = true;
  if (trail.mesh.instanceColor) {
    trail.mesh.instanceColor.needsUpdate = true;
  }
}

function sampleFireColor(age, target) {
  if (age < 0.34) {
    return target.copy(FIRE_GRADIENT[0]).lerp(FIRE_GRADIENT[1], age / 0.34);
  }
  if (age < 0.7) {
    return target.copy(FIRE_GRADIENT[1]).lerp(FIRE_GRADIENT[2], (age - 0.34) / 0.36);
  }
  return target.copy(FIRE_GRADIENT[2]).lerp(FIRE_GRADIENT[3], (age - 0.7) / 0.3);
}

function createWingtipWind(side, material) {
  const sign = side === "left" ? -1 : 1;
  const group = new THREE.Group();
  group.name = `${side} boost wingtip wind animation`;
  group.position.set(sign * 3.18, -0.08, -0.08);
  group.visible = false;

  const streaks = [];
  for (let index = 0; index < WIND_STREAKS_PER_SIDE; index += 1) {
    const streak = new THREE.Mesh(createWindStreakGeometry(sign, 3.1 + index * 0.42, 0.1 + index * 0.023), material);
    streak.name = `${side} procedural wingtip wind streak ${index}`;
    streak.position.set(sign * (index * 0.03), (index - 1.5) * 0.055, index * 0.08);
    streak.rotation.z = sign * (-0.08 + index * 0.03);
    streak.userData.phase = index / WIND_STREAKS_PER_SIDE;
    group.add(streak);
    streaks.push(streak);
  }

  return { group, streaks };
}

function updateWingtipWind(wind, intensity, elapsed) {
  wind.group.visible = intensity > 0.025;
  for (let index = 0; index < wind.streaks.length; index += 1) {
    const streak = wind.streaks[index];
    const phase = streak.userData.phase ?? 0;
    const pulse = 0.72 + Math.sin(elapsed * 13 + phase * TAU) * 0.22;
    const slide = fract(elapsed * (1.8 + index * 0.18) + phase) * 0.32;
    streak.position.z = index * 0.08 + slide;
    streak.scale.set(1, 0.72 + intensity * 0.38, (0.9 + pulse * 0.24) * (0.92 + intensity * 0.42));
  }
}

function createWingGeometry(sign, scale = 1) {
  const geometry = new THREE.BufferGeometry();
  const positions = [
    0, 0, 0,
    sign * 2.9 * scale, -0.12, -0.46,
    sign * 0.72 * scale, -0.08, 1.04,
    sign * 0.72 * scale, -0.08, 1.04,
    sign * 2.9 * scale, -0.12, -0.46,
    sign * 1.65 * scale, -0.06, 1.18,
  ];
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createLeadingWingFacetGeometry(sign) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      0, 0, -0.03,
      sign * 1.45, 0.02, -0.82,
      sign * 2.42, -0.05, -0.5,
      0, 0, -0.03,
      sign * 2.42, -0.05, -0.5,
      sign * 1.08, -0.03, 0.18,
    ], 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function createWindStreakGeometry(sign, length, width) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      0, 0, 0,
      sign * width, 0.02, length * 0.34,
      0, 0.025, length,
      0, 0, 0,
      0, 0.025, length,
      -sign * width * 0.66, -0.015, length * 0.42,
    ], 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function createFeatherGeometry(width, length) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      0, 0, 0,
      -width, 0.02, length * 0.35,
      0, -0.04, length,
      0, 0, 0,
      0, -0.04, length,
      width, 0.02, length * 0.35,
    ], 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function createDiamondGeometry(width, length) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      0, 0.16, 0,
      -width, 0, length * 0.36,
      0, -0.15, length,
      0, 0.16, 0,
      0, -0.15, length,
      width, 0, length * 0.36,
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
