"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireDm, requireSession } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toError(err: unknown): ActionResult {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

// ---------------------------------------------------------------- auth

export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) return { ok: false, error: error.message };
  // When email confirmation is required, no session comes back — send the
  // user to login with a "check your inbox" notice instead of the app.
  if (!data.session) {
    redirect("/login?confirm=sent");
  }
  redirect("/");
}

export async function signIn(
  email: string,
  password: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { ok: false, error: error.message };
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ------------------------------------------------------------ characters

export async function createCharacter(input: {
  name: string;
  kind: "pc" | "enemy";
  classId?: string | null;
  maxHp?: number;
}): Promise<ActionResult & { id?: string }> {
  try {
    const session = await requireSession();
    const supabase = await createClient();

    const insert = {
      name: input.name.trim(),
      kind: input.kind,
      class_id: input.classId ?? null,
      max_hp: input.maxHp ?? 10,
      current_hp: input.maxHp ?? 10,
      owner_id: session.user.id,
    };

    const { data, error } = await supabase
      .from("characters")
      .insert(insert)
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    if (input.classId) {
      const { error: skillError } = await supabase.rpc("grant_default_skills", {
        p_character: data.id,
      });
      if (skillError) throw new Error(skillError.message);
    }
    revalidatePath("/characters");
    revalidatePath("/bestiary");
    revalidatePath("/");
    return { ok: true, id: data.id };
  } catch (err) {
    return toError(err);
  }
}

export async function updateCharacterFields(
  id: string,
  fields: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await requireSession();
    const supabase = await createClient();

    // DM-owned fields must go through the validated RPC.
    const dmFields = ["level", "xp", "kind", "owner_id"];
    const hasDmFields = dmFields.some((k) => k in fields);
    if (hasDmFields) {
      const { error } = await supabase.rpc("dm_update_character", {
        p_id: id,
        p_updates: fields,
      });
      if (error) throw new Error(error.message);
    }

    const playerFields = Object.fromEntries(
      Object.entries(fields).filter(([k]) => !dmFields.includes(k)),
    );
    if (Object.keys(playerFields).length > 0) {
      const { error } = await supabase
        .from("characters")
        .update(playerFields)
        .eq("id", id);
      if (error) throw new Error(error.message);
    }

    revalidatePath(`/characters/${id}`);
    revalidatePath("/bestiary");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

export async function deleteCharacter(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    const supabase = await createClient();
    const { error } = await supabase.from("characters").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/characters");
    revalidatePath("/bestiary");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

export async function levelUpCharacter(id: string): Promise<ActionResult> {
  try {
    await requireDm();
    const supabase = await createClient();

    const { data: character, error: fetchErr } = await supabase
      .from("characters")
      .select("level")
      .eq("id", id)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    const { error } = await supabase.rpc("dm_update_character", {
      p_id: id,
      p_updates: { level: character.level + 1 },
    });
    if (error) throw new Error(error.message);

    revalidatePath(`/characters/${id}`);
    revalidatePath("/bestiary");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

// ----------------------------------------------------------- skill trees

export async function unlockSkill(
  characterId: string,
  skillId: string,
): Promise<ActionResult> {
  try {
    await requireSession();
    const supabase = await createClient();
    const { error } = await supabase.rpc("unlock_skill", {
      p_character: characterId,
      p_skill: skillId,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/characters/${characterId}`);
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

export async function lockSkill(
  characterId: string,
  skillId: string,
): Promise<ActionResult> {
  try {
    await requireSession();
    const supabase = await createClient();
    const { error } = await supabase.rpc("lock_skill", {
      p_character: characterId,
      p_skill: skillId,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/characters/${characterId}`);
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

// ------------------------------------------------------------- classes

export async function upsertClass(input: {
  id?: string;
  name: string;
  description: string;
  pointsPerLevel: number;
}): Promise<ActionResult & { id?: string }> {
  try {
    await requireDm();
    const supabase = await createClient();

    if (input.id) {
      const { error } = await supabase
        .from("classes")
        .update({
          name: input.name,
          description: input.description,
          points_per_level: input.pointsPerLevel,
        })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      revalidatePath("/trees");
      revalidatePath(`/trees/${input.id}`);
      return { ok: true, id: input.id };
    }

    const { data, error } = await supabase
      .from("classes")
      .insert({
        name: input.name,
        description: input.description,
        points_per_level: input.pointsPerLevel,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/trees");
    return { ok: true, id: data.id };
  } catch (err) {
    return toError(err);
  }
}

export async function deleteClass(id: string): Promise<ActionResult> {
  try {
    await requireDm();
    const supabase = await createClient();
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/trees");
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

// --------------------------------------------------------------- skills

export async function upsertSkill(input: {
  id?: string;
  classId: string;
  name: string;
  description: string;
  cost: number;
  prereqSkillIds: string[];
  isDefault: boolean;
}): Promise<ActionResult & { id?: string }> {
  try {
    await requireDm();
    const supabase = await createClient();

    const row = {
      class_id: input.classId,
      name: input.name,
      description: input.description,
      cost: input.cost,
      prereq_skill_ids: input.prereqSkillIds,
      is_default: input.isDefault,
    };

    if (input.id) {
      const { error } = await supabase
        .from("skills")
        .update(row)
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      revalidatePath(`/trees/${input.classId}`);
      return { ok: true, id: input.id };
    }

    const { data, error } = await supabase
      .from("skills")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/trees/${input.classId}`);
    return { ok: true, id: data.id };
  } catch (err) {
    return toError(err);
  }
}

export async function deleteSkill(
  id: string,
  classId: string,
): Promise<ActionResult> {
  try {
    await requireDm();
    const supabase = await createClient();
    const { error } = await supabase.from("skills").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath(`/trees/${classId}`);
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

// ---------------------------------------------------------------- items

export async function upsertItem(input: {
  id?: string;
  name: string;
  description: string;
}): Promise<ActionResult> {
  try {
    await requireDm();
    const supabase = await createClient();
    const row = { name: input.name, description: input.description };
    const query = input.id
      ? supabase.from("items").update(row).eq("id", input.id)
      : supabase.from("items").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    revalidatePath("/items");
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

export async function deleteItem(id: string): Promise<ActionResult> {
  try {
    await requireDm();
    const supabase = await createClient();
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/items");
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

// ------------------------------------------------------------ inventory

export async function adjustInventory(input: {
  characterId: string;
  itemName: string;
  delta: number;
}): Promise<ActionResult> {
  try {
    await requireSession();
    if (
      !input.characterId ||
      !input.itemName.trim() ||
      input.itemName.trim().length > 200 ||
      !Number.isInteger(input.delta) ||
      input.delta === 0
    ) {
      throw new Error("Invalid inventory change");
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("adjust_inventory", {
      p_character: input.characterId,
      p_item_name: input.itemName,
      p_delta: input.delta,
    });
    if (error) throw new Error(error.message);

    revalidatePath(`/characters/${input.characterId}`);
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

export async function transferInventory(input: {
  fromCharacterId: string;
  toCharacterId: string;
  itemName: string;
  quantity: number;
}): Promise<ActionResult> {
  try {
    await requireDm();
    const supabase = await createClient();
    const { error } = await supabase.rpc("transfer_inventory", {
      p_from_character: input.fromCharacterId,
      p_to_character: input.toCharacterId,
      p_item_name: input.itemName,
      p_quantity: input.quantity,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/characters/${input.fromCharacterId}`);
    revalidatePath(`/characters/${input.toCharacterId}`);
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

// -------------------------------------------------------- session notes

export async function upsertSessionNote(input: {
  id?: string;
  title: string;
  occurredOn: string;
  contentMd: string;
}): Promise<ActionResult & { id?: string }> {
  try {
    await requireDm();
    const supabase = await createClient();
    const row = {
      title: input.title,
      occurred_on: input.occurredOn,
      content_md: input.contentMd,
    };

    if (input.id) {
      const { error } = await supabase
        .from("session_notes")
        .update(row)
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      revalidatePath("/sessions");
      return { ok: true, id: input.id };
    }

    const { data, error } = await supabase
      .from("session_notes")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/sessions");
    return { ok: true, id: data.id };
  } catch (err) {
    return toError(err);
  }
}

export async function deleteSessionNote(id: string): Promise<ActionResult> {
  try {
    await requireDm();
    const supabase = await createClient();
    const { error } = await supabase
      .from("session_notes")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/sessions");
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}
