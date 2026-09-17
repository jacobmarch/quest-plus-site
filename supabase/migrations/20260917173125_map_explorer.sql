create table public.maps (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  parent_id uuid references public.maps(id) on delete restrict,
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint maps_not_own_parent check (parent_id is distinct from id)
);
create index maps_parent_id_idx on public.maps(parent_id);

-- Parentage and IDs are immutable. Requiring an already-existing parent on
-- insert makes cycles impossible, including multi-row inserts and direct API use.
create function private.validate_map_hierarchy()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.parent_id is distinct from old.parent_id
      or new.storage_path is distinct from old.storage_path
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'Only the map name can be changed';
    end if;
  elsif new.parent_id is not null then
    perform 1 from public.maps where id = new.parent_id for key share;
    if not found then
      raise exception 'Parent map must already exist';
    end if;
  end if;
  return new;
end;
$$;
create trigger validate_map_hierarchy before insert or update on public.maps
  for each row execute function private.validate_map_hierarchy();

alter table public.maps enable row level security;
revoke all on public.maps from anon, authenticated;
grant select, insert, delete on public.maps to authenticated;
grant update (name) on public.maps to authenticated;
create policy maps_read on public.maps for select to authenticated using (true);
create policy maps_create on public.maps for insert to authenticated
  with check (private.is_dm() and created_by = (select auth.uid())
    and split_part(storage_path, '/', 1) = (select auth.uid())::text);
create policy maps_rename on public.maps for update to authenticated
  using (private.is_dm()) with check (private.is_dm());
create policy maps_delete on public.maps for delete to authenticated using (private.is_dm());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('maps', 'maps', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']);
create policy maps_images_read on storage.objects for select to authenticated
  using (bucket_id = 'maps');
create policy maps_images_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'maps' and private.is_dm()
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'
    and split_part(name, '/', 1) = (select auth.uid())::text);
-- No overwrite policy: each upload uses a fresh path. Referenced images cannot
-- be removed until the leaf metadata is deleted successfully.
create policy maps_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'maps' and private.is_dm()
    and not exists (select 1 from public.maps where storage_path = storage.objects.name));
