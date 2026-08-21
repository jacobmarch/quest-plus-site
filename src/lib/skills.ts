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
  learned: Array<Pick<SkillRow, "cost_per_rank"> & { rank: number }>,
): SkillPointsSummary {
  const perLevel = cls?.points_per_level ?? 0;
  const total = (character.level ?? 0) * perLevel;
  const spent = learned.reduce(
    (sum, s) => sum + Number(s.rank) * Number(s.cost_per_rank),
    0,
  );
  return { total, spent, available: total - spent };
}

export function isSkillUnlocked(
  skill: Pick<SkillRow, "prereq_skill_ids">,
  learnedIds: Set<string>,
): boolean {
  return skill.prereq_skill_ids.every((id) => learnedIds.has(id));
}

export type SkillNodeState = "learned" | "available" | "locked";

export function getSkillNodeState(
  skill: Pick<SkillRow, "id" | "prereq_skill_ids" | "max_rank">,
  rank: number | undefined,
  learnedIds: Set<string>,
): SkillNodeState {
  if ((rank ?? 0) > 0) return "learned";
  if (isSkillUnlocked(skill, learnedIds)) return "available";
  return "locked";
}

export function buildEdges(
  skills: Array<Pick<SkillRow, "id" | "prereq_skill_ids">>,
): Array<{ id: string; source: string; target: string }> {
  const edges: Array<{ id: string; source: string; target: string }> = [];
  for (const skill of skills) {
    for (const prereqId of skill.prereq_skill_ids) {
      edges.push({
        id: `${prereqId}->${skill.id}`,
        source: prereqId,
        target: skill.id,
      });
    }
  }
  return edges;
}
