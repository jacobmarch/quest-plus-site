import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { formatRollBreakdown } from "@/lib/rolls";
import { Badge } from "@/components/ui/badge";

export default async function RollsPage() {
  await requireSession();
  const supabase = await createClient();
  const { data: rolls } = await supabase
    .from("rolls")
    .select(
      "id, roller_display_name, is_private, expression, faces, constant, total, created_at",
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

      {(rolls ?? []).length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No Rolls yet. Use the sidebar to roll.
        </p>
      ) : (
        <ul className="space-y-3">
          {(rolls ?? []).map((roll) => (
            <li key={roll.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{roll.roller_display_name}</span>
                  <Badge variant="secondary">
                    {roll.is_private ? "Private" : "Public"}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(roll.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 font-mono text-sm">
                {roll.expression} → {roll.total}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatRollBreakdown(roll)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
