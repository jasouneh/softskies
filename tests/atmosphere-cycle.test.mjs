import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ATMOSPHERE_CONFIG } from "../src/config/game.js";
import { advanceAtmospherePhase, getAtmospherePhaseDurations, hexChannel, sampleAtmospherePalette, sampleSunCycle, sampleTwilightIntensity } from "../src/atmosphere/day-night.js";

const rootUrl = new URL("../", import.meta.url);

function channels(hex) {
  return [hexChannel(hex, "r"), hexChannel(hex, "g"), hexChannel(hex, "b")];
}

async function readProjectFile(relativePath) {
  return readFile(new URL(relativePath, rootUrl), "utf8");
}

test("night phases use a genuinely dark palette instead of sunset orange", () => {
  const lateNight = sampleAtmospherePalette(0.84, { config: ATMOSPHERE_CONFIG });
  const dusk = sampleAtmospherePalette(0.75, { config: ATMOSPHERE_CONFIG, twilightIntensity: 1.2 });
  const [nightR, nightG, nightB] = channels(lateNight.sky);
  const [duskR, duskG, duskB] = channels(dusk.sky);

  assert.ok(sampleSunCycle(0.84, ATMOSPHERE_CONFIG).nightFactor > 0.95, "fixture should be in night mode");
  assert.ok(Math.max(nightR, nightG, nightB) < 72, "night sky should stay dark");
  assert.ok(nightB > nightR, "night sky should be blue-black, not orange");
  assert.ok(duskR > nightR * 4, "sunset color should be limited to the dusk band");
  assert.ok(duskB > duskG, "sunset should include purple-blue tones instead of reading orange");
});

test("sun height, star visibility, and day/night duration align", () => {
  assert.ok(sampleSunCycle(0, ATMOSPHERE_CONFIG).starFactor > 0.95, "midnight should show stars");
  assert.ok(sampleSunCycle(0.5, ATMOSPHERE_CONFIG).dayFactor > 0.95, "midday should be bright");
  assert.ok(sampleSunCycle(0.24, ATMOSPHERE_CONFIG).starFactor < 0.5, "sunrise glow should not be full night");

  let daySamples = 0;
  let nightSamples = 0;
  for (let index = 0; index < 720; index += 1) {
    const cycle = sampleSunCycle(index / 720, ATMOSPHERE_CONFIG);
    if (cycle.dayFactor > cycle.nightFactor) {
      daySamples += 1;
    } else if (cycle.nightFactor > cycle.dayFactor) {
      nightSamples += 1;
    }
  }

  assert.ok(Math.abs(daySamples - nightSamples) <= 1, "night should last the same normalized time as day");

  let elapsedDaySamples = 0;
  let elapsedNightSamples = 0;
  const config = { dayLengthSeconds: 180, timeScale: 0.5, startPhase: 0 };
  for (let elapsed = 0; elapsed < 360; elapsed += 0.5) {
    const phase = advanceAtmospherePhase(elapsed, config);
    const cycle = sampleSunCycle(phase, config);
    if (cycle.dayFactor > cycle.nightFactor) {
      elapsedDaySamples += 1;
    } else if (cycle.nightFactor > cycle.dayFactor) {
      elapsedNightSamples += 1;
    }
  }
  assert.ok(Math.abs(elapsedDaySamples - elapsedNightSamples) <= 1, "elapsed night duration should match elapsed day duration");
});

test("dawn and dusk last sixty seconds with randomized pink-purple intensity", () => {
  const timing = getAtmospherePhaseDurations(ATMOSPHERE_CONFIG);
  assert.equal(timing.dawnSeconds, 60);
  assert.equal(timing.duskSeconds, 60);
  assert.ok(Math.abs(timing.daySeconds - 120) < 1e-6);
  assert.ok(Math.abs(timing.nightSeconds - 120) < 1e-6);

  const sunrise = sampleAtmospherePalette(0.25, { config: ATMOSPHERE_CONFIG, twilightIntensity: 0.8 });
  const intenseSunset = sampleAtmospherePalette(0.75, { config: ATMOSPHERE_CONFIG, twilightIntensity: 1.25 });
  const [sunriseR, sunriseG, sunriseB] = channels(sunrise.sky);
  const [sunsetR, sunsetG, sunsetB] = channels(intenseSunset.sky);
  assert.ok(sunriseR > sunriseG && sunriseB > sunriseG, "sunrise should mix pink and purple tones");
  assert.ok(sunsetR > sunsetG && sunsetB > sunsetG, "sunset should mix pink and purple tones");
  assert.notEqual(sampleTwilightIntensity(0, ATMOSPHERE_CONFIG), sampleTwilightIntensity(360, ATMOSPHERE_CONFIG));
});

test("night sky stays procedural, bounded, and wired into the atmosphere", async () => {
  const [sky, stars] = await Promise.all([
    readProjectFile("src/atmosphere/sky.js"),
    readProjectFile("src/atmosphere/stars.js"),
  ]);

  assert.match(sky, /createNightSky\(starHook\)/);
  assert.match(stars, /MILKY_WAY_BAND_STARS = 720/);
  assert.match(stars, /createMilkyWayHaze/);
  assert.match(stars, /ShaderMaterial/);
  assert.match(stars, /soft layered sky-bound procedural Milky Way haze/);
  assert.match(stars, /MILKY_WAY_CORE_LONGITUDE = 0\.62/);
  assert.match(stars, /MILKY_WAY_CORE_LATITUDE = 0\.38/);
  assert.match(stars, /milkyWayHaze\.material\.uniforms\.opacity\.value = Math\.min\(1\.35, visibility \* 1\.35\)/);
  assert.match(stars, /points\.renderOrder = 42/);
  assert.match(stars, /mesh\.renderOrder = 40/);
  assert.doesNotMatch(stars, /depthTest: false/);
  assert.doesNotMatch(stars, /createMilkyWayRibbon|createMilkyWayCoreGlow|CircleGeometry/);
  assert.match(stars, /procedural Milky Way/);
  assert.doesNotMatch(stars, /https?:\/\//);
  assert.doesNotMatch(stars, /TextureLoader|DataTextureLoader|ImageBitmapLoader/);
});
