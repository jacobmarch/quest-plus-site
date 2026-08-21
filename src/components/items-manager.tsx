"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteItem, upsertItem } from "@/app/actions";
import type { ItemRow } from "@/lib/database.types";
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

  function handleCreate(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    startTransition(async () => {
      const result = await upsertItem({
        name,
        description: String(formData.get("description") ?? ""),
      });
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleRename(item: ItemRow, name: string, description: string) {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await upsertItem({ id: item.id, name, description });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Add item</CardTitle>
          <CardDescription>Weapons, trinkets, cursed socks...</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleCreate} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="itemName">Name</Label>
              <Input id="itemName" name="name" required className="w-56" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="itemDescription">Description</Label>
              <Input
                id="itemDescription"
                name="description"
                className="w-72"
              />
            </div>
            <Button type="submit" disabled={pending}>
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

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
                <li key={item.id} className="py-2 first:pt-0 last:pb-0">
                  <ItemRowEditor
                    item={item}
                    pending={pending}
                    onSave={handleRename}
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

function ItemRowEditor({
  item,
  pending,
  onSave,
  onDelete,
}: {
  item: ItemRow;
  pending: boolean;
  onSave: (item: ItemRow, name: string, description: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        defaultValue={item.name}
        className="w-52"
        onBlur={(e) => {
          if (e.target.value.trim() && e.target.value !== item.name) {
            onSave(item, e.target.value.trim(), item.description);
          }
        }}
      />
      <Input
        defaultValue={item.description}
        className="w-72"
        onBlur={(e) => {
          if (e.target.value !== item.description) {
            onSave(item, item.name, e.target.value);
          }
        }}
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
  );
}
