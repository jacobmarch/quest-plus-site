"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { CoinPurse, type CoinField } from "@/components/coin-purse";
import { SkillTreePanel } from "@/components/skill-tree-panel";
import { InventoryPanel } from "@/components/inventory-panel";

type LearnedRow = { skill_id: string };

const SHEET_TABS = ["overview", "skills", "inventory"] as const;
type SheetTab = (typeof SHEET_TABS)[number];

function isSheetTab(value: string | null): value is SheetTab {
  return SHEET_TABS.includes(value as SheetTab);
}

export function CharacterSheet({
  character,
  cls,
  skills,
  learned,
  inventory,
  profiles,
  transferTargets,
  isDm,
  currentUserId,
}: {
  character: CharacterRow;
  cls: ClassRow | null;
  skills: SkillRow[];
  learned: LearnedRow[];
  inventory: Array<
    Pick<
      InventoryRow,
      | "id"
      | "item_name"
      | "quantity"
      | "damage"
      | "effects"
    >
  >;
  profiles: Array<Pick<ProfileRow, "id" | "display_name">>;
  transferTargets: Array<Pick<CharacterRow, "id" | "name">>;
  isDm: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const tabParam = searchParams.get("tab");
  const tab: SheetTab = isSheetTab(tabParam) ? tabParam : "overview";

  const points = computeSkillPoints(
    cls,
    character,
    learned.map((l) => {
      const skill = skills.find((s) => s.id === l.skill_id);
      return {
        cost: skill?.cost ?? 0,
        is_default: skill?.is_default ?? false,
      };
    }),
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const update = (fields: Record<string, unknown>) =>
    run(() => updateCharacterFields(character.id, fields));

  const listHref = isDm
    ? character.kind === "enemy"
      ? "/bestiary"
      : "/party"
    : "/characters";

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
            onClick={() => router.push(listHref)}
          >
            Back
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
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
                <div className="flex w-full items-end justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="level">Level</Label>
                    {isDm ? (
                      <Input
                        id="level"
                        type="number"
                        min={1}
                        defaultValue={character.level}
                        className="w-24"
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (!Number.isNaN(value) && value >= 1) {
                            update({ level: value });
                          }
                        }}
                      />
                    ) : (
                      <p id="level" className="text-2xl font-semibold tabular-nums">
                        {character.level}
                      </p>
                    )}
                  </div>
                  <CoinPurse
                    idPrefix="overview"
                    gold={character.gold_pieces}
                    silver={character.silver_pieces}
                    bronze={character.bronze_pieces}
                    pending={pending}
                    className="justify-end"
                    onChange={(field: CoinField, value) =>
                      update({ [field]: value })
                    }
                  />
                </div>
                {isDm ? (
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
                ) : null}
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Skill points: {points.available} available of{" "}
                  {points.total} ({points.spent} spent)
                </p>
              </CardContent>
            </Card>
          </div>

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
                      router.push(listHref);
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
            gold={character.gold_pieces}
            silver={character.silver_pieces}
            bronze={character.bronze_pieces}
            transferTargets={transferTargets}
            isDm={isDm}
            pending={pending}
            onCoinChange={(field, value) => update({ [field]: value })}
            onAdjust={(itemName, delta) =>
              run(() =>
                adjustInventory({
                  characterId: character.id,
                  itemName,
                  delta,
                }),
              )
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
