import { WEIGHT_DATABASE_ID, cacheForMinutes, queryAll } from '../lib/notion.js'

// The Weight database's "Date" column is a Created time property, not a Date: Notion stamps each
// row in UTC when Mike adds it, so convert to his time zone to get the day he weighed in.
function weighInDate(row) {
  const stamp = row.properties.Date?.created_time ?? row.properties.Date?.date?.start
  if (!stamp) return null
  if (stamp.length === 10) return stamp
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date(stamp))
}

// Mike's Notion "Weight" database: the weight (lb) is typed as each row's title, e.g. "194.4".
// Returns [{ date, weight }] oldest first; rows whose title isn't a number are skipped.
export default async function handler(req, res) {
  let rows
  try {
    rows = await queryAll(WEIGHT_DATABASE_ID, undefined)
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }

  const points = []
  for (const row of rows) {
    const title = Object.values(row.properties).find(p => p.type === 'title')
    const weight = parseFloat((title?.title ?? []).map(t => t.plain_text).join(''))
    const date = weighInDate(row)
    if (date && Number.isFinite(weight)) points.push({ date, weight })
  }
  points.sort((a, b) => a.date.localeCompare(b.date))
  cacheForMinutes(res, 10)
  res.status(200).json(points)
}
