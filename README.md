# Digi Mess Book local development

The React frontend is in `client/`. Supabase local configuration, SQL schema, and demo data are in `supabase/`. The original `index.html` remains as a reference copy.

## Start the local backend

From the repository root, run:

```powershell
npx supabase start
```

The first run downloads the Supabase Docker images. When it finishes, use `npx supabase status` to get the local API URL and anon key. The default local API URL is `http://127.0.0.1:54321`.

Copy `client/.env.example` to `client/.env.local` and put the API URL and anon key from `supabase status` in that file. These are local public client values; never put a service-role key in the browser app.

## Start the frontend

In a second PowerShell window:

```powershell
cd D:\DEV\DigiMessBook\client
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://127.0.0.1:5173`.

## Demo students

The local seed creates these accounts. All use password `Mess@2026!`.

| Account number | Demo name | Room |
|---|---|---|
| `24B000` | Demo Student One | 101 |
| `24B001` | Demo Student Two | 102 |
| `24B002` | Demo Student Three | 103 |

`npx supabase db reset` reapplies migrations and reseeds the local database, replacing local test changes.
`npx supabase stop` stops the local stack; it preserves its data unless `--no-backup` is specified.

## Super-admin dashboard

The admin dashboard is available at `/super-admin`. Its workspace uses a Supabase Edge Function so administrative operations never need a service-role key in the browser. The SQL migration adds departments, lock settings, mess-calendar dates, student notifications, and an admin audit log.

Apply migrations and deploy the function to the intended Supabase project:

```powershell
npx supabase db push
npx supabase functions deploy super-admin
npx supabase secrets set RESEND_API_KEY="your-resend-api-key" PASSWORD_RESET_FROM_EMAIL="DigiMessBook <no-reply@your-verified-domain>" PASSWORD_RESET_REDIRECT_URL="https://your-app.example/reset-password"
```

The Edge Function uses Supabase's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment values. These are provided to deployed functions by Supabase; do not add the service-role key to `client/.env.local` or any frontend configuration. For local development, start the local Supabase stack, put `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `PASSWORD_RESET_FROM_EMAIL`, and `PASSWORD_RESET_REDIRECT_URL` in the ignored file `supabase/.env.local`, then run:

```powershell
npx supabase functions serve super-admin --env-file supabase/.env.local
```

Create a dedicated administrator in Supabase Auth and set its **app metadata** to `{"role":"super_admin"}`. The dashboard validates this server-side for every request. User metadata is not used for authorization. Sign in to `/super-admin` with that Auth user's email and password. Newly created student accounts and super-admin password resets use the student's admission number as the password. When no admission number is on file, the fallback is `Mess@2026!`.

Forgot-password recovery emails use Resend because student login accounts use internal email aliases. They send a single-use link to the student's saved `students.email` address; the student chooses a new password on `/reset-password`. Super-admin password resets set the password directly and do not send an email. Verify the sender domain with Resend, set `PASSWORD_RESET_REDIRECT_URL` to the deployed app's `/reset-password` URL, and add that exact URL to the Supabase Auth redirect allow list. For local Edge Function development, set `PASSWORD_RESET_REDIRECT_URL=http://127.0.0.1:5173/reset-password` in the ignored `supabase/.env.local` file. Forgot-password requests are limited to one email per student per minute. Other student-facing email sends should use the saved `students.email` address as well.

Notifications are stored for each selected student, appear in the student app's notification panel, and are marked read when opened. Admin changes are written to the audit log. The month cleanup action removes meal-day entries for the selected month across the selected tenant and keeps student accounts and the audit log.

The student dashboard month picker shows the previous, current, and next month, with the current month selected at login. A monthly Supabase Cron job removes `meal_days` and `mess_calendar` rows older than the previous month, keeping the previous, current, and next month available. Student profiles and audit history are retained.

The local demo users and their data remain local unless you apply migrations or seed data to another project deliberately.
