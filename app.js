const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const DAY_HEADERS = ['Su','Mo','Tu','We','Th','Fr','Sa']

const GOONING_START = new Date(2026, 4, 6) // May 6, 2026
const INTERNET_START = new Date(2026, 5, 30) // June 30, 2026 - stats count from here
// Second internet start (Mike, 2026-11-12): marked on the calendar only; he didn't want separate stats.
const INTERNET_RESTART = new Date(2026, 9, 20) // October 20, 2026
const LIFTING_START = new Date(2026, 5, 1) // June 1, 2026 - first "Lifting" tag in the Energy Tracker
// Mike started logging partial workouts (1/4, 1/2, 3/4 Lifting) here; before it, every gym day
// was plain "Lifting". Lifting stats and the bar graph count from here.
const LIFTING_RESTART = new Date(2026, 10, 12) // November 12, 2026
// One calendar is shared by every day-by-day tab and stays put when switching tabs (Mike,
// 2026-11-12), so it spans from the earliest tracker's start; days before a tab's own start are blank.
const CALENDAR_START = GOONING_START

// Trips and other things that explain a stretch of days. Dates come from Mike's photo folders
// (footage\personal), converted to Central time. `tabs` limits an event to some tabs. All events
// share one marker; hovering a day names it (Mike, 2026-11-12: no color per event).
const EVENTS = [
  { label: 'Yellowstone', start: '2026-05-22', end: '2026-05-25' },
  { label: 'Guatemala with friends', start: '2026-06-10', end: '2026-06-14' },
  { label: 'lifting injury', start: '2026-07-16', end: '2026-07-27', tabs: ['lifting'] },
  { label: "Denver, sister's engagement", start: '2026-09-26', end: '2026-09-27' },
]

// Chart time frames; "all" starts at the chart's own first day.
const RANGES = [['All', null], ['1M', 30], ['3M', 91], ['1Y', 365]]

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

function daysBefore(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() - days)
  return d
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

// ---- Events ----

function eventsFor(tab) {
  return EVENTS.filter(e => !e.tabs || e.tabs.includes(tab))
}

function eventTitle(e) {
  return `${e.label} (${shortDate(parseDate(e.start))}–${shortDate(parseDate(e.end))})`
}

// ---- Calendar ----

// cellClass(dateStr, isToday) returns the status class for a day on or after `start`, or null to
// leave it blank. `markers` are the start dates drawn in blue.
function renderCalendar({ tab, start, markers, cellClass }) {
  const container = document.getElementById('calendar')
  const today = startOfToday()
  const todayStr = formatDate(today)
  const markerStrs = new Set(markers.map(formatDate))
  const events = eventsFor(tab)
  container.innerHTML = ''

  for (let first = new Date(CALENDAR_START.getFullYear(), CALENDAR_START.getMonth(), 1); first <= today;
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
      const event = events.find(e => e.start <= dateStr && dateStr <= e.end)
      if (event) {
        cell.classList.add('event')
        cell.dataset.event = EVENTS.indexOf(event)
        cell.title = eventTitle(event)
      }
      cell.innerHTML = `<span class="day-number">${day}</span>`
      gridEl.appendChild(cell)
    }
    monthEl.appendChild(gridEl)
    container.appendChild(monthEl)
  }
}

// ---- Chart ----

