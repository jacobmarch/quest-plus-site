-- Abilities are binary: unlocked or locked. No ranks, no per-rank costs —
-- each ability has a one-time point cost.

alter table public.skills
  drop column max_rank,
  drop column cost_per_rank,
  add column cost numeric(6,1) not null default 1 check (cost >= 0);

alter table public.character_skills drop column rank;

-- ============================================================
-- Unlock / lock (validated, atomic)
-- ============================================================

create or replace function public.unlock_skill(
  p_character uuid,
  p_skill uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_char public.characters%rowtype;
  v_skill public.skills%rowtype;
  v_spent numeric;
  v_budget numeric;
begin
  if not private.can_edit_character(p_character) then
    raise exception 'Not allowed to edit this character';
  end if;

  select * into v_char from public.characters where id = p_character;
  if v_char.class_id is null then
    raise exception 'Character has no class assigned';
  end if;

  select * into v_skill from public.skills where id = p_skill;
  if v_skill.class_id <> v_char.class_id then
    raise exception 'Ability belongs to a different class';
  end if;

  if exists (
    select 1 from public.character_skills
    where character_id = p_character and skill_id = p_skill
  ) then
    raise exception 'Already unlocked';
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

  select coalesce(sum(s.cost), 0) into v_spent
  from public.character_skills cs
  join public.skills s on s.id = cs.skill_id
  where cs.character_id = p_character;

  select v_char.level * c.points_per_level into v_budget
  from public.classes c where c.id = v_char.class_id;

  if v_spent + v_skill.cost > v_budget then
    raise exception 'Not enough skill points';
  end if;

  insert into public.character_skills (character_id, skill_id)
  values (p_character, p_skill);
end;
$$;

create or replace function public.lock_skill(
  p_character uuid,
  p_skill uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_edit_character(p_character) then
    raise exception 'Not allowed to edit this character';
  end if;

  if not exists (
    select 1 from public.character_skills
    where character_id = p_character and skill_id = p_skill
  ) then
    raise exception 'Character does not know that ability';
  end if;

  -- Cannot lock an ability that something already unlocked depends on.
  if exists (
    select 1
    from public.character_skills cs
    join public.skills s on s.id = cs.skill_id
    where cs.character_id = p_character
      and p_skill = any(s.prereq_skill_ids)
  ) then
    raise exception 'Lock the abilities that require this one first';
  end if;

  delete from public.character_skills
  where character_id = p_character and skill_id = p_skill;
end;
$$;

-- ============================================================
-- Replace the rank-based RPCs
-- ============================================================

revoke all on function public.spend_skill_points(uuid, uuid, integer)
  from authenticated;
drop function public.spend_skill_points(uuid, uuid, integer);

revoke all on function public.refund_skill_points(uuid, uuid, integer)
  from authenticated;
drop function public.refund_skill_points(uuid, uuid, integer);

revoke all on function public.unlock_skill(uuid, uuid) from public, anon;
grant execute on function public.unlock_skill(uuid, uuid) to authenticated;

revoke all on function public.lock_skill(uuid, uuid) from public, anon;
grant execute on function public.lock_skill(uuid, uuid) to authenticated;
