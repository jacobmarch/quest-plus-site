"use client";

import { useState } from "react";
import { SkillTreeView } from "@/components/skill-tree-view";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SkillRow } from "@/lib/database.types";
import {
  collectUnlockedSkillIds,
  type SkillPointsSummary,
} from "@/lib/skills";

type LearnedRow = { skill_id: string };

export function SkillTreePanel({
  classId,
  skills,
  learned,
  points,
  pending,
  onUnlock,
  onLock,
}: {
  classId: string | null;
  skills: SkillRow[];
  learned: LearnedRow[];
  points: SkillPointsSummary;
  pending: boolean;
  onUnlock: (skillId: string) => void;
  onLock: (skillId: string) => void;
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

  const unlockedIds = collectUnlockedSkillIds(skills, learned);
  const selected = skills.find((s) => s.id === selectedId) ?? null;
  const isUnlocked = selected ? unlockedIds.has(selected.id) : false;
  const isStartingSkill = selected?.is_default ?? false;
  const prereqMet =
    !selected ||
    selected.prereq_skill_ids.every((id) => unlockedIds.has(id));
  const canAfford = selected
    ? points.available >= Number(selected.cost)
    : false;
  const canUnlock =
    !!selected && !isUnlocked && prereqMet && canAfford && !pending;
  // An ability that leads to something already unlocked can't be removed.
  const blocksDependents =
    !!selected &&
    skills.some(
      (s) =>
        s.prereq_skill_ids.includes(selected.id) &&
        unlockedIds.has(s.id),
    );
  const canLock =
    isUnlocked && !isStartingSkill && !blocksDependents && !pending;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {points.available} of {points.total} skill points available (
        {points.spent} spent). Start at Tier 1 and work right — click any
        ability to unlock it for its one-time cost.
      </p>

      <SkillTreeView
        skills={skills}
        unlockedIds={unlockedIds}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>{selected.name}</CardTitle>
            <CardDescription>
              {isStartingSkill
                ? "Starting skill — granted free at character creation"
                : isUnlocked
                ? "Unlocked"
                : `Costs ${Number(selected.cost)} point(s) to unlock`}{" "}
              {!isStartingSkill ? "· one-time purchase, no ranking up" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selected.description ? (
              <p className="text-sm">{selected.description}</p>
            ) : null}
            {!prereqMet && !isUnlocked ? (
              <p className="text-sm text-destructive">
                Unlock the abilities that lead to this one first.
              </p>
            ) : null}
            {!canAfford && prereqMet && !isUnlocked ? (
              <p className="text-sm text-destructive">
                Not enough skill points.
              </p>
            ) : null}
            {blocksDependents && !isStartingSkill ? (
              <p className="text-sm text-destructive">
                Lock the abilities that require this one first.
              </p>
            ) : null}
            {!isUnlocked ? (
              <Button
                size="sm"
                disabled={!canUnlock}
                onClick={() => onUnlock(selected.id)}
              >
                Unlock ({Number(selected.cost)} pt
                {Number(selected.cost) === 1 ? "" : "s"})
              </Button>
            ) : null}
            {isUnlocked && !isStartingSkill ? (
              <Button
                variant="outline"
                size="sm"
                disabled={!canLock}
                onClick={() => onLock(selected.id)}
              >
                Lock (refund)
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
