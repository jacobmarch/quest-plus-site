export const MAX_MAP_SCALE = 8;

const MIN_ABSOLUTE_SCALE = 0.05;

/**
 * Normalizes a wheel event delta to pixel-like units so zoom speed is
 * consistent across browsers (Firefox reports lines, legacy axes pages).
 */
export function normalizedWheelDelta(
  event: Pick<WheelEvent, "deltaY" | "deltaMode">,
): number {
  if (event.deltaMode === 1) return event.deltaY * 33;
  if (event.deltaMode === 2) return event.deltaY * 400;
  return event.deltaY;
}

/**
 * Lowest allowed scale for a map: half its fitted scale, so users can back
 * off slightly for context but the image can never shrink to an invisible dot.
 */
export function zoomFloor(fitScale: number): number {
  return Math.max(fitScale / 2, MIN_ABSOLUTE_SCALE);
}

/**
 * Multiplicative zoom keeps each step proportional to the current scale, so a
 * single click can never collapse a small fitted map to nothing or triple it.
 */
export function nextZoomScale(
  currentScale: number,
  factor: number,
  fitScale: number,
  maxScale: number = MAX_MAP_SCALE,
): number {
  return Math.min(maxScale, Math.max(zoomFloor(fitScale), currentScale * factor));
}
