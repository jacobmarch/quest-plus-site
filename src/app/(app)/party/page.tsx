import { createClient } from "@/lib/supabase/server";
import { requireDm } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PartyPage() {
  await requireDm();
  const supabase = await createClient();

  const [charactersRes, profilesRes] = await Promise.all([
    supabase
      .from("characters")
      .select("id, name, kind, level, current_hp, max_hp, is_dead, owner_id")
      .eq("kind", "pc")
      .order("name"),
    supabase.from("profiles").select("id, display_name").order("display_name"),
  ]);

  const characters = charactersRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const nameById = new Map(profiles.map((p) => [p.id, p.display_name]));
  const unowned = profiles.filter(
    (p) => !characters.some((c) => c.owner_id === p.id),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Party</h1>
        <p className="text-sm text-muted-foreground">
          Every player character and who owns it
        </p>
      </div>

      {characters.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No player characters yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <ul className="divide-y">
              {characters.map((character) => (
                <li
                  key={character.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <Link
                    href={`/characters/${character.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {character.name}
                  </Link>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>
                      {character.owner_id
                        ? (nameById.get(character.owner_id) ?? "Unknown player")
                        : "Unowned"}
                    </span>
                    <span>Lv {character.level}</span>
                    <span>
                      HP {character.current_hp}/{character.max_hp}
                    </span>
                    {character.is_dead ? (
                      <span className="text-destructive">dead</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {unowned.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No character yet</CardTitle>
            <CardDescription>
              Players who have not created a character
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {unowned.map((p) => p.display_name).join(", ")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Button asChild variant="outline" size="sm">
        <Link href="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
