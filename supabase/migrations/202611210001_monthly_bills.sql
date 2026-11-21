create table public.monthly_bills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hostel_id uuid not null references public.hostels(id) on delete cascade,
  bill_month date not null check (extract(day from bill_month) = 1),
  status text not null default 'unpublished' check (status in ('published', 'unpublished')),
  fixed_items jsonb not null default '[]'::jsonb check (jsonb_typeof(fixed_items) = 'array'),
  daily_rate numeric(12,2) not null default 0 check (daily_rate >= 0),
  published_fixed_items jsonb not null default '[]'::jsonb check (jsonb_typeof(published_fixed_items) = 'array'),
  published_daily_rate numeric(12,2) not null default 0 check (published_daily_rate >= 0),
  created_at timestamptz not null default now(),
  last_edited_at timestamptz,
  last_published_at timestamptz,
  unique (hostel_id, bill_month)
);

create index monthly_bills_tenant_month_idx on public.monthly_bills (tenant_id, bill_month desc);
create index monthly_bills_hostel_month_idx on public.monthly_bills (hostel_id, bill_month desc);

create or replace function public.set_monthly_bill_edit_time()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.fixed_items is distinct from old.fixed_items
    or new.daily_rate is distinct from old.daily_rate then
    new.last_edited_at := now();
  end if;
  return new;
end;
$$;

create trigger monthly_bills_edit_time
before update on public.monthly_bills
for each row execute function public.set_monthly_bill_edit_time();

alter table public.monthly_bills enable row level security;
create policy "students read published bills for their hostel" on public.monthly_bills
  for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.students
      where students.user_id = auth.uid()
        and students.hostel_id = monthly_bills.hostel_id
        and students.tenant_id = monthly_bills.tenant_id
    )
  );
grant select on public.monthly_bills to authenticated;

create table public.student_monthly_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hostel_id uuid not null references public.hostels(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  bill_month date not null check (extract(day from bill_month) = 1),
  extras_total numeric(12,2) not null default 0 check (extras_total >= 0),
  fine_days integer not null default 0 check (fine_days >= 0),
  fine_total numeric(12,2) not null default 0 check (fine_total >= 0),
  updated_at timestamptz not null default now(),
  unique (student_id, bill_month)
);

create index student_monthly_charges_student_month_idx on public.student_monthly_charges (student_id, bill_month);
alter table public.student_monthly_charges enable row level security;
create policy "students read their own monthly bill charges" on public.student_monthly_charges
  for select to authenticated
  using (
    exists (
      select 1 from public.students
      where students.id = student_monthly_charges.student_id
        and students.user_id = auth.uid()
        and students.tenant_id = student_monthly_charges.tenant_id
    )
  );
grant select on public.student_monthly_charges to authenticated;
grant select, insert, update, delete on public.monthly_bills, public.student_monthly_charges to service_role;

notify pgrst, 'reload schema';
