import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs the hidden-ability migration against real PostgreSQL. The tables below
// are the current shape of the tables it touches, not the full schema.
const dm = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const player = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const cls = "11111111-1111-1111-1111-111111111111";
const root = "22222222-2222-2222-2222-222222222222";
const secret = "33333333-3333-3333-3333-333333333333";
const deeper = "44444444-4444-4444-4444-444444444444";
const hero = "55555555-5555-5555-5555-555555555555";
const sidekick = "66666666-6666-6666-6666-666666666666";
let db: PGlite;

async function asRole(user: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try { return await db.query<{ id: string }>(sql); }
  finally { await db.exec("reset role"); }
}

const visibleTo = async (user: string) =>
  (await asRole(user, "select id from public.skills order by name")).rows.map((r) => r.id);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles(id uuid primary key, role text);
    insert into public.profiles values ('${dm}', 'dm'), ('${player}', 'player');
    create function private.is_dm() returns boolean language sql stable security definer set search_path = '' as
      $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'dm') $$;
    create table public.classes(id uuid primary key, points_per_level integer not null default 1);
    create table public.characters(
      id uuid primary key, kind text not null default 'pc', owner_id uuid,
      class_id uuid references public.classes(id), level integer not null default 1
    );
    create function private.can_edit_character(p uuid) returns boolean language sql stable security definer set search_path = '' as
      $$ select exists(select 1 from public.characters c where c.id = p and (private.is_dm() or c.owner_id = auth.uid())) $$;
    create function private.can_view_character(p uuid) returns boolean language sql stable security definer set search_path = '' as
      $$ select private.can_edit_character(p) $$;
    create table public.skills(
      id uuid primary key default gen_random_uuid(),
      class_id uuid not null,
      name text not null,
      cost numeric not null default 1,
      prereq_skill_ids uuid[] not null default '{}',
      is_default boolean not null default false,
      is_draft boolean not null default false
    );
    alter table public.skills enable row level security;
    create policy "skills_select_authenticated" on public.skills for select
      using ((select auth.uid()) is not null and (not is_draft or private.is_dm()));
    create policy "skills_write_dm" on public.skills for all
      using (private.is_dm()) with check (private.is_dm());
    create table public.character_skills(
      character_id uuid references public.characters(id) on delete cascade,
      skill_id uuid references public.skills(id) on delete cascade,
      primary key (character_id, skill_id)
    );
    grant usage on schema public, auth, private to authenticated;
    grant select, insert, update, delete on public.skills, public.characters, public.character_skills to authenticated;
  `);
  await db.exec(readFileSync(resolve("supabase/migrations/20261007170000_hidden_skills.sql"), "utf8"));
  await db.exec(`
    insert into public.classes values ('${cls}', 5);
    insert into public.characters(id, owner_id, class_id, level) values
      ('${hero}', '${player}', '${cls}', 3), ('${sidekick}', '${player}', '${cls}', 3);
    insert into public.skills(id, class_id, name) values ('${root}', '${cls}', 'a Keen Eye');
    insert into public.skills(id, class_id, name, is_hidden, prereq_skill_ids)
      values ('${secret}', '${cls}', 'b Shadow Step', true, '{${root}}');
    insert into public.skills(id, class_id, name, prereq_skill_ids)
      values ('${deeper}', '${cls}', 'c Umbral Cloak', '{${secret}}');
  `);
}, 20000);

afterAll(async () => { await db?.close(); });

describe.sequential("hidden skills migration", () => {
  it("hides a hidden ability and its branch from players, not the DM", async () => {
    expect(await visibleTo(player)).toEqual([root]);
    expect(await visibleTo(dm)).toEqual([root, secret, deeper]);
  });

  it("will not let a player unlock a hidden ability", async () => {
    await db.exec(`insert into public.character_skills values ('${hero}', '${root}')`);
    await expect(asRole(player, `select public.unlock_skill('${hero}', '${secret}')`))
      .rejects.toThrow("Ability not found");
  });

  it("only lets the DM reveal", async () => {
    await expect(asRole(player, `select public.reveal_skill('${hero}', '${secret}')`))
      .rejects.toThrow("Only the DM");
    await expect(asRole(player, `insert into public.skill_reveals values ('${hero}', '${secret}')`))
      .rejects.toThrow();
  });

  it("revealing a deep ability opens the hidden path above it for that character", async () => {
    await asRole(dm, `select public.reveal_skill('${hero}', '${deeper}')`);
    const reveals = await db.query<{ skill_id: string }>("select skill_id from public.skill_reveals");
    expect(reveals.rows.map((r) => r.skill_id)).toEqual([secret]);
    expect(await visibleTo(player)).toEqual([root, secret, deeper]);
    await asRole(player, `select public.unlock_skill('${hero}', '${secret}')`);
  });

  it("keeps the branch hidden from the player's other character", async () => {
    const visible = await db.query<{ v: boolean }>(
      `select private.skill_visible_to_character('${secret}', '${sidekick}') as v`,
    );
    expect(visible.rows[0].v).toBe(false);
    await expect(asRole(player, `select public.unlock_skill('${sidekick}', '${root}')`)).resolves.toBeTruthy();
    await expect(asRole(player, `select public.unlock_skill('${sidekick}', '${secret}')`))
      .rejects.toThrow("Ability not found");
  });

  it("keeps learned abilities visible after the reveal is taken back", async () => {
    await asRole(dm, `delete from public.skill_reveals where character_id = '${hero}'`);
    const visible = await db.query<{ v: boolean }>(
      `select private.skill_visible_to_character('${secret}', '${hero}') as v`,
    );
    expect(visible.rows[0].v).toBe(true);
  });

  it("does not allow a hidden starting skill", async () => {
    await expect(db.exec(`update public.skills set is_default = true where id = '${secret}'`))
      .rejects.toThrow("skills_hidden_not_default");
  });

  it("skips starting skills under a hidden branch", async () => {
    await db.exec(`
      insert into public.skills(class_id, name, is_default, prereq_skill_ids)
        values ('${cls}', 'd Hidden Start', true, '{${secret}}');
      insert into public.skills(class_id, name, is_default) values ('${cls}', 'e Open Start', true);
    `);
    await asRole(player, `select public.grant_default_skills('${sidekick}')`);
    const granted = await db.query<{ name: string }>(
      `select s.name from public.character_skills cs join public.skills s on s.id = cs.skill_id
       where cs.character_id = '${sidekick}' and s.is_default`,
    );
    expect(granted.rows.map((r) => r.name)).toEqual(["e Open Start"]);
  });
});
