import * as THREE from "../platform/three.js";
import { CLOUD_CONFIG, WORLD_SEED } from "../config/game.js";
import { cloudCellCoordsForWorld, generateCloudField, resolveCloudConfig } from "./cloud-cells.js";

const DAY_CLOUD = new THREE.Color(0xfff9df);
const NIGHT_CLOUD = new THREE.Color(0x6e86a9);
const TWILIGHT_CLOUD = new THREE.Color(0xffbd8a);

export function createCloudLayer(scene, { seed = WORLD_SEED, config = CLOUD_CONFIG } = {}) {
  const cfg = resolveCloudConfig(config);
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  geometry.name = "low-poly procedural cloud puff geometry";

  const material = new THREE.MeshLambertMaterial({
    name: "low-poly procedural cloud material",
    color: DAY_CLOUD,
    transparent: true,
    opacity: cfg.opacity,
    depthWrite: false,
    flatShading: true,
  });

  const maxInstances = cfg.maxPuffs;
  const mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
  mesh.name = "bounded deterministic cloud puffs";
  mesh.count = 0;
  mesh.frustumCulled = false;
  if (mesh.instanceMatrix.setUsage && THREE.DynamicDrawUsage) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  const group = new THREE.Group();
  group.name = "deterministic large-cell cloud layer";
  group.add(mesh);
  scene.add(group);

  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  let field = null;
  let fieldKey = "";

  function update({ camera, playerPosition, elapsed = 0, atmosphere = {} } = {}) {
    const source = playerPosition ?? camera?.position ?? { x: 0, z: 0 };
    const driftX = Math.cos(cfg.driftDirection) * elapsed * cfg.driftSpeed;
    const driftZ = Math.sin(cfg.driftDirection) * elapsed * cfg.driftSpeed;
    const sampleX = source.x - driftX;
    const sampleZ = source.z - driftZ;
    const center = cloudCellCoordsForWorld(sampleX, sampleZ, cfg.cellSize);
    const nextFieldKey = `${center.x},${center.z}`;

    if (nextFieldKey !== fieldKey || !field) {
      field = generateCloudField(seed, sampleX, sampleZ, cfg);
      fieldKey = nextFieldKey;
    }

    const count = Math.min(field.puffs.length, maxInstances);
    for (let index = 0; index < count; index += 1) {
      const puff = field.puffs[index];
      position.set(puff.x + driftX, puff.y, puff.z + driftZ);
      scale.set(puff.radiusX, puff.radiusY, puff.radiusZ);
      euler.set(0, puff.yaw, 0);
      quaternion.setFromEuler(euler);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    updateCloudMaterial(material, color, atmosphere, cfg);

    return {
      fieldKey,
      visiblePuffs: count,
      activeCells: field.stats.activeCells,
      maxPuffs: maxInstances,
    };
  }

  return {
    object: group,
    mesh,
    update,
    dispose() {
      scene.remove(group);
      geometry.dispose();
      material.dispose();
    },
  };
}

function updateCloudMaterial(material, color, atmosphere, config) {
  const dayFactor = atmosphere?.dayFactor ?? 1;
  const phase = atmosphere?.phase ?? 0.32;
  const warmFactor = Math.max(
    0,
    1 - Math.min(Math.abs(phase - 0.25) / 0.08, Math.abs(phase - 0.75) / 0.08, 1),
  ) * 0.3;

  color.copy(NIGHT_CLOUD).lerp(DAY_CLOUD, dayFactor).lerp(TWILIGHT_CLOUD, warmFactor);
  material.color.copy(color);
  material.opacity = config.opacity * (0.44 + dayFactor * 0.56);
}
