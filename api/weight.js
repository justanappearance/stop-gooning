import { WEIGHT_DATABASE_ID, cacheForMinutes, queryAll, rowDate } from '../lib/notion.js'

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
    const date = rowDate(row)
    if (date && Number.isFinite(weight)) points.push({ date, weight })
  }
  points.sort((a, b) => a.date.localeCompare(b.date))
  cacheForMinutes(res, 10)
  res.status(200).json(points)
}
