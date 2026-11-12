const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const DAY_HEADERS = ['Su','Mo','Tu','We','Th','Fr','Sa']

const GOONING_START = new Date(2026, 4, 6) // May 6, 2026
const INTERNET_START = new Date(2026, 5, 30) // June 30, 2026 - stats count from here
// Second internet start (Mike, 2026-11-12): marked on the calendar only; he didn't want separate stats.
const INTERNET_RESTART = new Date(2026, 9, 20) // October 20, 2026
// Mike started logging partial workouts (1/4, 1/2, 3/4 Lifting) here; before it, every gym day
// was plain "Lifting". Lifting stats count from here, the calendar and graph show everything.
const LIFTING_RESTART = new Date(2026, 10, 12) // November 12, 2026

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function shortDate(d) {
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

async function fetchJSON(url, fallback) {
  try {
    const resp = await fetch(url)
    if (resp.ok) return await resp.json()
  } catch (e) {
    console.error(`Failed to load ${url}`, e)
  }
  return fallback
}

function setStat(panel, name, value) {
  panel.querySelector(`[data-stat="${name}"]`).textContent = value
}

// ---- Calendar (shared by every day-by-day tab) ----

// cellClass(dateStr, isToday) returns the status class for a day on or after `start`, or null to
// leave it blank. `markers` are the start dates drawn in blue.
function renderCalendar(container, { start, markers, cellClass }) {
  const today = startOfToday()
  const todayStr = formatDate(today)
  const markerStrs = new Set(markers.map(formatDate))
  container.innerHTML = ''

  for (let first = new Date(start.getFullYear(), start.getMonth(), 1); first <= today;
       first = new Date(first.getFullYear(), first.getMonth() + 1, 1)) {
    const monthEl = document.createElement('div')
    monthEl.className = 'month'
    monthEl.innerHTML = `<div class="month-name">${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}</div>` +
      `<div class="day-headers">${DAY_HEADERS.map(h => `<div class="day-header">${h}</div>`).join('')}</div>`

    const gridEl = document.createElement('div')
    gridEl.className = 'day-grid'
    for (let i = 0; i < first.getDay(); i++) {
      gridEl.insertAdjacentHTML('beforeend', '<div class="day-cell empty"></div>')
    }

    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(first.getFullYear(), first.getMonth(), day)
      const dateStr = formatDate(date)
      const isToday = dateStr === todayStr
      const cell = document.createElement('div')
      cell.className = 'day-cell'
      const status = date < start || date > today ? null : cellClass(dateStr, isToday)
      cell.classList.add(status || 'empty')
      if (isToday) cell.classList.add('today')
      if (markerStrs.has(dateStr)) cell.classList.add('start')
      cell.innerHTML = `<span class="day-number">${day}</span>`
      gridEl.appendChild(cell)
    }
    monthEl.appendChild(gridEl)
    container.appendChild(monthEl)
  }
}

// ---- Clean/bad trackers (gooning, internet) ----

function streakStats(isBad, start) {
  const today = startOfToday()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1) // today is still pending
  let longest = 0
  let run = 0
  let bad = 0
  for (const d = new Date(start); d <= yesterday; d.setDate(d.getDate() + 1)) {
    if (isBad(formatDate(d))) {
      bad++
      run = 0
    } else {
      run++
      longest = Math.max(longest, run)
    }
  }
  const pastDays = Math.round((today - start) / 864e5)
  return { current: run, longest, bad, clean: pastDays - bad }
}

function renderCleanTracker(panel, { start, markers, entries, isBad, extraClass }) {
  const byDate = {}
  for (const e of entries) byDate[e.date] = e
  const bad = dateStr => Boolean(byDate[dateStr] && isBad(byDate[dateStr]))

  const stats = streakStats(bad, start)
  setStat(panel, 'current-streak', stats.current)
  setStat(panel, 'longest-streak', stats.longest)
  setStat(panel, 'clean', stats.clean)
  setStat(panel, 'bad', stats.bad)

  renderCalendar(panel.querySelector('.calendar'), {
    start,
    markers,
    cellClass(dateStr, isToday) {
      if (bad(dateStr)) return 'folded'
      const extra = extraClass && byDate[dateStr] && extraClass(byDate[dateStr])
      if (extra) return extra
      return isToday ? null : 'clean'
    },
  })
}

async function showGooning(panel) {
  renderCleanTracker(panel, {
    start: GOONING_START,
    markers: [GOONING_START],
    entries: await fetchJSON('/api/entries', []),
    isBad: e => e.folded,
    extraClass: e => (e.almost ? 'almost' : null),
  })
}

async function showInternet(panel) {
  renderCleanTracker(panel, {
    start: INTERNET_START,
    markers: [INTERNET_START, INTERNET_RESTART],
    entries: await fetchJSON('/api/internet-entries', []),
    isBad: e => e.relapsed,
  })
}

// ---- Charts ----

