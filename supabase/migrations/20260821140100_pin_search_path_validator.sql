-- Pin search_path on the prereq validator so it can't be hijacked
-- (supabase linter: function_search_path_mutable).

create or replace function private.validate_skill_prereqs()
returns trigger
language plpgsql
set search_path = ''
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
