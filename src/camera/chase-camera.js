import * as THREE from "../platform/three.js";
import { CAMERA_CONFIG } from "../config/game.js";
import { clamp } from "../world/generation/noise.js";

const WORLD_UP = new THREE.Vector3(0, 1, 0);

export function createChaseCamera(camera, options = {}) {
  return new ChaseCamera(camera, options);
}

export class ChaseCamera {
  constructor(camera, { config = CAMERA_CONFIG } = {}) {
    this.camera = camera;
    this.config = config;
    this.desired = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3(0, 80, -30);
    this.tmp = new THREE.Vector3();
  }

  update(dt, pose, { boost = false } = {}) {
    const cfg = this.config;
    const smoothing = 1 - Math.exp(-cfg.smoothing * dt);
    const lookSmoothing = 1 - Math.exp(-cfg.lookSmoothing * dt);
    const distance = cfg.chaseDistance + (boost ? 5 : 0);
    const height = cfg.chaseHeight + Math.abs(pose.roll) * 2.2;

    this.desired.copy(pose.position)
      .addScaledVector(pose.forward, -distance)
      .addScaledVector(WORLD_UP, height);
    this.camera.position.lerp(this.desired, smoothing);

    this.tmp.copy(pose.position)
      .addScaledVector(pose.forward, cfg.lookAhead)
      .addScaledVector(WORLD_UP, 2.6);
    this.lookTarget.lerp(this.tmp, lookSmoothing);
    this.camera.lookAt(this.lookTarget);

    const targetFov = boost ? cfg.boostFov : cfg.baseFov;
    this.camera.fov += (targetFov - this.camera.fov) * clamp(dt * 3.5, 0, 1);
    this.camera.updateProjectionMatrix();
  }
}
