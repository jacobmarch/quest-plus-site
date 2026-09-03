import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { CharacterSheet } from "@/components/character-sheet";

export default async function CharacterPage({
  params,
}: PageProps<"/characters/[id]">) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data: character } = await supabase
    .from("characters")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!character) notFound();

  const canEdit =
    session.isDm ||
    (character.kind === "pc" && character.owner_id === session.user.id);
  if (!canEdit) notFound();

  const [clsRes, skillsRes, learnedRes, inventoryRes, profilesRes, othersRes] =
    await Promise.all([
      character.class_id
        ? supabase.from("classes").select("*").eq("id", character.class_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("skills").select("*").order("name"),
      supabase.from("character_skills").select("skill_id").eq("character_id", id),
      supabase.rpc("list_inventory", { p_character: id }),
      supabase.from("profiles").select("id, display_name"),
      session.isDm
        ? supabase.from("characters").select("id, name").neq("id", id).order("name")
        : supabase
            .from("characters")
            .select("id, name")
            .eq("kind", "pc")
            .eq("owner_id", session.user.id)
            .neq("id", id)
            .order("name"),
    ]);

  if (inventoryRes.error) {
    throw new Error(inventoryRes.error.message);
  }

  return (
    <Suspense>
      <CharacterSheet
        character={character}
        cls={clsRes.data}
        skills={skillsRes.data ?? []}
        learned={learnedRes.data ?? []}
        inventory={inventoryRes.data ?? []}
        profiles={profilesRes.data ?? []}
        transferTargets={othersRes.data ?? []}
        isDm={session.isDm}
        currentUserId={session.user.id}
      />
    </Suspense>
  );
}
