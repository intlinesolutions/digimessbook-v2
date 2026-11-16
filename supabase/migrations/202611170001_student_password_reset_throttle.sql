create table if not exists public.student_password_reset_throttle (
  student_id uuid primary key references public.students(id) on delete cascade,
  last_sent_at timestamptz not null
);

alter table public.student_password_reset_throttle enable row level security;
revoke all on public.student_password_reset_throttle from anon, authenticated;
grant all on public.student_password_reset_throttle to service_role;
