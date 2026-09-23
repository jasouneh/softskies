import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../", import.meta.url);

async function readProjectFile(relativePath) {
  return readFile(new URL(relativePath, rootUrl), "utf8");
}

test("source page points at the native browser module entry", async () => {
  const html = await readProjectFile("index.html");

  assert.match(html, /<script type="module" src="\.\/src\/main\.js"><\/script>/);
  assert.match(html, /<meta name="softskies-base-path" content="\.\/" \/>/);
  assert.doesNotMatch(html, /dist\//, "source page should not reference generated output");
});

test("hud exposes compact pause/play and avatar thumbnail menu hooks", async () => {
  const [html, hud] = await Promise.all([
    readProjectFile("index.html"),
    readProjectFile("src/ui/hud.js"),
  ]);

  assert.match(html, /background: rgb\(24 42 35 \/ 28%\)/);
  assert.match(html, /\.softskies-pause-button[\s\S]*width: 4\.25rem/);
  assert.match(hud, /textContent = paused \? "Play" : "Pause"/);
  assert.match(hud, /data-action="avatar-trigger"/);
  assert.match(hud, /softskies-avatar-thumb/);
  assert.doesNotMatch(hud, /<select/);
  assert.doesNotMatch(hud, /Resume/);
});

test("source entry imports Three.js through the project boundary and wires clouds", async () => {
  const source = await readProjectFile("src/main.js");
  const threeBoundary = await readProjectFile("src/platform/three.js");

  assert.match(source, /import \* as THREE from "\.\/platform\/three\.js";/);
  assert.match(source, /import \{ createCloudLayer \} from "\.\/atmosphere\/clouds\.js";/);
  assert.match(source, /const cloudLayer = createCloudLayer\(scene\);/);
  assert.match(source, /cloudLayer\.update/);
  assert.match(source, /export function createSoftSkiesShell/);
  assert.match(source, /export function mountSoftSkiesShell/);
  assert.match(threeBoundary, /THREE_VERSION = "0\.170\.0"/);
  assert.match(threeBoundary, /https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.170\.0\/build\/three\.module\.js/);
});

test("flight starts from a random terrain-safe map position", async () => {
  const [config, controller] = await Promise.all([
    readProjectFile("src/config/game.js"),
    readProjectFile("src/flight/phoenix-controller.js"),
  ]);

  assert.match(config, /startRadius: 4200/);
  assert.match(controller, /Math\.random\(\) \* Math\.PI \* 2/);
  assert.match(controller, /Math\.sqrt\(Math\.random\(\)\) \* radius/);
  assert.match(controller, /getTerrainHeight\(x, z\) \+ config\.startAltitude/);
  assert.doesNotMatch(controller, /new THREE\.Vector3\(0, config\.startAltitude, 0\)/);
});

test("phoenix source stays procedural and wires bounded fire and boost wind effects", async () => {
  const [source, phoenix] = await Promise.all([
    readProjectFile("src/main.js"),
    readProjectFile("src/flight/phoenix-view.js"),
  ]);

  assert.match(source, /phoenix\.update\(dt, playableElapsed, updatedPose, \{/);
  assert.match(source, /pitch: intent\.pitch/);
  assert.match(source, /roll: intent\.roll/);
  assert.match(source, /mousePitchDelta: intent\.mousePitchDelta/);
  assert.match(source, /mouseYawDelta: intent\.mouseYawDelta/);
  assert.match(phoenix, /FIRE_PARTICLE_COUNT = 72/);
  assert.match(phoenix, /new THREE\.InstancedMesh\(geometry, material, FIRE_PARTICLE_COUNT\)/);
  assert.match(phoenix, /bounded procedural phoenix fire particle trail/);
  assert.match(phoenix, /layered body flame facets/);
  assert.match(phoenix, /low-poly primary feather/);
  assert.match(phoenix, /getWingClimbTarget/);
  assert.match(phoenix, /getWingTurnTarget/);
  assert.match(phoenix, /actionIntensity/);
  assert.match(phoenix, /levelFlightTime > 1\.15/);
  assert.match(phoenix, /\* 0\.75/);
  assert.match(phoenix, /trailLength = 9\.1/);
  assert.doesNotMatch(phoenix, /pose\.speed > 58/);
  assert.match(phoenix, /boost wingtip wind animation/);
  assert.match(phoenix, /WIND_STREAKS_PER_SIDE = 5/);
  assert.doesNotMatch(phoenix, /https?:\/\//);
});
