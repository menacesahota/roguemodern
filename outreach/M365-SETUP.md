# Microsoft 365 send setup (Graph)

One-time setup so the weekday automation can send from `01@roguemodern.com`.

## 1. Azure app registration

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. **New registration** → name `Rogue Outreach` → single tenant → Register
3. Copy **Application (client) ID** and **Directory (tenant) ID**
4. **Certificates & secrets** → New client secret → copy the **Value** once

## 2. Mail permission

1. **API permissions** → Add → Microsoft Graph → **Application** permissions
2. Add `Mail.Send`
3. Click **Grant admin consent** (required for app-only send)

## 3. Cursor cloud secrets

In Cursor Cloud Agents / Automations secrets for `menacesahota/roguemodern`, add:

| Secret | Value |
|--------|--------|
| `AZURE_TENANT_ID` | Directory (tenant) ID |
| `AZURE_CLIENT_ID` | Application (client) ID |
| `AZURE_CLIENT_SECRET` | Client secret value |
| `ROGUE_FROM_EMAIL` | `01@roguemodern.com` |

## 4. Test locally (optional)

```bash
# PowerShell
$env:AZURE_TENANT_ID="..."
$env:AZURE_CLIENT_ID="..."
$env:AZURE_CLIENT_SECRET="..."
$env:ROGUE_FROM_EMAIL="01@roguemodern.com"
node outreach/send-graph.mjs outreach/outbox/sample.json
```

Hard cap in the script: **10 sends per run**.
