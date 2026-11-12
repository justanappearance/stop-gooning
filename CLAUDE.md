# stop-gooning

## What it does
Public calendar (stop-gooning.vercel.app) of days Mike folded since May 6, 2026, with streak and
day counts. Every day counts as clean unless it has a folded entry.

## Architecture
Static `index.html`/`app.js`/`style.css` plus Vercel serverless functions in `api/`, talking to
Supabase's REST API directly (no client library). Table `entries` (date PK, folded, almost) lives in
the Supabase project shared with Mike's other trackers. Deploys on push to `main`.

## File map
- `app.js` - renders the calendar and stats from `/api/entries`; `START_DATE` is the tracking start.
- `admin.html`/`admin.js` - password-gated form (`ADMIN_PASSWORD`) posting to `/api/log`.
- `api/entries.js` - read all entries. `api/log.js` - upsert or delete one day.
- `api/sync-notion.js` - daily cron: marks folded every Notion "Energy Tracker" row tagged
  "Masturbated" (`NOTION_TOKEN`). Add-only. See DECISIONS.md.
- `api/keepalive.js` - daily cron ping so Supabase's free tier doesn't pause the project.

## Known gotchas
- Vercel Hobby crons run once a day at most, and only roughly on time. A day logged in Notion shows
  up the next morning; `GET /api/sync-notion` forces it.
- Notion rows without a Date are skipped, not guessed.
- Dates before `START_DATE` are stored but not shown or counted.
