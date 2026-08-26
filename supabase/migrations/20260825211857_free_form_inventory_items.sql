-- Inventory entries are free-form per-character slots. Existing catalog links
-- are retained for old rows, but new entries use item_name directly.

alter table public.inventory
  add column item_name text;

update public.inventory i
set item_name = items.name
from public.items
where items.id = i.item_id;

alter table public.inventory
  alter column item_name set not null,
  alter column item_id drop not null;

alter table public.inventory
  drop constraint inventory_character_id_item_id_key;

create unique index inventory_character_name_idx
  on public.inventory (character_id, lower(item_name));

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
        coalesce(new.item_name, old.item_name, v_item_name, 'unknown item')
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
    actor_id, target_character_id, target_owner_id, entity_type, action,
    description, before_data, after_data
  )
  values (
    (select auth.uid()), v_character_id, v_owner_id, tg_table_name, lower(tg_op),
    v_description, v_before, v_after
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop function public.adjust_inventory(uuid, uuid, integer);

create function public.adjust_inventory(
  p_character uuid,
  p_item_name text,
  p_delta integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_item_name);
  v_current integer;
  v_new integer;
begin
  if not private.can_edit_character(p_character) then
    raise exception 'Not allowed to edit this character';
  end if;
  if v_name = '' or length(v_name) > 200 then
    raise exception 'Item name must be between 1 and 200 characters';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'Inventory change cannot be zero';
  end if;

  select quantity into v_current
  from public.inventory
  where character_id = p_character and lower(item_name) = lower(v_name)
  for update;

  v_new := coalesce(v_current, 0) + p_delta;
  if v_new <= 0 then
    if v_current is not null then
      delete from public.inventory
      where character_id = p_character and lower(item_name) = lower(v_name);
    end if;
  elsif v_current is null then
    insert into public.inventory (character_id, item_id, item_name, quantity)
    values (p_character, null, v_name, v_new);
  else
    update public.inventory
    set quantity = v_new
    where character_id = p_character and lower(item_name) = lower(v_name);
  end if;
end;
$$;

revoke all on function public.adjust_inventory(uuid, text, integer)
  from public, anon;
grant execute on function public.adjust_inventory(uuid, text, integer)
  to authenticated;

drop function public.transfer_inventory(uuid, uuid, uuid, integer);

create function public.transfer_inventory(
  p_from_character uuid,
  p_to_character uuid,
  p_item_name text,
  p_quantity integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_item_name);
  v_available integer;
begin
  if not private.is_dm() then
    raise exception 'Only the DM can transfer items';
  end if;
  if v_name = '' or length(v_name) > 200 then
    raise exception 'Item name must be between 1 and 200 characters';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;
  if p_from_character = p_to_character then
    raise exception 'Source and destination must differ';
  end if;

  select quantity into v_available
  from public.inventory
  where character_id = p_from_character and lower(item_name) = lower(v_name)
  for update;

  if v_available is null or v_available < p_quantity then
    raise exception 'Source does not hold enough of that item';
  end if;

  if v_available = p_quantity then
    delete from public.inventory
    where character_id = p_from_character and lower(item_name) = lower(v_name);
  else
    update public.inventory
    set quantity = quantity - p_quantity
    where character_id = p_from_character and lower(item_name) = lower(v_name);
  end if;

  insert into public.inventory (character_id, item_id, item_name, quantity)
  values (p_to_character, null, v_name, p_quantity)
  on conflict (character_id, (lower(item_name)))
  do update set quantity = inventory.quantity + excluded.quantity;
end;
$$;

revoke all on function public.transfer_inventory(uuid, uuid, text, integer)
  from public, anon;
grant execute on function public.transfer_inventory(uuid, uuid, text, integer)
  to authenticated;
