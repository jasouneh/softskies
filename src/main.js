import * as THREE from "./platform/three.js";

const SKY_TOP = 0x63c8ff;
const SKY_HORIZON = 0xf8b85c;
const GROUND_COLOR = 0x4fbb6f;
const PHOENIX_ORANGE = 0xff7a18;
const PHOENIX_GOLD = 0xffd166;

export function createPolyFlyShell({ mountNode = document.body } = {}) {
  const root = document.createElement("section");
  root.className = "polyfly-shell";
  root.setAttribute("data-polyfly", "foundation-shell");

  const overlay = document.createElement("div");
  overlay.className = "polyfly-overlay";
  overlay.innerHTML = `
    <h1>polyFly</h1>
    <p>Foundation scene only: Three.js is wired up, while free-flight controls, phoenix animation, and procedural chunk streaming are staged in docs/prototype-plan.md.</p>
  `;
  root.append(overlay);
  mountNode.replaceChildren(root);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(SKY_TOP, 1);
  if (THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  root.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.name = "polyFly foundation scene";
  scene.background = new THREE.Color(SKY_TOP);
  scene.fog = new THREE.Fog(SKY_HORIZON, 36, 120);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
  camera.name = "planned third-person phoenix camera";
  camera.position.set(0, 5.8, 12);
  camera.lookAt(0, 1.2, 0);

  const sun = new THREE.DirectionalLight(0xfff0c2, 2.4);
  sun.name = "low-poly sun placeholder";
  sun.position.set(-8, 16, 10);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xd8f4ff, 0x31472f, 1.7));

  const horizon = createHorizonBand();
  scene.add(horizon);

  const phoenixMarker = createPhoenixMarker();
  phoenixMarker.position.set(0, 1.5, 0);
  scene.add(phoenixMarker);

  const clock = new THREE.Clock();

  function resize() {
    const { clientWidth, clientHeight } = root;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
  }

  function render() {
    const elapsed = clock.getElapsedTime();
    phoenixMarker.rotation.y = Math.sin(elapsed * 0.45) * 0.18;
    phoenixMarker.position.y = 1.5 + Math.sin(elapsed * 1.4) * 0.08;
    renderer.render(scene, camera);
  }

  window.addEventListener("resize", resize);
  resize();
  renderer.setAnimationLoop(render);

  return {
    camera,
    renderer,
    scene,
    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      disposeObject(scene);
      renderer.dispose();
      root.remove();
    },
  };
}

function createHorizonBand() {
  const group = new THREE.Group();
  group.name = "single-patch terrain color study";

  const ground = new THREE.Mesh(
    new THREE.ConeGeometry(28, 4, 7, 1, true),
    new THREE.MeshStandardMaterial({ color: GROUND_COLOR, roughness: 0.95, flatShading: true }),
  );
  ground.name = "placeholder low-poly plain";
  ground.position.y = -2.6;
  ground.rotation.y = Math.PI / 7;
  group.add(ground);

  const mountainMaterial = new THREE.MeshStandardMaterial({ color: 0x718d9b, roughness: 1, flatShading: true });
  const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xf2fbff, roughness: 0.85, flatShading: true });

  for (let index = 0; index < 5; index += 1) {
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(1.8 + index * 0.22, 5 + index * 0.65, 5), mountainMaterial);
    mountain.name = "planned procedural mountain silhouette";
    mountain.position.set(-10 + index * 5.1, -0.2, -18 - (index % 2) * 3);
    mountain.rotation.y = index * 0.7;
    group.add(mountain);

    const snowCap = new THREE.Mesh(new THREE.ConeGeometry(0.8 + index * 0.08, 1.4, 5), snowMaterial);
    snowCap.name = "planned snow band material cue";
    snowCap.position.copy(mountain.position).add(new THREE.Vector3(0, 2.45 + index * 0.3, 0));
    snowCap.rotation.y = mountain.rotation.y;
    group.add(snowCap);
  }

  return group;
}

function createPhoenixMarker() {
  const group = new THREE.Group();
  group.name = "procedural phoenix avatar placeholder";

  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.36, 1.35, 5),
    new THREE.MeshStandardMaterial({ color: PHOENIX_ORANGE, roughness: 0.72, flatShading: true }),
  );
  body.name = "phoenix body seed";
  body.rotation.x = Math.PI / 2;
  group.add(body);

  const wingGeometry = new THREE.BufferGeometry();
  wingGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      0, 0.12, 0,
      -1.55, 0.0, -0.24,
      -0.45, 0.1, 0.68,
      0, 0.12, 0,
      1.55, 0.0, -0.24,
      0.45, 0.1, 0.68,
    ], 3),
  );
  wingGeometry.computeVertexNormals();
  const wings = new THREE.Mesh(
    wingGeometry,
    new THREE.MeshStandardMaterial({ color: PHOENIX_GOLD, roughness: 0.68, side: THREE.DoubleSide, flatShading: true }),
  );
  wings.name = "phoenix wing silhouette seed";
  group.add(wings);

  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 1.1, 4),
    new THREE.MeshStandardMaterial({ color: 0xff3d2e, roughness: 0.7, flatShading: true }),
  );
  tail.name = "phoenix tail flame seed";
  tail.position.set(0, -0.05, 0.78);
  tail.rotation.x = Math.PI / 2;
  group.add(tail);

  return group;
}

function disposeObject(object3d) {
  object3d.traverse((node) => {
    if (node.geometry) {
      node.geometry.dispose();
    }
    if (node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        material.dispose();
      }
    }
  });
}

export function mountPolyFlyShell() {
  const mountNode = document.querySelector("#app") ?? document.body;
  return createPolyFlyShell({ mountNode });
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    mountPolyFlyShell();
  }, { once: true });
}
