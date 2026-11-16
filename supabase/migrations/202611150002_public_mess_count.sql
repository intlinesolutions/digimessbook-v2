create or replace function public.mess_count_hostels()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select h.id, h.name
  from public.hostels h
  join public.tenants t on t.id = h.tenant_id
  where t.slug = 'digimessbook'
  order by h.name;
$$;

create or replace function public.mess_count_summary(p_hostel uuid, p_date date)
returns table (
  meal text,
  meal_count bigint,
  veg bigint,
  chicken bigint,
  fish bigint,
  egg bigint,
  beef bigint
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
  with meals(label, meal_index, code) as (
    values
      ('Breakfast'::text, 1, 'B'::text),
      ('Lunch'::text, 2, 'L'::text),
      ('Tea'::text, 3, 'T'::text),
      ('Dinner'::text, 4, 'D'::text)
  ), roster as (
    select
      coalesce(trim(md.meal_code), '----') as meal_code,
      array(
        select lower(trim(preference.value))
        from unnest(string_to_array(coalesce(s.food_preference, ''), ',')) as preference(value)
      ) as preferences
    from public.students s
    left join public.meal_days md
      on md.student_id = s.id and md.meal_date = p_date
    where s.hostel_id = p_hostel
  )
  select
    m.label,
    count(*) filter (
      where substring(r.meal_code from m.meal_index for 1) = m.code
    ),
    count(*) filter (
      where substring(r.meal_code from m.meal_index for 1) = m.code
        and 'veg only' = any(r.preferences)
    ),
    count(*) filter (
      where substring(r.meal_code from m.meal_index for 1) = m.code
        and 'chicken' = any(r.preferences)
    ),
    count(*) filter (
      where substring(r.meal_code from m.meal_index for 1) = m.code
        and 'fish' = any(r.preferences)
    ),
    count(*) filter (
      where substring(r.meal_code from m.meal_index for 1) = m.code
        and 'egg' = any(r.preferences)
    ),
    count(*) filter (
      where substring(r.meal_code from m.meal_index for 1) = m.code
        and 'beef' = any(r.preferences)
    )
  from meals m
  left join roster r on true
  group by m.label, m.meal_index
  order by m.meal_index;
end;
$$;

revoke all on function public.mess_count_hostels() from public;
revoke all on function public.mess_count_summary(uuid, date) from public;
grant execute on function public.mess_count_hostels() to anon, authenticated;
grant execute on function public.mess_count_summary(uuid, date) to anon, authenticated;
