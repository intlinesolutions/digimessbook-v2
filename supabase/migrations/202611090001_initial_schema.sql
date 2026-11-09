create extension if not exists pgcrypto with schema extensions;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);
create table public.hostels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  unique (tenant_id, name)
);
create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hostel_id uuid not null references public.hostels(id),
  account_number text not null,
  full_name text not null,
  room text,
  academic_year text,
  food_preference text not null default '',
  role text not null default 'student' check (role in ('student','admin')),
  unique (tenant_id, account_number)
);
create table public.meal_days (
  student_id uuid not null references public.students(id) on delete cascade,
  meal_date date not null,
  meal_code char(4) not null default '----' check (meal_code ~ '^(B|-)(L|-)(T|-)(D|-)$|^----$'),
  updated_at timestamptz not null default now(),
  primary key (student_id, meal_date)
);
alter table public.tenants enable row level security;
alter table public.hostels enable row level security;
alter table public.students enable row level security;
alter table public.meal_days enable row level security;

create policy "authenticated users read own tenant" on public.tenants for select to authenticated
 using (id in (select tenant_id from public.students where user_id = auth.uid()));
create policy "users read hostels in own tenant" on public.hostels for select to authenticated
 using (tenant_id in (select tenant_id from public.students where user_id = auth.uid()));
create policy "students read own profile" on public.students for select to authenticated using (user_id = auth.uid());
create policy "students update own food preference" on public.students for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "students read own meal days" on public.meal_days for select to authenticated
 using (student_id in (select id from public.students where user_id = auth.uid()));
create policy "students update own editable meal days" on public.meal_days for insert to authenticated
 with check (student_id in (select id from public.students where user_id = auth.uid()) and
   (((meal_date - 1)::timestamp + time '19:00') at time zone 'Asia/Kolkata') > now());
create policy "students modify own editable meal days" on public.meal_days for update to authenticated
 using (student_id in (select id from public.students where user_id = auth.uid()) and
   (((meal_date - 1)::timestamp + time '19:00') at time zone 'Asia/Kolkata') > now())
 with check (student_id in (select id from public.students where user_id = auth.uid()) and
   (((meal_date - 1)::timestamp + time '19:00') at time zone 'Asia/Kolkata') > now());

create or replace function public.billable_days(p_student uuid)
returns integer language sql stable security invoker set search_path = public as $$
 with ordered as (
   select meal_code, (meal_code = '----') as is_cut,
          lag(meal_code = '----') over(order by meal_date) as prev_cut,
          lead(meal_code = '----') over(order by meal_date) as next_cut
   from public.meal_days where student_id = p_student
 )
 select count(*)::integer from ordered
 where not is_cut or (is_cut and coalesce(prev_cut,false)=false and coalesce(next_cut,false)=false);
$$;

grant select on public.tenants, public.hostels, public.students, public.meal_days to authenticated;
grant update (food_preference) on public.students to authenticated;
grant insert, update on public.meal_days to authenticated;
grant execute on function public.billable_days(uuid) to authenticated;
