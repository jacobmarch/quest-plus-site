-- Atomic inventory editing and a DM-only audit trail for game-state changes.

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  target_character_id uuid,
  target_owner_id uuid,
  entity_type text not null,
  action text not null,
  description text not null,
  before_data jsonb,
  after_data jsonb
);

create index audit_events_created_at_idx
  on public.audit_events (created_at desc);
create index audit_events_target_character_idx
  on public.audit_events (target_character_id);

alter table public.audit_events enable row level security;

create policy "audit_events_select_dm"
  on public.audit_events for select
  to authenticated
  using (private.is_dm());

revoke all on public.audit_events from anon;
revoke insert, update, delete on public.audit_events from authenticated;
grant select on public.audit_events to authenticated;

create or replace function private.record_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_character_id uuid;
  v_owner_id uuid;
  v_item_name text;
  v_skill_name text;
  v_description text;
begin
  v_before := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_after := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;

  if tg_table_name = 'characters' then
    v_character_id := coalesce(new.id, old.id);
    v_owner_id := coalesce(new.owner_id, old.owner_id);
    v_description := format('%s character "%s"', lower(tg_op), coalesce(new.name, old.name));
  elsif tg_table_name in ('inventory', 'character_skills') then
    v_character_id := coalesce(new.character_id, old.character_id);
    select owner_id into v_owner_id
    from public.characters
    where id = v_character_id;
    if tg_table_name = 'inventory' then
      select name into v_item_name
      from public.items
      where id = coalesce(new.item_id, old.item_id);
      v_description := format(
        '%s inventory item "%s"',
        lower(tg_op),
        coalesce(v_item_name, 'unknown item')
      );
    else
      select name into v_skill_name
      from public.skills
      where id = coalesce(new.skill_id, old.skill_id);
      v_description := format(
        '%s skill "%s"',
        lower(tg_op),
        coalesce(v_skill_name, 'unknown skill')
      );
    end if;
  else
    v_description := format('%s %s record', lower(tg_op), tg_table_name);
  end if;

  insert into public.audit_events (
    actor_id,
    target_character_id,
    target_owner_id,
    entity_type,
    action,
    description,
    before_data,
    after_data
  )
  values (
    (select auth.uid()),
    v_character_id,
    v_owner_id,
    tg_table_name,
    lower(tg_op),
    v_description,
    v_before,
    v_after
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger audit_characters
  after insert or update or delete on public.characters
  for each row execute procedure private.record_audit_event();
create trigger audit_character_skills
  after insert or update or delete on public.character_skills
  for each row execute procedure private.record_audit_event();
create trigger audit_inventory
  after insert or update or delete on public.inventory
  for each row execute procedure private.record_audit_event();
create trigger audit_classes
  after insert or update or delete on public.classes
  for each row execute procedure private.record_audit_event();
create trigger audit_skills
  after insert or update or delete on public.skills
  for each row execute procedure private.record_audit_event();
create trigger audit_items
  after insert or update or delete on public.items
  for each row execute procedure private.record_audit_event();
create trigger audit_session_notes
  after insert or update or delete on public.session_notes
  for each row execute procedure private.record_audit_event();

create or replace function public.adjust_inventory(
  p_character uuid,
  p_item uuid,
  p_delta integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current integer;
  v_new integer;
begin
  if not private.can_edit_character(p_character) then
    raise exception 'Not allowed to edit this character';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'Inventory change cannot be zero';
  end if;
  if not exists (select 1 from public.items where id = p_item) then
    raise exception 'Item does not exist';
  end if;

  select quantity into v_current
  from public.inventory
  where character_id = p_character and item_id = p_item
  for update;

  v_new := coalesce(v_current, 0) + p_delta;
  if v_new <= 0 then
    if v_current is not null then
      delete from public.inventory
      where character_id = p_character and item_id = p_item;
    end if;
  elsif v_current is null then
    insert into public.inventory (character_id, item_id, quantity)
    values (p_character, p_item, v_new);
  else
    update public.inventory
    set quantity = v_new
    where character_id = p_character and item_id = p_item;
  end if;
end;
$$;

revoke all on function public.adjust_inventory(uuid, uuid, integer)
  from public, anon;
grant execute on function public.adjust_inventory(uuid, uuid, integer)
  to authenticated;

revoke insert, update, delete on public.inventory from authenticated;
