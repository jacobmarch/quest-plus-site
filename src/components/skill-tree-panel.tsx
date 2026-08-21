"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SkillTreeCanvas } from "@/components/skill-tree-canvas";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SkillRow } from "@/lib/database.types";
import type { SkillPointsSummary } from "@/lib/skills";

type LearnedRow = { skill_id: string; rank: number };

export function SkillTreePanel({
  characterId,
  classId,
  skills,
  learned,
  points,
  pending,
  onSpend,
  onRefund,
}: {
  characterId: string;
  classId: string | null;
  skills: SkillRow[];
  learned: LearnedRow[];
  points: SkillPointsSummary;
  pending: boolean;
  onSpend: (skillId: string, ranks: number) => void;
  onRefund: (skillId: string, ranks: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!classId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No class assigned</CardTitle>
          <CardDescription>
            Assign a class to this character to unlock its skill tree.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const ranksById = new Map(learned.map((l) => [l.skill_id, l.rank]));
  const selected = skills.find((s) => s.id === selectedId) ?? null;
  const selectedRank = selected ? (ranksById.get(selected.id) ?? 0) : 0;
  const prereqMet =
    !selected ||
    selected.prereq_skill_ids.every((id) => (ranksById.get(id) ?? 0) > 0);
  const canAfford = selected
    ? points.available >= Number(selected.cost_per_rank)
    : false;
  const canLearn =
    !!selected &&
    prereqMet &&
    canAfford &&
    selectedRank < selected.max_rank &&
    !pending;
  const canForget = !!selected && selectedRank > 0 && !pending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {points.available} of {points.total} skill points available
          ({points.spent} spent). Click a node to learn or refund ranks.
        </p>
      </div>

      <SkillTreeCanvas
        skills={skills}
        ranksById={ranksById}
        onNodeClick={setSelectedId}
      />

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>{selected.name}</CardTitle>
            <CardDescription>
              Rank {selectedRank}/{selected.max_rank} · costs{" "}
              {Number(selected.cost_per_rank)} point(s) per rank
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selected.description ? (
              <p className="text-sm">{selected.description}</p>
            ) : null}
            {!prereqMet ? (
              <p className="text-sm text-destructive">
                Learn the prerequisite skills first.
              </p>
            ) : null}
            {!canAfford && prereqMet && selectedRank < selected.max_rank ? (
              <p className="text-sm text-destructive">
                Not enough skill points.
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!canLearn}
                onClick={() => onSpend(selected.id, 1)}
              >
                Learn 1 rank
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!canForget}
                onClick={() => onRefund(selected.id, 1)}
              >
                Refund 1 rank
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Select a node in the tree to see details.
        </p>
      )}
    </div>
  );
}
