-- The mess-admin Edge Function uses the service role after checking the
-- authenticated user's trusted app-metadata hostel scope.
grant execute on function public.mess_count_summary(uuid, date) to service_role;
grant execute on function public.students_list_rows(uuid, date) to service_role;
