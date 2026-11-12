// Shared by every api/ route that reads Mike's Notion. Lives outside api/ so Vercel doesn't
// expose it as a route of its own.
export const ENERGY_TRACKER_ID = '3737b954a45980d48a6cdc9a0623a045'
export const WEIGHT_DATABASE_ID = '3067b954a45980d7a311fb49a711ee14'

export async function queryAll(databaseId, filter) {
  const rows = []
  let cursor
  do {
    const resp = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filter, start_cursor: cursor, page_size: 100 }),
    })
    if (!resp.ok) throw new Error(`Notion ${resp.status}: ${await resp.text()}`)
    const page = await resp.json()
    rows.push(...page.results)
    cursor = page.has_more ? page.next_cursor : undefined
  } while (cursor)
  return rows
}

// Notion dates may carry a time and offset ("2026-11-12T08:35:00.000-06:00"); the calendar
// date as Mike entered it is the first 10 characters.
export function rowDate(row) {
  return row.properties.Date?.date?.start?.slice(0, 10) ?? null
}

export function tags(row, property) {
  return (row.properties[property]?.multi_select ?? []).map(option => option.name)
}

// Notion responses are a few seconds old at worst after this, and the page loads instantly.
export function cacheForMinutes(res, minutes) {
  res.setHeader('Cache-Control', `s-maxage=${minutes * 60}, stale-while-revalidate=${minutes * 60}`)
}
