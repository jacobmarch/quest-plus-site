import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/database.types";

export type SessionContext = {
  user: {
    id: string;
    email?: string;
  };
  profile: ProfileRow;
  isDm: boolean;
};

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    user: { id: user.id, email: user.email ?? undefined },
    profile,
    isDm: profile.role === "dm",
  };
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) {
    throw new Error("Not authenticated");
  }
  return session;
}

export async function requireDm(): Promise<SessionContext> {
  const session = await requireSession();
  if (!session.isDm) {
    throw new Error("Only the DM can do that");
  }
  return session;
}
