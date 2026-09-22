import * as THREE from "../../platform/three.js";

const COLORS = {
  bark: new THREE.Color(0x7a4b2a),
  leaf: new THREE.Color(0x2f9e44),
  leafLight: new THREE.Color(0x55c96a),
  deadWood: new THREE.Color(0x7b6757),
  wall: new THREE.Color(0xd9b26f),
  roof: new THREE.Color(0xb65032),
  snow: new THREE.Color(0xf4fbff),
  iceShadow: new THREE.Color(0xc6e7f5),
};

export function createDressingMaterial() {
  return new THREE.MeshStandardMaterial({
    name: "procedural-world-dressing-vertex-colors",
    roughness: 0.9,
    flatShading: true,
    vertexColors: true,
  });
}

export function createDressingChunkObject(dressing, { material = createDressingMaterial() } = {}) {
  const builder = { positions: [], colors: [] };

  for (const feature of dressing.features) {
    if (feature.type === "tree") {
      addTree(builder, feature);
    } else if (feature.type === "house") {
      addHouse(builder, feature);
    } else if (feature.type === "dead-tree") {
      addDeadTree(builder, feature);
    } else if (feature.type === "igloo") {
      addIgloo(builder, feature);
    }
  }

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

function addTree(builder, feature) {
  const s = feature.scale;
  addBox(builder, feature.x, feature.y + 1.1 * s, feature.z, 0.45 * s, 2.2 * s, 0.45 * s, COLORS.bark, feature.yaw);
  addCone(builder, feature.x, feature.y + 1.5 * s, feature.z, 1.85 * s, 3.1 * s, 6, COLORS.leaf, feature.yaw);
  addCone(builder, feature.x, feature.y + 3.05 * s, feature.z, 1.25 * s, 2.0 * s, 6, COLORS.leafLight, feature.yaw + 0.4);
}

function addDeadTree(builder, feature) {
  const s = feature.scale;
  addBox(builder, feature.x, feature.y + 1.45 * s, feature.z, 0.34 * s, 2.9 * s, 0.34 * s, COLORS.deadWood, feature.yaw);
  addBox(builder, feature.x, feature.y + 2.3 * s, feature.z, 2.0 * s, 0.2 * s, 0.24 * s, COLORS.deadWood, feature.yaw + 0.45);
  addBox(builder, feature.x, feature.y + 1.78 * s, feature.z, 1.35 * s, 0.18 * s, 0.22 * s, COLORS.deadWood, feature.yaw - 0.82);
}

function addHouse(builder, feature) {
  const s = feature.scale;
  addBox(builder, feature.x, feature.y + 1.15 * s, feature.z, 3.6 * s, 2.3 * s, 3.2 * s, COLORS.wall, feature.yaw);
  addGableRoof(builder, feature.x, feature.y + 2.3 * s, feature.z, 4.2 * s, 1.4 * s, 3.9 * s, COLORS.roof, feature.yaw);
  const doorForward = transformLocal(0, -1.72 * s, feature.yaw);
  addBox(builder, feature.x + doorForward.x, feature.y + 0.72 * s, feature.z + doorForward.z, 0.72 * s, 1.45 * s, 0.18 * s, COLORS.bark, feature.yaw);
}

function addIgloo(builder, feature) {
  const s = feature.scale;
  addHemisphere(builder, feature.x, feature.y, feature.z, 2.3 * s, 8, 4, COLORS.snow, feature.yaw);
  const front = transformLocal(0, -2.0 * s, feature.yaw);
  addBox(builder, feature.x + front.x, feature.y + 0.62 * s, feature.z + front.z, 1.25 * s, 1.24 * s, 0.95 * s, COLORS.iceShadow, feature.yaw);
  addBox(builder, feature.x + front.x, feature.y + 0.38 * s, feature.z + front.z - 0.01, 0.74 * s, 0.78 * s, 1.02 * s, COLORS.deadWood, feature.yaw);
}

function addBox(builder, x, y, z, width, height, depth, color, yaw = 0) {
  const hx = width / 2;
  const hy = height / 2;
  const hz = depth / 2;
  const corners = [
    [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
    [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
  ].map(([localX, localY, localZ]) => {
    const rotated = transformLocal(localX, localZ, yaw);
    return { x: x + rotated.x, y: y + localY, z: z + rotated.z };
  });
  const faces = [
    [0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7],
    [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0],
  ];
  for (const [a, b, c, d] of faces) {
    pushQuad(builder, corners[a], corners[b], corners[c], corners[d], color);
  }
}

function addCone(builder, x, baseY, z, radius, height, sides, color, yaw = 0) {
  const apex = { x, y: baseY + height, z };
  const center = { x, y: baseY, z };
  const ring = [];
  for (let index = 0; index < sides; index += 1) {
    const angle = yaw + (index / sides) * Math.PI * 2;
    ring.push({ x: x + Math.cos(angle) * radius, y: baseY, z: z + Math.sin(angle) * radius });
  }
  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    pushTriangle(builder, ring[index], ring[next], apex, color);
    pushTriangle(builder, center, ring[index], ring[next], color);
  }
}

function addGableRoof(builder, x, y, z, width, height, depth, color, yaw = 0) {
  const hx = width / 2;
  const hz = depth / 2;
  const points = [
    [-hx, 0, -hz], [hx, 0, -hz], [0, height, -hz],
    [-hx, 0, hz], [hx, 0, hz], [0, height, hz],
  ].map(([localX, localY, localZ]) => {
    const rotated = transformLocal(localX, localZ, yaw);
    return { x: x + rotated.x, y: y + localY, z: z + rotated.z };
  });
  pushQuad(builder, points[0], points[3], points[5], points[2], color);
  pushQuad(builder, points[1], points[2], points[5], points[4], color);
  pushTriangle(builder, points[0], points[1], points[2], color);
  pushTriangle(builder, points[3], points[5], points[4], color);
}

function addHemisphere(builder, x, baseY, z, radius, sectors, rings, color, yaw = 0) {
  const points = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const theta = (ring / rings) * (Math.PI / 2);
    const y = baseY + Math.cos(theta) * radius;
    const r = Math.sin(theta) * radius;
    const row = [];
    for (let sector = 0; sector < sectors; sector += 1) {
      const angle = yaw + (sector / sectors) * Math.PI * 2;
      row.push({ x: x + Math.cos(angle) * r, y, z: z + Math.sin(angle) * r });
    }
    points.push(row);
  }

  for (let ring = 0; ring < rings; ring += 1) {
    for (let sector = 0; sector < sectors; sector += 1) {
      const next = (sector + 1) % sectors;
      if (ring === 0) {
        pushTriangle(builder, points[ring][sector], points[ring + 1][sector], points[ring + 1][next], color);
      } else {
        pushQuad(builder, points[ring][sector], points[ring + 1][sector], points[ring + 1][next], points[ring][next], color);
      }
    }
  }
}

function transformLocal(localX, localZ, yaw) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: localX * cos - localZ * sin,
    z: localX * sin + localZ * cos,
  };
}

function pushQuad(builder, a, b, c, d, color) {
  pushTriangle(builder, a, b, c, color);
  pushTriangle(builder, a, c, d, color);
}

function pushTriangle(builder, a, b, c, color) {
  pushPoint(builder, a, color);
  pushPoint(builder, b, color);
  pushPoint(builder, c, color);
}

function pushPoint(builder, point, color) {
  builder.positions.push(point.x, point.y, point.z);
  builder.colors.push(color.r, color.g, color.b);
}
