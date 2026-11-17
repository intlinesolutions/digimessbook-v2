create or replace function public.audit_student_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  student_row record;
  event_action text;
  event_details jsonb;
begin
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  if tg_table_name = 'meal_days' then
    if coalesce(current_setting('app.suppress_meal_audit', true), '') = 'true' then
      return new;
    end if;
    if tg_op = 'UPDATE' and old.meal_code = new.meal_code then
      return new;
    end if;
    select s.id, s.tenant_id, s.user_id, s.account_number, s.full_name
      into student_row from public.students s where s.id = new.student_id;
    if student_row.user_id is distinct from auth.uid() then
      return new;
    end if;
    event_action := case when tg_op = 'INSERT' then 'meal.created' else 'meal.updated' end;
    event_details := jsonb_build_object(
      'account_number', student_row.account_number,
      'student_name', student_row.full_name,
      'date', new.meal_date,
      'meal_code', trim(new.meal_code),
      'status', case when trim(new.meal_code) = '----' then 'cut' else 'present' end,
      'actor_type', 'student',
      'source', 'student'
    );
    insert into public.admin_audit_log (tenant_id, actor_id, actor_type, student_id, action, details)
      values (student_row.tenant_id, auth.uid(), 'student', student_row.id, event_action, event_details);
  elsif tg_table_name = 'students' and tg_op = 'UPDATE' and old.food_preference is distinct from new.food_preference then
    if old.user_id is distinct from auth.uid() then
      return new;
    end if;
    insert into public.admin_audit_log (tenant_id, actor_id, actor_type, student_id, action, details)
      values (new.tenant_id, auth.uid(), 'student', new.id, 'student.food_preference_updated', jsonb_build_object(
        'account_number', new.account_number,
        'student_name', new.full_name,
        'food_preference', new.food_preference,
        'actor_type', 'student',
        'source', 'student'
      ));
  end if;
  return new;
end;
$$;

create or replace function public.update_student_meal_range(
  p_student uuid,
  p_meal_dates date[],
  p_meal_code text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  student_row record;
  first_date date;
  last_date date;
  unique_date_count integer;
  date_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in before updating multiple days.';
  end if;
  if p_meal_dates is null or cardinality(p_meal_dates) < 2 then
    raise exception 'Choose at least two days to update.';
  end if;
  if p_meal_code is null or p_meal_code !~ '^(B|-)(L|-)(T|-)(D|-)$|^----$' then
    raise exception 'Choose a valid meal selection.';
  end if;

  select s.id, s.tenant_id, s.user_id, s.account_number, s.full_name
    into student_row
    from public.students s
    where s.id = p_student and s.user_id = auth.uid();
  if not found then
    raise exception 'Student profile not found.';
  end if;

  select min(d), max(d), count(distinct d)::integer, count(*)::integer
    into first_date, last_date, unique_date_count, date_count
    from unnest(p_meal_dates) as selected_dates(d);
  if date_count <> cardinality(p_meal_dates) or unique_date_count <> date_count then
    raise exception 'The selected dates must be unique and valid.';
  end if;
  if last_date - first_date + 1 <> date_count then
    raise exception 'Choose one continuous date range.';
  end if;
  if exists (
    select 1 from unnest(p_meal_dates) as selected_dates(d)
    where not public.student_meal_editable(p_student, d)
  ) then
    raise exception 'The selected range includes a locked or closed day.';
  end if;

  perform set_config('app.suppress_meal_audit', 'true', true);
  insert into public.meal_days (student_id, meal_date, meal_code)
    select p_student, d, p_meal_code
    from unnest(p_meal_dates) as selected_dates(d)
    on conflict (student_id, meal_date) do update
      set meal_code = excluded.meal_code, updated_at = now();

  insert into public.admin_audit_log (tenant_id, actor_id, actor_type, student_id, action, details)
    values (
      student_row.tenant_id,
      auth.uid(),
      'student',
      student_row.id,
      'meal.range_updated',
      jsonb_build_object(
        'account_number', student_row.account_number,
        'student_name', student_row.full_name,
        'from_date', first_date,
        'to_date', last_date,
        'days', date_count,
        'meal_code', p_meal_code,
        'status', case when p_meal_code = '----' then 'cut' else 'present' end,
        'actor_type', 'student',
        'source', 'student'
      )
    );

  return date_count;
end;
$$;

revoke all on function public.update_student_meal_range(uuid, date[], text) from public, anon;
grant execute on function public.update_student_meal_range(uuid, date[], text) to authenticated;

notify pgrst, 'reload schema';
