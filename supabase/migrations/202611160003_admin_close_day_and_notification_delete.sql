grant delete on public.student_notifications to authenticated;
drop policy if exists "students remove read notifications" on public.student_notifications;
create policy "students remove read notifications" on public.student_notifications
  for delete to authenticated
  using (
    read_at is not null
    and student_id in (select id from public.students where user_id = auth.uid())
  );

create or replace function public.admin_close_mess_day(
  p_tenant_id uuid,
  p_calendar_date date,
  p_note text,
  p_actor uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  affected integer;
begin
  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'Tenant not found';
  end if;

  insert into public.mess_calendar (tenant_id, calendar_date, status, note, updated_at)
  values (p_tenant_id, p_calendar_date, 'closed', coalesce(p_note, ''), now())
  on conflict (tenant_id, calendar_date) do update
    set status = 'closed', note = excluded.note, updated_at = excluded.updated_at;

  insert into public.meal_days (student_id, meal_date, meal_code, updated_at)
  select s.id, p_calendar_date, '----', now()
  from public.students s
  where s.tenant_id = p_tenant_id
  on conflict (student_id, meal_date) do update
    set meal_code = '----', updated_at = excluded.updated_at;
  get diagnostics affected = row_count;

  insert into public.admin_audit_log (tenant_id, actor_id, action, details)
  values (
    p_tenant_id,
    p_actor,
    'day.mess_closed',
    jsonb_build_object('date', p_calendar_date, 'note', coalesce(p_note, ''), 'students_affected', affected)
  );
  return affected;
end;
$$;
revoke all on function public.admin_close_mess_day(uuid, date, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_close_mess_day(uuid, date, text, uuid) to service_role;

notify pgrst, 'reload schema';
