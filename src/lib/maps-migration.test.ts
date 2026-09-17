import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Exercise real PostgreSQL constraints and RLS locally without needing Docker.
// The minimal auth/storage tables below model policy inputs, not Storage HTTP.
const dm = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const player = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const world = "11111111-1111-1111-1111-111111111111";
const region = "22222222-2222-2222-2222-222222222222";
const city = "33333333-3333-3333-3333-333333333333";
const path = (id: string) => `${dm}/${id}.png`;
let db: PGlite;

async function asRole(role: "authenticated" | "anon", user: string, sql: string) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try { return await db.query(sql); }
  finally { await db.exec("reset role"); }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth; create schema private; create schema storage;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles(id uuid primary key, role text);
    insert into public.profiles values ('${dm}', 'dm'), ('${player}', 'player');
    create function private.is_dm() returns boolean language sql stable security definer set search_path = '' as
      $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'dm') $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage, private to authenticated, anon;
    grant select, insert, update, delete on storage.objects to authenticated, anon;
  `);
  await db.exec(readFileSync(resolve("supabase/migrations/20260917173125_map_explorer.sql"), "utf8"));
}, 20000);

afterAll(async () => { await db?.close(); });

describe.sequential("map migration PostgreSQL permissions and hierarchy", () => {
  it("creates a restricted private bucket", async () => {
    const result = await db.query<{ public: boolean; file_size_limit: number }>("select * from storage.buckets where id = 'maps'");
    expect(result.rows[0].public).toBe(false);
    expect(Number(result.rows[0].file_size_limit)).toBe(10485760);
  });
  it("allows a DM to upload and create World > Region > City", async () => {
    for (const [id, name, parent] of [[world, "World", null], [region, "Region", world], [city, "City", region]]) {
      await asRole("authenticated", dm, `insert into storage.objects(bucket_id,name) values ('maps','${path(id!)}')`);
      await asRole("authenticated", dm, `insert into public.maps(id,name,parent_id,storage_path,created_by) values
        ('${id}','${name}',${parent ? `'${parent}'` : "null"},'${path(id!)}','${dm}')`);
    }
    expect((await asRole("authenticated", player, "select * from public.maps")).rows).toHaveLength(3);
    expect((await asRole("authenticated", player, "select * from storage.objects")).rows).toHaveLength(3);
  });
  it("rejects player metadata and image creation", async () => {
    await expect(asRole("authenticated", player, `insert into public.maps(name,storage_path,created_by) values ('No','${player}/${city}.png','${player}')`)).rejects.toThrow();
    await expect(asRole("authenticated", player, `insert into storage.objects(bucket_id,name) values ('maps','${player}/${city}.png')`)).rejects.toThrow();
    expect((await asRole("authenticated", player, `update public.maps set name='No' where id='${world}' returning id`)).rows).toHaveLength(0);
    expect((await asRole("authenticated", player, `delete from public.maps where id='${city}' returning id`)).rows).toHaveLength(0);
    expect((await asRole("authenticated", player, "delete from storage.objects returning id")).rows).toHaveLength(0);
    expect((await asRole("authenticated", player, "update storage.objects set name='No' returning id")).rows).toHaveLength(0);
  });
  it("denies anonymous reads and writes", async () => {
    await expect(asRole("anon", "", "select * from public.maps")).rejects.toThrow();
    await expect(asRole("anon", "", "delete from public.maps")).rejects.toThrow();
    expect((await asRole("anon", "", "select * from storage.objects")).rows).toHaveLength(0);
    await expect(asRole("anon", "", `insert into storage.objects(bucket_id,name) values ('maps','${path(city)}')`)).rejects.toThrow();
  });
  it("blocks reparenting, self-parenting, cycles and non-leaf deletion", async () => {
    await expect(asRole("authenticated", dm, `update public.maps set parent_id='${city}' where id='${world}'`)).rejects.toThrow();
    await expect(db.exec(`update public.maps set parent_id='${city}' where id='${world}'`)).rejects.toThrow("Only the map name");
    await expect(asRole("authenticated", dm, `insert into public.maps(id,name,parent_id,storage_path,created_by)
      values ('44444444-4444-4444-4444-444444444444','Self','44444444-4444-4444-4444-444444444444','${dm}/44444444-4444-4444-4444-444444444444.png','${dm}')`)).rejects.toThrow();
    await expect(asRole("authenticated", dm, `delete from public.maps where id='${world}'`)).rejects.toThrow();
  });
  it("protects referenced images and supports rename plus leaf-first cleanup", async () => {
    expect((await asRole("authenticated", dm, `delete from storage.objects where name='${path(city)}' returning id`)).rows).toHaveLength(0);
    await asRole("authenticated", dm, `update public.maps set name='New World' where id='${world}'`);
    expect((await asRole("authenticated", player, `select name from public.maps where id='${world}'`)).rows).toEqual([{ name: "New World" }]);
    await asRole("authenticated", dm, `delete from public.maps where id='${city}'`);
    expect((await asRole("authenticated", dm, `delete from storage.objects where name='${path(city)}' returning id`)).rows).toHaveLength(1);
  });
});
