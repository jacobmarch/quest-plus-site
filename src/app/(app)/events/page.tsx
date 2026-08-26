import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireDm } from "@/lib/auth";
import { AuditLog } from "@/components/audit-log";

export default async function EventsPage() {
  await requireDm();
  const supabase = await createClient();

  const [eventsRes, profilesRes, charactersRes] = await Promise.all([
    supabase
      .from("audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("profiles").select("id, display_name"),
    supabase.from("characters").select("id, name"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Game events</h1>
        <p className="text-sm text-muted-foreground">
          An audit trail of changes made to the campaign.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading events...</p>}>
        <AuditLog
          events={eventsRes.data ?? []}
          profiles={profilesRes.data ?? []}
          characters={charactersRes.data ?? []}
        />
      </Suspense>
    </div>
  );
}
