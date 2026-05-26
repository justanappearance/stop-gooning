const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const DAY_HEADERS = ['Su','Mo','Tu','We','Th','Fr','Sa']
const START_DATE = new Date(2026, 2, 16) // March 16, 2026
const STATS_START_DATE = new Date(2026, 4, 6) // May 6, 2026


function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function calcCurrentStreak(entryMap, today) {
  const d = new Date(today)
  d.setDate(d.getDate() - 1) // start from yesterday since today is pending
  let streak = 0
  for (let i = 0; i < 366; i++) {
    if (d < STATS_START_DATE) break
    const entry = entryMap[formatDate(d)]
    if (entry && entry.folded) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function calcLongestStreak(entryMap, today) {
  const d = new Date(STATS_START_DATE)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  let longest = 0
  let current = 0
  while (d <= yesterday) {
    const entry = entryMap[formatDate(d)]
    if (entry && entry.folded) {
      if (current > longest) longest = current
      current = 0
    } else {
      current++
    }
    d.setDate(d.getDate() + 1)
  }
  return Math.max(longest, current)
}

function renderMonth(year, month, todayStr, entryMap, today) {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow = firstDay.getDay()

  const monthEl = document.createElement('div')
  monthEl.className = 'month'

  const nameEl = document.createElement('div')
  nameEl.className = 'month-name'
  nameEl.textContent = `${MONTH_NAMES[month]} ${year}`
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

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateStr = formatDate(date)
    const isFuture = date > today
    const isBeforeStart = date < START_DATE
    const isToday = dateStr === todayStr

    const cell = document.createElement('div')
    cell.className = 'day-cell'

    if (isBeforeStart || isFuture) {
      cell.classList.add('empty')
    } else if (isToday) {
      const entry = entryMap[dateStr]
      if (entry && entry.folded) cell.classList.add('folded')
      else if (entry && entry.almost) cell.classList.add('almost')
      else cell.classList.add('empty')
    } else {
      const entry = entryMap[dateStr]
      const isPreChallenge = date < STATS_START_DATE
      if (entry && entry.folded) cell.classList.add('folded')
      else if (entry && entry.almost) cell.classList.add('almost')
      else if (isPreChallenge) cell.classList.add('empty')
      else cell.classList.add('clean')
    }

    if (isToday) cell.classList.add('today')
    if (dateStr === formatDate(STATS_START_DATE)) cell.classList.add('start')

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

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = formatDate(today)

  const entryMap = {}
  for (const e of entries) entryMap[e.date] = e

  const pastDays = Math.floor((today - STATS_START_DATE) / 864e5) // excludes today (still pending)
  const foldedCount = Object.values(entryMap).filter(e => e.folded && e.date !== todayStr && e.date >= formatDate(STATS_START_DATE)).length
  document.getElementById('total-folded').textContent = foldedCount
  document.getElementById('total-clean').textContent = pastDays - foldedCount
  document.getElementById('current-streak').textContent = calcCurrentStreak(entryMap, today)
  document.getElementById('longest-streak').textContent = calcLongestStreak(entryMap, today)

  calendar.innerHTML = ''

  for (let month = START_DATE.getMonth(); month <= today.getMonth(); month++) {
    calendar.appendChild(renderMonth(today.getFullYear(), month, todayStr, entryMap, today))
  }
}

init()
