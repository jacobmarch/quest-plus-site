-- Read the class from the incoming row. The trigger runs BEFORE INSERT, so
-- looking the new skill up by id found nothing, left the class null, and
-- rejected every prerequisite on a brand-new skill ("Prerequisite skill not
-- found in this class") - e.g. adding a child skill from the tree view.

create or replace function private.validate_skill_prereqs()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_prereq record;
begin
  for v_prereq in
    select unnest(new.prereq_skill_ids) as id
  loop
    if v_prereq.id = new.id then
      raise exception 'A skill cannot be its own prerequisite';
    end if;
    if not exists (
      select 1 from public.skills s
      where s.id = v_prereq.id and s.class_id = new.class_id
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
