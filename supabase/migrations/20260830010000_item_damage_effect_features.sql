-- Catalog defaults for damage/effect, plus per-inventory overrides and
-- named feature notes (enchantments). New inventory rows snapshot matching
-- catalog stats once; later catalog edits do not rewrite existing copies.

alter table public.items
  add column damage text not null default '',
  add column effect text not null default '';

alter table public.items
  add constraint items_damage_len check (char_length(damage) <= 80),
  add constraint items_effect_len check (char_length(effect) <= 80);

alter table public.inventory
  add column damage text not null default '',
  add column effect text not null default '',
  add column features jsonb not null default '[]'::jsonb;

alter table public.inventory
  add constraint inventory_damage_len check (char_length(damage) <= 80),
  add constraint inventory_effect_len check (char_length(effect) <= 80),
  add constraint inventory_features_is_array check (jsonb_typeof(features) = 'array');

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
  v_effect text := '';
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
    select i.damage, i.effect into v_damage, v_effect
    from public.items i
    where lower(i.name) = lower(v_name)
    limit 1;

    insert into public.inventory (
      character_id, item_id, item_name, quantity, damage, effect
    )
    values (
      p_character,
      null,
      v_name,
      v_new,
      coalesce(v_damage, ''),
      coalesce(v_effect, '')
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
  v_effect text := '';
  v_features jsonb := '[]'::jsonb;
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

  select quantity, damage, effect, features
    into v_available, v_damage, v_effect, v_features
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
    character_id, item_id, item_name, quantity, damage, effect, features
  )
  values (
    p_to_character,
    null,
    v_name,
    p_quantity,
    coalesce(v_damage, ''),
    coalesce(v_effect, ''),
    coalesce(v_features, '[]'::jsonb)
  )
  on conflict (character_id, (lower(item_name)))
  do update set quantity = inventory.quantity + excluded.quantity;
end;
$$;

create or replace function public.update_inventory_details(
  p_character uuid,
  p_item_name text,
  p_damage text,
  p_effect text,
  p_features jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_item_name);
  v_damage text := btrim(coalesce(p_damage, ''));
  v_effect text := btrim(coalesce(p_effect, ''));
  v_features jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_fname text;
  v_fdetail text;
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
  if char_length(v_effect) > 80 then
    raise exception 'Effect must be 80 characters or fewer';
  end if;
  if p_features is null or jsonb_typeof(p_features) <> 'array' then
    raise exception 'Features must be an array';
  end if;
  if jsonb_array_length(p_features) > 20 then
    raise exception 'At most 20 features are allowed';
  end if;

  for v_elem in select * from jsonb_array_elements(p_features)
  loop
    if jsonb_typeof(v_elem) <> 'object' then
      raise exception 'Each feature must be an object';
    end if;
    v_fname := btrim(coalesce(v_elem->>'name', ''));
    v_fdetail := btrim(coalesce(v_elem->>'detail', ''));
    if v_fname = '' then
      raise exception 'Feature name is required';
    end if;
    if char_length(v_fname) > 80 then
      raise exception 'Feature name must be 80 characters or fewer';
    end if;
    if char_length(v_fdetail) > 200 then
      raise exception 'Feature detail must be 200 characters or fewer';
    end if;
    v_features := v_features || jsonb_build_array(
      jsonb_build_object('name', v_fname, 'detail', v_fdetail)
    );
  end loop;

  update public.inventory
  set damage = v_damage, effect = v_effect, features = v_features
  where character_id = p_character and lower(item_name) = lower(v_name);

  if not found then
    raise exception 'Item is not in this inventory';
  end if;
end;
$$;

revoke all on function public.update_inventory_details(uuid, text, text, text, jsonb)
  from public, anon;
grant execute on function public.update_inventory_details(uuid, text, text, text, jsonb)
  to authenticated;
