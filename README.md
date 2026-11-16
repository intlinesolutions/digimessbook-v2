# DigiMessBook production

The React frontend is in client/. Supabase schema, Edge Functions, and production-safe seed data are in supabase/.

## Production data

The migrations and seed create the DigiMessBook tenant and the three mess halls: MH 1, MH 2, and MH 3. They do not create Auth users, students, or meal-day records.

## Frontend

Configure these Vercel Production environment variables:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY (use the Supabase publishable key)

The Vercel project root is client; the build command is npm run build, with output in dist.

## Supabase deployment

Apply the migrations to the intended project and deploy the super-admin Edge Function. The function uses Supabase's built-in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; never expose the service-role key to the browser.

Before using student creation or password-reset actions, configure the Edge Function secrets DEFAULT_STUDENT_PASSWORD, RESEND_API_KEY, and PASSWORD_RESET_FROM_EMAIL. The app fails closed if the default password is not configured.

Create a dedicated administrator in Supabase Auth and set its app metadata to {"role":"super_admin"}. The dashboard checks this role server-side.
