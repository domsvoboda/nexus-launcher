// The layout is designed for a 1600x1000 window. Larger windows scale the
// whole interface up so it fills high-resolution screens instead of
// spreading small controls. Sizes are in device-independent pixels, so OS
// display scaling is already accounted for.
const BASE_WIDTH = 1600, BASE_HEIGHT = 1000, MAX_ZOOM = 2.5;

export function resolutionZoom(width: number, height: number): number {
  const factor = Math.min(width / BASE_WIDTH, height / BASE_HEIGHT);
  if (!Number.isFinite(factor) || factor <= 1) return 1;
  return Math.min(MAX_ZOOM, Math.round(factor * 20) / 20);
}
