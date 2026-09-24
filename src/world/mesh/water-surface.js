export const WATER_SURFACE_LIFT = 0.22;

export function resolveWaterSurfaceHeight(samples, { lift = WATER_SURFACE_LIFT } = {}) {
  let strongestLake = null;
  let strongestLakeStrength = 0;
  let strongestRiver = null;
  let strongestRiverStrength = 0;

  for (const sample of samples) {
    const lakeStrength = sample.lakeStrength ?? 0;
    if (lakeStrength > strongestLakeStrength && Number.isFinite(sample.lakeLevel)) {
      strongestLake = sample;
      strongestLakeStrength = lakeStrength;
    }

    const riverStrength = sample.riverStrength ?? 0;
    if (riverStrength > strongestRiverStrength) {
      strongestRiver = sample;
      strongestRiverStrength = riverStrength;
    }
  }

  if (strongestLake && strongestLakeStrength >= strongestRiverStrength && strongestLakeStrength > 0.05) {
    return strongestLake.lakeLevel + lift;
  }

  if (strongestRiver && strongestRiverStrength > 0.05) {
    const riverLevel = Number.isFinite(strongestRiver.waterLevel)
      ? strongestRiver.waterLevel
      : strongestRiver.height;
    return riverLevel + lift;
  }

  return null;
}
