import { describe, expect, it } from "vitest";
import { collectDependents, collectHiddenSkillIds } from "@/lib/skills";

const tree = [
  { id: "keen", prereq_skill_ids: [] },
  { id: "mark", prereq_skill_ids: ["keen"] },
  { id: "volley", prereq_skill_ids: ["mark"] },
  { id: "bond", prereq_skill_ids: [] },
  { id: "pack", prereq_skill_ids: ["bond", "mark"] },
];

describe("collectDependents", () => {
  it("includes the skill and everything downstream of it", () => {
    expect([...collectDependents(tree, "mark")].sort()).toEqual(["mark", "pack", "volley"]);
  });

  it("follows a second parent link", () => {
    expect([...collectDependents(tree, "bond")].sort()).toEqual(["bond", "pack"]);
  });

  it("is just the skill for a leaf", () => {
    expect([...collectDependents(tree, "volley")]).toEqual(["volley"]);
  });
});

describe("collectHiddenSkillIds", () => {
  const withHidden = tree.map((s) => ({ ...s, is_hidden: s.id === "mark" }));

  it("hides a hidden ability and everything below it", () => {
    expect([...collectHiddenSkillIds(withHidden)].sort()).toEqual(["mark", "pack", "volley"]);
  });

  it("opens the branch once the ability is revealed or learned", () => {
    expect([...collectHiddenSkillIds(withHidden, new Set(["mark"]))]).toEqual([]);
  });
});
