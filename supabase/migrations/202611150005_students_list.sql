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
    where h.id = p_hostel and t.slug = 'digimessbook'
  ) then
    raise exception 'Hostel not found' using errcode = '22023';
  end if;

  return query
  select
    s.account_number,
    s.room,
    s.full_name,
    coalesce(trim(md.meal_code), '----') = '----'
  from public.students s
  join public.hostels h on h.id = s.hostel_id
  join public.tenants t on t.id = h.tenant_id
  left join public.meal_days md
    on md.student_id = s.id and md.meal_date = p_date
  where s.hostel_id = p_hostel
    and s.tenant_id = h.tenant_id
    and t.slug = 'digimessbook'
  order by s.account_number;
end;
$$;

revoke all on function public.students_list_rows(uuid, date) from public;
grant execute on function public.students_list_rows(uuid, date) to anon, authenticated;

notify pgrst, 'reload schema';
