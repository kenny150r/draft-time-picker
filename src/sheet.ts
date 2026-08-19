import { deleteAvailability, listResponses, memberKey, saveAvailability, type DraftResponse } from './db.ts'
import { formatSlot, groupDays, prettyDate, SLOTS, WEEK_LABELS } from './slots.ts'

type Tab = 'enter' | 'league'

type State = {
  tab: Tab
  name: string
  selected: Set<string>
  rows: DraftResponse[]
  status: string
  error: string
  saving: boolean
}

const DAYS = groupDays()
const state: State = {
  tab: 'enter',
  name: '',
  selected: new Set(),
  rows: [],
  status: 'Loading league sheet...',
  error: '',
  saving: false,
}

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function eveningIds(): string[] {
  return SLOTS.filter((s) => s.hour >= 18).map((s) => s.id)
}

function rankedSlots(): { id: string; names: string[] }[] {
  const counts = new Map<string, string[]>()
  for (const slot of SLOTS) counts.set(slot.id, [])
  for (const row of state.rows) {
    for (const id of row.available_slot_ids) counts.get(id)?.push(row.display_name)
  }
  return [...counts.entries()]
    .map(([id, names]) => ({ id, names }))
    .sort((a, b) => {
      if (b.names.length !== a.names.length) return b.names.length - a.names.length
      return a.id.localeCompare(b.id)
    })
}

function slotSheet(selected: Set<string>, act: string): string {
  const weeks = WEEK_LABELS.map((label, week) => {
    const days = DAYS.filter((d) => d.slots[0]?.week === week)
    const rows = days
      .map((day) => {
        const boxes = day.slots
          .map((s) => {
            const on = selected.has(s.id)
            const boxId = `${act}-${s.id.replace(/[^a-zA-Z0-9]/g, '-')}`
            return `<div class="field-row time-check">
              <input id="${boxId}" type="checkbox" data-act="${act}" data-id="${s.id}" ${on ? 'checked' : ''}>
              <label for="${boxId}">${s.time}</label>
            </div>`
          })
          .join('')
        return `<div class="day-row"><span class="day-name">${prettyDate(day.date, day.weekday)}</span><span class="time-checks">${boxes}</span></div>`
      })
      .join('')
    return `<section class="week-block"><h3>${label}</h3>${rows}</section>`
  }).join('')
  return `<div class="slot-sheet">${weeks}</div>`
}

function enterView(): string {
  return `
    <p>Type your name, check every window you can do, and save. All times are <strong>Pacific</strong>.</p>
    <div class="field-row-stacked">
      <label for="sheet-name">Name:</label>
      <input id="sheet-name" type="text" maxlength="80" value="${esc(state.name)}" data-act="name" />
    </div>
    ${slotSheet(state.selected, 'toggle')}
    <div class="dlg-btns">
      <button type="button" data-act="weeknights">Weeknights</button>
      <button type="button" data-act="clear">Clear</button>
      <button type="button" class="default" data-act="save" ${state.saving ? 'disabled' : ''}>Save</button>
    </div>`
}

