update public.hostels
set name = 'MH 1'
where id = '20000000-0000-4000-8000-000000000001';

insert into public.hostels (id, tenant_id, name)
values ('20000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000001', 'MH 2')
on conflict (id) do update set name = excluded.name;

with demo_users(id, email) as (values
 ('30000000-0000-4000-8000-000000000004'::uuid, '24b003@demo.digimessbook.local'),
 ('30000000-0000-4000-8000-000000000005'::uuid, '24b004@demo.digimessbook.local')
)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token, email_change_token_new,
  email_change, email_change_token_current, phone_change, phone_change_token,
  reauthentication_token, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  is_sso_user, is_anonymous)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
  extensions.crypt('Mess@2026!', extensions.gen_salt('bf')), now(), '', '', '', '', '', '', '', '',
  '{}'::jsonb, '{}'::jsonb, now(), now(), false, false
from demo_users
on conflict (id) do nothing;

insert into auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
select id, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', email, now(), now()
from auth.users
where email in ('24b003@demo.digimessbook.local', '24b004@demo.digimessbook.local')
on conflict (provider_id, provider) do nothing;

insert into public.students (user_id, tenant_id, hostel_id, account_number, full_name, room, academic_year, food_preference)
values
 ('30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','24B003','Demo Student Four','201','2025','Egg'),
 ('30000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','24B004','Demo Student Five','202','2026','Veg only')
on conflict (user_id) do nothing;

insert into public.meal_days (student_id, meal_date, meal_code)
select s.id, d::date,
  case
    when s.account_number='24B003' and extract(day from d)::int in (6,7,19) then '----'
    when s.account_number='24B004' and extract(day from d)::int in (10,11,22,23) then '----'
    else 'BLTD'
  end
from public.students s
cross join generate_series(date '2026-11-01', date '2026-11-30', interval '1 day') d
where s.account_number in ('24B003','24B004')
on conflict (student_id, meal_date) do nothing;
