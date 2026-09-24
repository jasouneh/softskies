import * as THREE from "../platform/three.js";
import { ATMOSPHERE_CONFIG } from "../config/game.js";
import { clamp, lerp } from "../world/generation/noise.js";
import { advanceAtmospherePhase, sampleAtmospherePalette, sampleSunCycle } from "./day-night.js";
import { createNightSky } from "./stars.js";

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
  starHook.name = "procedural Milky Way and stars hook";
  skyRig.add(starHook);
  const nightSky = createNightSky(starHook);

  const skyColor = new THREE.Color();
  const fogColor = new THREE.Color();
  const hemiSky = new THREE.Color();
  const hemiGround = new THREE.Color();

  function update(elapsed, { camera } = {}) {
    const phase = advanceAtmospherePhase(elapsed, config);
    const palette = sampleAtmospherePalette(phase);
    skyColor.setHex(palette.sky);
    fogColor.setHex(palette.fog);
    hemiSky.setHex(palette.hemi);
    hemiGround.setHex(palette.ground);

    scene.background = skyColor;
    if (!scene.fog) {
      scene.fog = new THREE.Fog(fogColor, 160, 760);
    }
    scene.fog.color.copy(fogColor);

    const { angle, sunY, sunZ, dayFactor, nightFactor, starFactor } = sampleSunCycle(phase);
    const radius = 560;
    const sunPosition = new THREE.Vector3(-Math.cos(angle * 0.37) * radius * 0.35, sunY * radius, -sunZ * radius);
    const moonPosition = sunPosition.clone().multiplyScalar(-1);
    sun.position.copy(sunPosition);
    moon.position.copy(moonPosition);
    sunLight.position.copy(sunPosition).normalize();

    sun.material.opacity = clamp(dayFactor * 1.2);
    moon.material.opacity = clamp(nightFactor * 1.1);
    sunLight.intensity = lerp(0.02, 2.7, dayFactor);
    hemi.intensity = lerp(0.14, 1.85, dayFactor);
    hemi.color.copy(hemiSky);
    hemi.groundColor.copy(hemiGround);
    const nightSkyState = nightSky.update({ nightFactor });

    if (camera) {
      skyRig.position.copy(camera.position);
      sun.lookAt(camera.position);
      moon.lookAt(camera.position);
    }

    return { phase, dayFactor, nightFactor, starFactor, ...nightSkyState };
  }

  return { skyRig, sun, moon, sunLight, hemi, nightSky, update };
}
