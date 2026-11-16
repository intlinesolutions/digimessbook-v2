alter table public.students
  add column if not exists admission_number text,
  add column if not exists email text,
  add column if not exists mobile_number text,
  add column if not exists guardian_name text,
  add column if not exists guardian_relation text,
  add column if not exists guardian_mobile_number text,
  add column if not exists blood_group text;

insert into public.hostels (tenant_id, name)
select id, 'MH 3'
from public.tenants
where slug = 'digimessbook'
on conflict (tenant_id, name) do nothing;
