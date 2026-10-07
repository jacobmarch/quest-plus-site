-- Hidden abilities: the DM can mark an ability hidden. It and everything that
-- leads from it (its branch) stay off a character's tree until the DM reveals
-- it to that character. Learned abilities always stay visible to their owner.

alter table public.skills
  add column is_hidden boolean not null default false;

alter table public.skills
  add constraint skills_hidden_not_default
    check (not (is_hidden and is_default));

create table public.skill_reveals (
  character_id uuid not null references public.characters(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (character_id, skill_id)
);
create index skill_reveals_skill_id_idx on public.skill_reveals (skill_id);

alter table public.skill_reveals enable row level security;

create policy "skill_reveals_select_visible"
  on public.skill_reveals for select
  using (private.can_view_character(character_id));
create policy "skill_reveals_insert_dm"
  on public.skill_reveals for insert
  with check (private.is_dm());
create policy "skill_reveals_delete_dm"
  on public.skill_reveals for delete
  using (private.is_dm());

revoke update on public.skill_reveals from authenticated, anon;
grant select, insert, delete on public.skill_reveals to authenticated;

-- An ability is visible to a character when neither it nor any ability above
-- it is a draft or still hidden from that character. A null character asks
-- whether the ability is visible to everyone.
create or replace function private.skill_visible_to_character(
  p_skill uuid,
  p_character uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain(id) as (
    select p_skill
    union
    select unnest(s.prereq_skill_ids)
    from public.skills s
    join chain c on s.id = c.id
  )
  select exists (select 1 from public.skills where id = p_skill)
    and not exists (
      select 1
      from chain c
      join public.skills s on s.id = c.id
      where s.is_draft
        or (
          s.is_hidden
          and not exists (
            select 1 from public.skill_reveals r
            where r.character_id = p_character and r.skill_id = s.id
          )
          and not exists (
            select 1 from public.character_skills cs
            where cs.character_id = p_character and cs.skill_id = s.id
          )
        )
    );
$$;

create or replace function private.skill_visible_to_viewer(p_skill uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_dm()
    or private.skill_visible_to_character(p_skill, null)
    or exists (
      select 1 from public.characters c
      where c.kind = 'pc'
        and c.owner_id = (select auth.uid())
        and private.skill_visible_to_character(p_skill, c.id)
    );
$$;

-- Players only read abilities one of their characters can see.
drop policy if exists "skills_select_authenticated" on public.skills;
create policy "skills_select_authenticated"
  on public.skills for select
  using (
    (select auth.uid()) is not null
    and private.skill_visible_to_viewer(id)
  );

-- Reveal an ability to one character, along with any hidden abilities above
-- it, so the whole path to it opens up.
create or replace function public.reveal_skill(
  p_character uuid,
  p_skill uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_dm() then
    raise exception 'Only the DM can reveal abilities';
  end if;
  if not exists (select 1 from public.characters where id = p_character) then
    raise exception 'Character not found';
  end if;
  if not exists (select 1 from public.skills where id = p_skill) then
    raise exception 'Ability not found';
  end if;

  insert into public.skill_reveals (character_id, skill_id)
  with recursive chain(id) as (
    select p_skill
    union
    select unnest(s.prereq_skill_ids)
    from public.skills s
    join chain c on s.id = c.id
  )
  select p_character, s.id
  from chain c
  join public.skills s on s.id = c.id
  where s.is_hidden
  on conflict (character_id, skill_id) do nothing;
end;
$$;

revoke all on function public.reveal_skill(uuid, uuid) from public, anon;
grant execute on function public.reveal_skill(uuid, uuid) to authenticated;

-- Starting skills under a hidden branch wait until the branch is revealed.
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
    and private.skill_visible_to_character(id, p_character)
  on conflict (character_id, skill_id) do nothing;
end;
$$;

-- Players cannot unlock an ability that is still hidden from them.
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
  if not found
    or (not private.is_dm()
        and not private.skill_visible_to_character(p_skill, p_character)) then
    raise exception 'Ability not found';
  end if;
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
