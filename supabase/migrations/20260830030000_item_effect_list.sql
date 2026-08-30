-- Unify catalog and inventory onto a list of effects. Each effect has a
-- name, description, impact, and a hidden-by-default flag. Inventory copies
-- also store whether that effect has been revealed to the player.

alter table public.items
  add column effects jsonb not null default '[]'::jsonb;

alter table public.inventory
  add column effects jsonb not null default '[]'::jsonb;

update public.items i
set effects = coalesce((
  select jsonb_agg(e)
  from (
    select jsonb_build_object(
      'name', 'Effect',
      'description', '',
      'impact', btrim(i.effect),
      'hidden', i.effect_hidden
    ) as e
    where btrim(i.effect) <> ''
    union all
    select jsonb_build_object(
      'name', coalesce(nullif(btrim(s->>'name'), ''), 'Hidden'),
      'description', '',
      'impact', coalesce(s->>'detail', s->>'impact', ''),
      'hidden', true
    )
    from jsonb_array_elements(coalesce(i.secret_features, '[]'::jsonb)) s
  ) parts
), '[]'::jsonb);

update public.inventory inv
set effects = coalesce((
  select jsonb_agg(e)
  from (
    select jsonb_build_object(
      'name', 'Effect',
      'description', '',
      'impact', btrim(inv.effect),
      'hidden', not inv.effect_revealed,
      'revealed', inv.effect_revealed
    ) as e
    where btrim(inv.effect) <> ''
    union all
    select jsonb_build_object(
      'name', coalesce(nullif(btrim(f->>'name'), ''), 'Effect'),
      'description', coalesce(f->>'description', ''),
      'impact', coalesce(f->>'impact', f->>'detail', ''),
      'hidden', coalesce((f->>'hidden')::boolean, false),
      'revealed', coalesce(
        (f->>'revealed')::boolean,
        not coalesce((f->>'hidden')::boolean, false)
      )
    )
    from jsonb_array_elements(coalesce(inv.features, '[]'::jsonb)) f
  ) parts
), '[]'::jsonb);

drop view if exists public.inventory_visible;

alter table public.items
  drop constraint if exists items_effect_len,
  drop constraint if exists items_secret_features_is_array,
  drop column effect,
  drop column effect_hidden,
  drop column secret_features,
  add constraint items_effects_is_array check (jsonb_typeof(effects) = 'array');

alter table public.inventory
  drop constraint if exists inventory_effect_len,
  drop constraint if exists inventory_features_is_array,
  drop column effect,
  drop column effect_revealed,
  drop column features,
  add constraint inventory_effects_is_array check (jsonb_typeof(effects) = 'array');

create or replace function private.catalog_effects_to_inventory(p_effects jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_name text;
  v_description text;
  v_impact text;
  v_hidden boolean;
begin
  if p_effects is null or jsonb_typeof(p_effects) <> 'array' then
    return '[]'::jsonb;
  end if;
  for v_elem in select * from jsonb_array_elements(p_effects)
  loop
    if jsonb_typeof(v_elem) <> 'object' then
      continue;
    end if;
    v_name := btrim(coalesce(v_elem->>'name', ''));
    v_description := btrim(coalesce(v_elem->>'description', ''));
    v_impact := btrim(coalesce(v_elem->>'impact', v_elem->>'detail', ''));
    v_hidden := coalesce((v_elem->>'hidden')::boolean, false);
    if v_name = '' then
      continue;
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'name', v_name,
      'description', v_description,
      'impact', v_impact,
      'hidden', v_hidden,
      'revealed', not v_hidden
    ));
  end loop;
  return v_out;
end;
$$;

