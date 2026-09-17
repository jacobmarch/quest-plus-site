import { MapsExplorer } from "@/components/maps-explorer";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function MapsPage() {
  const { isDm } = await requireSession();
  const supabase = await createClient();
  const { data: maps, error } = await supabase.from("maps").select("*").order("name");

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Maps</h1>
        <div role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm">
          <p className="font-medium text-destructive">Unable to load maps.</p>
          <p className="mt-1 text-muted-foreground">{error.message}</p>
          <a href="/maps" className="mt-3 inline-block underline underline-offset-4">Try again</a>
        </div>
      </div>
    );
  }

  return <MapsExplorer maps={maps ?? []} isDm={isDm} />;
}
