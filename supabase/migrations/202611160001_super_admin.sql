alter table public.students add column if not exists department text;

create table if not exists public.mess_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  lock_days_before integer not null default 1 check (lock_days_before between 0 and 7),
  lock_time time not null default time '19:00',
  timezone text not null default 'Asia/Kolkata',
  updated_at timestamptz not null default now()
);

create table if not exists public.mess_calendar (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  calendar_date date not null,
  status text not null check (status in ('open', 'closed')),
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (tenant_id, calendar_date)
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'admin' check (actor_type in ('admin', 'student')),
  student_id uuid references public.students(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_tenant_created_idx
  on public.admin_audit_log (tenant_id, created_at desc);
create index if not exists admin_audit_log_student_created_idx
  on public.admin_audit_log (student_id, created_at desc);

create table if not exists public.student_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists student_notifications_student_created_idx
  on public.student_notifications (student_id, created_at desc);

alter table public.mess_settings enable row level security;
alter table public.mess_calendar enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.student_notifications enable row level security;

revoke all on public.mess_settings, public.mess_calendar, public.admin_audit_log,
  public.student_notifications from anon, authenticated;
grant all on public.mess_settings, public.mess_calendar, public.admin_audit_log,
  public.student_notifications to service_role;

grant select on public.student_notifications to authenticated;
grant update (read_at) on public.student_notifications to authenticated;
grant select on public.mess_settings, public.mess_calendar to authenticated;
create policy "students read own mess settings" on public.mess_settings
  for select to authenticated
  using (tenant_id in (select tenant_id from public.students where user_id = auth.uid()));
create policy "students read own mess calendar" on public.mess_calendar
  for select to authenticated
  using (tenant_id in (select tenant_id from public.students where user_id = auth.uid()));
create policy "students read own notifications" on public.student_notifications
  for select to authenticated
  using (student_id in (select id from public.students where user_id = auth.uid()));
create policy "students mark own notifications read" on public.student_notifications
  for update to authenticated
  using (student_id in (select id from public.students where user_id = auth.uid()))
  with check (student_id in (select id from public.students where user_id = auth.uid()));

create or replace function public.student_meal_editable(p_student uuid, p_meal_date date)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.students s
    left join public.mess_settings ms on ms.tenant_id = s.tenant_id
    left join public.mess_calendar mc on mc.tenant_id = s.tenant_id and mc.calendar_date = p_meal_date
    where s.id = p_student
      and s.user_id = auth.uid()
      and coalesce(mc.status, 'open') = 'open'
      and (((p_meal_date - coalesce(ms.lock_days_before, 1))::timestamp
        + coalesce(ms.lock_time, time '19:00')) at time zone coalesce(ms.timezone, 'Asia/Kolkata')) > now()
  );
$$;
revoke all on function public.student_meal_editable(uuid, date) from public;
grant execute on function public.student_meal_editable(uuid, date) to authenticated;

drop policy if exists "students update own editable meal days" on public.meal_days;
drop policy if exists "students modify own editable meal days" on public.meal_days;
create policy "students update own editable meal days" on public.meal_days for insert to authenticated
  with check (public.student_meal_editable(student_id, meal_date));
create policy "students modify own editable meal days" on public.meal_days for update to authenticated
  using (public.student_meal_editable(student_id, meal_date))
  with check (public.student_meal_editable(student_id, meal_date));

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
    if tg_op = 'UPDATE' then
      if old.meal_code = new.meal_code then
        return new;
      end if;
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
revoke all on function public.audit_student_activity() from public;
create trigger audit_student_meal_changes
  after insert or update on public.meal_days
  for each row execute function public.audit_student_activity();
create trigger audit_student_preference_changes
  after update on public.students
  for each row execute function public.audit_student_activity();

notify pgrst, 'reload schema';
