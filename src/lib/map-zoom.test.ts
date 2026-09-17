import { describe, expect, it } from "vitest";
import { MAX_MAP_SCALE, nextZoomScale, zoomFloor } from "./map-zoom";

describe("map zoom stepping", () => {
  it("zooms multiplicatively so small fitted maps stay readable", () => {
    // Fitted scale 0.2: one zoom-in is ×1.4, not +0.5 (which tripled the map).
    expect(nextZoomScale(0.2, 1.4, 0.2)).toBeCloseTo(0.28);
    // One zoom-out backs off by a third, not to zero.
    expect(nextZoomScale(0.2, 1 / 1.4, 0.2)).toBeCloseTo(0.143);
  });
  it("repeated zoom-outs can never blank the map", () => {
    // Old behavior: 0.2 - 0.5 clamped to 0.00001 => invisible map.
    let scale = 0.2;
    for (let i = 0; i < 20; i += 1) scale = nextZoomScale(scale, 1 / 1.4, 0.2);
    expect(scale).toBe(0.1);
  });
  it("floors zoom at half the fitted scale, never below an absolute minimum", () => {
    expect(zoomFloor(0.2)).toBe(0.1);
    expect(zoomFloor(0.001)).toBe(0.05);
    expect(nextZoomScale(0.001, 1 / 1.4, 0.001)).toBe(0.05);
  });
  it("caps zoom regardless of input", () => {
    expect(nextZoomScale(MAX_MAP_SCALE, 1.4, 0.05)).toBe(MAX_MAP_SCALE);
  });
});
