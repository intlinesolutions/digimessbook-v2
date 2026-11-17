create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.prune_old_month_data()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  retention_cutoff date;
begin
  -- Keep the previous, current, and next month; remove dates before the previous month.
  retention_cutoff := (
    date_trunc('month', timezone('Asia/Kolkata', now())) - interval '1 month'
  )::date;

  delete from public.meal_days where meal_date < retention_cutoff;
  delete from public.mess_calendar where calendar_date < retention_cutoff;
end;
$$;

revoke all on function public.prune_old_month_data() from public, anon, authenticated;

select cron.schedule(
  'digimessbook-prune-old-month-data',
  '0 0 1 * *',
  'select public.prune_old_month_data();'
);
