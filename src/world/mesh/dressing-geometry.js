const COLORS = Object.freeze({
  bark: colorFromHex(0x6c5738),
  leaf: colorFromHex(0x4f9656),
  leafLight: colorFromHex(0x6cab61),
  deadWood: colorFromHex(0x7b6757),
  rock: colorFromHex(0x68747c),
  wall: colorFromHex(0xb8ad78),
  roof: colorFromHex(0x8b7653),
  blacksmithRoof: colorFromHex(0x3f4548),
  farm: colorFromHex(0x9bc66d),
  soil: colorFromHex(0x7a5a36),
  snow: colorFromHex(0xf4fbff),
  snowRoof: colorFromHex(0xd5edf7),
  iceShadow: colorFromHex(0xc6e7f5),
});

export function createDressingGeometryData(dressing) {
  const builder = { positions: [], colors: [] };

  for (const feature of dressing.features) {
    if (feature.type === "tree") {
      addTree(builder, feature);
    } else if (feature.type === "house") {
      addHouse(builder, feature);
    } else if (feature.type === "blacksmith") {
      addBlacksmith(builder, feature);
    } else if (feature.type === "farm") {
      addFarm(builder, feature);
    } else if (feature.type === "snow-house") {
      addSnowHouse(builder, feature);
    } else if (feature.type === "snow-farm") {
      addSnowFarm(builder, feature);
    } else if (feature.type === "dead-tree") {
      addDeadTree(builder, feature);
    } else if (feature.type === "igloo") {
      addIgloo(builder, feature);
    }
  }

  return builder;
}

function colorFromHex(hex) {
  return Object.freeze({
    r: ((hex >> 16) & 0xff) / 255,
    g: ((hex >> 8) & 0xff) / 255,
    b: (hex & 0xff) / 255,
  });
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
  const chimney = transformLocal(1.25 * s, -0.8 * s, feature.yaw);
  addBox(builder, feature.x + chimney.x, feature.y + 3.25 * s, feature.z + chimney.z, 0.42 * s, 0.92 * s, 0.42 * s, COLORS.deadWood, feature.yaw);
}

function addBlacksmith(builder, feature) {
  const s = feature.scale;
  addBox(builder, feature.x, feature.y + 1.05 * s, feature.z, 4.5 * s, 2.1 * s, 3.7 * s, COLORS.wall, feature.yaw);
  addGableRoof(builder, feature.x, feature.y + 2.1 * s, feature.z, 5.05 * s, 1.25 * s, 4.25 * s, COLORS.blacksmithRoof, feature.yaw);
  const forge = transformLocal(-2.7 * s, 0.4 * s, feature.yaw);
  addBox(builder, feature.x + forge.x, feature.y + 0.72 * s, feature.z + forge.z, 1.3 * s, 1.45 * s, 1.35 * s, COLORS.rock, feature.yaw);
  const chimney = transformLocal(1.45 * s, -0.75 * s, feature.yaw);
  addBox(builder, feature.x + chimney.x, feature.y + 3.1 * s, feature.z + chimney.z, 0.55 * s, 1.45 * s, 0.55 * s, COLORS.blacksmithRoof, feature.yaw);
}

function addFarm(builder, feature) {
  const s = feature.scale;
  addBox(builder, feature.x, feature.y + 0.04 * s, feature.z, 5.2 * s, 0.08 * s, 3.9 * s, COLORS.soil, feature.yaw);
  for (const offset of [-1.45, 0, 1.45]) {
    const row = transformLocal(offset * s, 0, feature.yaw);
    addBox(builder, feature.x + row.x, feature.y + 0.16 * s, feature.z + row.z, 0.55 * s, 0.2 * s, 3.5 * s, COLORS.farm, feature.yaw);
  }
  const postA = transformLocal(-2.8 * s, -2.1 * s, feature.yaw);
  const postB = transformLocal(2.8 * s, 2.1 * s, feature.yaw);
  addBox(builder, feature.x + postA.x, feature.y + 0.48 * s, feature.z + postA.z, 0.22 * s, 0.96 * s, 0.22 * s, COLORS.bark, feature.yaw);
  addBox(builder, feature.x + postB.x, feature.y + 0.48 * s, feature.z + postB.z, 0.22 * s, 0.96 * s, 0.22 * s, COLORS.bark, feature.yaw);
}

function addSnowHouse(builder, feature) {
  const s = feature.scale;
  addBox(builder, feature.x, feature.y + 1.0 * s, feature.z, 3.4 * s, 2.0 * s, 3.0 * s, COLORS.iceShadow, feature.yaw);
  addGableRoof(builder, feature.x, feature.y + 2.0 * s, feature.z, 4.0 * s, 1.15 * s, 3.7 * s, COLORS.snowRoof, feature.yaw);
  const doorForward = transformLocal(0, -1.62 * s, feature.yaw);
  addBox(builder, feature.x + doorForward.x, feature.y + 0.64 * s, feature.z + doorForward.z, 0.68 * s, 1.28 * s, 0.18 * s, COLORS.deadWood, feature.yaw);
}

function addSnowFarm(builder, feature) {
  const s = feature.scale;
  addBox(builder, feature.x, feature.y + 0.05 * s, feature.z, 5.0 * s, 0.1 * s, 3.6 * s, COLORS.snow, feature.yaw);
  for (const offset of [-1.25, 1.25]) {
    const row = transformLocal(offset * s, 0, feature.yaw);
    addBox(builder, feature.x + row.x, feature.y + 0.18 * s, feature.z + row.z, 0.55 * s, 0.24 * s, 3.1 * s, COLORS.iceShadow, feature.yaw);
  }
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
    [0, 3, 2, 1], [4, 5, 6, 7], [4, 7, 3, 0],
    [1, 2, 6, 5], [3, 7, 6, 2], [4, 0, 1, 5],
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
    pushTriangle(builder, ring[next], ring[index], apex, color);
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
  pushTriangle(builder, points[0], points[2], points[1], color);
  pushTriangle(builder, points[3], points[4], points[5], color);
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
        pushTriangle(builder, points[ring][sector], points[ring + 1][next], points[ring + 1][sector], color);
      } else {
        pushQuad(builder, points[ring][sector], points[ring][next], points[ring + 1][next], points[ring + 1][sector], color);
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
