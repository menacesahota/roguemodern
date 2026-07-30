-- Rogue inbound leads (Name + Email form)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  source text not null default 'website',
  user_agent text,
  created_at timestamptz not null default now(),
  constraint leads_name_len check (char_length(trim(name)) between 1 and 120),
  constraint leads_email_len check (char_length(trim(email)) between 3 and 254),
  constraint leads_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx on public.leads (lower(email));

alter table public.leads enable row level security;

drop policy if exists "anon_insert_leads" on public.leads;
create policy "anon_insert_leads"
  on public.leads
  for insert
  to anon, authenticated
  with check (true);

-- No select/update/delete for anon. Read leads in the Supabase dashboard
-- (or with the service role) only.
