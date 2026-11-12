// Marks a day as folded for every row of Mike's Notion "Energy Tracker" whose Activities include
// "Masturbated". Only ever adds folded days, never clears them: Mike doesn't un-log days in Notion,
// and a Notion outage or mistake shouldn't be able to wipe the site's history.
const NOTION_DATABASE_ID = '3737b954a45980d48a6cdc9a0623a045'
const FOLDED_ACTIVITY = 'Masturbated'

async function foldedDatesFromNotion() {
  const dates = new Set()
  let undated = 0
  let cursor
  do {
    const resp = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { property: 'Activities', multi_select: { contains: FOLDED_ACTIVITY } },
        start_cursor: cursor,
        page_size: 100,
      }),
    })
    if (!resp.ok) throw new Error(`Notion ${resp.status}: ${await resp.text()}`)
    const page = await resp.json()
    for (const row of page.results) {
      const start = row.properties.Date?.date?.start
      // Rows without a Date can't be placed on the calendar - counted so they're visible, not guessed.
      if (start) dates.add(start.slice(0, 10))
      else undated++
    }
    cursor = page.has_more ? page.next_cursor : undefined
  } while (cursor)
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
