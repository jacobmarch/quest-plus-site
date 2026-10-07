"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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
  hiddenIds,
  revealedIds,
  characterName,
  onUnlock,
  onLock,
  onReveal,
  onUnreveal,
}: {
  classId: string | null;
  skills: SkillRow[];
  learned: LearnedRow[];
  points: SkillPointsSummary;
  pending: boolean;
  /** DM only: abilities this character can't see yet. */
  hiddenIds?: Set<string>;
  /** DM only: hidden abilities already revealed to this character. */
  revealedIds?: Set<string>;
  characterName: string;
  onUnlock: (skillId: string) => void;
  onLock: (skillId: string) => void;
  onReveal?: (skillId: string) => void;
  onUnreveal?: (skillId: string) => void;
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
  const isHidden = selected ? (hiddenIds?.has(selected.id) ?? false) : false;
  const isRevealed =
    !!selected && selected.is_hidden && (revealedIds?.has(selected.id) ?? false);
  const hiddenCount = hiddenIds?.size ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {points.available} of {points.total} skill points available (
        {points.spent} spent). Start at Tier 1 and work right — click any
        ability to unlock it for its one-time cost.
        {hiddenCount > 0
          ? ` Dashed abilities are hidden from ${characterName} until you reveal them.`
          : ""}
      </p>

      <SkillTreeView
        skills={skills}
        unlockedIds={unlockedIds}
        hiddenIds={hiddenIds}
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
            {isHidden && onReveal ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <EyeOff className="size-4 shrink-0" />
                  {selected.is_hidden
                    ? `Hidden from ${characterName}.`
                    : `Hidden from ${characterName}: it sits below a hidden ability.`}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => onReveal(selected.id)}
                >
                  <Eye />
                  Reveal to {characterName}
                </Button>
              </div>
            ) : null}
            {isRevealed && onUnreveal ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Eye className="size-4 shrink-0" />
                  {isUnlocked
                    ? `Revealed to ${characterName}. Learned abilities stay visible.`
                    : `Revealed to ${characterName}.`}
                </span>
                {!isUnlocked ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onUnreveal(selected.id)}
                  >
                    <EyeOff />
                    Hide again
                  </Button>
                ) : null}
              </div>
            ) : null}
            {selected.description ? (
              <p className="text-sm whitespace-pre-line">{selected.description}</p>
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
