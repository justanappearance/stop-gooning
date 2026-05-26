function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

document.getElementById('date').value = formatDate(new Date())

document.getElementById('log-form').addEventListener('submit', async (e) => {
  e.preventDefault()

  const password = document.getElementById('password').value
  const date = document.getElementById('date').value
  const status = document.querySelector('input[name="status"]:checked').value

  const btn = document.getElementById('submit-btn')
  const msg = document.getElementById('result-msg')

  btn.disabled = true
  msg.className = 'result-msg'
  msg.textContent = 'Saving...'

  try {
    const body = { password, date }

    if (status === 'remove') {
      body.action = 'delete'
    } else {
      body.folded = status === 'folded'
      body.almost = status === 'almost'
    }

    const resp = await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await resp.json()

    if (resp.ok) {
      msg.className = 'result-msg success'
      if (status === 'remove') msg.textContent = 'Entry removed.'
      else if (status === 'folded') msg.textContent = 'Logged. You folded.'
      else if (status === 'almost') msg.textContent = 'Logged. Close call.'
      else msg.textContent = 'Logged. Held strong.'
    } else {
      msg.className = 'result-msg error'
      msg.textContent = data.error || 'Something went wrong.'
    }
  } catch {
    msg.className = 'result-msg error'
    msg.textContent = 'Network error.'
  }

  btn.disabled = false
})
