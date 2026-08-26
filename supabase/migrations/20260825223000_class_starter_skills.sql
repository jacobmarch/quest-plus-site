-- Class starter skills are granted automatically to new characters and do
-- not consume their level-one skill points.

alter table public.skills
  add column is_default boolean not null default false;

create or replace function public.grant_default_skills(
  p_character uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
begin
  if not private.can_edit_character(p_character) then
    raise exception 'Not allowed to edit this character';
  end if;

  select class_id
    into v_class_id
  from public.characters
  where id = p_character;

  if v_class_id is null then
    return;
  end if;

  insert into public.character_skills (character_id, skill_id)
  select p_character, id
  from public.skills
  where class_id = v_class_id
    and is_default
  on conflict (character_id, skill_id) do nothing;
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
declare
  v_is_default boolean;
begin
  if not private.can_edit_character(p_character) then
    raise exception 'Not allowed to edit this character';
  end if;

  select is_default
    into v_is_default
  from public.skills
  where id = p_skill;

  if coalesce(v_is_default, false) then
    raise exception 'Starting skills cannot be locked';
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

revoke all on function public.grant_default_skills(uuid) from public, anon;
grant execute on function public.grant_default_skills(uuid) to authenticated;

revoke all on function public.lock_skill(uuid, uuid) from public, anon;
grant execute on function public.lock_skill(uuid, uuid) to authenticated;
