import type {
  CharacterRow,
  ClassRow,
  SkillRow,
} from "@/lib/database.types";

export type LearnedSkill = SkillRow & { rank: number };

export type SkillPointsSummary = {
  total: number;
  spent: number;
  available: number;
};

export function computeSkillPoints(
  cls: Pick<ClassRow, "points_per_level"> | null | undefined,
  character: Pick<CharacterRow, "level">,
  learned: Array<Pick<SkillRow, "cost">>,
): SkillPointsSummary {
  const perLevel = cls?.points_per_level ?? 0;
  const total = (character.level ?? 0) * perLevel;
  const spent = learned.reduce((sum, s) => sum + Number(s.cost), 0);
  return { total, spent, available: total - spent };
}

export type SkillNodeState = "unlocked" | "available" | "locked";

/**
 * An ability is unlocked when it appears in the character's learned set.
 * Otherwise it is available (all prerequisites unlocked) or locked.
 */
export function getSkillNodeState(
  skill: Pick<SkillRow, "id" | "prereq_skill_ids">,
  unlockedIds: Set<string>,
): SkillNodeState {
  if (unlockedIds.has(skill.id)) return "unlocked";
  return isSkillUnlocked(skill, unlockedIds) ? "available" : "locked";
}

export function isSkillUnlocked(
  skill: Pick<SkillRow, "prereq_skill_ids">,
  unlockedIds: Set<string>,
): boolean {
  return skill.prereq_skill_ids.every((id) => unlockedIds.has(id));
}

/**
 * Groups skills into tiers (columns) based on prerequisite depth. Tier 0 is
 * every skill with no prerequisites; each other skill sits one tier below
 * its highest-tier prerequisite. The database guarantees the graph is
 * acyclic and same-class, so this always terminates.
 */
export function deriveTiers(
  skills: Array<Pick<SkillRow, "id" | "prereq_skill_ids">>,
): Map<string, number> {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const tiers = new Map<string, number>();

  const visit = (id: string): number => {
    const known = tiers.get(id);
    if (known !== undefined) return known;

    // Reserve the id first so a stray cycle cannot loop forever.
    tiers.set(id, 0);
    const skill = byId.get(id);
    let tier = 0;
    if (skill) {
      for (const prereqId of skill.prereq_skill_ids) {
        if (!byId.has(prereqId)) continue;
        tier = Math.max(tier, visit(prereqId) + 1);
      }
    }
    tiers.set(id, tier);
    return tier;
  };

  for (const skill of skills) visit(skill.id);
  return tiers;
}

/**
 * Orders nodes so branches never criss-cross: everything under the first
 * root keeps its subtree together above the second root's subtree, and so
 * on, recursively. Children are listed in prereq order (then name), and any
 * node reachable from multiple parents sits under its first parent.
 */
export function orderSkillsByBranch(
  skills: SkillRow[],
): { ordered: SkillRow[]; tierOf: Map<string, number> } {
  // Adjacency: parent -> children, in the DM's declared prereq order.
  const childrenOf = new Map<string, string[]>();
  const roots: string[] = [];
  for (const skill of skills) {
    if (skill.prereq_skill_ids.length === 0) roots.push(skill.id);
    for (const parentId of skill.prereq_skill_ids) {
      const list = childrenOf.get(parentId) ?? [];
      if (!list.includes(skill.id)) list.push(skill.id);
      childrenOf.set(parentId, list);
    }
  }

  const position = new Map<string, number>();
  let counter = 0;
  const assign = (id: string) => {
    if (position.has(id)) return;
    position.set(id, counter);
    counter += 1;
    for (const childId of childrenOf.get(id) ?? []) assign(childId);
  };
  for (const root of roots) assign(root);

  // Any stragglers (unreachable due to odd data) keep a stable tail spot.
  for (const skill of [...skills].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    assign(skill.id);
  }

  const ordered = [...skills].sort(
    (a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
  );
  return { ordered, tierOf: deriveTiers(skills) };
}

export type SkillTierColumn = {
  tier: number;
  skills: SkillRow[];
};

/**
 * Groups ordered skills into tier columns, preserving the branch order of
 * the input within each column.
 */
export function buildTierColumns(
  ordered: SkillRow[],
  tierOf: Map<string, number>,
): SkillTierColumn[] {
  const maxTier = Math.max(-1, ...tierOf.values());
  const columns: SkillTierColumn[] = [];
  for (let t = 0; t <= maxTier; t += 1) {
    columns.push({
      tier: t,
      skills: ordered.filter((s) => tierOf.get(s.id) === t),
    });
  }
  return columns;
}
