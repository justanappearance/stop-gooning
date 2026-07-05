export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const resp = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/entries?select=date&limit=1`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  )

  if (!resp.ok) {
    return res.status(500).json({ error: 'Database error' })
  }

  res.status(200).json({ ok: true })
}
