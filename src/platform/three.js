export const THREE_VERSION = "0.170.0";

// Keep Three.js as the only runtime dependency for the foundation. Future build
// tooling may replace this with a vendored or npm-resolved module, but gameplay
// modules should continue importing through this boundary rather than directly
// depending on a CDN URL.
export * from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
