-- Reassert the authenticated student read permissions required by the app.
-- These grants are intentionally separate from the service-role admin writes.
grant select on public.mess_settings, public.mess_calendar, public.student_notifications to authenticated;
grant update (read_at) on public.student_notifications to authenticated;
