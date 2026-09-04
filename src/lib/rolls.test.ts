import { describe, expect, it } from "vitest";
import {
  canViewerSeeRoll,
  evaluateDiceExpression,
  parseDiceExpression,
  rollParsed,
} from "./rolls";

describe("parseDiceExpression", () => {
  it("accepts preset-style and summed expressions", () => {
    expect(parseDiceExpression("d20").ok).toBe(true);
    expect(parseDiceExpression("2d6+3").ok).toBe(true);
    expect(parseDiceExpression("1d20+2d6+3").ok).toBe(true);
    expect(parseDiceExpression(" 2d6 - 1 ").ok).toBe(true);
  });

  it("rejects illegal expressions without producing a parse", () => {
    expect(parseDiceExpression("").ok).toBe(false);
    expect(parseDiceExpression("0d6").ok).toBe(false);
    expect(parseDiceExpression("d3").ok).toBe(false);
    expect(parseDiceExpression("101d6").ok).toBe(false);
    expect(parseDiceExpression("999d20").ok).toBe(false);
    expect(parseDiceExpression("fireball").ok).toBe(false);
    expect(parseDiceExpression("+3").ok).toBe(false);
    expect(parseDiceExpression("-1d6").ok).toBe(false);
  });
});

describe("rollParsed", () => {
  it("stores faces, net constant, and total", () => {
    const parsed = parseDiceExpression("2d6+3");
    if (!parsed.ok) throw new Error("expected parse");
    let i = 0;
    const sequence = [0, 0.99];
    const rolled = rollParsed(parsed.value, () => sequence[i++] ?? 0);
    expect(rolled.expression).toBe("2d6+3");
    expect(rolled.faces).toEqual([1, 6]);
    expect(rolled.constant).toBe(3);
    expect(rolled.total).toBe(10);
  });
});

describe("evaluateDiceExpression", () => {
  it("does not roll when the expression is illegal", () => {
    expect(evaluateDiceExpression("d3").ok).toBe(false);
  });
});

describe("canViewerSeeRoll", () => {
  const playerA = { id: "a", isDm: false };
  const playerB = { id: "b", isDm: false };
  const dm = { id: "dm", isDm: true };

  it("lets every member see a Public Roll", () => {
    const roll = { is_private: false, roller_id: "a" };
    expect(canViewerSeeRoll(roll, playerA)).toBe(true);
    expect(canViewerSeeRoll(roll, playerB)).toBe(true);
    expect(canViewerSeeRoll(roll, dm)).toBe(true);
  });

  it("lets only the Player and DM see a Player Private Roll", () => {
    const roll = { is_private: true, roller_id: "a" };
    expect(canViewerSeeRoll(roll, playerA)).toBe(true);
    expect(canViewerSeeRoll(roll, playerB)).toBe(false);
    expect(canViewerSeeRoll(roll, dm)).toBe(true);
  });

  it("lets only the DM see a DM Private Roll", () => {
    const roll = { is_private: true, roller_id: "dm" };
    expect(canViewerSeeRoll(roll, playerA)).toBe(false);
    expect(canViewerSeeRoll(roll, playerB)).toBe(false);
    expect(canViewerSeeRoll(roll, dm)).toBe(true);
  });
});
