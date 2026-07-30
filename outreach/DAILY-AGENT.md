# Daily weekday agent brief

Run weekdays ~08:00. Do not exceed **10 sends**.

## Goal
1. Find **25** new dated UK businesses (trade / local with money).
2. Rank by strength of dated clue.
3. Write personalised cold emails for the top **10**.
4. Send those 10 via Microsoft Graph.
5. Log everything; leave the other 15 as researched backlog.

## Who to target
Packaging, printers, manufacturers, joiners, HVAC, electrical, roofing, accountants, solicitors, estate agents, wholesalers, food producers.

## Dated signals
Looks 2008–2015, not mobile-friendly, Flash / “Best viewed in…”, clutter, no clear quote CTA, placeholder/lorem text, thin template sites for serious firms.

## Rules
- Rotate town + trade each day (London boroughs, Home Counties, then wider UK).
- Skip anyone already in `outreach/prospects.csv` or `outreach/logs/sends.csv`.
- Verify the dated clue on the live site before writing the email.
- Prefer a real contact email from the site; otherwise a credible `info@` / `enquiries@` only when that address is published.
- Cap **10 sends** per day. Never blast more.

## Email voice
From display: **Mani · Rogue** / `01@roguemodern.com`  
Short, calm, useful. Cite one concrete dated clue. Offer a 3-point teardown if they reply **YES**. No hype.

## Output each run
1. Append 25 researched rows to `outreach/prospects.csv` (`status=researched` or `sent`).
2. Write `outreach/outbox/YYYY-MM-DD.json` with the 10 send payloads (`to`, `subject`, `bodyText`, `business`).
3. Write `outreach/daily/YYYY-MM-DD.md` with the full pack (25 list + 10 emails).
4. Send with:

```bash
node outreach/send-graph.mjs outreach/outbox/YYYY-MM-DD.json
```

5. Commit the CSV / daily / outbox / log updates to `master` (or open a PR if push fails).
6. Do **not** send email except through `send-graph.mjs`.
