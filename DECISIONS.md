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
