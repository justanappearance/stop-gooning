import { ENERGY_TRACKER_ID, queryAll, rowDate } from '../lib/notion.js'

// Sets each day's internet status from the Notion "Energy Tracker": a day is clean only if a row
// dated that day has "No Internet" in Potential Causes. Anything else - including a day with no row
// at all - counts as relapsed, which is how Mike logs it (Mike, 2026-11-12).
// Notion is the source of truth from SYNC_START on: the day after the last day Mike logged by hand
// on quitting-the-internet's /admin (2026-10-05). Older days keep those hand-logged entries, which he
// says are accurate. The table lives in the Supabase project both sites share.
const CLEAN_CAUSE = 'No Internet'
const SYNC_START = '2026-10-06'
const TIME_ZONE = 'America/Chicago'

// Today is still in progress (and Vercel runs in UTC), so only days through yesterday in
// Mike's time zone are settled.
function settledDates() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date())
  const dates = []
  for (let d = new Date(`${SYNC_START}T00:00:00Z`); d.toISOString().slice(0, 10) < today; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

// No auth on purpose: it only copies Notion's answer onto the already-public calendar, so
// anyone triggering it early changes nothing. `?dry=1` reports without writing.
export default async function handler(req, res) {
  let clean
  try {
    const rows = await queryAll(ENERGY_TRACKER_ID, {
      property: 'Potential Causes', multi_select: { contains: CLEAN_CAUSE },
    })
    clean = new Set(rows.map(rowDate).filter(Boolean))
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }

  const rows = settledDates().map(date => ({ date, relapsed: !clean.has(date) }))
  if (req.query.dry !== '1' && rows.length) {
    const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/internet_entries`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    })
    if (!resp.ok) return res.status(500).json({ error: 'Database error' })
  }

  res.status(200).json({
    written: req.query.dry !== '1',
    clean: rows.filter(r => !r.relapsed).map(r => r.date),
    relapsed: rows.filter(r => r.relapsed).map(r => r.date),
  })
}
