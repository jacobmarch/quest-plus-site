-- dm_update_character cast (p_updates -> 'k')::uuid directly from jsonb to
-- uuid, which Postgres does not support. Extract as text first.

create or replace function public.dm_update_character(
  p_id uuid,
  p_updates jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_allowed text[] := array[
    'name', 'class_id', 'level', 'xp', 'current_hp', 'max_hp',
    'stats', 'notes', 'is_dead', 'kind', 'owner_id'
  ];
begin
  if not private.is_dm() then
    raise exception 'Only the DM can do that';
  end if;

  foreach v_key in array array(select jsonb_object_keys(p_updates)) loop
    if not (v_key = any(v_allowed)) then
      raise exception 'Field not editable: %', v_key;
    end if;
  end loop;

  update public.characters c set
    name        = coalesce(p_updates ->> 'name', c.name),
    class_id    = coalesce((p_updates ->> 'class_id')::uuid, c.class_id),
    level       = coalesce((p_updates ->> 'level')::int, c.level),
    xp          = coalesce((p_updates ->> 'xp')::int, c.xp),
    current_hp  = coalesce((p_updates ->> 'current_hp')::int, c.current_hp),
    max_hp      = coalesce((p_updates ->> 'max_hp')::int, c.max_hp),
    stats       = coalesce(p_updates -> 'stats', c.stats),
    notes       = coalesce(p_updates ->> 'notes', c.notes),
    is_dead     = coalesce((p_updates ->> 'is_dead')::boolean, c.is_dead),
    kind        = coalesce(p_updates ->> 'kind', c.kind),
    owner_id    = coalesce((p_updates ->> 'owner_id')::uuid, c.owner_id)
  where c.id = p_id;
end;
$$;
