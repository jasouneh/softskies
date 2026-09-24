import assert from "node:assert/strict";
import test from "node:test";

import { createDressingGeometryData } from "../src/world/mesh/dressing-geometry.js";

const BOX_TRIANGLES = 12;
const HOUSE_WALL_TRIANGLES = BOX_TRIANGLES;
const HOUSE_ROOF_TRIANGLES = 6;
const TREE_CONE_TRIANGLES = 12;
const EPSILON = 1e-8;

test("house wall and roof triangles face outward for browser front-side rendering", () => {
  const feature = { type: "house", x: 12, y: 3, z: -8, yaw: 0.72, scale: 1.15 };
  const geometry = createDressingGeometryData({ key: "house-test", features: [feature] });
  const wallCenter = { x: feature.x, y: feature.y + 1.15 * feature.scale, z: feature.z };
  const roofCenter = { x: feature.x, y: feature.y + 2.3 * feature.scale + (1.4 * feature.scale) / 3, z: feature.z };

  assertTrianglesFaceAway(geometry.positions, 0, HOUSE_WALL_TRIANGLES, wallCenter, "wall");
  assertTrianglesFaceAway(geometry.positions, HOUSE_WALL_TRIANGLES, HOUSE_ROOF_TRIANGLES, roofCenter, "roof");
});

test("village and biome specialty features generate low-poly geometry", () => {
  const features = [
    { type: "blacksmith", x: 0, y: 1, z: 0, yaw: 0.2, scale: 1 },
    { type: "farm", x: 8, y: 1, z: 0, yaw: 0.4, scale: 1 },
    { type: "snow-house", x: 16, y: 1, z: 0, yaw: 0.6, scale: 1 },
    { type: "snow-farm", x: 24, y: 1, z: 0, yaw: 0.8, scale: 1 },
    { type: "jungle-hut", x: 32, y: 1, z: 0, yaw: 1.0, scale: 1 },
    { type: "rainforest-shrine", x: 40, y: 1, z: 0, yaw: 1.2, scale: 1 },
    { type: "desert-camp", x: 48, y: 1, z: 0, yaw: 1.4, scale: 1 },
    { type: "desert-ruin", x: 56, y: 1, z: 0, yaw: 1.6, scale: 1 },
    { type: "desert-palm", x: 64, y: 1, z: 0, yaw: 1.8, scale: 1 },
  ];
  const geometry = createDressingGeometryData({ key: "village-detail-test", features });

  assert.ok(geometry.positions.length > 0);
  assert.equal(geometry.positions.length % 9, 0);
  assert.equal(geometry.colors.length, geometry.positions.length);
});

test("tree trunk and leaf triangles face outward for browser front-side rendering", () => {
  const feature = { type: "tree", x: -5, y: 2, z: 7, yaw: 1.12, scale: 0.9 };
  const geometry = createDressingGeometryData({ key: "tree-test", features: [feature] });
  const trunkCenter = { x: feature.x, y: feature.y + 1.1 * feature.scale, z: feature.z };
  const lowerConeCenter = coneCenter(feature, 1.5, 3.1);
  const upperConeCenter = coneCenter(feature, 3.05, 2.0);

  assertTrianglesFaceAway(geometry.positions, 0, BOX_TRIANGLES, trunkCenter, "tree trunk");
  assertTrianglesFaceAway(geometry.positions, BOX_TRIANGLES, TREE_CONE_TRIANGLES, lowerConeCenter, "lower tree canopy");
  assertTrianglesFaceAway(geometry.positions, BOX_TRIANGLES + TREE_CONE_TRIANGLES, TREE_CONE_TRIANGLES, upperConeCenter, "upper tree canopy");
});

function assertTrianglesFaceAway(positions, startTriangle, triangleCount, center, label) {
  for (let index = startTriangle; index < startTriangle + triangleCount; index += 1) {
    assert.ok(pointsAwayFrom(triangleAt(positions, index), center), `${label} triangle ${index - startTriangle} should face away from its center`);
  }
}

function coneCenter(feature, baseOffset, height) {
  return {
    x: feature.x,
    y: feature.y + baseOffset * feature.scale + (height * feature.scale) / 4,
    z: feature.z,
  };
}

function triangleAt(positions, triangleIndex) {
  const offset = triangleIndex * 9;
  return [
    { x: positions[offset], y: positions[offset + 1], z: positions[offset + 2] },
    { x: positions[offset + 3], y: positions[offset + 4], z: positions[offset + 5] },
    { x: positions[offset + 6], y: positions[offset + 7], z: positions[offset + 8] },
  ];
}

function pointsAwayFrom([a, b, c], center) {
  const normal = cross(subtract(b, a), subtract(c, a));
  const centroid = {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3,
    z: (a.z + b.z + c.z) / 3,
  };
  return dot(normal, subtract(centroid, center)) > EPSILON;
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
