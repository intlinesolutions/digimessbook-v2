create or replace function public.prune_old_month_data()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  retention_cutoff date;
  boundary_date date;
  meal_end date;
begin
  retention_cutoff := (
    date_trunc('month', timezone('Asia/Kolkata', now())) - interval '1 month'
  )::date;
  boundary_date := retention_cutoff - 1;
  meal_end := (
    date_trunc('month', timezone('Asia/Kolkata', now())) + interval '2 months' - interval '1 day'
  )::date;

  -- Keep the previous month's last day for adjacent-cut calculations.
  delete from public.meal_days where meal_date < boundary_date;
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
