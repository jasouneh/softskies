import * as THREE from "../../platform/three.js";
import { createDressingGeometryData } from "./dressing-geometry.js";

export function createDressingMaterial() {
  return new THREE.MeshStandardMaterial({
    name: "procedural-world-dressing-vertex-colors",
    roughness: 0.9,
    flatShading: true,
    vertexColors: true,
  });
}

export function createDressingChunkObject(dressing, { material = createDressingMaterial() } = {}) {
  const builder = createDressingGeometryData(dressing);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(builder.positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(builder.colors, 3));
  if (builder.positions.length > 0) {
    geometry.computeVertexNormals();
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `world dressing ${dressing.key}`;
  mesh.userData.chunkKey = dressing.key;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

export function disposeDressingChunkObject(object3d) {
  object3d.traverse((node) => {
    if (node.geometry) {
      node.geometry.dispose();
    }
  });
}

export function disposeDressingMaterial(material) {
  material.dispose();
}
