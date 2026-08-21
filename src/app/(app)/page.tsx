import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [charactersRes, notesRes] = await Promise.all([
    supabase
      .from("characters")
      .select("id, name, kind, level, current_hp, max_hp, is_dead, owner_id")
      .order("kind")
      .order("name"),
    supabase
      .from("session_notes")
      .select("id, title, occurred_on")
      .order("occurred_on", { ascending: false })
      .limit(3),
  ]);

  const characters = charactersRes.data ?? [];
  const recentNotes = notesRes.data ?? [];
  const isDm = session.isDm;

  const pcs = characters.filter((c) => c.kind === "pc");
  const enemies = characters.filter((c) => c.kind === "enemy");
  const myCharacters = pcs.filter((c) => c.owner_id === session.user.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {session.profile.display_name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isDm
            ? "DM view — the whole campaign at a glance"
            : "Your party at a glance"}
        </p>
      </div>

      {isDm ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardDescription>Player characters</CardDescription>
              <CardTitle className="text-3xl">{pcs.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/party">View party</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Active enemies</CardDescription>
              <CardTitle className="text-3xl">{enemies.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/bestiary">Open bestiary</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{isDm ? "Party" : "My characters"}</CardTitle>
          <CardDescription>
            {isDm
              ? "Every player character in the campaign"
              : "Characters you own"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(isDm ? pcs : myCharacters).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No characters yet.{" "}
              <Link href="/characters" className="underline underline-offset-4">
                Create one
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y">
              {(isDm ? pcs : myCharacters).map((character) => {
                const hpPct = Math.round(
                  (character.current_hp / Math.max(character.max_hp, 1)) * 100,
                );
                return (
                  <li key={character.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      href={`/characters/${character.id}`}
                      className="flex items-center justify-between gap-4 rounded-md px-2 py-1 hover:bg-accent"
                    >
                      <span className="font-medium">{character.name}</span>
                      <span className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Badge variant="outline">Lv {character.level}</Badge>
                        <span
                          className={
                            character.is_dead || hpPct <= 25
                              ? "text-destructive"
                              : undefined
                          }
                        >
                          HP {character.current_hp}/{character.max_hp}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
          <CardDescription>The latest campaign log entries</CardDescription>
        </CardHeader>
        <CardContent>
          {recentNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sessions recorded yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentNotes.map((note) => (
                <li key={note.id}>
                  <Link
                    href={`/sessions/${note.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-accent"
                  >
                    <span className="font-medium">{note.title}</span>
                    <span className="text-muted-foreground">
                      {note.occurred_on}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
