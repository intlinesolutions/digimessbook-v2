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
volatile
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_date is null then
    raise exception 'Date is required' using errcode = '22023';
  end if;

  if p_hostel is not null and not exists (
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
    join public.hostels h on h.id = s.hostel_id
    join public.tenants t on t.id = h.tenant_id
    left join public.meal_days md
      on md.student_id = s.id and md.meal_date = p_date
    where t.slug = 'digimessbook'
      and (
        (p_hostel is not null and s.hostel_id = p_hostel)
        or (p_hostel is null and h.name in ('MH 1', 'MH 2'))
      )
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

grant execute on function public.mess_count_summary(uuid, date) to anon, authenticated;
