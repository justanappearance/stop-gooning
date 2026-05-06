export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { password, date, folded, action } = req.body

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' })
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date' })
  }

  const base = `${process.env.SUPABASE_URL}/rest/v1/entries`
  const headers = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }

  if (action === 'delete') {
    const r = await fetch(`${base}?date=eq.${date}`, {
      method: 'DELETE',
      headers,
    })
    if (!r.ok) return res.status(500).json({ error: 'Database error' })
  } else {
    const r = await fetch(base, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ date, folded: folded === true }),
    })
    if (!r.ok) return res.status(500).json({ error: 'Database error' })
  }

  res.status(200).json({ success: true })
}
