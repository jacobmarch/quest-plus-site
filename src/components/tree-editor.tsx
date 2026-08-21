"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteSkill, upsertSkill, upsertClass } from "@/app/actions";
import type { ClassRow, SkillRow } from "@/lib/database.types";
import { SkillTreeCanvas } from "@/components/skill-tree-canvas";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TreeEditor({
  classId,
  skills,
}: {
  classId: string;
  skills: SkillRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = skills.find((s) => s.id === selectedId) ?? null;

  function saveSkill(
    input: Parameters<typeof upsertSkill>[0],
    onDone?: (id: string) => void,
  ) {
    startTransition(async () => {
      const result = await upsertSkill(input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.id && onDone) onDone(result.id);
      toast.success("Saved");
    });
  }

  function handleConnectPrereq(skillId: string, prereqId: string) {
    const skill = skills.find((s) => s.id === skillId);
    if (!skill || skill.prereq_skill_ids.includes(prereqId)) return;
    saveSkill({
      id: skill.id,
      classId,
      name: skill.name,
      description: skill.description,
      maxRank: skill.max_rank,
      costPerRank: Number(skill.cost_per_rank),
      x: skill.x,
      y: skill.y,
      prereqSkillIds: [...skill.prereq_skill_ids, prereqId],
    });
  }

  function handleDisconnectPrereq(skillId: string, prereqId: string) {
    const skill = skills.find((s) => s.id === skillId);
    if (!skill) return;
    saveSkill({
      id: skill.id,
      classId,
      name: skill.name,
      description: skill.description,
      maxRank: skill.max_rank,
      costPerRank: Number(skill.cost_per_rank),
      x: skill.x,
      y: skill.y,
      prereqSkillIds: skill.prereq_skill_ids.filter((id) => id !== prereqId),
    });
  }

  function handleMoveNode(skillId: string, x: number, y: number) {
    const skill = skills.find((s) => s.id === skillId);
    if (!skill) return;
    startTransition(async () => {
      await upsertSkill({
        id: skill.id,
        classId,
        name: skill.name,
        description: skill.description,
        maxRank: skill.max_rank,
        costPerRank: Number(skill.cost_per_rank),
        x,
        y,
        prereqSkillIds: [...skill.prereq_skill_ids],
      });
    });
  }

  function addNode() {
    // Place new nodes in a spiral around the origin so they never overlap.
    const index = skills.length;
    const angle = index * 2.4;
    const radius = 140 + index * 30;
    saveSkill(
      {
        classId,
        name: `New skill ${index + 1}`,
        description: "",
        maxRank: 1,
        costPerRank: 1,
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius),
        prereqSkillIds: [],
      },
      (id) => setSelectedId(id),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {skills.length} node(s). Click a node to edit it.
        </p>
        <Button size="sm" onClick={addNode} disabled={pending}>
          Add node
        </Button>
      </div>

      <SkillTreeCanvas
        skills={skills}
        ranksById={new Map()}
        editable
        onNodeClick={setSelectedId}
        onConnectPrereq={handleConnectPrereq}
        onDisconnectPrereq={handleDisconnectPrereq}
        onMoveNode={handleMoveNode}
      />

      {selected ? (
        <SkillEditForm
          key={selected.id}
          skill={selected}
          skills={skills}
          pending={pending}
          onSave={(input) =>
            saveSkill({ ...input, id: selected.id }, undefined)
          }
          onDelete={() =>
            startTransition(async () => {
              const result = await deleteSkill(selected.id, classId);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setSelectedId(null);
              toast.success("Node deleted");
            })
          }
        />
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Select a node to edit its details, or add a new one.
        </p>
      )}
    </div>
  );
}

function SkillEditForm({
  skill,
  skills,
  pending,
  onSave,
  onDelete,
}: {
  skill: SkillRow;
  skills: SkillRow[];
  pending: boolean;
  onSave: (input: Parameters<typeof upsertSkill>[0]) => void;
  onDelete: () => void;
}) {
  function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    const prereqs = formData.getAll("prereqs").map(String);
    onSave({
      classId: skill.class_id,
      name,
      description: String(formData.get("description") ?? ""),
      maxRank: Math.max(1, Number(formData.get("maxRank") ?? 1)),
      costPerRank: Math.max(0, Number(formData.get("costPerRank") ?? 1)),
      x: skill.x,
      y: skill.y,
      prereqSkillIds: prereqs.filter((id) => id !== skill.id),
    });
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit node</CardTitle>
        <CardDescription>
          Prerequisites must be learned before this skill can be taken
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="skillName">Name</Label>
            <Input id="skillName" name="name" defaultValue={skill.name} required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="skillDescription">Description</Label>
            <Textarea
              id="skillDescription"
              name="description"
              rows={2}
              defaultValue={skill.description}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="maxRank">Max rank</Label>
            <Input
              id="maxRank"
              name="maxRank"
              type="number"
              min={1}
              defaultValue={skill.max_rank}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="costPerRank">Cost per rank</Label>
            <Input
              id="costPerRank"
              name="costPerRank"
              type="number"
              min={0}
              step="0.5"
              defaultValue={Number(skill.cost_per_rank)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Prerequisites</Label>
            <div className="grid gap-1 sm:grid-cols-2">
              {skills
                .filter((s) => s.id !== skill.id)
                .map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      name="prereqs"
                      value={s.id}
                      defaultChecked={skill.prereq_skill_ids.includes(s.id)}
                      className="size-4 accent-[var(--primary)]"
                    />
                    {s.name}
                  </label>
                ))}
            </div>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save node"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Delete "${skill.name}"?`)) onDelete();
              }}
            >
              Delete node
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function EditClassDialog({ cls }: { cls: ClassRow }) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await upsertClass({
        id: cls.id,
        name: String(formData.get("name") ?? cls.name),
        description: String(formData.get("description") ?? ""),
        pointsPerLevel: Number(formData.get("pointsPerLevel") ?? 1),
      });
      if (!result.ok) toast.error(result.error);
      else toast.success("Class updated");
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor={`name-${cls.id}`}>Name</Label>
        <Input id={`name-${cls.id}`} name="name" defaultValue={cls.name} className="w-40" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`ppl-${cls.id}`}>Pts/level</Label>
        <Input
          id={`ppl-${cls.id}`}
          name="pointsPerLevel"
          type="number"
          min={0}
          defaultValue={cls.points_per_level}
          className="w-24"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
