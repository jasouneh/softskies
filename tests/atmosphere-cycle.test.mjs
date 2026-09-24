import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { hexChannel, sampleAtmospherePalette, sampleSunCycle } from "../src/atmosphere/day-night.js";

const rootUrl = new URL("../", import.meta.url);

function channels(hex) {
  return [hexChannel(hex, "r"), hexChannel(hex, "g"), hexChannel(hex, "b")];
}

async function readProjectFile(relativePath) {
  return readFile(new URL(relativePath, rootUrl), "utf8");
}

test("night phases use a genuinely dark palette instead of sunset orange", () => {
  const lateNight = sampleAtmospherePalette(0.84);
  const dusk = sampleAtmospherePalette(0.76);
  const [nightR, nightG, nightB] = channels(lateNight.sky);
  const [duskR] = channels(dusk.sky);

  assert.ok(sampleSunCycle(0.84).nightFactor > 0.95, "fixture should be in night mode");
  assert.ok(Math.max(nightR, nightG, nightB) < 72, "night sky should stay dark");
  assert.ok(nightB > nightR, "night sky should be blue-black, not orange");
  assert.ok(duskR > nightR * 4, "warm sunset color should be limited to the dusk band");
});

test("sun height, star visibility, and day/night duration align", () => {
  assert.ok(sampleSunCycle(0).starFactor > 0.95, "midnight should show stars");
  assert.ok(sampleSunCycle(0.5).dayFactor > 0.95, "midday should be bright");
  assert.ok(sampleSunCycle(0.24).starFactor < 0.5, "sunrise glow should not be full night");

  let daySamples = 0;
  let nightSamples = 0;
  for (let index = 0; index < 720; index += 1) {
    const cycle = sampleSunCycle(index / 720);
    if (cycle.dayFactor > cycle.nightFactor) {
      daySamples += 1;
    } else if (cycle.nightFactor > cycle.dayFactor) {
      nightSamples += 1;
    }
  }

  assert.ok(Math.abs(daySamples - nightSamples) <= 1, "night should last the same normalized time as day");
});

test("night sky stays procedural, bounded, and wired into the atmosphere", async () => {
  const [sky, stars] = await Promise.all([
    readProjectFile("src/atmosphere/sky.js"),
    readProjectFile("src/atmosphere/stars.js"),
  ]);

  assert.match(sky, /createNightSky\(starHook\)/);
  assert.match(stars, /MILKY_WAY_BAND_STARS = 760/);
  assert.match(stars, /createMilkyWayRibbon/);
  assert.match(stars, /createMilkyWayCoreGlow/);
  assert.match(stars, /MILKY_WAY_CORE_LONGITUDE = 0\.62/);
  assert.match(stars, /MILKY_WAY_CORE_LATITUDE = 0\.38/);
  assert.match(stars, /coreGlow\.material\.opacity = 0\.22 \* visibility/);
  assert.doesNotMatch(stars, /depthTest: false/);
  assert.match(stars, /procedural Milky Way/);
  assert.doesNotMatch(stars, /https?:\/\//);
  assert.doesNotMatch(stars, /TextureLoader|DataTextureLoader|ImageBitmapLoader/);
});
