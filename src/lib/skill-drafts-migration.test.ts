import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs the draft-ability migration against real PostgreSQL. The tables below
// are the current shape of skills/character_skills, not the full schema.
const dm = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const player = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const cls = "11111111-1111-1111-1111-111111111111";
const root = "22222222-2222-2222-2222-222222222222";
const draft = "33333333-3333-3333-3333-333333333333";
const hero = "44444444-4444-4444-4444-444444444444";
let db: PGlite;

async function asRole(user: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try { return await db.query(sql); }
  finally { await db.exec("reset role"); }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role authenticated;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles(id uuid primary key, role text);
    insert into public.profiles values ('${dm}', 'dm'), ('${player}', 'player');
    create function private.is_dm() returns boolean language sql stable security definer set search_path = '' as
      $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'dm') $$;
    create table public.skills(
      id uuid primary key default gen_random_uuid(),
      class_id uuid not null,
      name text not null,
      description text not null default '',
      cost numeric not null default 1,
      prereq_skill_ids uuid[] not null default '{}',
      is_default boolean not null default false,
      created_at timestamptz not null default now()
    );
    alter table public.skills enable row level security;
    create policy "skills_select_authenticated" on public.skills for select
      using ((select auth.uid()) is not null);
    create policy "skills_write_dm" on public.skills for all
      using (private.is_dm()) with check (private.is_dm());
    create table public.character_skills(character_id uuid, skill_id uuid references public.skills(id) on delete cascade);
    grant usage on schema public, auth, private to authenticated;
    grant select, insert, update, delete on public.skills to authenticated;
  `);
  await db.exec(readFileSync(resolve("supabase/migrations/20261006120000_skill_drafts.sql"), "utf8"));
  await db.exec(`
    insert into public.skills(id, class_id, name) values ('${root}', '${cls}', 'Keen Eye');
    insert into public.skills(id, class_id, name, is_draft) values ('${draft}', '${cls}', 'Hail of Thorns', true);
  `);
}, 20000);

afterAll(async () => { await db?.close(); });

describe.sequential("skill drafts migration", () => {
  it("hides drafts from players but not the DM", async () => {
    expect((await asRole(player, "select id from public.skills")).rows).toHaveLength(1);
    expect((await asRole(dm, "select id from public.skills")).rows).toHaveLength(2);
  });

  it("keeps drafts unlinked and never starting skills", async () => {
    await expect(db.exec(`update public.skills set prereq_skill_ids = '{${root}}' where id = '${draft}'`)).rejects.toThrow();
    await expect(db.exec(`update public.skills set is_default = true where id = '${draft}'`)).rejects.toThrow();
  });

  it("rejects links to a draft and unlocking a draft", async () => {
    await expect(db.exec(`insert into public.skills(class_id, name, prereq_skill_ids) values ('${cls}', 'Bad', '{${draft}}')`))
      .rejects.toThrow("Place the draft");
    await expect(db.exec(`insert into public.character_skills values ('${hero}', '${draft}')`))
      .rejects.toThrow("cannot be unlocked");
  });

  it("places a draft under a parent in one update", async () => {
    await asRole(dm, `update public.skills set is_draft = false, prereq_skill_ids = '{${root}}' where id = '${draft}'`);
    expect((await asRole(player, "select id from public.skills")).rows).toHaveLength(2);
    await db.exec(`insert into public.character_skills values ('${hero}', '${draft}')`);
  });

  it("will not move an ability with dependents back to drafts", async () => {
    await expect(db.exec(`update public.skills set is_draft = true where id = '${root}'`)).rejects.toThrow("lead from this one");
  });
});
