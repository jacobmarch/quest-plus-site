"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { adjustInventory, transferInventory } from "@/app/actions";
import type { CharacterRow, InventoryRow } from "@/lib/database.types";
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
  transferTargets,
  isDm,
  pending,
  onAdjust,
}: {
  characterId: string;
  inventory: Array<Pick<InventoryRow, "id" | "item_name" | "quantity">>;
  transferTargets: Array<Pick<CharacterRow, "id" | "name">>;
  isDm: boolean;
  pending: boolean;
  onAdjust: (itemName: string, delta: number) => void;
}) {
  const rows = [...inventory].sort((a, b) =>
    a.item_name.localeCompare(b.item_name),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Carried items</CardTitle>
          <CardDescription>
            Adjust quantities on this sheet; DMs can also transfer items below
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
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                >
                  <p className="truncate font-medium">{row.item_name}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => onAdjust(row.item_name, -1)}
                    >
                      −
                    </Button>
                    <span className="w-10 text-center tabular-nums">
                      ×{row.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => onAdjust(row.item_name, 1)}
                    >
                      +
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AddItemForm characterId={characterId} />

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

function AddItemForm({
  characterId,
}: {
  characterId: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const itemName = String(formData.get("itemName") ?? "").trim();
    const quantity = Number(formData.get("quantity") ?? 1);
    if (!itemName || !Number.isInteger(quantity) || quantity < 1) return;

    startTransition(async () => {
      const result = await adjustInventory({
        characterId,
        itemName,
        delta: quantity,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Item added");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add item</CardTitle>
        <CardDescription>
          Add any item, currency, or note to this inventory
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
              placeholder="e.g. Potion, 50 gold, rope"
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