// One SVG for both chart types. points: [{ date: Date, value }]; markers: Dates drawn as dashed lines.
function renderChart(container, { points, kind, yMin, yMax, markers = [], formatY }) {
  const W = 900, H = 260, left = 44, right = 12, top = 12, bottom = 28
  const first = points[0].date
  const last = startOfToday()
  const span = Math.max(1, (last - first) / 864e5)
  const x = d => left + ((d - first) / 864e5 / span) * (W - left - right)
  const y = v => top + (1 - (v - yMin) / (yMax - yMin)) * (H - top - bottom)
  const barWidth = Math.max(1.5, (W - left - right) / (span + 1) - 1.5)

  const parts = []
  for (const tick of [yMin, (yMin + yMax) / 2, yMax]) {
    parts.push(`<line class="grid" x1="${left}" x2="${W - right}" y1="${y(tick)}" y2="${y(tick)}"/>`)
    parts.push(`<text class="axis" x="${left - 6}" y="${y(tick) + 4}" text-anchor="end">${formatY(tick)}</text>`)
  }
  for (let m = new Date(first.getFullYear(), first.getMonth() + 1, 1); m <= last; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    parts.push(`<text class="axis" x="${x(m)}" y="${H - 8}" text-anchor="middle">${MONTH_NAMES[m.getMonth()].slice(0, 3)}</text>`)
  }
  for (const m of markers) {
    parts.push(`<line class="marker" x1="${x(m)}" x2="${x(m)}" y1="${top}" y2="${H - bottom}"/>`)
  }
  if (kind === 'bar') {
    for (const p of points) {
      if (!p.value) continue
      parts.push(`<rect class="bar" x="${x(p.date) - barWidth / 2}" y="${y(p.value)}" width="${barWidth}" height="${y(yMin) - y(p.value)}"><title>${shortDate(p.date)}: ${formatY(p.value)}</title></rect>`)
    }
  } else {
    parts.push(`<polyline class="line" points="${points.map(p => `${x(p.date)},${y(p.value)}`).join(' ')}"/>`)
    for (const p of points) {
      parts.push(`<circle class="point" cx="${x(p.date)}" cy="${y(p.value)}" r="3"><title>${shortDate(p.date)}: ${formatY(p.value)}</title></circle>`)
    }
  }
  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img">${parts.join('')}</svg>`
}

// ---- Lifting ----

const LIFT_CLASS = { 0.25: 'lift-1', 0.5: 'lift-2', 0.75: 'lift-3', 1: 'lift-4' }

async function showLifting(panel) {
  const shares = await fetchJSON('/api/lifting', {})
  const dates = Object.keys(shares).sort()
  if (!dates.length) {
    panel.querySelector('.calendar').innerHTML = '<p class="loading">No lifting logged yet.</p>'
    return
  }
  const firstLift = parseDate(dates[0])
  const today = startOfToday()

  let workouts = 0
  let gymDays = 0
  for (const [date, share] of Object.entries(shares)) {
    if (parseDate(date) >= LIFTING_RESTART) {
      workouts += share
      gymDays++
    }
  }
  setStat(panel, 'workouts', Number(workouts.toFixed(2)))
  setStat(panel, 'gym-days', gymDays)
  setStat(panel, 'average', gymDays ? `${Math.round((workouts / gymDays) * 100)}%` : '—')
  setStat(panel, 'all-time', dates.length)
  const dayNumber = Math.round((today - LIFTING_RESTART) / 864e5) + 1
  setStat(panel, 'since', `since ${shortDate(LIFTING_RESTART)} (day ${dayNumber}) · all time since ${shortDate(firstLift)}`)

  const points = []
  for (const d = new Date(firstLift); d <= today; d.setDate(d.getDate() + 1)) {
    points.push({ date: new Date(d), value: shares[formatDate(d)] || 0 })
  }
  renderChart(panel.querySelector('.chart'), {
    points, kind: 'bar', yMin: 0, yMax: 1, markers: [LIFTING_RESTART],
    formatY: v => `${Math.round(v * 100)}%`,
  })

  renderCalendar(panel.querySelector('.calendar'), {
    start: firstLift,
    markers: [firstLift, LIFTING_RESTART],
    cellClass(dateStr, isToday) {
      if (shares[dateStr]) return LIFT_CLASS[shares[dateStr]]
      return isToday ? null : 'rest'
    },
  })
}

// ---- Weight ----

function signed(n) {
  if (n === null) return '—'
  const rounded = Number(n.toFixed(1))
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

async function showWeight(panel) {
  const raw = await fetchJSON('/api/weight', [])
  if (!raw.length) {
    panel.querySelector('.chart').innerHTML = '<p class="loading">No weigh-ins found.</p>'
    return
  }
  const points = raw.map(p => ({ date: parseDate(p.date), value: p.weight }))
  const latest = points[points.length - 1]
  // Change against the most recent weigh-in at least N days before the latest one.
  const changeOver = days => {
    const cutoff = new Date(latest.date)
    cutoff.setDate(cutoff.getDate() - days)
    const earlier = points.filter(p => p.date <= cutoff).pop()
    return earlier ? latest.value - earlier.value : null
  }
  setStat(panel, 'current', latest.value)
  setStat(panel, 'week', signed(changeOver(7)))
  setStat(panel, 'month', signed(changeOver(30)))
  setStat(panel, 'entries', points.length)

  const values = points.map(p => p.value)
  const pad = 2
  renderChart(panel.querySelector('.chart'), {
    points, kind: 'line',
    yMin: Math.floor(Math.min(...values) - pad), yMax: Math.ceil(Math.max(...values) + pad),
    formatY: v => `${Number(v.toFixed(1))}`,
  })
}

// ---- Tabs ----

const TABS = { gooning: showGooning, internet: showInternet, lifting: showLifting, weight: showWeight }
const loaded = new Set()

function showTab() {
  const name = TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'gooning'
  for (const link of document.querySelectorAll('.tabs a')) {
    link.classList.toggle('active', link.dataset.tab === name)
  }
  for (const tab of Object.keys(TABS)) {
    document.getElementById(`panel-${tab}`).hidden = tab !== name
  }
  // Each tab fetches once, on first view, so opening the site doesn't wait on all four sources.
  if (!loaded.has(name)) {
    loaded.add(name)
    TABS[name](document.getElementById(`panel-${name}`))
  }
}

window.addEventListener('hashchange', showTab)
showTab()
