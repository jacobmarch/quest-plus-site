"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteSkill, upsertSkill } from "@/app/actions";
import type { SkillRow } from "@/lib/database.types";
import { SkillTreeView } from "@/components/skill-tree-view";
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
    });
  }

  /** Add or remove one prerequisite link; DB validates class + cycles. */
  function togglePrereq(childId: string, parentId: string) {
    const child = skills.find((s) => s.id === childId);
    if (!child) return;
    const has = child.prereq_skill_ids.includes(parentId);
    const nextIds = has
      ? child.prereq_skill_ids.filter((id) => id !== parentId)
      : [...child.prereq_skill_ids, parentId];
    saveSkill({
      id: child.id,
      classId,
      name: child.name,
      description: child.description,
      cost: Number(child.cost),
      prereqSkillIds: nextIds,
    });
  }

  return (
    <div className="space-y-6">
      <AddAbilityForm
        classId={classId}
        skills={skills}
        pending={pending}
        onSave={(input) =>
          startTransition(async () => {
            const result = await upsertSkill(input);
            if (!result.ok) toast.error(result.error);
            else toast.success("Ability added");
          })
        }
      />

      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          Tiers build left to right automatically. Click an ability to edit or
          delete it; use “link from prior tier” to make one ability lead to
          another.
        </p>
        <SkillTreeView
          skills={skills}
          unlockedIds={new Set()}
          selectedId={selectedId}
          editable
          onSelect={setSelectedId}
          onTogglePrereq={togglePrereq}
        />
      </div>

      {selected ? (
        <EditAbilityForm
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
              toast.success("Ability deleted");
            })
          }
        />
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Select an ability in the tree to edit its details.
        </p>
      )}
    </div>
  );
}

function AddAbilityForm({
  classId,
  skills,
  pending,
  onSave,
}: {
  classId: string;
  skills: SkillRow[];
  pending: boolean;
  onSave: (input: Parameters<typeof upsertSkill>[0]) => void;
}) {
  function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    onSave({
      classId: String(formData.get("classId")),
      name,
      description: String(formData.get("description") ?? ""),
      cost: Math.max(0, Number(formData.get("cost") ?? 1)),
      prereqSkillIds: formData.getAll("prereqs").map(String),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add ability</CardTitle>
        <CardDescription>
          Optionally pick which existing abilities lead to it — it will drop
          into the right tier automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="classId" value={classId} />
          <div className="space-y-1">
            <Label htmlFor="newName">Name</Label>
            <Input id="newName" name="name" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="newCost">Cost (points)</Label>
              <Input
                id="newCost"
                name="cost"
                type="number"
                min={0}
                step="0.5"
                defaultValue={1}
              />
            </div>
            <div />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="newDescription">Description</Label>
            <Textarea
              id="newDescription"
              name="description"
              rows={2}
              placeholder="What does this ability do?"
            />
          </div>
          {skills.length > 0 ? (
            <div className="space-y-1 sm:col-span-2">
              <Label>Leads from (prerequisites)</Label>
              <div className="grid gap-1 sm:grid-cols-3">
                {skills.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      name="prereqs"
                      value={s.id}
                      className="size-4 accent-[var(--primary)]"
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Add ability"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function EditAbilityForm({
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
      cost: Math.max(0, Number(formData.get("cost") ?? 1)),
      prereqSkillIds: prereqs.filter((id) => id !== skill.id),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit “{skill.name}”</CardTitle>
        <CardDescription>
          Changes apply everywhere immediately — players see updates live.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`editName-${skill.id}`}>Name</Label>
            <Input
              id={`editName-${skill.id}`}
              name="name"
              defaultValue={skill.name}
              required
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`editDesc-${skill.id}`}>Description</Label>
            <Textarea
              id={`editDesc-${skill.id}`}
              name="description"
              rows={2}
              defaultValue={skill.description}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`editCost-${skill.id}`}>Cost (points)</Label>
            <Input
              id={`editCost-${skill.id}`}
              name="cost"
              type="number"
              min={0}
              step="0.5"
              defaultValue={Number(skill.cost)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Leads from (prerequisites)</Label>
            <div className="grid gap-1 sm:grid-cols-3">
              {[...skills]
                .sort((a, b) => a.name.localeCompare(b.name))
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
              {pending ? "Saving..." : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Delete "${skill.name}"?`)) onDelete();
              }}
            >
              Delete ability
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
