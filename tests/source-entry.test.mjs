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
  assert.match(html, /<meta name="polyfly-base-path" content="\.\/" \/>/);
  assert.doesNotMatch(html, /dist\//, "source page should not reference generated output");
});

test("source entry imports Three.js through the project boundary", async () => {
  const source = await readProjectFile("src/main.js");
  const threeBoundary = await readProjectFile("src/platform/three.js");

  assert.match(source, /import \* as THREE from "\.\/platform\/three\.js";/);
  assert.match(source, /export function createPolyFlyShell/);
  assert.match(source, /export function mountPolyFlyShell/);
  assert.match(threeBoundary, /THREE_VERSION = "0\.170\.0"/);
  assert.match(threeBoundary, /https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.170\.0\/build\/three\.module\.js/);
});
