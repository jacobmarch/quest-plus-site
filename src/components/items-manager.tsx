"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteItem, upsertItem } from "@/app/actions";
import type { ItemRow } from "@/lib/database.types";
import { parseItemEffects, type ItemEffect } from "@/lib/items";
import {
  EffectList,
  emptyDraftEffect,
} from "@/components/item-effects-fields";
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

export function ItemsManager({ items }: { items: ItemRow[] }) {
  const [pending, startTransition] = useTransition();

  function persist(input: {
    id?: string;
    name: string;
    description: string;
    damage: string;
    effects: ItemEffect[];
  }) {
    startTransition(async () => {
      const result = await upsertItem(input);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <AddItemForm pending={pending} onCreate={persist} />
      <Card>
        <CardHeader>
          <CardTitle>Catalog ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing in the catalog yet.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <ItemRowEditor
                    item={item}
                    pending={pending}
                    onSave={persist}
                    onDelete={() =>
                      startTransition(async () => {
                        const result = await deleteItem(item.id);
                        if (!result.ok) toast.error(result.error);
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddItemForm({
  pending,
  onCreate,
}: {
  pending: boolean;
  onCreate: (input: {
    name: string;
    description: string;
    damage: string;
    effects: ItemEffect[];
  }) => void;
}) {
  const [effects, setEffects] = useState<ItemEffect[]>([]);
  const [draft, setDraft] = useState<ItemEffect>(emptyDraftEffect);

  function handleCreate(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    onCreate({
      name,
      description: String(formData.get("description") ?? ""),
      damage: String(formData.get("damage") ?? ""),
      effects,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add item</CardTitle>
        <CardDescription>
          Name, description, and base damage. Stack as many effects as you
          want — each can be public or hidden until identified.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleCreate} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="itemName">Name</Label>
            <Input
              id="itemName"
              name="name"
              required
              placeholder="e.g. Short sword with a ruby"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="itemDescription">Description</Label>
            <Input id="itemDescription" name="description" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="itemDamage">Damage</Label>
            <Input
              id="itemDamage"
              name="damage"
              placeholder="e.g. 1d6"
              maxLength={80}
              className="max-w-40"
            />
          </div>
          <EffectList
            effects={effects}
            isDm
            idPrefix="new-item"
            draft={draft}
            onDraftChange={setDraft}
            onAdd={() => {
              if (!draft.name.trim()) return;
              setEffects([
                ...effects,
                {
                  ...draft,
                  name: draft.name.trim(),
                  description: draft.description.trim(),
                  impact: draft.impact.trim(),
                  revealed: !draft.hidden,
                },
              ]);
              setDraft(emptyDraftEffect());
            }}
            onRemove={(index) =>
              setEffects(effects.filter((_, i) => i !== index))
            }
            onToggleHidden={(index, hidden) =>
              setEffects(
                effects.map((effect, i) =>
                  i === index
                    ? { ...effect, hidden, revealed: !hidden }
                    : effect,
                ),
              )
            }
          />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              Add
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ItemRowEditor({
  item,
  pending,
  onSave,
  onDelete,
}: {
  item: ItemRow;
  pending: boolean;
  onSave: (input: {
    id: string;
    name: string;
    description: string;
    damage: string;
    effects: ItemEffect[];
  }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [damage, setDamage] = useState(item.damage);
  const [effects, setEffects] = useState<ItemEffect[]>(
    parseItemEffects(item.effects),
  );
  const [draft, setDraft] = useState<ItemEffect>(emptyDraftEffect);

  function persist(nextEffects = effects) {
    if (!name.trim()) return;
    if (
      name.trim() === item.name &&
      description === item.description &&
      damage === item.damage &&
      JSON.stringify(nextEffects) === JSON.stringify(parseItemEffects(item.effects))
    ) {
      return;
    }
    onSave({
      id: item.id,
      name: name.trim(),
      description,
      damage,
      effects: nextEffects,
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          className="w-52"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => persist()}
        />
        <Input
          value={description}
          className="w-72"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => persist()}
        />
        <Input
          value={damage}
          placeholder="Damage"
          className="w-40"
          maxLength={80}
          onChange={(e) => setDamage(e.target.value)}
          onBlur={() => persist()}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Delete "${item.name}"?`)) onDelete();
          }}
        >
          Delete
        </Button>
      </div>
      <EffectList
        effects={effects}
        isDm
        idPrefix={item.id}
        draft={draft}
        onDraftChange={setDraft}
        onAdd={() => {
          if (!draft.name.trim()) return;
          const nextEffects = [
            ...effects,
            {
              ...draft,
              name: draft.name.trim(),
              description: draft.description.trim(),
              impact: draft.impact.trim(),
              revealed: !draft.hidden,
            },
          ];
          setEffects(nextEffects);
          setDraft(emptyDraftEffect());
          persist(nextEffects);
        }}
        onRemove={(index) => {
          const nextEffects = effects.filter((_, i) => i !== index);
          setEffects(nextEffects);
          persist(nextEffects);
        }}
        onToggleHidden={(index, hidden) => {
          const nextEffects = effects.map((effect, i) =>
            i === index ? { ...effect, hidden, revealed: !hidden } : effect,
          );
          setEffects(nextEffects);
          persist(nextEffects);
        }}
      />
    </div>
  );
}
