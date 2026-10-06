-- Draft abilities: rough ideas the DM jots into a class's tray before placing
-- them on the tree. Drafts are DM-only, have no prerequisites, and nothing
-- can depend on or unlock them until they are placed.

alter table public.skills
  add column is_draft boolean not null default false;

alter table public.skills
  add constraint skills_draft_unlinked
    check (not is_draft or cardinality(prereq_skill_ids) = 0),
  add constraint skills_draft_not_default
    check (not (is_draft and is_default));

-- Players never see drafts; the DM sees everything.
drop policy if exists "skills_select_authenticated" on public.skills;
create policy "skills_select_authenticated"
  on public.skills for select
  using (
    (select auth.uid()) is not null
    and (not is_draft or private.is_dm())
  );

-- Placed abilities may not list a draft as a prerequisite, and an ability
-- that others depend on cannot be moved back to drafts.
create or replace function private.validate_skill_draft_links()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.skills s
    where s.id = any(new.prereq_skill_ids) and s.is_draft
  ) then
    raise exception 'Place the draft ability on the tree before linking to it';
  end if;

  if new.is_draft and tg_op = 'UPDATE' and exists (
    select 1 from public.skills s
    where new.id = any(s.prereq_skill_ids)
  ) then
    raise exception 'Other abilities lead from this one';
  end if;

  return new;
end;
$$;

drop trigger if exists skills_validate_draft_links on public.skills;
create trigger skills_validate_draft_links
  before insert or update of prereq_skill_ids, is_draft on public.skills
  for each row execute procedure private.validate_skill_draft_links();

-- Unlock RPCs run as security definer, so guard the table they write to.
create or replace function private.reject_draft_character_skill()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.skills s
    where s.id = new.skill_id and s.is_draft
  ) then
    raise exception 'Draft abilities cannot be unlocked';
  end if;
  return new;
end;
$$;

drop trigger if exists character_skills_reject_draft on public.character_skills;
create trigger character_skills_reject_draft
  before insert or update of skill_id on public.character_skills
  for each row execute procedure private.reject_draft_character_skill();
