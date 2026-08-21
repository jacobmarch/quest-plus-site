import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { CreateCharacterDialog } from "@/components/create-character-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function CharactersPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [charactersRes, classesRes] = await Promise.all([
    supabase
      .from("characters")
      .select("id, name, kind, level, current_hp, max_hp, is_dead")
      .eq("kind", "pc")
      .order("name"),
    supabase.from("classes").select("id, name").order("name"),
  ]);

  const characters = charactersRes.data ?? [];
  const classes = classesRes.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Characters</h1>
          <p className="text-sm text-muted-foreground">
            Sheets you own — level up by spending skill points
          </p>
        </div>
        <CreateCharacterDialog kind="pc" classes={classes} />
      </div>

      {characters.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You have no characters yet. Create your first one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {characters.map((character) => (
            <Link key={character.id} href={`/characters/${character.id}`}>
              <Card className="h-full transition-colors hover:border-foreground/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {character.name}
                    {character.is_dead ? (
                      <Badge variant="destructive">Dead</Badge>
                    ) : null}
                  </CardTitle>
                  <CardDescription>Level {character.level}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  HP {character.current_hp} / {character.max_hp}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
