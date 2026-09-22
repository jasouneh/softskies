import * as THREE from "../platform/three.js";

const BODY = 0xff7428;
const GOLD = 0xffd166;
const RED = 0xf94b3d;
const DEEP_RED = 0xb8242a;
const BEAK = 0xfff0a0;

export function createPhoenixView() {
  const group = new THREE.Group();
  group.name = "procedural low-poly phoenix";

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.72, flatShading: true });
  const goldMaterial = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.68, flatShading: true, side: THREE.DoubleSide });
  const redMaterial = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.7, flatShading: true, side: THREE.DoubleSide });
  const deepRedMaterial = new THREE.MeshStandardMaterial({ color: DEEP_RED, roughness: 0.76, flatShading: true, side: THREE.DoubleSide });
  const beakMaterial = new THREE.MeshStandardMaterial({ color: BEAK, roughness: 0.62, flatShading: true });

  const body = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.35, 6), bodyMaterial);
  body.name = "phoenix tapered body";
  body.rotation.x = -Math.PI / 2;
  body.position.z = -0.08;
  group.add(body);

  const chest = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 0), bodyMaterial);
  chest.name = "phoenix faceted chest";
  chest.scale.set(0.82, 0.72, 1.05);
  chest.position.set(0, 0.03, -0.18);
  group.add(chest);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), bodyMaterial);
  head.name = "phoenix faceted head";
  head.position.set(0, 0.26, -1.42);
  group.add(head);

  const crest = new THREE.Mesh(createFeatherGeometry(0.25, 0.7), redMaterial);
  crest.name = "phoenix flame crest";
  crest.position.set(0, 0.58, -1.34);
  crest.rotation.x = -0.35;
  group.add(crest);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), beakMaterial);
  beak.name = "phoenix angular beak";
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.25, -1.82);
  group.add(beak);

  const leftWing = createWing("left", goldMaterial, redMaterial);
  const rightWing = createWing("right", goldMaterial, redMaterial);
  group.add(leftWing.root, rightWing.root);

  const tailRoot = new THREE.Group();
  tailRoot.name = "phoenix tail fan";
  tailRoot.position.set(0, -0.04, 1.12);
  const tailFeathers = [];
  for (let index = -2; index <= 2; index += 1) {
    const feather = new THREE.Mesh(createFeatherGeometry(0.22, 1.8 - Math.abs(index) * 0.2), index % 2 === 0 ? redMaterial : deepRedMaterial);
    feather.position.set(index * 0.18, -0.08 * Math.abs(index), 0.35 + Math.abs(index) * 0.02);
    feather.rotation.z = index * 0.18;
    feather.rotation.x = Math.PI * 0.08;
    tailRoot.add(feather);
    tailFeathers.push(feather);
  }
  group.add(tailRoot);

  group.scale.setScalar(1.18);

  return {
    object: group,
    update(dt, elapsed, pose) {
      group.position.copy(pose.position);
      group.quaternion.copy(pose.quaternion);
      const flapRate = pose.speed > 58 ? 10.5 : 7.2;
      const flap = Math.sin(elapsed * flapRate) * 0.42 + Math.sin(elapsed * flapRate * 0.5) * 0.12;
      leftWing.root.rotation.z = 0.18 + flap;
      rightWing.root.rotation.z = -0.18 - flap;
      leftWing.tip.rotation.z = -0.16 - flap * 0.35;
      rightWing.tip.rotation.z = 0.16 + flap * 0.35;
      tailRoot.rotation.y = Math.sin(elapsed * 2.3) * 0.08 + pose.bankAmount * 0.16;
      tailRoot.rotation.x = Math.sin(elapsed * 3.4) * 0.05;
      for (let index = 0; index < tailFeathers.length; index += 1) {
        tailFeathers[index].rotation.y = Math.sin(elapsed * 4.2 + index) * 0.05;
      }
      chest.scale.y = 0.72 + Math.sin(elapsed * 5.2) * 0.025;
    },
  };
}

function createWing(side, goldMaterial, redMaterial) {
  const sign = side === "left" ? -1 : 1;
  const root = new THREE.Group();
  root.name = `${side} phoenix wing root`;
  root.position.set(sign * 0.42, 0.05, -0.28);

  const base = new THREE.Mesh(createWingGeometry(sign, 1), goldMaterial);
  base.name = `${side} phoenix inner wing`;
  root.add(base);

  const tip = new THREE.Group();
  tip.name = `${side} phoenix wing tip hinge`;
  tip.position.set(sign * 1.65, -0.02, -0.08);
  const outer = new THREE.Mesh(createWingGeometry(sign, 0.72), redMaterial);
  outer.name = `${side} phoenix ember primaries`;
  outer.position.set(sign * -1.65, 0, 0);
  tip.add(outer);
  root.add(tip);

  return { root, tip };
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
