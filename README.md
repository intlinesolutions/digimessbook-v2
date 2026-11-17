# DigiMessBook production

The React frontend is in `client/`. Supabase schema, migrations, and the super-admin Edge Function are in `supabase/`.

## Production data

The production migrations and seed establish the DigiMessBook tenant and its three mess halls: MH 1, MH 2, and MH 3. They do not create Auth users, students, or meal records. Add students later through the super-admin dashboard.

## Vercel

The production Vercel project uses `client/` as its root directory and builds with `npm run build` into `dist/`. Configure these Production environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (the Supabase publishable key)

The production branch is `codex/production`. Vercel deploys commits pushed to that branch.

## Supabase

Apply migrations only to the dedicated production project and deploy the `super-admin` Edge Function. The function uses Supabase's built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; never expose the service-role key to the browser.

Student accounts use their admission number as the initial password when one is present. Otherwise, the function reads `DEFAULT_STUDENT_PASSWORD` from the production Edge Function secrets. Keep that setting in Supabase, not in frontend code or Git. Student password resets from the admin dashboard use the same rule.

Create the super-admin user in Supabase Auth and set its app metadata to `{"role":"super_admin"}`. The dashboard checks this role server-side.

## Meal data

The student dashboard supports the previous, current, and next month. New student records receive default meal rows for the supported date range. A monthly database job removes meal-day and mess-calendar rows older than the previous month. Admins can delete meal data for a selected month; the student account and audit history remain.
