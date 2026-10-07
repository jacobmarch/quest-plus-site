import { describe, expect, it } from "vitest";
import {
  applyHpDelta,
  formatRelativeTime,
  getHpStatus,
  getNaturalResult,
  hpPercent,
  latestRollByRoller,
} from "./dashboard";

describe("getHpStatus", () => {
  const at = (current_hp: number, is_dead = false) =>
    getHpStatus({ current_hp, max_hp: 20, is_dead });

  it("bands health by fraction of max", () => {
    expect(at(20)).toBe("healthy");
    expect(at(11)).toBe("healthy");
    expect(at(10)).toBe("bloodied");
    expect(at(5)).toBe("critical");
    expect(at(0)).toBe("down");
  });

  it("reports dead regardless of HP", () => {
    expect(at(20, true)).toBe("dead");
  });
});

describe("hpPercent and applyHpDelta", () => {
  it("clamps the bar and the new HP", () => {
    expect(hpPercent({ current_hp: 30, max_hp: 20 })).toBe(100);
    expect(hpPercent({ current_hp: 5, max_hp: 0 })).toBe(100);
    expect(applyHpDelta({ current_hp: 4, max_hp: 20 }, -10)).toBe(0);
    expect(applyHpDelta({ current_hp: 18, max_hp: 20 }, 5)).toBe(20);
    expect(applyHpDelta({ current_hp: 10, max_hp: 20 }, -3)).toBe(7);
  });
});

describe("getNaturalResult", () => {
  it("flags a single d20 with or without a modifier", () => {
    expect(getNaturalResult({ expression: "1d20", faces: [20] })).toBe("nat20");
    expect(getNaturalResult({ expression: "d20+5", faces: [1] })).toBe("nat1");
    expect(getNaturalResult({ expression: "1d20", faces: [12] })).toBeNull();
  });

  it("ignores multi-die and non-d20 rolls", () => {
    expect(getNaturalResult({ expression: "2d20", faces: [20, 3] })).toBeNull();
    expect(getNaturalResult({ expression: "1d20+1d6", faces: [20, 3] })).toBeNull();
    expect(getNaturalResult({ expression: "1d100", faces: [20] })).toBeNull();
  });
});

describe("latestRollByRoller", () => {
  it("keeps the first (newest) Roll per roller", () => {
    const map = latestRollByRoller([
      { id: "a", roller_id: "p1" },
      { id: "b", roller_id: "p2" },
      { id: "c", roller_id: "p1" },
    ]);
    expect(map.get("p1")?.id).toBe("a");
    expect(map.get("p2")?.id).toBe("b");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  it("formats short spans", () => {
    expect(formatRelativeTime("2026-10-07T11:59:50Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-10-07T11:55:00Z", now)).toBe("5m ago");
    expect(formatRelativeTime("2026-10-07T09:00:00Z", now)).toBe("3h ago");
    expect(formatRelativeTime("2026-10-05T12:00:00Z", now)).toBe("2d ago");
  });
});
