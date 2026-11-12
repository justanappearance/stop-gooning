import { ENERGY_TRACKER_ID, queryAll, rowDate } from '../lib/notion.js'

// Marks a day as folded for every row of Mike's Notion "Energy Tracker" whose Activities include
// "Masturbated". Only ever adds folded days, never clears them: Mike doesn't un-log days in Notion,
// and a Notion outage or mistake shouldn't be able to wipe the site's history.
const FOLDED_ACTIVITY = 'Masturbated'

async function foldedDatesFromNotion() {
  const rows = await queryAll(ENERGY_TRACKER_ID, {
    property: 'Activities', multi_select: { contains: FOLDED_ACTIVITY },
  })
  const dates = new Set()
  let undated = 0
  for (const row of rows) {
    const date = rowDate(row)
    // Rows without a Date can't be placed on the calendar - counted so they're visible, not guessed.
    if (date) dates.add(date)
    else undated++
  }
  return { dates: [...dates].sort(), undated }
}

// No auth on purpose: it only copies what Notion already says onto the public calendar, so
// anyone triggering it early changes nothing. `?dry=1` reports without writing.
export default async function handler(req, res) {
  let found
  try {
    found = await foldedDatesFromNotion()
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }

  if (req.query.dry !== '1' && found.dates.length) {
    // Upsert sends only date + folded, so an existing row's `almost` is left as it was; a new
    // row gets the column default rather than null.
    const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/entries`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,missing=default',
      },
      body: JSON.stringify(found.dates.map(date => ({ date, folded: true }))),
    })
    if (!resp.ok) return res.status(500).json({ error: 'Database error' })
  }

  res.status(200).json({ written: req.query.dry !== '1', folded_dates: found.dates, undated_rows: found.undated })
}