// One SVG for both chart types, over [from, today]. points: [{ date: Date, value }]; `trend`
// (same shape, optional) is drawn as a solid line over a line chart's faint day-to-day one.
function renderChart({ points, from, kind, yMin, yMax, formatY, trend = [] }) {
  const W = 900, H = 260, left = 44, right = 12, top = 12, bottom = 28
  const last = startOfToday()
  const span = Math.max(1, Math.round((last - from) / 864e5))
  const x = d => left + ((d - from) / 864e5 / span) * (W - left - right)
  const y = v => top + (1 - (v - yMin) / (yMax - yMin)) * (H - top - bottom)
  const barWidth = Math.max(1.5, Math.min(24, (W - left - right) / (span + 1) - 1.5))

  const parts = []
  for (const tick of [yMin, (yMin + yMax) / 2, yMax]) {
    parts.push(`<line class="grid" x1="${left}" x2="${W - right}" y1="${y(tick)}" y2="${y(tick)}"/>`)
    parts.push(`<text class="axis" x="${left - 6}" y="${y(tick) + 4}" text-anchor="end">${formatY(tick)}</text>`)
  }
  // Weekly date labels for short ranges, month names for long ones.
  if (span <= 100) {
    for (let d = new Date(from); d <= last; d.setDate(d.getDate() + 7)) {
      parts.push(`<text class="axis" x="${x(d)}" y="${H - 8}" text-anchor="middle">${shortDate(d)}</text>`)
    }
  } else {
    for (let m = new Date(from.getFullYear(), from.getMonth() + 1, 1); m <= last; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      parts.push(`<text class="axis" x="${x(m)}" y="${H - 8}" text-anchor="middle">${MONTH_NAMES[m.getMonth()].slice(0, 3)}</text>`)
    }
  }
  const visible = points.filter(p => p.date >= from)
  if (kind === 'bar') {
    for (const p of visible) {
      if (!p.value) continue
      parts.push(`<rect class="bar" x="${x(p.date) - barWidth / 2}" y="${y(p.value)}" width="${barWidth}" height="${y(yMin) - y(p.value)}"><title>${shortDate(p.date)}: ${formatY(p.value)}</title></rect>`)
    }
  } else {
    parts.push(`<polyline class="line${trend.length ? ' faint' : ''}" points="${visible.map(p => `${x(p.date)},${y(p.value)}`).join(' ')}"/>`)
    const trendVisible = trend.filter(p => p.date >= from)
    if (trendVisible.length) {
      parts.push(`<polyline class="trend" points="${trendVisible.map(p => `${x(p.date)},${y(p.value)}`).join(' ')}"/>`)
    }
    for (const p of visible) {
      parts.push(`<circle class="point" cx="${x(p.date)}" cy="${y(p.value)}" r="3"><title>${shortDate(p.date)}: ${formatY(p.value)}</title></circle>`)
    }
  }
  document.getElementById('chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img">${parts.join('')}</svg>`
}

// Average of the weigh-ins in the `days` days up to and including each one - daily weight swings
// a pound or two on water alone, so this is what shows the real direction (Mike, 2026-11-12).
function rollingAverage(points, days) {
  return points.map(p => {
    const window = points.filter(q => q.date <= p.date && q.date > daysBefore(p.date, days))
    return { date: p.date, value: window.reduce((sum, q) => sum + q.value, 0) / window.length }
  })
}

// Range buttons above the chart; draw(from) redraws it for the chosen time frame. Each chart keeps
// its own choice. Defaults (Mike, 2026-11-12): weight opens on All, lifting on the past month.
const selectedRange = { lifting: '1M', weight: 'All' }
function renderRangeTabs(chart, firstDay, draw) {
  const container = document.getElementById('range-tabs')
  const today = startOfToday()
  const fromFor = name => {
    const days = RANGES.find(([n]) => n === name)[1]
    return days === null ? firstDay : daysBefore(today, days - 1)
  }
  container.innerHTML = RANGES.map(([name]) =>
    `<button type="button" data-range="${name}" class="${name === selectedRange[chart] ? 'active' : ''}">${name}</button>`).join('')
  container.onclick = e => {
    const name = e.target.dataset.range
    if (!name) return
    selectedRange[chart] = name
    for (const b of container.children) b.classList.toggle('active', b.dataset.range === name)
    draw(fromFor(name))
  }
  draw(fromFor(selectedRange[chart]))
}

// ---- Clean/bad trackers (gooning, internet) ----

function streakStats(isBad, start) {
  const today = startOfToday()
  const yesterday = daysBefore(today, 1) // today is still pending
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

function cleanTracker({ url, start, markers, isBad, extraClass }) {
  return {
    load: () => fetchJSON(url, []),
    show(panel, entries, tab) {
      const byDate = {}
      for (const e of entries) byDate[e.date] = e
      const bad = dateStr => Boolean(byDate[dateStr] && isBad(byDate[dateStr]))

      const stats = streakStats(bad, start)
      setStat(panel, 'current-streak', stats.current)
      setStat(panel, 'longest-streak', stats.longest)
      setStat(panel, 'clean', stats.clean)
      setStat(panel, 'bad', stats.bad)

      renderCalendar({
        tab, start, markers,
        cellClass(dateStr, isToday) {
          if (bad(dateStr)) return 'folded'
          const extra = extraClass && byDate[dateStr] && extraClass(byDate[dateStr])
          if (extra) return extra
          return isToday ? null : 'clean'
        },
      })
    },
  }
}

// ---- Lifting ----

const LIFT_CLASS = { 0.25: 'lift-1', 0.5: 'lift-2', 0.75: 'lift-3', 1: 'lift-4' }

const lifting = {
  load: () => fetchJSON('/api/lifting', {}),
  show(panel, shares, tab) {
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
    setStat(panel, 'all-time', Object.keys(shares).length)
    const dayNumber = Math.round((today - LIFTING_RESTART) / 864e5) + 1
    setStat(panel, 'since', `since ${shortDate(LIFTING_RESTART)} (day ${dayNumber}) · all time since ${shortDate(LIFTING_START)}`)

    renderCalendar({
      tab, start: LIFTING_START, markers: [LIFTING_START, LIFTING_RESTART],
      cellClass(dateStr, isToday) {
        if (shares[dateStr]) return LIFT_CLASS[shares[dateStr]]
        return isToday ? null : 'rest'
      },
    })

    // Only from the second start: before it every gym day was logged as a full workout, so
    // the bars would say nothing (Mike, 2026-11-12).
    const points = []
    for (const d = new Date(LIFTING_RESTART); d <= today; d.setDate(d.getDate() + 1)) {
      points.push({ date: new Date(d), value: shares[formatDate(d)] || 0 })
    }
    renderRangeTabs('lifting', LIFTING_RESTART, from => renderChart({
      points, from, kind: 'bar', yMin: 0, yMax: 1, formatY: v => `${Math.round(v * 100)}%`,
    }))
  },
}

// ---- Weight ----

function signed(n) {
  if (n === null) return '—'
  const rounded = Number(n.toFixed(1))
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

const weight = {
  chartOnly: true,
  load: () => fetchJSON('/api/weight', []),
  show(panel, raw) {
    if (!raw.length) {
      document.getElementById('chart').innerHTML = '<p class="loading">No weigh-ins found.</p>'
      return
    }
    const points = raw.map(p => ({ date: parseDate(p.date), value: p.weight }))
    const latest = points[points.length - 1]
    // Change against the most recent weigh-in at least N days before the latest one.
    const changeOver = days => {
      const earlier = points.filter(p => p.date <= daysBefore(latest.date, days)).pop()
      return earlier ? latest.value - earlier.value : null
    }
    setStat(panel, 'current', latest.value)
    setStat(panel, 'week', signed(changeOver(7)))
    setStat(panel, 'month', signed(changeOver(30)))
    setStat(panel, 'entries', points.length)

    const trend = rollingAverage(points, 7)
    document.getElementById('chart-note').textContent = 'dots: weigh-ins · line: 7-day average'
    renderRangeTabs('weight', points[0].date, from => {
      const values = points.filter(p => p.date >= from).map(p => p.value)
      if (!values.length) values.push(latest.value)
      renderChart({
        points, from, kind: 'line', trend,
        yMin: Math.floor(Math.min(...values) - 1), yMax: Math.ceil(Math.max(...values) + 1),
        formatY: v => `${Number(v.toFixed(1))}`,
      })
    })
  },
}

// ---- Tabs ----

const TABS = {
  gooning: cleanTracker({
    url: '/api/entries', start: GOONING_START, markers: [GOONING_START],
    isBad: e => e.folded, extraClass: e => (e.almost ? 'almost' : null),
  }),
  internet: cleanTracker({
    url: '/api/internet-entries', start: INTERNET_START, markers: [INTERNET_START, INTERNET_RESTART],
    isBad: e => e.relapsed,
  }),
  lifting,
  weight,
}
// Each tab's data is fetched once, on first view; switching back redraws from the cache.
const loads = {}

async function showTab() {
  const name = TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'gooning'
  const tracker = TABS[name]
  for (const link of document.querySelectorAll('.tabs a')) {
    link.classList.toggle('active', link.dataset.tab === name)
  }
  for (const tab of Object.keys(TABS)) {
    document.getElementById(`panel-${tab}`).hidden = tab !== name
  }
  document.getElementById('calendar').hidden = Boolean(tracker.chartOnly)
  document.getElementById('events-legend').hidden = Boolean(tracker.chartOnly)
  document.getElementById('chart-block').hidden = name !== 'lifting' && name !== 'weight'
  document.getElementById('chart-note').textContent = ''

  loads[name] ??= tracker.load()
  const data = await loads[name]
  // A quick second click could land before this one's data; only draw the tab still selected.
  if (location.hash.slice(1) === name || (name === 'gooning' && !TABS[location.hash.slice(1)])) {
    tracker.show(document.getElementById(`panel-${name}`), data, name)
  }
}

// Hovering one day of an event lights up all of its days, so the whole stretch reads as one thing
// (Mike, 2026-11-12). Delegated, since the calendar is rebuilt on every tab switch.
function highlightEvent(e, on) {
  const id = e.target.closest('.day-cell.event')?.dataset.event
  if (id === undefined) return
  for (const cell of document.querySelectorAll(`.day-cell[data-event="${id}"]`)) {
    cell.classList.toggle('event-hover', on)
  }
}
const calendarEl = document.getElementById('calendar')
calendarEl.addEventListener('mouseover', e => highlightEvent(e, true))
calendarEl.addEventListener('mouseout', e => highlightEvent(e, false))

window.addEventListener('hashchange', showTab)
showTab()
