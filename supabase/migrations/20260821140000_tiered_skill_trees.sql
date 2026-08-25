-- Skill trees become tier-based: layout coordinates are gone, tiers are
-- derived from prerequisite links, and the database guarantees the links
-- form a clean acyclic graph.

alter table public.skills
  drop column if exists x,
  drop column if exists y;

-- Prereqs must exist in the same class and must not create a cycle.
create or replace function private.validate_skill_prereqs()
returns trigger
language plpgsql
as $$
declare
  v_class uuid;
  v_prereq record;
begin
  select class_id into v_class from public.skills where id = new.id;

  for v_prereq in
    select unnest(new.prereq_skill_ids) as id
  loop
    if v_prereq.id = new.id then
      raise exception 'A skill cannot be its own prerequisite';
    end if;
    if not exists (
      select 1 from public.skills s
      where s.id = v_prereq.id and s.class_id = v_class
    ) then
      raise exception 'Prerequisite skill not found in this class';
    end if;

    -- Follow the chain upward; revisiting new.id means a cycle.
    if exists (
      with recursive chain as (
        select p.prereq_skill_ids as ids
        from public.skills p where p.id = v_prereq.id
        union all
        select p.prereq_skill_ids
        from public.skills p
        join chain c on p.id = any(c.ids)
      )
      select 1 from chain, unnest(ids) as u(id)
      where u.id = new.id
    ) then
      raise exception 'Prerequisite link would create a cycle';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists skills_validate_prereqs on public.skills;
create trigger skills_validate_prereqs
  before insert or update of prereq_skill_ids on public.skills
  for each row execute procedure private.validate_skill_prereqs();
