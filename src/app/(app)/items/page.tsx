import { createClient } from "@/lib/supabase/server";
import { requireDm } from "@/lib/auth";
import { ItemsManager } from "@/components/items-manager";
import type { InventoryRow } from "@/lib/database.types";

export default async function ItemsPage() {
  await requireDm();
  const supabase = await createClient();
  const [itemsRes, charactersRes, inventoryRes] = await Promise.all([
    supabase.from("items").select("*").order("name"),
    supabase
      .from("characters")
      .select("id, name, kind, is_dead")
      .order("name"),
    supabase.rpc("list_visible_inventory"),
  ]);
  if (inventoryRes.error) throw new Error(inventoryRes.error.message);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Item Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Every item you&apos;ve made and who is carrying it. Open an item to
          edit it or hand it to a character. Unique items, like a named
          weapon, live with one character at a time.
        </p>
      </div>
      <ItemsManager
        items={itemsRes.data ?? []}
        characters={charactersRes.data ?? []}
        inventory={(inventoryRes.data ?? []).map((row: InventoryRow) => ({
          character_id: row.character_id,
          item_name: row.item_name,
          quantity: row.quantity,
        }))}
      />
    </div>
  );
}
