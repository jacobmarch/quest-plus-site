create table public.rolls (
  id uuid primary key default gen_random_uuid(),
  roller_id uuid not null references public.profiles (id) on delete cascade,
  roller_display_name text not null,
  is_private boolean not null default false,
  expression text not null,
  faces integer[] not null,
  constant integer not null default 0,
  total integer not null,
  created_at timestamptz not null default now()
);

create index rolls_created_at_idx on public.rolls (created_at desc);

alter table public.rolls enable row level security;

create policy "rolls_select_visible"
  on public.rolls
  for select
  to authenticated
  using (
    not is_private
    or roller_id = (select auth.uid())
    or private.is_dm()
  );

create policy "rolls_insert_own"
  on public.rolls
  for insert
  to authenticated
  with check (roller_id = (select auth.uid()));

grant select, insert on table public.rolls to authenticated;

alter publication supabase_realtime add table public.rolls;
