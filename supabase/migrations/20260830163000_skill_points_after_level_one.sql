-- Skill points start after level 1: budget is (level - 1) * points_per_level.
-- Starting skills are free and must not consume that budget.

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

  if coalesce(v_skill.is_default, false) then
    raise exception 'Starting skills are granted automatically';
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
  where cs.character_id = p_character
    and not s.is_default;

  select greatest(v_char.level - 1, 0) * c.points_per_level into v_budget
  from public.classes c where c.id = v_char.class_id;

  if v_spent + v_skill.cost > v_budget then
    raise exception 'Not enough skill points';
  end if;

  insert into public.character_skills (character_id, skill_id)
  values (p_character, p_skill);
end;
$$;
