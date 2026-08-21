-- Hardening pass: column-level grants and validated RPCs.
--
-- Both players and the DM connect as `authenticated`, so the Data API must
-- not allow anyone to change DM-owned fields (level, xp, kind, owner) or to
-- write skill ranks directly. Those flows go through security definer RPCs
-- that re-check permissions and game rules server-side.

-- Restrict which character columns the Data API can update. DM-only fields
-- (level, xp, kind, owner_id) change via dm_update_character below.
revoke update on public.characters from authenticated;
grant update (name, class_id, current_hp, max_hp, stats, notes, is_dead)
  on public.characters to authenticated;

-- Skill ranks are written only through validated RPCs.
revoke insert, update, delete on public.character_skills from authenticated;

-- ============================================================
-- Skill point spending / refunding (validated, atomic)
-- ============================================================

create or replace function public.spend_skill_points(
  p_character uuid,
  p_skill uuid,
  p_ranks integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_char public.characters%rowtype;
  v_skill public.skills%rowtype;
  v_current integer;
  v_spent numeric;
  v_budget numeric;
begin
  if not private.can_edit_character(p_character) then
    raise exception 'Not allowed to edit this character';
  end if;
  if p_ranks is null or p_ranks < 1 then
    raise exception 'Ranks must be at least 1';
  end if;

  select * into v_char from public.characters where id = p_character;
  if v_char.class_id is null then
    raise exception 'Character has no class assigned';
  end if;

  select * into v_skill from public.skills where id = p_skill;
  if v_skill.class_id <> v_char.class_id then
    raise exception 'Skill belongs to a different class';
  end if;

  if exists (
    select 1
    from unnest(v_skill.prereq_skill_ids) as pre(id)
    where not exists (
      select 1 from public.character_skills cs
      where cs.character_id = p_character and cs.skill_id = pre.id
    )
  ) then
    raise exception 'Prerequisites not met';
  end if;

  select coalesce(rank, 0) into v_current
  from public.character_skills
  where character_id = p_character and skill_id = p_skill;

  if v_current + p_ranks > v_skill.max_rank then
    raise exception 'Exceeds maximum rank for this skill';
  end if;

  select coalesce(sum(cs.rank * s.cost_per_rank), 0) into v_spent
  from public.character_skills cs
  join public.skills s on s.id = cs.skill_id
  where cs.character_id = p_character;

  select level * points_per_level into v_budget
  from public.classes where id = v_char.class_id;

  if v_spent + (p_ranks * v_skill.cost_per_rank) > v_budget then
    raise exception 'Not enough skill points';
  end if;

  insert into public.character_skills (character_id, skill_id, rank)
  values (p_character, p_skill, v_current + p_ranks)
  on conflict (character_id, skill_id)
  do update set rank = excluded.rank;
end;
$$;

create or replace function public.refund_skill_points(
  p_character uuid,
  p_skill uuid,
  p_ranks integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current integer;
begin
  if not private.can_edit_character(p_character) then
    raise exception 'Not allowed to edit this character';
  end if;
  if p_ranks is null or p_ranks < 1 then
    raise exception 'Ranks must be at least 1';
  end if;

  select rank into v_current
  from public.character_skills
  where character_id = p_character and skill_id = p_skill;

  if v_current is null then
    raise exception 'Character does not know that skill';
  end if;

  if v_current - p_ranks <= 0 then
    delete from public.character_skills
    where character_id = p_character and skill_id = p_skill;
  else
    update public.character_skills
    set rank = rank - p_ranks
    where character_id = p_character and skill_id = p_skill;
  end if;
end;
$$;

-- ============================================================
-- DM-only character field updates (level, xp, kind, owner, ...)
-- ============================================================

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
    class_id    = coalesce((p_updates -> 'class_id')::uuid, c.class_id),
    level       = coalesce((p_updates ->> 'level')::int, c.level),
    xp          = coalesce((p_updates ->> 'xp')::int, c.xp),
    current_hp  = coalesce((p_updates ->> 'current_hp')::int, c.current_hp),
    max_hp      = coalesce((p_updates ->> 'max_hp')::int, c.max_hp),
    stats       = coalesce(p_updates -> 'stats', c.stats),
    notes       = coalesce(p_updates ->> 'notes', c.notes),
    is_dead     = coalesce((p_updates ->> 'is_dead')::boolean, c.is_dead),
    kind        = coalesce(p_updates ->> 'kind', c.kind),
    owner_id    = coalesce((p_updates -> 'owner_id')::uuid, c.owner_id)
  where c.id = p_id;
end;
$$;

-- ============================================================
-- Grants: reachable by signed-in users only; rules enforced inside
-- ============================================================

revoke all on function public.spend_skill_points(uuid, uuid, integer)
  from public, anon;
grant execute on function public.spend_skill_points(uuid, uuid, integer)
  to authenticated;

revoke all on function public.refund_skill_points(uuid, uuid, integer)
  from public, anon;
grant execute on function public.refund_skill_points(uuid, uuid, integer)
  to authenticated;

revoke all on function public.dm_update_character(uuid, jsonb)
  from public, anon;
grant execute on function public.dm_update_character(uuid, jsonb)
  to authenticated;
