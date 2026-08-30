-- Catalog secrets (hidden until the DM reveals them on a character's copy).
-- Players cannot read the items catalog or unrevealed inventory knowledge.

alter table public.items
  add column effect_hidden boolean not null default false,
  add column secret_features jsonb not null default '[]'::jsonb;

alter table public.items
  add constraint items_secret_features_is_array
    check (jsonb_typeof(secret_features) = 'array');

alter table public.inventory
  add column effect_revealed boolean not null default true;

drop policy "items_select_authenticated" on public.items;
create policy "items_select_dm"
  on public.items for select
  using (private.is_dm());

create or replace function private.secrets_as_inventory_features(p_secrets jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_name text;
  v_detail text;
begin
  if p_secrets is null or jsonb_typeof(p_secrets) <> 'array' then
    return '[]'::jsonb;
  end if;
  for v_elem in select * from jsonb_array_elements(p_secrets)
  loop
    if jsonb_typeof(v_elem) <> 'object' then
      continue;
    end if;
    v_name := btrim(coalesce(v_elem->>'name', ''));
    v_detail := btrim(coalesce(v_elem->>'detail', ''));
    if v_name = '' then
      continue;
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'name', v_name,
      'detail', v_detail,
      'hidden', true,
      'revealed', false
    ));
  end loop;
  return v_out;
end;
$$;

create or replace function private.features_for_viewer(p_features jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case
    when private.is_dm() then coalesce(p_features, '[]'::jsonb)
    else coalesce((
      select jsonb_agg(elem)
      from jsonb_array_elements(coalesce(p_features, '[]'::jsonb)) as elem
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
  case
    when private.is_dm() or i.effect_revealed then i.effect
    else ''::text
  end as effect,
  i.effect_revealed,
  private.features_for_viewer(i.features) as features
from public.inventory i
where private.can_view_character(i.character_id);

grant select on public.inventory_visible to authenticated;
revoke select on public.inventory from authenticated, anon;

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
  v_effect_hidden boolean := false;
  v_secrets jsonb := '[]'::jsonb;
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
    select i.damage, i.effect, i.effect_hidden, i.secret_features
      into v_damage, v_effect, v_effect_hidden, v_secrets
    from public.items i
    where lower(i.name) = lower(v_name)
    limit 1;

    insert into public.inventory (
      character_id, item_id, item_name, quantity,
      damage, effect, effect_revealed, features
    )
    values (
      p_character,
      null,
      v_name,
      v_new,
      coalesce(v_damage, ''),
      coalesce(v_effect, ''),
      not coalesce(v_effect_hidden, false),
      private.secrets_as_inventory_features(v_secrets)
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
  v_effect_revealed boolean := true;
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

  select quantity, damage, effect, effect_revealed, features
    into v_available, v_damage, v_effect, v_effect_revealed, v_features
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
    character_id, item_id, item_name, quantity,
    damage, effect, effect_revealed, features
  )
  values (
    p_to_character,
    null,
    v_name,
    p_quantity,
    coalesce(v_damage, ''),
    coalesce(v_effect, ''),
    coalesce(v_effect_revealed, true),
    coalesce(v_features, '[]'::jsonb)
  )
  on conflict (character_id, (lower(item_name)))
  do update set quantity = inventory.quantity + excluded.quantity;
end;
$$;

drop function public.update_inventory_details(uuid, text, text, text, jsonb);

create function public.update_inventory_details(
  p_character uuid,
  p_item_name text,
  p_damage text,
  p_effect text,
  p_effect_revealed boolean,
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
  v_hidden boolean;
  v_revealed boolean;
  v_existing jsonb;
  v_existing_effect text;
  v_existing_revealed boolean;
  v_effect_revealed boolean;
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
  if char_length(v_effect) > 80 then
    raise exception 'Effect must be 80 characters or fewer';
  end if;
  if p_features is null or jsonb_typeof(p_features) <> 'array' then
    raise exception 'Features must be an array';
  end if;

  select features, effect, effect_revealed
    into v_existing, v_existing_effect, v_existing_revealed
  from public.inventory
  where character_id = p_character and lower(item_name) = lower(v_name)
  for update;

  if not found then
    raise exception 'Item is not in this inventory';
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
    if v_is_dm then
      v_hidden := coalesce((v_elem->>'hidden')::boolean, false);
      v_revealed := coalesce((v_elem->>'revealed')::boolean, not v_hidden);
    else
      v_hidden := false;
      v_revealed := true;
    end if;
    v_features := v_features || jsonb_build_array(jsonb_build_object(
      'name', v_fname,
      'detail', v_fdetail,
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
      v_features := v_features || jsonb_build_array(v_elem);
    end loop;
    v_effect_revealed := v_existing_revealed;
    if not coalesce(v_existing_revealed, true) then
      v_effect := v_existing_effect;
    end if;
  else
    v_effect_revealed := coalesce(p_effect_revealed, v_existing_revealed);
  end if;

  if jsonb_array_length(v_features) > 20 then
    raise exception 'At most 20 features are allowed';
  end if;

  update public.inventory
  set
    damage = v_damage,
    effect = v_effect,
    effect_revealed = v_effect_revealed,
    features = v_features
  where character_id = p_character and lower(item_name) = lower(v_name);
end;
$$;

revoke all on function public.update_inventory_details(uuid, text, text, text, boolean, jsonb)
  from public, anon;
grant execute on function public.update_inventory_details(uuid, text, text, text, boolean, jsonb)
  to authenticated;
