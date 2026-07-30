# Website inbound form → Supabase

## 1. Create the table
In the Supabase SQL editor, run:

`supabase/migrations/20260730140000_leads.sql`

## 2. Local env
Copy `.env.example` to `.env` and fill:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (Project Settings → API → anon public)

## 3. GitHub Pages build secrets
Repo → Settings → Secrets and variables → Actions:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The Pages workflow injects these at build time.
