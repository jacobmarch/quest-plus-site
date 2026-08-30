import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { SessionNoteDialog } from "@/components/session-note-dialog";

export default async function SessionsPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: notes } = await supabase
    .from("session_notes")
    .select("id, title, occurred_on, content_md")
    .order("occurred_on", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            {session.isDm
              ? "Manage the campaign log — recaps, loot, and memorable moments"
              : "Session recaps from the campaign"}
          </p>
        </div>
        {session.isDm ? <SessionNoteDialog /> : null}
      </div>

      {(notes ?? []).length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No sessions recorded yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {(notes ?? []).map((note) => (
            <li key={note.id}>
              <Link
                href={`/sessions/${note.id}`}
                className="block rounded-lg border p-4 transition-colors hover:border-foreground/30"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold">{note.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {note.occurred_on}
                  </span>
                </div>
                {note.content_md ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {note.content_md.replace(/[#*_>`]/g, "")}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
