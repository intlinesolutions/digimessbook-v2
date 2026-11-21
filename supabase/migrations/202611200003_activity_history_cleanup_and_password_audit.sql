create or replace function public.log_student_password_change()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  student_row record;
begin
  if auth.uid() is null then
    raise exception 'Sign in before recording a password change.';
  end if;

  select s.id, s.tenant_id, s.account_number, s.full_name
    into student_row
    from public.students s
    where s.user_id = auth.uid();
  if not found then
    raise exception 'Student profile not found.';
  end if;

  insert into public.admin_audit_log (tenant_id, actor_id, actor_type, student_id, action, details)
    values (
      student_row.tenant_id,
      auth.uid(),
      'student',
      student_row.id,
      'student.password_changed',
      jsonb_build_object(
        'account_number', student_row.account_number,
        'student_name', student_row.full_name,
        'note', 'Student changed password',
        'actor_type', 'student',
        'source', 'student'
      )
    );
end;
$$;

revoke all on function public.log_student_password_change() from public, anon;
grant execute on function public.log_student_password_change() to authenticated;

notify pgrst, 'reload schema';
