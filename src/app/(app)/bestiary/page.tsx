import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireDm } from "@/lib/auth";
import { CreateCharacterDialog } from "@/components/create-character-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function BestiaryPage() {
  await requireDm();
  const supabase = await createClient();

  const [enemiesRes, classesRes] = await Promise.all([
    supabase
      .from("characters")
      .select("id, name, level, current_hp, max_hp, is_dead, notes")
      .eq("kind", "enemy")
      .order("name"),
    supabase.from("classes").select("id, name").order("name"),
  ]);

  const enemies = enemiesRes.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bestiary</h1>
          <p className="text-sm text-muted-foreground">
            Track foes between sessions — open a sheet for full controls
          </p>
        </div>
        <CreateCharacterDialog kind="enemy" classes={classesRes.data ?? []} />
      </div>

      {enemies.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No enemies yet. Add one to start building your roster of threats.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {enemies.map((enemy) => (
            <Link key={enemy.id} href={`/characters/${enemy.id}`}>
              <Card className="h-full transition-colors hover:border-foreground/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {enemy.name}
                    {enemy.is_dead ? (
                      <Badge variant="destructive">Dead</Badge>
                    ) : null}
                  </CardTitle>
                  <CardDescription>Level {enemy.level}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    HP{" "}
                    <span
                      className={
                        enemy.current_hp / Math.max(enemy.max_hp, 1) <= 0.25
                          ? "font-medium text-destructive"
                          : "font-medium text-foreground"
                      }
                    >
                      {enemy.current_hp}
                    </span>{" "}
                    / {enemy.max_hp}
                  </p>
                  {enemy.notes ? (
                    <p className="line-clamp-2">{enemy.notes}</p>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
