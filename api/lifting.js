import { ENERGY_TRACKER_ID, cacheForMinutes, queryAll, rowDate, tags } from '../lib/notion.js'

// How much of Mike's usual workout each Activities tag means. Plain "Lifting" is the full
// workout; before 2026-11-12 it was the only tag, so older days all read as full (Mike's call).
const WORKOUT_SHARE = { 'Lifting': 1, '3/4 Lifting': 0.75, '1/2 Lifting': 0.5, '1/4 Lifting': 0.25 }

// Read live from Notion (no sync table): nothing else needs these numbers, and Notion is where
// Mike logs them. Returns { "YYYY-MM-DD": share } for days with any lifting tag.
export default async function handler(req, res) {
  let rows
  try {
    rows = await queryAll(ENERGY_TRACKER_ID, {
      or: Object.keys(WORKOUT_SHARE).map(name => ({ property: 'Activities', multi_select: { contains: name } })),
    })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }

  const shares = {}
  for (const row of rows) {
    const date = rowDate(row)
    if (!date) continue
    const share = Math.max(...tags(row, 'Activities').map(name => WORKOUT_SHARE[name] ?? 0))
    shares[date] = Math.max(shares[date] ?? 0, share)
  }
  cacheForMinutes(res, 10)
  res.status(200).json(shares)
}
