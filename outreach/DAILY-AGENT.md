# Daily weekday agent brief

Run weekdays at **09:00 UK**. Do not exceed **10 drafts**.

## Goal
1. Find **25** new dated UK businesses (trade / local with money).
2. Rank by strength of dated clue.
3. Write personalised cold emails for the top **10**.
4. Save those 10 as **Outlook drafts** via Microsoft Graph (do not send).
5. Log everything; leave the other 15 as researched backlog.

## Who to target
Packaging, printers, manufacturers, joiners, HVAC, electrical, roofing, accountants, solicitors, estate agents, wholesalers, food producers.

## Dated signals
Looks 2008-2015, not mobile-friendly, Flash / "Best viewed in...", clutter, no clear quote CTA, placeholder/lorem text, thin template sites for serious firms.

## Rules
- Rotate town + trade each day (London boroughs, Home Counties, then wider UK).
- Skip anyone already in `outreach/prospects.csv` or `outreach/logs/sends.csv`.
- Verify the dated clue on the live site before writing the email.
- Never use long hyphens (em/en dashes). Use a normal `-` only.
- **Do not send email.** Only create drafts. Mani reviews and sends from Outlook Web.

## Email voice
From display: **Mani · Rogue** / `01@roguemodern.com`
Short, calm, useful. Cite one concrete dated clue. Offer a 3-point teardown if they reply **YES**. No hype.

## Output each run
1. Append 25 researched rows to `outreach/prospects.csv` (`status=researched` or `draft`).
2. Write `outreach/outbox/YYYY-MM-DD-drafts.json` with the 10 draft payloads (`to`, `subject`, `bodyText`, `business`).
3. Write `outreach/daily/YYYY-MM-DD-drafts.md` with the full pack (25 list + 10 emails).
4. Save drafts to Outlook with:

```bash
# Load AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, ROGUE_FROM_EMAIL from secrets
node outreach/save-drafts.mjs outreach/outbox/YYYY-MM-DD-drafts.json
```

5. Commit the CSV / daily / outbox updates to `master` (or open a PR if push fails).
6. Do **not** run `send-graph.mjs`. Do **not** send mail except if Mani later asks.
