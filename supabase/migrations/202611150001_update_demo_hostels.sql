insert into public.tenants (id, name, slug)
values (
  '10000000-0000-4000-8000-000000000001',
  'DigiMessBook',
  'digimessbook'
)
on conflict (id) do update
set name = excluded.name,
    slug = excluded.slug;

insert into public.hostels (id, tenant_id, name)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'MH 1'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'MH 2'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'MH 3')
on conflict (id) do update
set tenant_id = excluded.tenant_id,
    name = excluded.name;
