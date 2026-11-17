create table public.meal_month_deletions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  month_start date not null check (month_start = date_trunc('month', month_start)::date),
  deleted_at timestamptz not null default now(),
  primary key (tenant_id, month_start)
);
alter table public.meal_month_deletions enable row level security;
revoke all on public.meal_month_deletions from public, anon, authenticated;
grant select, insert, update, delete on public.meal_month_deletions to service_role;

create or replace function public.admin_delete_month_meal_data(p_tenant_id uuid, p_month_start date)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  affected_students integer;
  month_end date;
begin
  if p_month_start is null or p_month_start <> date_trunc('month', p_month_start)::date then
    raise exception 'Month start must be the first day of a month.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'Tenant not found' using errcode = '22023';
  end if;

  month_end := (p_month_start + interval '1 month' - interval '1 day')::date;
  select count(*)::integer into affected_students
  from public.students s
  where s.tenant_id = p_tenant_id;

  insert into public.meal_month_deletions (tenant_id, month_start, deleted_at)
  values (p_tenant_id, p_month_start, now())
  on conflict (tenant_id, month_start) do update set deleted_at = excluded.deleted_at;

  delete from public.meal_days md
  using public.students s
  where md.student_id = s.id
    and s.tenant_id = p_tenant_id
    and md.meal_date between p_month_start and month_end;

  return affected_students;
end;
$$;

revoke all on function public.admin_delete_month_meal_data(uuid, date) from public, anon, authenticated;
grant execute on function public.admin_delete_month_meal_data(uuid, date) to service_role;

create or replace function public.initialize_student_meal_days()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  account_created_on date;
  meal_start date;
  meal_end date;
  retention_cutoff date;
begin
  select (u.created_at at time zone 'Asia/Kolkata')::date
    into account_created_on
  from auth.users u
  where u.id = new.user_id;

  if account_created_on is null then
    raise exception 'Student account creation date was not found.';
  end if;

  retention_cutoff := (
    date_trunc('month', timezone('Asia/Kolkata', now())) - interval '1 month'
  )::date;
  meal_start := greatest(account_created_on, retention_cutoff);
  meal_end := (
    date_trunc('month', timezone('Asia/Kolkata', now())) + interval '2 months' - interval '1 day'
  )::date;

  insert into public.meal_days (student_id, meal_date, meal_code)
  select new.id, generated_date::date, 'BLTD'
  from generate_series(meal_start::timestamp, meal_end::timestamp, interval '1 day') as generated_dates(generated_date)
  where not exists (
    select 1
    from public.meal_month_deletions d
    where d.tenant_id = new.tenant_id
      and d.month_start = date_trunc('month', generated_date)::date
  )
  on conflict (student_id, meal_date) do nothing;

  return new;
end;
$$;

revoke all on function public.initialize_student_meal_days() from public;

create trigger initialize_student_meal_days_after_insert
  after insert on public.students
  for each row execute function public.initialize_student_meal_days();

-- Materialize defaults for the supported previous, current, and next month
-- for students that already existed before this migration.
with bounds as (
  select
    (date_trunc('month', timezone('Asia/Kolkata', now())) - interval '1 month')::date as retention_cutoff,
    (date_trunc('month', timezone('Asia/Kolkata', now())) + interval '2 months' - interval '1 day')::date as meal_end
)
insert into public.meal_days (student_id, meal_date, meal_code)
select s.id, generated_date::date, 'BLTD'
from public.students s
join auth.users u on u.id = s.user_id
cross join bounds b
cross join lateral generate_series(
  greatest((u.created_at at time zone 'Asia/Kolkata')::date, b.retention_cutoff)::timestamp,
  b.meal_end::timestamp,
  interval '1 day'
) as generated_dates(generated_date)
where not exists (
  select 1
  from public.meal_month_deletions d
  where d.tenant_id = s.tenant_id
    and d.month_start = date_trunc('month', generated_date)::date
)
on conflict (student_id, meal_date) do nothing;

-- Keep future default rows available as the current/next month rolls forward.
create or replace function public.prune_old_month_data()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  retention_cutoff date;
  meal_end date;
begin
  retention_cutoff := (
    date_trunc('month', timezone('Asia/Kolkata', now())) - interval '1 month'
  )::date;
  meal_end := (
    date_trunc('month', timezone('Asia/Kolkata', now())) + interval '2 months' - interval '1 day'
  )::date;

  delete from public.meal_days where meal_date < retention_cutoff;
  delete from public.mess_calendar where calendar_date < retention_cutoff;
  delete from public.meal_month_deletions where month_start < retention_cutoff;

  insert into public.meal_days (student_id, meal_date, meal_code)
  select s.id, generated_date::date, 'BLTD'
  from public.students s
  join auth.users u on u.id = s.user_id
  cross join lateral generate_series(
    greatest((u.created_at at time zone 'Asia/Kolkata')::date, retention_cutoff)::timestamp,
    meal_end::timestamp,
    interval '1 day'
  ) as generated_dates(generated_date)
  where not exists (
    select 1
    from public.meal_month_deletions d
    where d.tenant_id = s.tenant_id
      and d.month_start = date_trunc('month', generated_date)::date
  )
  on conflict (student_id, meal_date) do nothing;
end;
$$;

revoke all on function public.prune_old_month_data() from public, anon, authenticated;

create or replace function public.students_list_rows(p_hostel uuid, p_date date)
returns table (
  account_number text,
  room text,
  full_name text,
  is_mess_cut boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_hostel is null or p_date is null then
    raise exception 'Hostel and date are required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.hostels h
    join public.tenants t on t.id = h.tenant_id
    where h.id = p_hostel and t.slug = 'mh-nssce-demo'
  ) then
    raise exception 'Hostel not found' using errcode = '22023';
  end if;

  return query
  select
    s.account_number,
    s.room,
    s.full_name,
    case when md.student_id is null then null else trim(md.meal_code) = '----' end
  from public.students s
  join public.hostels h on h.id = s.hostel_id
  join public.tenants t on t.id = h.tenant_id
  left join public.meal_days md
    on md.student_id = s.id and md.meal_date = p_date
  where s.hostel_id = p_hostel
    and s.tenant_id = h.tenant_id
    and t.slug = 'mh-nssce-demo'
  order by s.account_number;
end;
$$;

revoke all on function public.students_list_rows(uuid, date) from public;
grant execute on function public.students_list_rows(uuid, date) to anon, authenticated;

notify pgrst, 'reload schema';
