import * as THREE from "../platform/three.js";
import { FLIGHT_CONFIG } from "../config/game.js";
import { clamp } from "../world/generation/noise.js";

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);

export function createPhoenixController(options = {}) {
  return new PhoenixController(options);
}

function createRandomStart(config, getTerrainHeight) {
  const radius = config.startRadius ?? 0;
  if (radius <= 0) {
    return { x: 0, y: config.startAltitude, z: 0 };
  }

  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * radius;
  const x = Math.cos(angle) * distance;
  const z = Math.sin(angle) * distance;
  return {
    x,
    y: getTerrainHeight(x, z) + config.startAltitude,
    z,
  };
}

export class PhoenixController {
  constructor({ config = FLIGHT_CONFIG, getTerrainHeight = () => 0 } = {}) {
    this.config = config;
    this.getTerrainHeight = getTerrainHeight;
    const start = createRandomStart(config, getTerrainHeight);
    this.position = new THREE.Vector3(start.x, start.y, start.z);
    this.quaternion = new THREE.Quaternion();
    this.euler = new THREE.Euler(0, 0, 0, "YXZ");
    this.pitch = -0.04;
    this.yaw = 0;
    this.roll = 0;
    this.speed = config.baseSpeed;
    this.forward = new THREE.Vector3(0, 0, -1);
    this.velocity = new THREE.Vector3();
    this.bankAmount = 0;
  }

  update(dt, intent = {}) {
    const cfg = this.config;
    const boost = Boolean(intent.boost);
    const targetSpeed = boost ? cfg.boostSpeed : cfg.baseSpeed;
    this.speed += (targetSpeed - this.speed) * clamp(dt * cfg.acceleration, 0, 1);

    this.yaw += (intent.mouseYawDelta || 0);
    this.pitch += (intent.mousePitchDelta || 0);
    this.pitch += (intent.pitch || 0) * cfg.pitchRate * dt;
    this.yaw -= (intent.yaw || 0) * cfg.yawRate * dt;

    const targetRoll = -(intent.roll || 0) * cfg.maxRoll;
    const rollBlend = 1 - Math.exp(-cfg.rollResponsiveness * dt);
    this.roll += (targetRoll - this.roll) * rollBlend;
    this.yaw += this.roll * cfg.bankYawRate * dt;
    if (Math.abs(intent.roll || 0) < 0.01) {
      this.roll += (0 - this.roll) * clamp(dt * cfg.autoLevel, 0, 1);
    }

    this.pitch = clamp(this.pitch, cfg.minPitch, cfg.maxPitch);
    this.euler.set(this.pitch, this.yaw, this.roll, "YXZ");
    this.quaternion.setFromEuler(this.euler);
    this.forward.copy(FORWARD).applyQuaternion(this.quaternion).normalize();
    this.velocity.copy(this.forward).multiplyScalar(this.speed);
    this.position.addScaledVector(this.velocity, dt);

    const terrainHeight = this.getTerrainHeight(this.position.x, this.position.z);
    const floor = terrainHeight + cfg.minTerrainClearance;
    if (this.position.y < floor) {
      const correction = (floor - this.position.y) * clamp(dt * 5, 0, 1);
      this.position.y += correction;
      this.pitch = Math.max(this.pitch, -0.08);
    }

    this.position.y = Math.max(this.position.y, floor);
    this.bankAmount = -this.roll / cfg.maxRoll;
  }

  getPose() {
    return {
      position: this.position,
      quaternion: this.quaternion,
      forward: this.forward,
      up: WORLD_UP,
      speed: this.speed,
      pitch: this.pitch,
      yaw: this.yaw,
      roll: this.roll,
      bankAmount: this.bankAmount,
    };
  }
}
