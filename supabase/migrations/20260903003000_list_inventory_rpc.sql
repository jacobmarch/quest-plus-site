-- Inventory reads must go through a security-definer RPC. The Data API GET
-- on inventory_visible is cached as an empty array by Next.js, so sheets
-- stay blank even after successful adjust_inventory writes.
-- Also run effects redaction as definer so the view works for authenticated.

create or replace function private.effects_for_viewer(p_effects jsonb)
returns jsonb
language sql
stable
security definer
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

create or replace function public.list_inventory(p_character uuid)
returns table (
  id uuid,
  character_id uuid,
  item_id uuid,
  item_name text,
  quantity integer,
  created_at timestamptz,
  damage text,
  effects jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
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
  where i.character_id = p_character
    and private.can_view_character(p_character);
$$;

create or replace function public.list_visible_inventory()
returns table (
  id uuid,
  character_id uuid,
  item_id uuid,
  item_name text,
  quantity integer,
  created_at timestamptz,
  damage text,
  effects jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.list_inventory(uuid) from public, anon;
grant execute on function public.list_inventory(uuid) to authenticated;

revoke all on function public.list_visible_inventory() from public, anon;
grant execute on function public.list_visible_inventory() to authenticated;
