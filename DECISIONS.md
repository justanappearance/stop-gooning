# Decisions

## Keep Supabase alive via Vercel Cron ping instead of migrating databases
- Decision: Added `api/keepalive.js` + a daily Vercel Cron entry in `vercel.json` (`0 0 * * *`) that pings Supabase with a trivial read, instead of switching to a different database service.
- Why: Supabase's free tier pauses a project after ~7 days of no API activity. The daily ping resets that inactivity clock, which directly solves the pausing problem with no changes to existing schema, env vars, or API routes.
- Rejected: Migrate to Vercel KV/Upstash Redis, migrate to Turso (SQLite), store entries as JSON in the git repo via GitHub API.
- Why rejected: All three require rewriting `api/entries.js` and `api/log.js`, migrating existing logged entries, and adopting a new service's quirks/credentials — real effort and risk for a dataset that's just a handful of dates. That trade only makes sense if the goal were leaving Supabase entirely, not just stopping the pause.
- Date: 2026-07-04

## Collapse START_DATE and STATS_START_DATE into a single date
- Decision: `app.js` used to have two separate dates — `START_DATE` (March 16, 2026, controlled which months/days the calendar rendered) and `STATS_START_DATE` (May 6, 2026, controlled streaks/day counts and the blue "start" marker). Removed `STATS_START_DATE` and made `START_DATE` = May 6, 2026 for both purposes.
- Why: The two-date split made the calendar show March/April and early May as placeholder "clean" days that never actually counted toward any stat, which read as confusing/wrong ("more than 79 clean days but it doesn't show that"). Mike confirmed May 6 is what he considers the real start.
- Date: 2026-07-27

## Folded days sync from Notion, add-only
- Decision: `api/sync-notion.js` reads Mike's Notion "Energy Tracker" database (ID hardcoded,
  token in the `NOTION_TOKEN` env var) and upserts `folded: true` for every row whose Activities
  multi-select contains "Masturbated". Runs daily via Vercel Cron (`0 11 * * *` UTC, about 5-6am
  Central); `GET /api/sync-notion` runs it on demand and `?dry=1` lists dates without writing.
- Why: Mike already logs this in Notion, so logging it again in /admin was double work and the site
  had fallen behind (first run added 9 days, Oct 13 to Nov 9).
- Add-only: never un-folds a day. Mike doesn't un-log days in Notion, and this keeps a Notion
  outage or edit from erasing site history. Days marked by hand in /admin but not in Notion stay.
- Rows with no Date are skipped and counted as `undated_rows` (2 on the first run).
- No auth on the endpoint: it only copies Notion's answer onto the already-public calendar.
- Rejected: Notion webhooks for instant updates.
- Why rejected: needs a public webhook endpoint with signature checks, more moving parts than a
  daily cron for one person logging once a day.
- Date: 2026-11-12

## One site, four tabs: gooning, internet, lifting, weight
- Decision: stop-gooning.vercel.app became the combined tracker (name kept, Mike's choice). The
  internet calendar moved in as a tab, reading the same `internet_entries` table, and its Notion
  sync (`api/sync-internet.js`) lives here because this Vercel project already has `NOTION_TOKEN`.
  quitting-the-internet.vercel.app/ now redirects to `#internet`.
- Why: Mike, 2026-11-12: the trackers are one record of his behavior and energy, and he logs them
  all in Notion.
- Lifting and weight read Notion live instead of syncing into Supabase: nothing else needs them,
  and live reads avoid a second copy. Cached 10 minutes at Vercel's edge.
- Calendars and charts share one renderer each (UI consistency rule); no chart library, plain SVG.
- Rejected: a new Vercel project and domain. Why rejected: Mike was fine with the existing name, and
  it would mean a new project, token and env vars for no gain.
- Date: 2026-11-12

## Lifting: partial workouts from Nov 12, all earlier gym days count as full
- Decision: Activities tags map to a share of the usual workout: "Lifting" 1, "3/4 Lifting",
  "1/2 Lifting", "1/4 Lifting". Lifting stats count from 2026-11-12 (second start), the graph and
  calendar show every day since the first Lifting tag (June 1, 2026).
- Why: Mike started logging partial workouts on Nov 12. Before that "Lifting" only meant he went,
  and he said to treat those days as full.
- Date: 2026-11-12

## Internet stats count from June 30 only
- Decision: Oct 20 is marked on the internet calendar as a second start, with no separate stats.
- Why: Mike, 2026-11-12, after trying a "since Oct 20" line: the all-time stats are enough.
- Date: 2026-11-12

## Fixed calendar, event markers, lifting chart from Nov 12, internet sync from Oct 6
- Decision: one shared calendar that recolors per tab instead of a calendar per tab; `EVENTS`
  (Yellowstone May 22-25, Guatemala Jun 10-14, Denver Sep 26-27, lifting injury Jul 16-27 on the
  lifting tab only) shown as corner dots plus legend entries; the lifting bar chart sits under the
  calendar and covers only Nov 12 on, with 1M (default)/3M/1Y/All, and weight uses the same chart.
- Internet sync start moved from Oct 20 to Oct 6: Mike's rule is that any day without "No Internet"
  means he used it, and Oct 6-19 had nothing logged, so they had been showing as clean.
- Why: Mike, 2026-11-12. Trip dates come from his photo folders, converted from the UTC filenames
  to Central time; the injury range is the July gap in his Lifting tags, which he confirmed.
- Rejected: storing events in Notion or Supabase. Why rejected: a handful of past events; a list in
  app.js is simpler until he adds them often.
- Date: 2026-11-12