function leagueView(): string {
  const ranked = rankedSlots()
  const best = ranked.find((s) => s.names.length > 0)
  const people = [...state.rows].sort((a, b) => a.display_name.localeCompare(b.display_name))
  const head = people
    .map(
      (row) => `<th>
        <div class="sheet-name">${esc(row.display_name)}</div>
        <button type="button" class="sheet-del" data-act="remove" data-key="${esc(row.member_key ?? memberKey(row.display_name))}">Remove</button>
      </th>`,
    )
    .join('')
  const body = WEEK_LABELS.map((label, week) => {
    const days = DAYS.filter((d) => d.slots[0]?.week === week)
    const rows = days.flatMap((day) =>
      day.slots.map((slot) => {
        const cells = people
          .map((row) => {
            const on = row.available_slot_ids.includes(slot.id)
            const key = row.member_key ?? memberKey(row.display_name)
            return `<td class="${on ? 'on' : ''}">
              <button type="button" class="sheet-cell ${on ? 'on' : ''}" data-act="cell" data-key="${esc(key)}" data-id="${slot.id}" aria-pressed="${on}">${on ? '●' : ''}</button>
            </td>`
          })
          .join('')
        const n = people.filter((row) => row.available_slot_ids.includes(slot.id)).length
        return `<tr>
          <th class="sheet-slot">${prettyDate(day.date, day.weekday)} · ${slot.time}</th>
          ${cells}
          <td class="sheet-count">${n}</td>
        </tr>`
      }),
    )
    return `<tr class="sheet-week"><th colspan="${people.length + 2}">${label}</th></tr>${rows.join('')}`
  }).join('')
  return `
    <p class="sheet-best">${
      best
        ? `Leading window: <strong>${esc(formatSlot(best.id))}</strong> — ${best.names.length} (${esc(best.names.join(', '))})`
        : 'No times checked yet. Add someone, or use Enter my times.'
    }</p>
    <div class="field-row sheet-add">
      <label for="add-name">Add / update person:</label>
      <input id="add-name" type="text" maxlength="80" placeholder="Name" />
      <button type="button" data-act="add">Add</button>
    </div>
    <div class="sheet-scroll">
      <table class="sheet-grid">
        <thead>
          <tr>
            <th class="sheet-slot">Pacific time</th>
            ${head}
            <th>#</th>
          </tr>
        </thead>
        <tbody>${people.length ? body : '<tr><td colspan="2">Nobody on the sheet yet.</td></tr>'}</tbody>
      </table>
    </div>`
}

function chrome(): string {
  return `
    <div class="desktop sheet-desktop">
      <div class="window dialog-win slots-win sheet-win" data-window="main">
        <div class="title-bar">
          <div class="title-bar-text">Boger Bowl Availability — League Sheet</div>
          <div class="title-bar-controls">
            <button type="button" aria-label="Minimize" disabled></button>
            <button type="button" aria-label="Maximize" disabled></button>
            <button type="button" aria-label="Close" disabled></button>
          </div>
        </div>
        <div class="window-body sheet-body">
          <menu role="tablist" class="sheet-tabs">
            <button type="button" role="tab" class="${state.tab === 'enter' ? 'active' : ''}" data-act="tab-enter">Enter my times</button>
            <button type="button" role="tab" class="${state.tab === 'league' ? 'active' : ''}" data-act="tab-league">League sheet</button>
          </menu>
          <div class="sheet-pane">${state.tab === 'enter' ? enterView() : leagueView()}</div>
        </div>
        <div class="status-bar">
          <p class="status-bar-field">${esc(state.error || state.status)}</p>
        </div>
      </div>
    </div>`
}

function render(): void {
  const app = document.getElementById('app')
  if (!app) return
  const name = state.tab === 'enter' ? (document.getElementById('sheet-name') as HTMLInputElement | null)?.value : state.name
  if (name !== undefined) state.name = name
  app.innerHTML = chrome()
  if (state.tab === 'enter') {
    const input = document.getElementById('sheet-name') as HTMLInputElement | null
    if (input && !input.value) input.focus()
  }
}

async function refresh(message = 'League sheet loaded.'): Promise<void> {
  state.rows = await listResponses()
  state.status = `${message} ${state.rows.length} player${state.rows.length === 1 ? '' : 's'}. All times Pacific.`
  state.error = ''
  render()
}

async function saveCurrent(): Promise<void> {
  const input = document.getElementById('sheet-name') as HTMLInputElement | null
  if (input) state.name = input.value
  const name = state.name.trim()
  if (name.length < 2) {
    state.error = 'Need a name with at least two letters.'
    render()
    return
  }
  if (state.selected.size < 1) {
    state.error = 'Check at least one window.'
    render()
    return
  }
  state.saving = true
  state.error = ''
  state.status = 'Saving...'
  render()
  try {
    await saveAvailability({
      display_name: name,
      member_key: memberKey(name),
      available_slot_ids: [...state.selected],
    })
    state.saving = false
    await refresh(`Saved ${name}.`)
  } catch (err) {
    state.saving = false
    state.error = err instanceof Error ? err.message : 'Save failed.'
    render()
  }
}

