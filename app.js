const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const DAY_HEADERS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function calcCurrentStreak(entries, entryMap) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const d = new Date(today)
  const todayStr = formatDate(d)

  // If today isn't logged yet, start counting from yesterday
  if (!entryMap[todayStr]) {
    d.setDate(d.getDate() - 1)
  }

  let streak = 0
  for (let i = 0; i < 366; i++) {
    const dateStr = formatDate(d)
    const entry = entryMap[dateStr]
    if (!entry || entry.folded) break
    streak++
    d.setDate(d.getDate() - 1)
  }

  return streak
}

function calcLongestStreak(entries) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))

  let longest = 0
  let current = 0
  let lastCleanDate = null

  for (const entry of sorted) {
    if (entry.folded) {
      if (current > longest) longest = current
      current = 0
      lastCleanDate = null
    } else {
      if (lastCleanDate !== null) {
        const prev = parseLocalDate(lastCleanDate)
        const curr = parseLocalDate(entry.date)
        const diff = (curr - prev) / 864e5
        if (diff > 1) {
          if (current > longest) longest = current
          current = 0
        }
      }
      current++
      lastCleanDate = entry.date
    }
  }

  return Math.max(longest, current)
}

function renderStats(entries, entryMap) {
  const clean = entries.filter(e => !e.folded)
  const folded = entries.filter(e => e.folded)

  document.getElementById('total-clean').textContent = clean.length
  document.getElementById('total-folded').textContent = folded.length
  document.getElementById('current-streak').textContent = calcCurrentStreak(entries, entryMap)
  document.getElementById('longest-streak').textContent = calcLongestStreak(entries)
}

function renderMonth(year, month, todayStr, entryMap) {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow = firstDay.getDay()

  const monthEl = document.createElement('div')
  monthEl.className = 'month'

  const nameEl = document.createElement('div')
  nameEl.className = 'month-name'
  nameEl.textContent = MONTH_NAMES[month]
  monthEl.appendChild(nameEl)

  const headersEl = document.createElement('div')
  headersEl.className = 'day-headers'
  for (const label of DAY_HEADERS) {
    const h = document.createElement('div')
    h.className = 'day-header'
    h.textContent = label
    headersEl.appendChild(h)
  }
  monthEl.appendChild(headersEl)

  const gridEl = document.createElement('div')
  gridEl.className = 'day-grid'

  for (let i = 0; i < startDow; i++) {
    const blank = document.createElement('div')
    blank.className = 'day-cell empty'
    gridEl.appendChild(blank)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateStr = formatDate(date)
    const isFuture = date > today
    const isToday = dateStr === todayStr

    const cell = document.createElement('div')
    cell.className = 'day-cell'

    if (isFuture) {
      cell.classList.add('future')
    } else {
      const entry = entryMap[dateStr]
      if (entry) {
        cell.classList.add(entry.folded ? 'folded' : 'clean')
      }
    }

    if (isToday) cell.classList.add('today')

    const num = document.createElement('span')
    num.className = 'day-number'
    num.textContent = day
    cell.appendChild(num)

    gridEl.appendChild(cell)
  }

  monthEl.appendChild(gridEl)
  return monthEl
}

async function init() {
  const calendar = document.getElementById('calendar')
  calendar.innerHTML = '<p class="loading">Loading...</p>'

  let entries = []
  try {
    const resp = await fetch('/api/entries')
    if (resp.ok) entries = await resp.json()
  } catch (e) {
    console.error('Failed to load entries', e)
  }

  const entryMap = {}
  for (const e of entries) entryMap[e.date] = e

  renderStats(entries, entryMap)

  calendar.innerHTML = ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = formatDate(today)
  const year = today.getFullYear()

  for (let month = 0; month <= today.getMonth(); month++) {
    calendar.appendChild(renderMonth(year, month, todayStr, entryMap))
  }
}

init()
