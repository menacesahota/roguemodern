# Website inbound form → Supabase + email

## What happens on submit
1. Browser posts to Edge Function `inbound`
2. Lead is saved to `leads`
3. `01@roguemodern.com` gets a notification
4. The visitor gets a short confirmation email

## Secrets (Supabase Edge Function)
Set in project → Edge Functions → Secrets (or CLI):

- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `ROGUE_FROM_EMAIL` = `01@roguemodern.com`
- `ROGUE_NOTIFY_EMAIL` = `01@roguemodern.com` (optional override)
- `SUPABASE_SERVICE_ROLE_KEY` (usually auto-injected as `SUPABASE_SERVICE_ROLE_KEY`)
- `SUPABASE_URL` (usually auto-injected)

## Deploy function
```bash
supabase functions deploy inbound --project-ref zooebajytjpospjvdydh
```

## Site env
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env` and GitHub Actions secrets.
