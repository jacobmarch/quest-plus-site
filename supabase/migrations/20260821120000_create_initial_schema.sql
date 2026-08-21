-- Quest Plus initial schema
-- Order matters: tables first (SQL function bodies are validated against
-- existing relations), then helpers, triggers, RPC, and RLS policies.

-- ============================================================
-- Tables
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Adventurer',
  role text not null default 'player' check (role in ('dm', 'player')),
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  points_per_level integer not null default 1 check (points_per_level >= 0),
  created_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  description text not null default '',
  max_rank integer not null default 1 check (max_rank >= 1),
  cost_per_rank numeric not null default 1 check (cost_per_rank >= 0),
  x double precision not null default 0,
  y double precision not null default 0,
  prereq_skill_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index skills_class_id_idx on public.skills (class_id);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'pc' check (kind in ('pc', 'enemy')),
  name text not null,
  class_id uuid references public.classes(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete cascade,
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  current_hp integer not null default 10 check (current_hp >= 0),
  max_hp integer not null default 10 check (max_hp >= 1),
  stats jsonb not null default '{}'::jsonb,
  notes text not null default '',
  is_dead boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint characters_owner_required_for_pc
    check (kind = 'enemy' or owner_id is not null)
);
create index characters_owner_id_idx on public.characters (owner_id);
create index characters_kind_idx on public.characters (kind);
create index characters_class_id_idx on public.characters (class_id);

create table public.character_skills (
  character_id uuid not null references public.characters(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  rank integer not null default 1 check (rank >= 1),
  primary key (character_id, skill_id)
);
create index character_skills_skill_id_idx on public.character_skills (skill_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  quantity integer not null default 1 check (quantity >= 1),
  created_at timestamptz not null default now(),
  unique (character_id, item_id)
);
create index inventory_character_id_idx on public.inventory (character_id);
create index inventory_item_id_idx on public.inventory (item_id);

create table public.session_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled Session',
  occurred_on date not null default current_date,
  content_md text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Private schema & helper functions
-- ============================================================

create schema if not exists private;

-- Role checks live in an unexposed schema; security definer so policies
-- can evaluate them without recursive RLS lookups.
create or replace function private.is_dm()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'dm'
  );
$$;

create or replace function private.can_view_character(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.characters c
    where c.id = p_character_id
      and (
        private.is_dm()
        or (c.kind = 'pc' and c.owner_id = (select auth.uid()))
      )
  );
$$;

create or replace function private.can_edit_character(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.characters c
    where c.id = p_character_id
      and (
        private.is_dm()
        or (c.kind = 'pc' and c.owner_id = (select auth.uid()))
      )
  );
$$;

-- ============================================================
-- Triggers
-- ============================================================

-- Bootstrap a profile on signup; first ever user becomes the DM.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_is_first;
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    ),
    case when v_is_first then 'dm' else 'player' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

-- Keep updated_at fresh.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger characters_touch_updated_at
  before update on public.characters
  for each row execute procedure private.touch_updated_at();

create trigger session_notes_touch_updated_at
  before update on public.session_notes
  for each row execute procedure private.touch_updated_at();

-- Only the DM may change roles (players cannot self-promote).
create or replace function private.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id <> old.id then
    raise exception 'Cannot change profile id';
  end if;
  if new.role <> old.role and not private.is_dm() then
    raise exception 'Only the DM can change roles';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role_change
  before update on public.profiles
  for each row execute procedure private.guard_profile_role_change();

-- ============================================================
-- Atomic inventory transfer RPC (DM only)
-- ============================================================

