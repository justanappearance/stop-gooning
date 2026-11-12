# stop-gooning

## What it does
Mike's combined tracker site (stop-gooning.vercel.app) with four tabs: gooning (since May 6, 2026),
internet (since June 30, 2026), lifting (how much of his workout he did each day) and weight. All of
it comes from what he logs in Notion; the page is public.

## Architecture
Static `index.html`/`app.js`/`style.css` plus Vercel serverless functions in `api/`. Tabs are
`#gooning`, `#internet`, `#lifting`, `#weight`; each fetches its data the first time it's shown.
One calendar (from May 2026) stays in place across gooning/internet/lifting and only its colors
change; weight shows just its chart. Lifting and weight share one chart with 1M/3M/1Y/All buttons.
`EVENTS` in `app.js` marks trips (dates from Mike's footage\personal folders) and the July lifting
injury with colored dots and legend entries.
- Gooning and internet are stored in Supabase (REST, no client library), in the project shared with
  Mike's other trackers: tables `entries` (date PK, folded, almost) and `internet_entries` (date PK,
  relapsed). Daily crons copy Notion into them; older days were logged by hand through /admin pages.
- Lifting and weight are read live from Notion on each request (cached 10 minutes), no table.
Deploys on push to `main`.

## File map
- `app.js` - one shared `renderCalendar` and `renderChart` (SVG, bar or line) used by every tab,
  plus a `show<Tab>` function each. Start dates are constants at the top.
- `lib/notion.js` - Notion database IDs, paginated query, date/tag helpers. Outside `api/` so it
  isn't a route.
- `api/entries.js`, `api/internet-entries.js` - read the two Supabase tables.
- `api/sync-notion.js` - cron: gooning days from the Energy Tracker's "Masturbated" tag. Add-only.
- `api/sync-internet.js` - cron: internet days from 2026-10-06 (right after the last /admin entry) on; clean only with "No Internet" in
  Potential Causes, otherwise relapsed (including days with no row).
- `api/lifting.js` - Energy Tracker Activities: Lifting = 1, 3/4 Lifting, 1/2 Lifting, 1/4 Lifting.
- `api/weight.js` - Notion "Weight" database: weight is the row title, date is the created time.
- `api/log.js` + `admin.html`/`admin.js` - password-gated manual gooning log (`ADMIN_PASSWORD`).
  The internet one still lives at quitting-the-internet.vercel.app/admin.
- `api/keepalive.js` - daily ping so Supabase's free tier doesn't pause.

## Known gotchas
- Vercel Hobby crons run once a day at most, roughly on time. `GET /api/sync-notion` or
  `/api/sync-internet` forces a sync; `?dry=1` shows what it would write.
- The Weight database's "Date" column is a Created time property, so a weigh-in entered late is
  dated the day it was entered.
- Before 2026-11-12 Mike only had the plain "Lifting" tag, so those days count as full workouts.
- Notion rows without a Date are skipped, not guessed.
- quitting-the-internet.vercel.app/ redirects here (`#internet`); its repo still owns that /admin.
