insert into public.tenants (id, name, slug)
values ('10000000-0000-4000-8000-000000000001','MH NSSCE Demo','mh-nssce-demo')
on conflict (slug) do nothing;
insert into public.hostels (id, tenant_id, name)
values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Mens Hostel')
on conflict (tenant_id,name) do nothing;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  is_sso_user, is_anonymous)
values
 ('30000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','24b000@demo.digimessbook.local',extensions.crypt('Mess@2026!',extensions.gen_salt('bf')),now(),'','','','','','','','','{}','{}',now(),now(),false,false),
 ('30000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','24b001@demo.digimessbook.local',extensions.crypt('Mess@2026!',extensions.gen_salt('bf')),now(),'','','','','','','','','{}','{}',now(),now(),false,false),
 ('30000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','24b002@demo.digimessbook.local',extensions.crypt('Mess@2026!',extensions.gen_salt('bf')),now(),'','','','','','','','','{}','{}',now(),now(),false,false)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
select id, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', email, now(), now()
from auth.users where email in ('24b000@demo.digimessbook.local','24b001@demo.digimessbook.local','24b002@demo.digimessbook.local')
on conflict (provider_id, provider) do nothing;

insert into public.students (user_id, tenant_id, hostel_id, account_number, full_name, room, academic_year, food_preference)
values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','24B000','Demo Student One','101','2024','Chicken, Egg'),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','24B001','Demo Student Two','102','2024','Veg only'),
 ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','24B002','Demo Student Three','103','2025','Fish')
on conflict (user_id) do nothing;

-- Create a full month so adjacent cut days are evaluated consistently.
insert into public.meal_days (student_id, meal_date, meal_code)
select s.id, d::date,
  case
    when s.account_number='24B000' and extract(day from d)::int in (4,5,12,20,21) then '----'
    when s.account_number='24B001' and extract(day from d)::int in (7,8,9,18) then '----'
    when s.account_number='24B002' and extract(day from d)::int in (1,2,3,15,16) then '----'
    else 'BLTD'
  end
from public.students s cross join generate_series(date '2026-11-01', date '2026-11-30', interval '1 day') d
where s.account_number in ('24B000','24B001','24B002')
on conflict (student_id, meal_date) do nothing;
