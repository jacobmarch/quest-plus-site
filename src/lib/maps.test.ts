import { describe, expect, it } from "vitest";
import { MAX_MAP_BYTES, validateMapFile, validateMapName, validMapStoragePath } from "./maps";

describe("map upload validation", () => {
  it("trims map names and rejects empty or excessive names", () => {
    expect(validateMapName("  World  ")).toBe("World");
    expect(() => validateMapName(" ")).toThrow();
    expect(() => validateMapName("x".repeat(121))).toThrow();
  });
  it("accepts each supported format at the size limit", () => {
    expect(validateMapFile({ size: MAX_MAP_BYTES, type: "image/png" })).toBe("png");
    expect(validateMapFile({ size: 1, type: "image/jpeg" })).toBe("jpg");
    expect(validateMapFile({ size: 1, type: "image/webp" })).toBe("webp");
  });
  it("rejects empty, oversized, and unsupported files", () => {
    expect(() => validateMapFile({ size: 0, type: "image/png" })).toThrow();
    expect(() => validateMapFile({ size: MAX_MAP_BYTES + 1, type: "image/png" })).toThrow();
    expect(() => validateMapFile({ size: 1, type: "image/svg+xml" })).toThrow();
    expect(() => validateMapFile({ size: 1, type: "text/html" })).toThrow();
  });
  it("requires a fresh image path in the current user's directory", () => {
    const user = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const image = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    expect(validMapStoragePath(`${user}/${image}.png`, user)).toBe(true);
    expect(validMapStoragePath(`${image}/${image}.png`, user)).toBe(false);
    expect(validMapStoragePath(`${user}/../${image}.png`, user)).toBe(false);
    expect(validMapStoragePath(`${user}/${image}.svg`, user)).toBe(false);
  });
});
