import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { RollLog } from "@/components/roll-log";

export default async function RollsPage() {
  await requireSession();
  const supabase = await createClient();
  const { data: rolls } = await supabase
    .from("rolls")
    .select(
      "id, roller_id, roller_display_name, is_private, expression, faces, constant, total, created_at",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rolls</h1>
        <p className="text-sm text-muted-foreground">
          History of dice you are allowed to see. Newest first.
        </p>
      </div>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Loading Rolls...</p>
        }
      >
        <RollLog rolls={rolls ?? []} />
      </Suspense>
    </div>
  );
}
