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

type CharacterSummary = {
  id: string;
  name: string;
  kind: string;
  level: number;
  current_hp: number;
  max_hp: number;
  is_dead: boolean;
  owner_id: string | null;
};

type SessionNoteSummary = {
  id: string;
  title: string;
  occurred_on: string;
};

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

  if (session.isDm) {
    return (
      <DmDashboard
        displayName={session.profile.display_name}
        pcs={characters.filter((c) => c.kind === "pc")}
        enemies={characters.filter((c) => c.kind === "enemy")}
        recentNotes={recentNotes}
      />
    );
  }

  return (
    <PlayerDashboard
      displayName={session.profile.display_name}
      myCharacters={characters.filter(
        (c) => c.kind === "pc" && c.owner_id === session.user.id,
      )}
      recentNotes={recentNotes}
    />
  );
}

function DmDashboard({
  displayName,
  pcs,
  enemies,
  recentNotes,
}: {
  displayName: string;
  pcs: CharacterSummary[];
  enemies: CharacterSummary[];
  recentNotes: SessionNoteSummary[];
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {displayName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Campaign overview — party, threats, and the session log
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Party</CardTitle>
          <CardDescription>Every player character in the campaign</CardDescription>
        </CardHeader>
        <CardContent>
          {pcs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No player characters yet. Players create their own sheets; assign
              an owner from Party once they exist.
            </p>
          ) : (
            <CharacterList characters={pcs} />
          )}
        </CardContent>
      </Card>

      <Separator />
      <RecentSessions notes={recentNotes} />
    </div>
  );
}

function PlayerDashboard({
  displayName,
  myCharacters,
  recentNotes,
}: {
  displayName: string;
  myCharacters: CharacterSummary[];
  recentNotes: SessionNoteSummary[];
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {displayName}
        </h1>
        <p className="text-sm text-muted-foreground">Your party at a glance</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My characters</CardTitle>
          <CardDescription>Characters you own</CardDescription>
        </CardHeader>
        <CardContent>
          {myCharacters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No characters yet.{" "}
              <Link href="/characters" className="underline underline-offset-4">
                Create one
              </Link>
              .
            </p>
          ) : (
            <CharacterList characters={myCharacters} />
          )}
        </CardContent>
      </Card>

      <Separator />
      <RecentSessions notes={recentNotes} />
    </div>
  );
}

function CharacterList({ characters }: { characters: CharacterSummary[] }) {
  return (
    <ul className="divide-y">
      {characters.map((character) => {
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
  );
}

function RecentSessions({ notes }: { notes: SessionNoteSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent sessions</CardTitle>
        <CardDescription>The latest campaign log entries</CardDescription>
      </CardHeader>
      <CardContent>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sessions recorded yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id}>
                <Link
                  href={`/sessions/${note.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-accent"
                >
                  <span className="font-medium">{note.title}</span>
                  <span className="text-muted-foreground">{note.occurred_on}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
