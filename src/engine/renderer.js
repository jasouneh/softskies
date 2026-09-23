import * as THREE from "../platform/three.js";

export function createRenderer({ root, clearColor = 0x7bd7ff } = {}) {
  if (!root) {
    throw new Error("createRenderer requires a root element.");
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(clearColor, 1);
  renderer.domElement.className = "softskies-canvas";
  if (THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  renderer.shadowMap.enabled = false;
  root.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.name = "SoftSkies playable scene";
  scene.background = new THREE.Color(clearColor);
  scene.fog = new THREE.Fog(0xbfeeff, 160, 760);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1_500);
  camera.name = "third-person phoenix chase camera";
  camera.position.set(0, 96, 32);
  camera.lookAt(0, 84, -48);

  function resize() {
    const { clientWidth, clientHeight } = root;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    resize,
    render() {
      renderer.render(scene, camera);
    },
    dispose() {
      window.removeEventListener("resize", resize);
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export function disposeObject(object3d) {
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