create or replace function public.transfer_inventory(
  p_from_character uuid,
  p_to_character uuid,
  p_item uuid,
  p_quantity integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_dm() then
    raise exception 'Only the DM can transfer items';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;
  if p_from_character = p_to_character then
    raise exception 'Source and destination must differ';
  end if;

  -- Validate source holds enough (row lock prevents races).
  declare
    v_available integer;
  begin
    select quantity into v_available
    from public.inventory
    where character_id = p_from_character and item_id = p_item
    for update;

    if v_available is null or v_available < p_quantity then
      raise exception 'Source does not hold enough of that item';
    end if;

    if v_available = p_quantity then
      delete from public.inventory
      where character_id = p_from_character and item_id = p_item;
    else
      update public.inventory
      set quantity = quantity - p_quantity
      where character_id = p_from_character and item_id = p_item;
    end if;
  end;

  -- Merge into destination stack.
  insert into public.inventory (character_id, item_id, quantity)
  values (p_to_character, p_item, p_quantity)
  on conflict (character_id, item_id)
  do update set quantity = inventory.quantity + excluded.quantity;
end;
$$;

revoke all on function public.transfer_inventory(uuid, uuid, uuid, integer)
  from public, anon;
grant execute on function public.transfer_inventory(uuid, uuid, uuid, integer)
  to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.skills enable row level security;
alter table public.characters enable row level security;
alter table public.character_skills enable row level security;
alter table public.items enable row level security;
alter table public.inventory enable row level security;
alter table public.session_notes enable row level security;

-- profiles: everyone signed-in can read (party roster); users edit their own.
create policy "profiles_select_authenticated"
  on public.profiles for select
  using ((select auth.uid()) is not null);

create policy "profiles_update_own"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Catalog tables: readable by all signed-in, writable by DM only.
create policy "classes_select_authenticated"
  on public.classes for select
  using ((select auth.uid()) is not null);
create policy "classes_insert_dm"
  on public.classes for insert
  with check (private.is_dm());
create policy "classes_update_dm"
  on public.classes for update
  using (private.is_dm())
  with check (private.is_dm());
create policy "classes_delete_dm"
  on public.classes for delete
  using (private.is_dm());

create policy "skills_select_authenticated"
  on public.skills for select
  using ((select auth.uid()) is not null);
create policy "skills_insert_dm"
  on public.skills for insert
  with check (private.is_dm());
create policy "skills_update_dm"
  on public.skills for update
  using (private.is_dm())
  with check (private.is_dm());
create policy "skills_delete_dm"
  on public.skills for delete
  using (private.is_dm());

create policy "items_select_authenticated"
  on public.items for select
  using ((select auth.uid()) is not null);
create policy "items_insert_dm"
  on public.items for insert
  with check (private.is_dm());
create policy "items_update_dm"
  on public.items for update
  using (private.is_dm())
  with check (private.is_dm());
create policy "items_delete_dm"
  on public.items for delete
  using (private.is_dm());

-- characters: players see/edit their own PCs; DM sees everything.
create policy "characters_select_own_or_dm"
  on public.characters for select
  using (
    private.is_dm()
    or (kind = 'pc' and owner_id = (select auth.uid()))
  );

create policy "characters_insert_own_pc_or_dm"
  on public.characters for insert
  with check (
    private.is_dm()
    or (kind = 'pc' and owner_id = (select auth.uid()))
  );

create policy "characters_update_own_or_dm"
  on public.characters for update
  using (
    private.is_dm()
    or (kind = 'pc' and owner_id = (select auth.uid()))
  )
  with check (
    private.is_dm()
    or (kind = 'pc' and owner_id = (select auth.uid()))
  );

create policy "characters_delete_own_or_dm"
  on public.characters for delete
  using (
    private.is_dm()
    or (kind = 'pc' and owner_id = (select auth.uid()))
  );

-- character_skills: follows visibility of the parent character.
create policy "character_skills_select_visible"
  on public.character_skills for select
  using (private.can_view_character(character_id));

create policy "character_skills_insert_editable"
  on public.character_skills for insert
  with check (private.can_edit_character(character_id));

create policy "character_skills_update_editable"
  on public.character_skills for update
  using (private.can_edit_character(character_id))
  with check (private.can_edit_character(character_id));

create policy "character_skills_delete_editable"
  on public.character_skills for delete
  using (private.can_edit_character(character_id));

-- inventory: follows visibility of the parent character.
create policy "inventory_select_visible"
  on public.inventory for select
  using (private.can_view_character(character_id));

create policy "inventory_insert_editable"
  on public.inventory for insert
  with check (private.can_edit_character(character_id));

create policy "inventory_update_editable"
  on public.inventory for update
  using (private.can_edit_character(character_id))
  with check (private.can_edit_character(character_id));

create policy "inventory_delete_editable"
  on public.inventory for delete
  using (private.can_edit_character(character_id));

-- session_notes: shared campaign log; readable by all, writable by DM.
create policy "session_notes_select_authenticated"
  on public.session_notes for select
  using ((select auth.uid()) is not null);

create policy "session_notes_insert_dm"
  on public.session_notes for insert
  with check (private.is_dm());

create policy "session_notes_update_dm"
  on public.session_notes for update
  using (private.is_dm())
  with check (private.is_dm());

create policy "session_notes_delete_dm"
  on public.session_notes for delete
  using (private.is_dm());
