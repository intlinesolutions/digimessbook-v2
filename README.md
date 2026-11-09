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

## Current scope

Login, profile retrieval, meal-day reads/updates, food preference updates, RLS, and the November 2026 demo data are implemented. Password reset email delivery and admin workflows are not implemented. Demo users and data are local only; no data or credentials have been copied to a hosted project.
