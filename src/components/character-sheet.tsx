"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  adjustInventory,
  deleteCharacter,
  levelUpCharacter,
  lockSkill,
  unlockSkill,
  updateCharacterFields,
} from "@/app/actions";
import type {
  CharacterRow,
  ClassRow,
  InventoryRow,
  ItemRow,
  ProfileRow,
  SkillRow,
} from "@/lib/database.types";
import { computeSkillPoints } from "@/lib/skills";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SkillTreePanel } from "@/components/skill-tree-panel";
import { InventoryPanel } from "@/components/inventory-panel";

type LearnedRow = { skill_id: string };

export function CharacterSheet({
  character,
  cls,
  skills,
  learned,
  inventory,
  items,
  profiles,
  transferTargets,
  isDm,
  currentUserId,
}: {
  character: CharacterRow;
  cls: ClassRow | null;
  skills: SkillRow[];
  learned: LearnedRow[];
  inventory: Array<Pick<InventoryRow, "id" | "item_id" | "quantity">>;
  items: ItemRow[];
  profiles: Array<Pick<ProfileRow, "id" | "display_name">>;
  transferTargets: Array<Pick<CharacterRow, "id" | "name">>;
  isDm: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const points = computeSkillPoints(
    cls,
    character,
    learned.map((l) => ({
      cost: skills.find((s) => s.id === l.skill_id)?.cost ?? 1,
    })),
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) toast.error(result.error);
    });
  }

  const update = (fields: Record<string, unknown>) =>
    run(() => updateCharacterFields(character.id, fields));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
            {character.name}
            <Badge variant="outline">Lv {character.level}</Badge>
            {character.is_dead ? (
              <Badge variant="destructive">Dead</Badge>
            ) : null}
            {character.kind === "enemy" ? (
              <Badge variant="secondary">Enemy</Badge>
            ) : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            {cls?.name ?? "No class"}
            {cls ? ` · ${cls.points_per_level} pt(s) per level` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDm ? (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => run(() => levelUpCharacter(character.id))}
            >
              Level up
            </Button>
          ) : null}
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => router.push("/characters")}
          >
            Back
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="skills">
            Skills
            <Badge variant="secondary" className="ml-2">
              {points.available} pts
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Health</CardTitle>
                <CardDescription>
                  {character.current_hp} / {character.max_hp} HP
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={
                      character.current_hp / Math.max(character.max_hp, 1) <=
                      0.25
                        ? "h-full rounded-full bg-destructive transition-all"
                        : "h-full rounded-full bg-primary transition-all"
                    }
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          (character.current_hp /
                            Math.max(character.max_hp, 1)) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[1, 5, 10].map((amount) => (
                    <Button
                      key={`dmg-${amount}`}
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        update({
                          current_hp: Math.max(
                            0,
                            character.current_hp - amount,
                          ),
                        })
                      }
                    >
                      -{amount} HP
                    </Button>
                  ))}
                  {[1, 5, 10].map((amount) => (
                    <Button
                      key={`heal-${amount}`}
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        update({
                          current_hp: Math.min(
                            character.max_hp,
                            character.current_hp + amount,
                          ),
                        })
                      }
                    >
                      +{amount} HP
                    </Button>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="currentHp">Current</Label>
                    <Input
                      id="currentHp"
                      type="number"
                      min={0}
                      defaultValue={character.current_hp}
                      className="w-24"
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (!Number.isNaN(value)) {
                          update({
                            current_hp: Math.min(
                              Math.max(0, value),
                              character.max_hp,
                            ),
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="maxHp">Max</Label>
                    <Input
                      id="maxHp"
                      type="number"
                      min={1}
                      defaultValue={character.max_hp}
                      className="w-24"
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (!Number.isNaN(value) && value >= 1) {
                          update({ max_hp: value });
                        }
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
                <CardDescription>Core sheet fields</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="charName">Name</Label>
                  <Input
                    id="charName"
                    defaultValue={character.name}
                    onBlur={(e) => {
                      const name = e.target.value.trim();
                      if (name && name !== character.name) update({ name });
                    }}
                  />
                </div>
                {isDm ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="xp">XP</Label>
                        <Input
                          id="xp"
                          type="number"
                          min={0}
                          defaultValue={character.xp}
                          onBlur={(e) => {
                            const value = Number(e.target.value);
                            if (!Number.isNaN(value) && value >= 0) {
                              update({ xp: value });
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="level">Level</Label>
                        <Input
                          id="level"
                          type="number"
                          min={1}
                          defaultValue={character.level}
                          onBlur={(e) => {
                            const value = Number(e.target.value);
                            if (!Number.isNaN(value) && value >= 1) {
                              update({ level: value });
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="owner">Owner</Label>
                      <select
                        id="owner"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                        defaultValue={character.owner_id ?? ""}
                        onChange={(e) =>
                          update({ owner_id: e.target.value || null })
                        }
                      >
                        <option value="">Unowned</option>
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : null}
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Skill points: {points.available} available of{" "}
                  {points.total} ({points.spent} spent)
                </p>
              </CardContent>
            </Card>
          </div>

          <StatsEditor
            stats={(character.stats ?? {}) as Record<string, unknown>}
            onChange={(stats) => update({ stats })}
            disabled={pending}
          />

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>
                Freeform notes, conditions, and reminders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={5}
                defaultValue={character.notes}
                onBlur={(e) => {
                  if (e.target.value !== character.notes) {
                    update({ notes: e.target.value });
                  }
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger zone</CardTitle>
              <CardDescription>
                Deleting a sheet removes its skills and inventory
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete ${character.name}? This cannot be undone.`,
                    )
                  ) {
                    startTransition(async () => {
                      const result = await deleteCharacter(character.id);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      router.push("/characters");
                    });
                  }
                }}
              >
                Delete character
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="pt-4">
          <SkillTreePanel
            classId={character.class_id}
            skills={skills.filter((s) => s.class_id === character.class_id)}
            learned={learned}
            points={points}
            pending={pending}
            onUnlock={(skillId) =>
              run(() => unlockSkill(character.id, skillId))
            }
            onLock={(skillId) =>
              run(() => lockSkill(character.id, skillId))
            }
          />
        </TabsContent>

        <TabsContent value="inventory" className="pt-4">
          <InventoryPanel
            characterId={character.id}
            inventory={inventory}
            items={items}
            transferTargets={transferTargets}
            pending={pending}
            onAdjust={(itemId, delta) =>
              run(() => adjustInventory({ characterId: character.id, itemId, delta }))
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatsEditor({
  stats,
  onChange,
  disabled,
}: {
  stats: Record<string, unknown>;
  onChange: (stats: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const [entries, setEntries] = useState<Array<[string, string]>>(() =>
    Object.entries(stats).map(([k, v]) => [k, String(v)]),
  );

  function commit(next: Array<[string, string]>) {
    setEntries(next);
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of next) {
      const trimmedKey = key.trim();
      if (!trimmedKey) continue;
      const num = Number(value);
      cleaned[trimmedKey] = value !== "" && !Number.isNaN(num) ? num : value;
    }
    onChange(cleaned);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stats</CardTitle>
        <CardDescription>
          Custom stat block for this homebrew system (numbers or text)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stats yet.</p>
        ) : (
          entries.map(([key, value], index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder="Stat name"
                value={key}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...entries];
                  next[index] = [e.target.value, value];
                  setEntries(next);
                }}
                onBlur={() => commit(entries)}
                className="w-40"
              />
              <Input
                placeholder="Value"
                value={value}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...entries];
                  next[index] = [key, e.target.value];
                  setEntries(next);
                }}
                onBlur={() => commit(entries)}
                className="w-32"
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  commit(entries.filter((_, i) => i !== index))
                }
              >
                Remove
              </Button>
            </div>
          ))
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setEntries([...entries, ["", ""]])}
        >
          Add stat
        </Button>
      </CardContent>
    </Card>
  );
}
