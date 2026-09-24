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
  jungleLeaf: colorFromHex(0x2f9b4f),
  rainforestLeaf: colorFromHex(0x147a4f),
  palmLeaf: colorFromHex(0x4fae5d),
  reedRoof: colorFromHex(0xa98746),
  sandstone: colorFromHex(0xc59a5b),
  sunbakedCloth: colorFromHex(0xd97244),
  campfire: colorFromHex(0xffb347),
  cactus: colorFromHex(0x5b9855),
  cactusFlower: colorFromHex(0xffd37a),
  waterfall: colorFromHex(0x67cfff),
  waterfallFoam: colorFromHex(0xd9f7ff),
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
    } else if (feature.type === "jungle-tree") {
      addJungleTree(builder, feature);
    } else if (feature.type === "rainforest-tree") {
      addRainforestTree(builder, feature);
    } else if (feature.type === "desert-palm") {
      addDesertPalm(builder, feature);
    } else if (feature.type === "jungle-hut") {
      addJungleHut(builder, feature);
    } else if (feature.type === "rainforest-shrine") {
      addRainforestShrine(builder, feature);
    } else if (feature.type === "desert-camp") {
      addDesertCamp(builder, feature);
    } else if (feature.type === "desert-ruin") {
      addDesertRuin(builder, feature);
    } else if (feature.type === "cactus") {
      addCactus(builder, feature);
    } else if (feature.type === "waterfall") {
      addWaterfall(builder, feature);
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

function addJungleTree(builder, feature) {
  const s = feature.scale;
  addBox(builder, feature.x, feature.y + 2.45 * s, feature.z, 0.58 * s, 4.9 * s, 0.58 * s, COLORS.bark, feature.yaw);
  addCone(builder, feature.x, feature.y + 3.55 * s, feature.z, 2.65 * s, 3.0 * s, 8, COLORS.jungleLeaf, feature.yaw + 0.24);
  addCone(builder, feature.x, feature.y + 4.85 * s, feature.z, 2.05 * s, 2.55 * s, 8, COLORS.leafLight, feature.yaw - 0.22);
  for (let index = 0; index < 5; index += 1) {
    const angle = feature.yaw + (index / 5) * Math.PI * 2;
    const leaf = transformLocal(0, -1.35 * s, angle);
    addBox(builder, feature.x + leaf.x, feature.y + 5.1 * s, feature.z + leaf.z, 0.62 * s, 0.18 * s, 3.0 * s, COLORS.jungleLeaf, angle);
  }
}

function addRainforestTree(builder, feature) {
  const s = feature.scale;
  addBox(builder, feature.x, feature.y + 3.1 * s, feature.z, 0.66 * s, 6.2 * s, 0.66 * s, COLORS.bark, feature.yaw);
  addCone(builder, feature.x, feature.y + 4.7 * s, feature.z, 3.0 * s, 3.4 * s, 9, COLORS.rainforestLeaf, feature.yaw);
  addCone(builder, feature.x, feature.y + 6.05 * s, feature.z, 2.2 * s, 2.7 * s, 9, COLORS.jungleLeaf, feature.yaw + 0.32);
  const vine = transformLocal(0.72 * s, 0.18 * s, feature.yaw);
  addBox(builder, feature.x + vine.x, feature.y + 3.1 * s, feature.z + vine.z, 0.18 * s, 4.2 * s, 0.18 * s, COLORS.leaf, feature.yaw + 0.18);
  for (let index = 0; index < 4; index += 1) {
    const angle = feature.yaw + Math.PI / 4 + (index / 4) * Math.PI * 2;
    const root = transformLocal(0, -0.68 * s, angle);
    addBox(builder, feature.x + root.x, feature.y + 0.38 * s, feature.z + root.z, 0.24 * s, 0.76 * s, 1.5 * s, COLORS.bark, angle);
  }
}

function addDesertPalm(builder, feature) {
  const s = feature.scale;
  addBox(builder, feature.x, feature.y + 1.65 * s, feature.z, 0.42 * s, 3.3 * s, 0.42 * s, COLORS.bark, feature.yaw + 0.18);
  for (let index = 0; index < 6; index += 1) {
    const angle = feature.yaw + (index / 6) * Math.PI * 2;
    const frond = transformLocal(0, -1.18 * s, angle);
    addBox(builder, feature.x + frond.x, feature.y + 3.28 * s, feature.z + frond.z, 0.42 * s, 0.16 * s, 2.55 * s, COLORS.palmLeaf, angle);
  }
}

function addJungleHut(builder, feature) {
  const s = feature.scale;
  addBox(builder, feature.x, feature.y + 0.72 * s, feature.z, 3.2 * s, 0.26 * s, 3.0 * s, COLORS.bark, feature.yaw);
  addBox(builder, feature.x, feature.y + 1.62 * s, feature.z, 2.8 * s, 1.8 * s, 2.6 * s, COLORS.wall, feature.yaw);
  addGableRoof(builder, feature.x, feature.y + 2.5 * s, feature.z, 3.7 * s, 1.25 * s, 3.4 * s, COLORS.reedRoof, feature.yaw);
  for (const [lx, lz] of [[-1.35, -1.25], [1.35, -1.25], [-1.35, 1.25], [1.35, 1.25]]) {
    const post = transformLocal(lx * s, lz * s, feature.yaw);
    addBox(builder, feature.x + post.x, feature.y + 0.7 * s, feature.z + post.z, 0.18 * s, 1.4 * s, 0.18 * s, COLORS.bark, feature.yaw);
  }
}

function addRainforestShrine(builder, feature) {
  const s = feature.scale;
  addBox(builder, feature.x, feature.y + 0.28 * s, feature.z, 4.0 * s, 0.56 * s, 4.0 * s, COLORS.rock, feature.yaw);
  addBox(builder, feature.x, feature.y + 0.78 * s, feature.z, 2.9 * s, 0.52 * s, 2.9 * s, COLORS.sandstone, feature.yaw);
  addBox(builder, feature.x, feature.y + 1.26 * s, feature.z, 1.7 * s, 0.48 * s, 1.7 * s, COLORS.rock, feature.yaw);
  addCone(builder, feature.x, feature.y + 1.44 * s, feature.z, 0.95 * s, 1.35 * s, 4, COLORS.sandstone, feature.yaw + Math.PI / 4);
}

function addDesertCamp(builder, feature) {
  const s = feature.scale;
  addGableRoof(builder, feature.x, feature.y + 0.14 * s, feature.z, 3.5 * s, 1.55 * s, 3.0 * s, COLORS.sunbakedCloth, feature.yaw);
  const fire = transformLocal(0, 2.25 * s, feature.yaw);
  addCone(builder, feature.x + fire.x, feature.y + 0.08 * s, feature.z + fire.z, 0.7 * s, 0.95 * s, 5, COLORS.campfire, feature.yaw);
}

function addCactus(builder, feature) {
  const s = feature.scale;
  addBox(builder, feature.x, feature.y + 1.35 * s, feature.z, 0.48 * s, 2.7 * s, 0.48 * s, COLORS.cactus, feature.yaw);
  const armA = transformLocal(0.48 * s, 0, feature.yaw);
  const armB = transformLocal(-0.48 * s, 0, feature.yaw);
  addBox(builder, feature.x + armA.x, feature.y + 1.65 * s, feature.z + armA.z, 0.34 * s, 1.25 * s, 0.34 * s, COLORS.cactus, feature.yaw);
  addBox(builder, feature.x + armA.x * 1.45, feature.y + 2.16 * s, feature.z + armA.z * 1.45, 0.86 * s, 0.28 * s, 0.32 * s, COLORS.cactus, feature.yaw);
  addBox(builder, feature.x + armB.x, feature.y + 1.25 * s, feature.z + armB.z, 0.32 * s, 0.92 * s, 0.32 * s, COLORS.cactus, feature.yaw);
  addBox(builder, feature.x, feature.y + 2.84 * s, feature.z, 0.28 * s, 0.16 * s, 0.28 * s, COLORS.cactusFlower, feature.yaw);
}

function addWaterfall(builder, feature) {
  const s = feature.scale;
  const direction = feature.yaw;
  const drop = 4.0 * s;
  const face = transformLocal(0, -0.18 * s, direction);
  addBox(builder, feature.x + face.x, feature.y + 1.9 * s, feature.z + face.z, 2.2 * s, drop, 0.16 * s, COLORS.waterfall, direction);
  addBox(builder, feature.x - face.x * 1.8, feature.y + 0.08 * s, feature.z - face.z * 1.8, 2.6 * s, 0.16 * s, 1.25 * s, COLORS.waterfallFoam, direction);
  addBox(builder, feature.x + face.x * 1.1, feature.y + 3.95 * s, feature.z + face.z * 1.1, 2.35 * s, 0.18 * s, 0.36 * s, COLORS.waterfallFoam, direction);
}

function addDesertRuin(builder, feature) {
  const s = feature.scale;
  addBox(builder, feature.x, feature.y + 0.22 * s, feature.z, 4.2 * s, 0.44 * s, 3.4 * s, COLORS.sandstone, feature.yaw);
  for (const [lx, lz, h] of [[-1.6, -1.1, 2.1], [1.5, -1.0, 1.65], [-1.4, 1.2, 1.25], [1.45, 1.05, 2.35]]) {
    const column = transformLocal(lx * s, lz * s, feature.yaw);
    addBox(builder, feature.x + column.x, feature.y + (0.35 + h / 2) * s, feature.z + column.z, 0.46 * s, h * s, 0.46 * s, COLORS.sandstone, feature.yaw);
  }
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
