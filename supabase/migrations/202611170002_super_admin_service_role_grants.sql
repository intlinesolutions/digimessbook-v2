grant select on public.tenants, public.hostels to service_role;

grant select, insert, update, delete
  on public.students, public.meal_days
  to service_role;

grant select, insert, update, delete
  on public.mess_settings, public.mess_calendar, public.student_password_reset_throttle
  to service_role;

grant select, insert
  on public.admin_audit_log
  to service_role;

grant select, insert, update, delete
  on public.student_notifications
  to service_role;
