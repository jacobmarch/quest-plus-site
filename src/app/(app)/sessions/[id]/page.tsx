import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { SessionNoteEditDialog } from "@/components/session-note-dialog";
import { Button } from "@/components/ui/button";

function renderMarkdownLine(line: string, key: number) {
  if (line.startsWith("### ")) {
    return (
      <h3 key={key} className="mt-4 font-semibold">
        {line.slice(4)}
      </h3>
    );
  }
  if (line.startsWith("## ")) {
    return (
      <h2 key={key} className="mt-5 text-lg font-semibold">
        {line.slice(3)}
      </h2>
    );
  }
  if (line.startsWith("# ")) {
    return (
      <h1 key={key} className="mt-5 text-xl font-bold">
        {line.slice(2)}
      </h1>
    );
  }
  if (/^[-*] /.test(line)) {
    return (
      <li key={key} className="ml-5 list-disc">
        {inline(line.slice(2))}
      </li>
    );
  }
  if (line.trim() === "") {
    return <div key={key} className="h-2" />;
  }
  return <p key={key}>{inline(line)}</p>;
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}

export default async function SessionDetailPage({
  params,
}: PageProps<"/sessions/[id]">) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data: note } = await supabase
    .from("session_notes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!note) notFound();

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{note.title}</h1>
          <p className="text-sm text-muted-foreground">
            Played on {note.occurred_on}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session.isDm ? <SessionNoteEditDialog note={note} /> : null}
          <Button asChild variant="outline" size="sm">
            <Link href="/sessions">Back</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border p-6 leading-relaxed">
        {note.content_md
          ? note.content_md.split("\n").map(renderMarkdownLine)
          : "No notes yet."}
      </div>
    </article>
  );
}
