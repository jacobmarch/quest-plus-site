import { createClient } from "@/lib/supabase/server";
import { requireDm } from "@/lib/auth";
import Link from "next/link";
import type { Json } from "@/lib/database.types";
import { formatItemSummary } from "@/lib/items";
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

  const [charactersRes, profilesRes, inventoryRes] = await Promise.all([
    supabase
      .from("characters")
      .select("id, name, kind, level, current_hp, max_hp, is_dead, owner_id")
      .eq("kind", "pc")
      .order("name"),
    supabase.from("profiles").select("id, display_name, role").order("display_name"),
    supabase.rpc("list_visible_inventory"),
  ]);

  const characters = charactersRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  if (inventoryRes.error) {
    throw new Error(inventoryRes.error.message);
  }
  const inventoryByCharacter = new Map<
    string,
    NonNullable<typeof inventoryRes.data>
  >();
  for (const row of inventoryRes.data ?? []) {
    const list = inventoryByCharacter.get(row.character_id) ?? [];
    list.push(row);
    inventoryByCharacter.set(row.character_id, list);
  }
  const nameById = new Map(profiles.map((p) => [p.id, p.display_name]));
  const unowned = profiles.filter(
    (p) =>
      p.role === "player" && !characters.some((c) => c.owner_id === p.id),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Party</h1>
        <p className="text-sm text-muted-foreground">
          Every player character, who owns it, and what they are carrying.
          Players create their own sheets; assign an owner on the character
          sheet.
        </p>
      </div>

      {characters.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No player characters yet. Players create their own sheets; assign
            an owner on the sheet once they exist.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y">
              {characters.map((character) => (
                <li
                  key={character.id}
                  className="space-y-2 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/characters/${character.id}?tab=inventory`}
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
                  </div>
                  <CarriedSummary
                    items={inventoryByCharacter.get(character.id) ?? []}
                  />
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

function CarriedSummary({
  items,
}: {
  items: Array<{
    id: string;
    item_name: string;
    quantity: number;
    damage: string;
    effects: Json;
  }>;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Empty pockets</p>
    );
  }

  return (
    <ul className="space-y-1 text-sm text-muted-foreground">
      {items
        .slice()
        .sort((a, b) => a.item_name.localeCompare(b.item_name))
        .map((item) => {
          const summary = formatItemSummary({
            damage: item.damage,
            effects: item.effects,
            isDm: true,
          });
          return (
            <li key={item.id}>
              {item.quantity}× {item.item_name}
              {summary ? ` — ${summary}` : null}
            </li>
          );
        })}
    </ul>
  );
}
