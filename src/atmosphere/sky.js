import * as THREE from "../platform/three.js";
import { ATMOSPHERE_CONFIG } from "../config/game.js";
import { clamp, lerp, smoothstep } from "../world/generation/noise.js";

const PALETTES = [
  { t: 0, sky: 0x13274f, fog: 0x253f69, hemi: 0x1c315b, ground: 0x1c2837 },
  { t: 0.18, sky: 0xff9f70, fog: 0xffd08a, hemi: 0xffc796, ground: 0x59645c },
  { t: 0.32, sky: 0x72d8ff, fog: 0xc8f3ff, hemi: 0xdff7ff, ground: 0x6ab464 },
  { t: 0.68, sky: 0x65cfff, fog: 0xc6f0ff, hemi: 0xe4f8ff, ground: 0x70bf68 },
  { t: 0.84, sky: 0xf48a62, fog: 0xffbd7a, hemi: 0xffbc8f, ground: 0x4b5b60 },
  { t: 1, sky: 0x13274f, fog: 0x253f69, hemi: 0x1c315b, ground: 0x1c2837 },
];

export function createAtmosphere(scene, { config = ATMOSPHERE_CONFIG } = {}) {
  const sunLight = new THREE.DirectionalLight(0xfff2bd, 2.4);
  sunLight.name = "day-night sun key light";
  scene.add(sunLight);

  const hemi = new THREE.HemisphereLight(0xdff7ff, 0x537348, 1.6);
  hemi.name = "day-night ambient hemisphere";
  scene.add(hemi);

  const skyRig = new THREE.Group();
  skyRig.name = "procedural sky markers and future atmosphere hooks";
  scene.add(skyRig);

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(20, 12),
    new THREE.MeshBasicMaterial({ color: 0xffdf5d, side: THREE.DoubleSide, transparent: true }),
  );
  sun.name = "low-poly sun marker";
  skyRig.add(sun);

  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(14, 10),
    new THREE.MeshBasicMaterial({ color: 0xd8e9ff, side: THREE.DoubleSide, transparent: true }),
  );
  moon.name = "low-poly moon marker";
  skyRig.add(moon);

  const cloudHook = new THREE.Group();
  cloudHook.name = "deterministic cloud layer extension hook";
  skyRig.add(cloudHook);

  const starHook = new THREE.Group();
  starHook.name = "future stylized stars hook";
  skyRig.add(starHook);

  const skyColor = new THREE.Color();
  const fogColor = new THREE.Color();
  const hemiSky = new THREE.Color();
  const hemiGround = new THREE.Color();
  const tmpColorA = new THREE.Color();
  const tmpColorB = new THREE.Color();

  function update(elapsed, { camera } = {}) {
    const timeScale = config.timeScale ?? 1;
    const phase = (config.startPhase + (elapsed * timeScale) / config.dayLengthSeconds) % 1;
    const palette = samplePalette(phase, tmpColorA, tmpColorB);
    skyColor.copy(palette.sky);
    fogColor.copy(palette.fog);
    hemiSky.copy(palette.hemi);
    hemiGround.copy(palette.ground);

    scene.background = skyColor;
    if (!scene.fog) {
      scene.fog = new THREE.Fog(fogColor, 160, 760);
    }
    scene.fog.color.copy(fogColor);

    const angle = phase * Math.PI * 2;
    const radius = 560;
    const sunY = Math.sin(angle);
    const sunZ = Math.cos(angle);
    const sunPosition = new THREE.Vector3(-Math.cos(angle * 0.37) * radius * 0.35, sunY * radius, -sunZ * radius);
    const moonPosition = sunPosition.clone().multiplyScalar(-1);
    sun.position.copy(sunPosition);
    moon.position.copy(moonPosition);
    sunLight.position.copy(sunPosition).normalize();

    const dayFactor = smoothstep(-0.18, 0.26, sunY);
    const nightFactor = 1 - dayFactor;
    sun.material.opacity = clamp(dayFactor * 1.2);
    moon.material.opacity = clamp(nightFactor * 1.1);
    sunLight.intensity = lerp(0.25, 2.7, dayFactor);
    hemi.intensity = lerp(0.62, 1.85, dayFactor);
    hemi.color.copy(hemiSky);
    hemi.groundColor.copy(hemiGround);

    if (camera) {
      skyRig.position.copy(camera.position);
      sun.lookAt(camera.position);
      moon.lookAt(camera.position);
    }

    return { phase, dayFactor, nightFactor };
  }

  return { skyRig, sun, moon, sunLight, hemi, update };
}

function samplePalette(phase, colorA, colorB) {
  const wrapped = ((phase % 1) + 1) % 1;
  let lower = PALETTES[0];
  let upper = PALETTES[PALETTES.length - 1];
  for (let index = 0; index < PALETTES.length - 1; index += 1) {
    if (wrapped >= PALETTES[index].t && wrapped <= PALETTES[index + 1].t) {
      lower = PALETTES[index];
      upper = PALETTES[index + 1];
      break;
    }
  }
  const t = lower === upper ? 0 : smoothstep(0, 1, (wrapped - lower.t) / (upper.t - lower.t));
  return {
    sky: colorA.setHex(lower.sky).lerp(colorB.setHex(upper.sky), t).clone(),
    fog: colorA.setHex(lower.fog).lerp(colorB.setHex(upper.fog), t).clone(),
    hemi: colorA.setHex(lower.hemi).lerp(colorB.setHex(upper.hemi), t).clone(),
    ground: colorA.setHex(lower.ground).lerp(colorB.setHex(upper.ground), t).clone(),
  };
}
