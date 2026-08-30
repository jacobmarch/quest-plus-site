import { createClient } from "@/lib/supabase/server";
import { requireDm } from "@/lib/auth";
import { ItemsManager } from "@/components/items-manager";

export default async function ItemsPage() {
  await requireDm();
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("items")
    .select("*")
    .order("name");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Item Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Define items once, then grant them to any character sheet. Each
          effect can be public or hidden until you reveal it on a sheet.
        </p>
      </div>
      <ItemsManager items={items ?? []} />
    </div>
  );
}
