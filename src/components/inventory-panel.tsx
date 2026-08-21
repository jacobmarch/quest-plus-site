"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { transferInventory } from "@/app/actions";
import type { CharacterRow, InventoryRow, ItemRow } from "@/lib/database.types";
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
  items,
  transferTargets,
  pending,
  onAdjust,
}: {
  characterId: string;
  inventory: Array<Pick<InventoryRow, "id" | "item_id" | "quantity">>;
  items: ItemRow[];
  transferTargets: Array<Pick<CharacterRow, "id" | "name">>;
  pending: boolean;
  onAdjust: (itemId: string, delta: number) => void;
}) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const rows = inventory
    .map((row) => ({ row, item: itemById.get(row.item_id) }))
    .filter((entry) => entry.item)
    .sort((a, b) => a.item!.name.localeCompare(b.item!.name));

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
              Empty pockets. The DM can grant or transfer items.
            </p>
          ) : (
            <ul className="divide-y">
              {rows.map(({ row, item }) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item!.name}</p>
                    {item!.description ? (
                      <p className="truncate text-sm text-muted-foreground">
                        {item!.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending || row.quantity <= 0}
                      onClick={() => onAdjust(row.item_id, -1)}
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
                      onClick={() => onAdjust(row.item_id, 1)}
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

      {transferTargets.length > 0 ? (
        <TransferForm
          characterId={characterId}
          targets={transferTargets}
          items={items}
        />
      ) : null}
    </div>
  );
}

function TransferForm({
  characterId,
  targets,
  items,
}: {
  characterId: string;
  targets: Array<Pick<CharacterRow, "id" | "name">>;
  items: ItemRow[];
}) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const toCharacterId = String(formData.get("toCharacter") ?? "");
    const itemId = String(formData.get("item") ?? "");
    const quantity = Number(formData.get("quantity") ?? 1);
    if (!toCharacterId || !itemId || quantity < 1) return;

    startTransition(async () => {
      const result = await transferInventory({
        fromCharacterId: characterId,
        toCharacterId,
        itemId,
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
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
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