create or replace function private.effects_for_viewer(p_effects jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case
    when private.is_dm() then coalesce(p_effects, '[]'::jsonb)
    else coalesce((
      select jsonb_agg(elem)
      from jsonb_array_elements(coalesce(p_effects, '[]'::jsonb)) as elem
      where not coalesce((elem->>'hidden')::boolean, false)
         or coalesce((elem->>'revealed')::boolean, false)
    ), '[]'::jsonb)
  end;
$$;

create or replace view public.inventory_visible
with (security_invoker = false)
as
select
  i.id,
  i.character_id,
  i.item_id,
  i.item_name,
  i.quantity,
  i.created_at,
  i.damage,
  private.effects_for_viewer(i.effects) as effects
from public.inventory i
where private.can_view_character(i.character_id);

grant select on public.inventory_visible to authenticated;

create or replace function public.adjust_inventory(
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
  v_damage text := '';
  v_effects jsonb := '[]'::jsonb;
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
    select i.damage, i.effects into v_damage, v_effects
    from public.items i
    where lower(i.name) = lower(v_name)
    limit 1;

    insert into public.inventory (
      character_id, item_id, item_name, quantity, damage, effects
    )
    values (
      p_character,
      null,
      v_name,
      v_new,
      coalesce(v_damage, ''),
      private.catalog_effects_to_inventory(v_effects)
    );
  else
    update public.inventory
    set quantity = v_new
    where character_id = p_character and lower(item_name) = lower(v_name);
  end if;
end;
$$;

create or replace function public.transfer_inventory(
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
  v_damage text := '';
  v_effects jsonb := '[]'::jsonb;
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

  select quantity, damage, effects
    into v_available, v_damage, v_effects
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

  insert into public.inventory (
    character_id, item_id, item_name, quantity, damage, effects
  )
  values (
    p_to_character,
    null,
    v_name,
    p_quantity,
    coalesce(v_damage, ''),
    coalesce(v_effects, '[]'::jsonb)
  )
  on conflict (character_id, (lower(item_name)))
  do update set quantity = inventory.quantity + excluded.quantity;
end;
$$;

drop function if exists public.update_inventory_details(uuid, text, text, text, boolean, jsonb);

create function public.update_inventory_details(
  p_character uuid,
  p_item_name text,
  p_damage text,
  p_effects jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_item_name);
  v_damage text := btrim(coalesce(p_damage, ''));
  v_effects jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_ename text;
  v_description text;
  v_impact text;
  v_hidden boolean;
  v_revealed boolean;
  v_existing jsonb;
  v_is_dm boolean := private.is_dm();
begin
  if not private.can_edit_character(p_character) then
    raise exception 'Not allowed to edit this character';
  end if;
  if v_name = '' or length(v_name) > 200 then
    raise exception 'Item name must be between 1 and 200 characters';
  end if;
  if char_length(v_damage) > 80 then
    raise exception 'Damage must be 80 characters or fewer';
  end if;
  if p_effects is null or jsonb_typeof(p_effects) <> 'array' then
    raise exception 'Effects must be an array';
  end if;

  select effects into v_existing
  from public.inventory
  where character_id = p_character and lower(item_name) = lower(v_name)
  for update;

  if not found then
    raise exception 'Item is not in this inventory';
  end if;

  for v_elem in select * from jsonb_array_elements(p_effects)
  loop
    if jsonb_typeof(v_elem) <> 'object' then
      raise exception 'Each effect must be an object';
    end if;
    v_ename := btrim(coalesce(v_elem->>'name', ''));
    v_description := btrim(coalesce(v_elem->>'description', ''));
    v_impact := btrim(coalesce(v_elem->>'impact', v_elem->>'detail', ''));
    if v_ename = '' then
      raise exception 'Effect name is required';
    end if;
    if char_length(v_ename) > 80 then
      raise exception 'Effect name must be 80 characters or fewer';
    end if;
    if char_length(v_description) > 200 then
      raise exception 'Effect description must be 200 characters or fewer';
    end if;
    if char_length(v_impact) > 80 then
      raise exception 'Effect impact must be 80 characters or fewer';
    end if;
    if v_is_dm then
      v_hidden := coalesce((v_elem->>'hidden')::boolean, false);
      v_revealed := coalesce((v_elem->>'revealed')::boolean, not v_hidden);
    else
      v_hidden := false;
      v_revealed := true;
    end if;
    v_effects := v_effects || jsonb_build_array(jsonb_build_object(
      'name', v_ename,
      'description', v_description,
      'impact', v_impact,
      'hidden', v_hidden,
      'revealed', v_revealed
    ));
  end loop;

  if not v_is_dm then
    for v_elem in
      select elem
      from jsonb_array_elements(coalesce(v_existing, '[]'::jsonb)) as elem
      where coalesce((elem->>'hidden')::boolean, false)
    loop
      v_effects := v_effects || jsonb_build_array(v_elem);
    end loop;
  end if;

  if jsonb_array_length(v_effects) > 20 then
    raise exception 'At most 20 effects are allowed';
  end if;

  update public.inventory
  set damage = v_damage, effects = v_effects
  where character_id = p_character and lower(item_name) = lower(v_name);
end;
$$;

revoke all on function public.update_inventory_details(uuid, text, text, jsonb)
  from public, anon;
grant execute on function public.update_inventory_details(uuid, text, text, jsonb)
  to authenticated;