async function toggleCell(key: string, slotId: string): Promise<void> {
  const row = state.rows.find((r) => (r.member_key ?? memberKey(r.display_name)) === key)
  if (!row) return
  const next = new Set(row.available_slot_ids)
  if (next.has(slotId)) next.delete(slotId)
  else next.add(slotId)
  row.available_slot_ids = [...next]
  render()
  state.status = `Saving ${row.display_name}...`
  try {
    await saveAvailability({
      display_name: row.display_name,
      member_key: key,
      available_slot_ids: row.available_slot_ids,
    })
    state.status = `Updated ${row.display_name}.`
    const bar = document.querySelector('.status-bar-field')
    if (bar) bar.textContent = state.status
  } catch (err) {
    state.error = err instanceof Error ? err.message : 'Save failed.'
    await refresh()
  }
}

async function addPerson(): Promise<void> {
  const input = document.getElementById('add-name') as HTMLInputElement | null
  const name = input?.value.trim() ?? ''
  if (name.length < 2) {
    state.error = 'Need a name with at least two letters.'
    render()
    return
  }
  const key = memberKey(name)
  const existing = state.rows.find((r) => (r.member_key ?? memberKey(r.display_name)) === key)
  if (existing) {
    state.tab = 'enter'
    state.name = existing.display_name
    state.selected = new Set(existing.available_slot_ids)
    state.status = `${existing.display_name} is already on the sheet. Edit and save.`
    state.error = ''
    render()
    return
  }
  try {
    await saveAvailability({
      display_name: name,
      member_key: key,
      available_slot_ids: [],
    })
    if (input) input.value = ''
    await refresh(`Added ${name}. Click cells to mark times.`)
  } catch (err) {
    state.error = err instanceof Error ? err.message : 'Could not add person.'
    render()
  }
}

async function removePerson(key: string): Promise<void> {
  const row = state.rows.find((r) => (r.member_key ?? memberKey(r.display_name)) === key)
  const label = row?.display_name ?? key
  if (!window.confirm(`Remove ${label} from the league sheet?`)) return
  try {
    await deleteAvailability(key)
    await refresh(`Removed ${label}.`)
  } catch (err) {
    state.error = err instanceof Error ? err.message : 'Could not remove.'
    render()
  }
}

function handle(act: string, el: HTMLElement): void {
  switch (act) {
    case 'tab-enter':
      state.tab = 'enter'
      state.error = ''
      render()
      break
    case 'tab-league':
      state.tab = 'league'
      state.error = ''
      render()
      break
    case 'toggle': {
      const id = el.dataset.id ?? ''
      const on = el instanceof HTMLInputElement ? el.checked : false
      if (on) state.selected.add(id)
      else state.selected.delete(id)
      break
    }
    case 'weeknights':
      for (const id of eveningIds()) state.selected.add(id)
      render()
      break
    case 'clear':
      state.selected = new Set()
      render()
      break
    case 'save':
      void saveCurrent()
      break
    case 'add':
      void addPerson()
      break
    case 'remove':
      void removePerson(el.dataset.key ?? '')
      break
    case 'cell':
      void toggleCell(el.dataset.key ?? '', el.dataset.id ?? '')
      break
    default:
      break
  }
}

export function mountSheet(el: HTMLElement): void {
  document.body.classList.add('sheet-page')
  document.title = 'Boger Bowl Availability Sheet'
  el.addEventListener('click', (ev) => {
    const actEl = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]')
    if (!actEl) return
    const act = actEl.dataset.act ?? ''
    if (act === 'toggle' || act === 'name') return
    ev.preventDefault()
    handle(act, actEl)
  })
  el.addEventListener('change', (ev) => {
    const t = ev.target as HTMLElement
    if (t instanceof HTMLInputElement && t.dataset.act === 'toggle') handle('toggle', t)
  })
  el.addEventListener('input', (ev) => {
    const t = ev.target as HTMLElement
    if (t.id === 'sheet-name') state.name = (t as HTMLInputElement).value
  })
  el.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return
    const t = ev.target as HTMLElement
    if (t.id === 'sheet-name') {
      ev.preventDefault()
      void saveCurrent()
    }
    if (t.id === 'add-name') {
      ev.preventDefault()
      void addPerson()
    }
  })
  render()
  void refresh().catch((err: unknown) => {
    state.error = err instanceof Error ? err.message : 'Could not load the sheet.'
    render()
  })
}
