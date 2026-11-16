alter table public.admin_audit_log
  add column if not exists actor_type text not null default 'admin';

update public.admin_audit_log
set actor_type = case when details->>'source' = 'student' then 'student' else 'admin' end;

alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_actor_type_check;
alter table public.admin_audit_log
  add constraint admin_audit_log_actor_type_check check (actor_type in ('admin', 'student'));

create index if not exists admin_audit_log_actor_type_created_idx
  on public.admin_audit_log (tenant_id, actor_type, created_at desc);

create unique index if not exists admin_audit_log_login_session_unique
  on public.admin_audit_log (actor_id, tenant_id, (details->>'login_at'))
  where action = 'auth.login';

create or replace function public.audit_student_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  student_row record;
  event_action text;
  event_details jsonb;
begin
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  if tg_table_name = 'meal_days' then
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

notify pgrst, 'reload schema';
