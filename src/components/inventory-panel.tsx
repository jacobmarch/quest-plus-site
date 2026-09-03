"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  transferInventory,
  updateInventoryDetails,
} from "@/app/actions";
import type { CharacterRow, InventoryRow } from "@/lib/database.types";
import {
  formatItemSummary,
  parseItemEffects,
  type ItemEffect,
} from "@/lib/items";
import {
  EffectList,
  emptyDraftEffect,
} from "@/components/item-effects-fields";
import { CoinPurse, type CoinField } from "@/components/coin-purse";
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

export function InventoryPanel({
  characterId,
  inventory,
  gold,
  silver,
  bronze,
  transferTargets,
  isDm,
  pending,
  onCoinChange,
  onAdjust,
}: {
  characterId: string;
  inventory: Array<
    Pick<InventoryRow, "id" | "item_name" | "quantity" | "damage" | "effects">
  >;
  gold: number;
  silver: number;
  bronze: number;
  transferTargets: Array<Pick<CharacterRow, "id" | "name">>;
  isDm: boolean;
  pending: boolean;
  onCoinChange: (field: CoinField, value: number) => void;
  onAdjust: (itemName: string, delta: number) => void;
}) {
  const rows = [...inventory].sort((a, b) =>
    a.item_name.localeCompare(b.item_name),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Coin purse</CardTitle>
          <CardDescription>
            Gold, silver, and bronze pieces — edit here instead of as inventory
            items
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CoinPurse
            idPrefix="inventory"
            gold={gold}
            silver={silver}
            bronze={bronze}
            pending={pending}
            onChange={onCoinChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Carried items</CardTitle>
          <CardDescription>
            Adjust quantities and effects on this sheet; DMs can reveal hidden
            effects and transfer items below
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Empty pockets. Add an item below to get started.
            </p>
          ) : (
            <ul className="divide-y">
              {rows.map((row) => (
                <InventoryItemEditor
                  key={row.id}
                  characterId={characterId}
                  row={row}
                  isDm={isDm}
                  pending={pending}
                  onAdjust={onAdjust}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AddItemForm pending={pending} onAdd={onAdjust} />

      {isDm && transferTargets.length > 0 ? (
        <TransferForm
          characterId={characterId}
          targets={transferTargets}
          inventory={inventory}
        />
      ) : null}
    </div>
  );
}

function InventoryItemEditor({
  characterId,
  row,
  isDm,
  pending,
  onAdjust,
}: {
  characterId: string;
  row: Pick<
    InventoryRow,
    "id" | "item_name" | "quantity" | "damage" | "effects"
  >;
  isDm: boolean;
  pending: boolean;
  onAdjust: (itemName: string, delta: number) => void;
}) {
  const [damage, setDamage] = useState(row.damage);
  const [effects, setEffects] = useState<ItemEffect[]>(
    parseItemEffects(row.effects),
  );
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<ItemEffect>(emptyDraftEffect);
  const router = useRouter();
  const [saving, startTransition] = useTransition();

  function save(nextEffects = effects, nextDamage = damage) {
    const payloadEffects = isDm
      ? nextEffects
      : nextEffects.filter((effect) => !effect.hidden);
    if (
      nextDamage === row.damage &&
      JSON.stringify(nextEffects) === JSON.stringify(parseItemEffects(row.effects))
    ) {
      return;
    }
    startTransition(async () => {
      const result = await updateInventoryDetails({
        characterId,
        itemName: row.item_name,
        damage: nextDamage,
        effects: payloadEffects,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Item details saved");
        router.refresh();
      }
    });
  }

  function addEffect() {
    if (!draft.name.trim()) return;
    const hidden = isDm && draft.hidden;
    const nextEffects = [
      ...effects,
      {
        ...draft,
        name: draft.name.trim(),
        description: draft.description.trim(),
        impact: draft.impact.trim(),
        hidden,
        revealed: !hidden,
      },
    ];
    setEffects(nextEffects);
    setDraft(emptyDraftEffect());
    save(nextEffects);
  }

  function removeEffect(index: number) {
    const target = effects[index];
    if (!isDm && target?.hidden) return;
    const nextEffects = effects.filter((_, i) => i !== index);
    setEffects(nextEffects);
    save(nextEffects);
  }

  const summary = formatItemSummary({ damage, effects, isDm });

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium">{row.item_name}</p>
          {summary ? (
            <p className="text-sm text-muted-foreground">{summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No damage or effects noted
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onAdjust(row.item_name, -1)}
          >
            −
          </Button>
          <span className="w-10 text-center tabular-nums">×{row.quantity}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onAdjust(row.item_name, 1)}
          >
            +
          </Button>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 px-0"
        onClick={() => setShowEditor((open) => !open)}
      >
        {showEditor ? "Hide details" : "Edit details"}
      </Button>
      {showEditor ? (
        <div className="mt-2 grid gap-3 rounded-md border p-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${row.id}-damage`}>Damage</Label>
            <Input
              id={`${row.id}-damage`}
              value={damage}
              placeholder="e.g. 1d6"
              maxLength={80}
              className="max-w-40"
              onChange={(event) => setDamage(event.target.value)}
              onBlur={() => save()}
              disabled={saving}
            />
          </div>
          <EffectList
            effects={effects}
            isDm={isDm}
            idPrefix={row.id}
            draft={draft}
            onDraftChange={setDraft}
            onAdd={addEffect}
            onRemove={removeEffect}
            onToggleHidden={
              isDm
                ? (index, hidden) => {
                    const nextEffects = effects.map((effect, i) =>
                      i === index
                        ? {
                            ...effect,
                            hidden,
                            revealed: hidden ? effect.revealed : true,
                          }
                        : effect,
                    );
                    setEffects(nextEffects);
                    save(nextEffects);
                  }
                : undefined
            }
            onToggleRevealed={
              isDm
                ? (index, revealed) => {
                    const nextEffects = effects.map((effect, i) =>
                      i === index ? { ...effect, revealed } : effect,
                    );
                    setEffects(nextEffects);
                    save(nextEffects);
                  }
                : undefined
            }
          />
        </div>
      ) : null}
    </li>
  );
}

function AddItemForm({
  pending,
  onAdd,
}: {
  pending: boolean;
  onAdd: (itemName: string, quantity: number) => void;
}) {
  function handleSubmit(formData: FormData) {
    const itemName = String(formData.get("itemName") ?? "").trim();
    const quantity = Number(formData.get("quantity") ?? 1);
    if (!itemName || !Number.isInteger(quantity) || quantity < 1) return;
    onAdd(itemName, quantity);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add item</CardTitle>
        <CardDescription>
          Add any item or note to this inventory
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="addItemName">Item name</Label>
            <Input
              id="addItemName"
              name="itemName"
              required
              placeholder="e.g. Potion, rope"
              maxLength={200}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="addQuantity">Quantity</Label>
            <Input
              id="addQuantity"
              name="quantity"
              type="number"
              min={1}
              step={1}
              defaultValue={1}
              required
            />
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Adding..." : "Add item"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TransferForm({
  characterId,
  targets,
  inventory,
}: {
  characterId: string;
  targets: Array<Pick<CharacterRow, "id" | "name">>;
  inventory: Array<Pick<InventoryRow, "item_name">>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const toCharacterId = String(formData.get("toCharacter") ?? "");
    const itemName = String(formData.get("item") ?? "");
    const quantity = Number(formData.get("quantity") ?? 1);
    if (!toCharacterId || !itemName || quantity < 1) return;

    startTransition(async () => {
      const result = await transferInventory({
        fromCharacterId: characterId,
        toCharacterId,
        itemName,
        quantity,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Item transferred");
      router.refresh();
    });
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer item (DM)</CardTitle>
        <CardDescription>
          Move items between characters — perfect for pickpocketing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="toCharacter">To character</Label>
            <select
              id="toCharacter"
              name="toCharacter"
              required
              className={selectClass}
              defaultValue=""
            >
              <option value="" disabled>
                Choose character
              </option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="transferItem">Item</Label>
            <select
              id="transferItem"
              name="item"
              required
              className={selectClass}
              defaultValue=""
            >
              <option value="" disabled>
                Choose item
              </option>
              {inventory.map((item) => (
                <option key={item.item_name} value={item.item_name}>
                  {item.item_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              defaultValue={1}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Transferring..." : "Transfer"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
