import { chord, chordSad, ding, unlockAudio } from './audio.ts'
import { listResponses, submitAvailability, type DraftResponse } from './db.ts'
import { formatSlot, prettyDate, SLOTS, type Slot } from './slots.ts'

type Step =
  | 'boot'
  | 'desktop'
  | 'welcome'
  | 'hang'
  | 'license'
  | 'name'
  | 'didyoumean'
  | 'dll'
  | 'modem'
  | 'timezone'
  | 'day'
  | 'confirm'
  | 'copy'
  | 'writeprotect'
  | 'finish'
  | 'bsod'
  | 'results'

type Overlay = 'help' | 'cantclose' | 'exit' | 'exit-no' | 'run' | 'shutdown' | null

type Day = {
  date: string
  weekday: string
  slots: Slot[]
}

function groupDays(): Day[] {
  const map = new Map<string, Slot[]>()
  for (const slot of SLOTS) {
    const list = map.get(slot.date) ?? []
    list.push(slot)
    map.set(slot.date, list)
  }
  return [...map.entries()].map(([date, slots]) => ({
    date,
    weekday: slots[0]?.weekday ?? '',
    slots,
  }))
}

const DAYS = groupDays()

const HELP =
  'Cannot open Help file.\n\nC:\\WINDOWS\\HELP\\BOGER.HLP\n\nMake sure the file exists and that you have a working copy of Windows.'

type State = {
  step: Step
  overlay: Overlay
  minimized: boolean
  startOpen: boolean
  name: string
  pending: Set<string>
  selected: Set<string>
  dayIndex: number
  dllTries: number
  copyTries: number
  progress: number
  restartNow: boolean
  noAgree: boolean
  tzOk: boolean
  rage: number
  dialogs: number
  startedAt: number
  results: DraftResponse[] | null
  error: string
  sending: boolean
}

const state: State = {
  step: 'boot',
  overlay: null,
  minimized: false,
  startOpen: false,
  name: '',
  pending: new Set(),
  selected: new Set(),
  dayIndex: 0,
  dllTries: 0,
  copyTries: 0,
  progress: 0,
  restartNow: true,
  noAgree: false,
  tzOk: false,
  rage: 0,
  dialogs: 0,
  startedAt: Date.now(),
  results: null,
  error: '',
  sending: false,
}

let timers: number[] = []
let drag: { dx: number; dy: number } | null = null

function later(fn: () => void, ms: number): void {
  timers.push(window.setTimeout(fn, ms))
}

function clearTimers(): void {
  for (const id of timers) window.clearTimeout(id)
  timers = []
}

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function slug(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return s || 'member'
}

function mangled(name: string): string {
  const t = name.trim()
  if (/boger/i.test(t)) return t.replace(/boger/gi, 'Booger')
  if (t.length < 2) return 'Player 2'
  const chars = [...t]
  const i = Math.max(0, chars.length - 2)
  const a = chars[i]
  const b = chars[i + 1]
  if (a && b) {
    chars[i] = b
    chars[i + 1] = a
  }
  return chars.join('')
}

function eveningIds(day: Day): string[] {
  return day.slots.filter((s) => s.hour >= 18).map((s) => s.id)
}

function icon(kind: 'info' | 'error' | 'warning' | 'question'): string {
  const map = {
    info: `<svg class="dlg-icon" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" fill="#c0c0c0"/><circle cx="16" cy="16" r="13" fill="#000080"/><text x="16" y="22" text-anchor="middle" font-size="18" font-family="serif" fill="#fff">i</text></svg>`,
    error: `<svg class="dlg-icon" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" fill="#c0c0c0"/><circle cx="16" cy="16" r="13" fill="#800000"/><text x="16" y="23" text-anchor="middle" font-size="18" font-weight="700" fill="#fff">X</text></svg>`,
    warning: `<svg class="dlg-icon" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" fill="#c0c0c0"/><polygon points="16,3 30,28 2,28" fill="#ff0" stroke="#000"/><text x="16" y="25" text-anchor="middle" font-size="16" font-weight="700">!</text></svg>`,
    question: `<svg class="dlg-icon" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" fill="#c0c0c0"/><circle cx="16" cy="16" r="13" fill="#008080"/><text x="16" y="22" text-anchor="middle" font-size="18" font-weight="700" fill="#fff">?</text></svg>`,
  }
  return map[kind]
}

function winFlag(): string {
  return `<span class="flag" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`
}

function dialog(opts: {
  title: string
  icon?: 'info' | 'error' | 'warning' | 'question'
  body: string
  buttons: { label: string; act: string; def?: boolean; disabled?: boolean }[]
  extra?: string
  status?: string
}): string {
  const buttons = opts.buttons
    .map(
      (b) =>
        `<button type="button" class="${b.def ? 'default' : ''}" data-act="${b.act}" ${b.disabled ? 'disabled' : ''}>${esc(b.label)}</button>`,
    )
    .join('')
  return `
    <div class="window dialog-win" data-window="main">
      <div class="title-bar" data-drag>
        <div class="title-bar-text">${esc(opts.title)}</div>
        <div class="title-bar-controls">
          <button type="button" aria-label="Minimize" data-act="min"></button>
          <button type="button" aria-label="Maximize" data-act="max"></button>
          <button type="button" aria-label="Close" data-act="x"></button>
        </div>
      </div>
      <div class="window-body">
        <div class="dlg-row">
          ${opts.icon ? icon(opts.icon) : ''}
          <div class="dlg-copy">${opts.body}</div>
        </div>
        ${opts.extra ?? ''}
        <div class="dlg-btns">${buttons}</div>
      </div>
      ${opts.status ? `<div class="status-bar"><p class="status-bar-field">${esc(opts.status)}</p></div>` : ''}
    </div>`
}

function overlayWin(title: string, body: string, buttons: { label: string; act: string; def?: boolean }[]): string {
  const btns = buttons
    .map((b) => `<button type="button" class="${b.def ? 'default' : ''}" data-act="${b.act}">${esc(b.label)}</button>`)
    .join('')
  return `
    <div class="modal-scrim">
      <div class="window overlay-win">
        <div class="title-bar">
          <div class="title-bar-text">${esc(title)}</div>
          <div class="title-bar-controls">
            <button type="button" aria-label="Close" data-act="overlay-x"></button>
          </div>
        </div>
        <div class="window-body">
          <div class="dlg-row">
            ${icon('warning')}
            <div class="dlg-copy">${body}</div>
          </div>
          <div class="dlg-btns">${btns}</div>
        </div>
      </div>
    </div>`
}

function currentView(): string {
  switch (state.step) {
    case 'welcome':
      return dialog({
        title: 'Boger Bowl Draft Time Setup Wizard',
        icon: 'info',
        body: `<p>Welcome to the Boger Bowl Draft Time Setup Wizard.</p><p>This wizard will help you tell the commissioner when you can draft. It will not be fast. It will not be pleasant. It is, however, certified for Windows 95.</p><p>All times are Pacific. Click Next to continue.</p>`,
        buttons: [
          { label: '< Back', act: 'noop', disabled: true },
          { label: 'Cancel', act: 'try-exit' },
          { label: 'Next >', act: 'to-hang', def: true },
        ],
        status: 'Setup has not begun, but it is already disappointed.',
      })
    case 'hang':
      return dialog({
        title: 'BogerBowl.exe',
        icon: 'error',
        body: `<p><strong>This program has performed an illegal operation and will be shut down.</strong></p><p>If the problem persists, contact the commissioner. Do not contact Microsoft. They have suffered enough.</p>`,
        extra: `<button type="button" data-act="details">Details &gt;&gt;</button><pre class="details hidden" id="details">BOGERBOWL caused a General Protection Fault in
module TIMES.DRV at 0002:1A4F.
Registers:
EAX=00000006  EBX=00000700
ECX=DECAFBAD  EDX=00000000
Stack dump: 6PM 7PM 9AM 1PM PT PT PT</pre>`,
        buttons: [
          { label: 'Close', act: 'to-license', def: true },
          { label: 'Help', act: 'help' },
        ],
      })
    case 'license':
      return dialog({
        title: 'Software License Agreement',
        icon: 'warning',
        body: `<p>Please read the following license agreement.</p>`,
        extra: `<textarea readonly class="license">${LICENSE}</textarea>
          <div class="field-row">
            <input type="checkbox" id="agree" data-act="fake-agree">
            <label for="agree">I agree to these terms</label>
          </div>
          <div class="field-row">
            <input type="checkbox" id="noagree" data-act="no-agree" ${state.noAgree ? 'checked' : ''}>
            <label for="noagree">I have not read this and that is fine</label>
          </div>`,
        buttons: [
          { label: '< Back', act: 'to-hang' },
          { label: 'Next >', act: 'to-name', def: true, disabled: !state.noAgree },
          { label: 'Cancel', act: 'try-exit' },
        ],
      })
    case 'name':
      return dialog({
        title: 'User Information',
        body: `<p>Type your name as you would like it to appear on the league printout.</p><p>Company is not optional. It has already been filled in.</p>`,
        extra: `<div class="field-row-stacked">
            <label for="name">Name:</label>
            <input id="name" type="text" maxlength="80" value="${esc(state.name)}" data-act="name" />
          </div>
          <div class="field-row-stacked">
            <label>Company:</label>
            <input type="text" value="Boger Bowl LLC" readonly />
          </div>`,
        buttons: [
          { label: 'Browse...', act: 'browse' },
          { label: 'Next >', act: 'to-mean', def: true },
          { label: 'Cancel', act: 'try-exit' },
        ],
      })
    case 'didyoumean':
      return dialog({
        title: 'AutoCorrect',
        icon: 'question',
        body: `<p>Did you mean:</p><p class="big-name">“${esc(mangled(state.name))}”</p><p>Windows is reasonably sure this is your name.</p>`,
        buttons: [
          { label: 'Yes', act: 'mean-yes', def: true },
          { label: 'No', act: 'mean-no' },
          { label: 'Help', act: 'help' },
        ],
      })
    case 'dll':
      return dialog({
        title: 'BogerBowl.exe - Unable To Locate Component',
        icon: 'error',
        body: `<p>This application has failed to start because <strong>BOGER32.DLL</strong> was not found. Re-installing the application may fix this problem. It will not.</p><p>Retries: ${state.dllTries}</p>`,
        buttons: [
          { label: 'Abort', act: 'dll-abort' },
          { label: 'Retry', act: 'dll-retry', def: true },
          { label: 'Ignore', act: 'dll-ignore' },
        ],
      })
    case 'modem':
      return dialog({
        title: 'Dial-Up Networking',
        icon: 'question',
        body: `<p>Setup needs to connect to League Headquarters (1-800-BOGER) to continue.</p><p>Are you connected to the Internet?</p>`,
        buttons: [
          { label: 'Yes', act: 'modem-yes', def: true },
          { label: 'No', act: 'modem-no' },
          { label: 'Help', act: 'help' },
        ],
      })
    case 'timezone':
      return dialog({
        title: 'Date/Time Properties',
        body: `<p>All draft times are Pacific. If you are in Arizona, you are still not in Pacific. If you are in Mountain, do not “just add an hour in your head.” We will add it incorrectly for you.</p>`,
        extra: `<fieldset>
            <legend>Time zone</legend>
            <div class="field-row">
              <input id="tz1" type="radio" name="tz" data-act="tz" ${state.tzOk ? 'checked' : ''}>
              <label for="tz1">(GMT-08:00) Pacific Time (US & Canada); Tijuana</label>
            </div>
            <div class="field-row">
              <input id="tz2" type="radio" name="tz">
              <label for="tz2">(GMT-07:00) Mountain Time, which is basically Pacific</label>
            </div>
          </fieldset>
          <div class="field-row">
            <input type="checkbox" id="clock" checked disabled>
            <label for="clock">Automatically adjust clock for daylight saving changes</label>
          </div>`,
        buttons: [
          { label: 'Apply', act: 'tz-apply' },
          { label: 'OK', act: 'to-days', def: true },
          { label: 'Cancel', act: 'try-exit' },
        ],
      })
    case 'day':
      return dayView()
    case 'confirm':
      return dialog({
        title: 'Confirm Availability',
        icon: 'question',
        body: `<p>You have selected <strong>${state.selected.size}</strong> time window${state.selected.size === 1 ? '' : 's'}.</p><ul class="pick-list">${[...state.selected].map((id) => `<li>${esc(formatSlot(id))}</li>`).join('')}</ul><p>Are you sure? Setup will ask this regardless of your answer.</p>`,
        buttons: [
          { label: 'No', act: 'confirm-no' },
          { label: 'Yes', act: 'to-copy', def: true },
          { label: 'Help', act: 'help' },
        ],
      })
    case 'copy':
      return dialog({
        title: 'Copying Files',
        body: `<p>Please wait while Setup copies Boger Bowl files to your computer.</p><p id="copy-file">Copying: C:\\WINDOWS\\TEMP\\BOGER.EXE</p>`,
        extra: `<div class="progress-indicator segmented copy-bar"><span class="progress-indicator-bar" id="bar" style="width: ${state.progress}%"></span></div>`,
        buttons: [{ label: 'Cancel', act: 'try-exit' }],
        status: `${state.progress}% complete`,
      })
    case 'writeprotect':
      return dialog({
        title: 'Error Copying File',
        icon: 'error',
        body: `<p>Cannot create or replace C:\\Program Files\\BogerBowl\\TIMES.DAT</p><p>The disk is write-protected. Remove the write-protection or use another disk. This is a website.</p>`,
        buttons: [
          { label: 'Abort', act: 'wp-abort' },
          { label: 'Retry', act: 'wp-retry', def: true },
          { label: 'Ignore', act: 'wp-ignore' },
        ],
      })
    case 'finish':
      return dialog({
        title: 'Setup Complete',
        icon: 'info',
        body: `<p>Setup has finished copying files to your computer.</p><p>Before you can use Boger Bowl Draft Times, you must restart Windows.</p>`,
        extra: `<fieldset>
            <div class="field-row">
              <input id="r1" type="radio" name="rs" data-act="rs-yes" ${state.restartNow ? 'checked' : ''}>
              <label for="r1">Yes, I want to restart my computer now.</label>
            </div>
            <div class="field-row">
              <input id="r2" type="radio" name="rs" data-act="rs-no" ${state.restartNow ? '' : 'checked'}>
              <label for="r2">No, I will restart my computer later.</label>
            </div>
          </fieldset>`,
        buttons: [{ label: 'Finish', act: 'finish', def: true }],
      })
    case 'results':
      return resultsView()
    default:
      return ''
  }
}

function dayView(): string {
  const day = DAYS[state.dayIndex]
  if (!day) return ''
  const swap = state.dayIndex % 4 === 3
  const boxes = day.slots
    .map((s) => {
      const on = state.pending.has(s.id)
      return `<div class="field-row">
        <input type="checkbox" id="${s.id}" data-act="toggle" data-id="${s.id}" ${on ? 'checked' : ''}>
        <label for="${s.id}">${s.time} Pacific</label>
      </div>`
    })
    .join('')
  const yes = { label: '&Yes', act: 'day-yes', def: !swap }
  const no = { label: '&No', act: 'day-no', def: swap }
  const buttons = swap
    ? [no, yes, { label: 'Yes to &All', act: 'day-all' }, { label: 'N&o to All', act: 'day-none' }]
    : [yes, no, { label: 'Yes to &All', act: 'day-all' }, { label: 'N&o to All', act: 'day-none' }]
  return dialog({
    title: 'Boger Bowl Availability',
    icon: 'question',
    body: `<p>Are you available on <strong>${prettyDate(day.date, day.weekday)}</strong>?</p><p>Check every window you can do. If you click Yes with nothing checked, Setup will assume evenings and will not apologize.</p>`,
    extra: `<fieldset><legend>${day.weekday}</legend>${boxes}</fieldset>`,
    buttons,
    status: `Day ${state.dayIndex + 1} of ${DAYS.length} · ${state.selected.size} windows so far`,
  })
}

function resultsView(): string {
  const rows = state.results ?? []
  const counts = new Map<string, string[]>()
  for (const slot of SLOTS) counts.set(slot.id, [])
  for (const row of rows) {
    for (const id of row.available_slot_ids) counts.get(id)?.push(row.display_name)
  }
  const ranked = [...counts.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length
    return a[0].localeCompare(b[0])
  })
  const best = ranked.find(([, names]) => names.length > 0)
  const lines = ranked
    .map(([id, names]) => {
      const n = names.length
      const bar = '#'.repeat(n) + '.'.repeat(Math.max(0, 4 - n))
      return `${formatSlot(id).padEnd(28, ' ')} ${bar} ${n}  ${names.join(', ') || '—'}`
    })
    .join('\n')
  return `
    <div class="window notepad" data-window="main">
      <div class="title-bar" data-drag>
        <div class="title-bar-text">Availability.txt - Notepad</div>
        <div class="title-bar-controls">
          <button type="button" aria-label="Minimize" data-act="min"></button>
          <button type="button" aria-label="Maximize" data-act="max"></button>
          <button type="button" aria-label="Close" data-act="again"></button>
        </div>
      </div>
      <div class="window-body notepad-body">
        <menu role="menubar">
          <li role="menuitem" data-act="again">File</li>
          <li role="menuitem" data-act="help">Edit</li>
          <li role="menuitem" data-act="help">Search</li>
          <li role="menuitem" data-act="help">Help</li>
        </menu>
        <textarea readonly class="notepad-text">BOGER BOWL — LEAGUE HEADQUARTERS PRINTOUT
Submitted as: ${state.name}
Windows selected: ${state.selected.size}
Rage clicks: ${state.rage}
Dialogs survived: ${state.dialogs}

COMMISSIONER'S TENTATIVE PICK
${best ? `${formatSlot(best[0])}\n${best[1].join(', ')}` : '(none yet — you are first)'}

${lines}
</textarea>
      </div>
    </div>`
}

const LICENSE = `BOGER BOWL SOFTWARE LICENSE AGREEMENT

IMPORTANT - READ THIS. THEN DO NOT READ THIS.

1. GRANT OF LICENSE. The commissioner grants you a non-exclusive, non-transferable, fully revocable right to click Next.
2. TIMES. All times are Pacific. "Around 6" is not a time. "After the kids are down" is not a time.
3. SATURDAY 9:00 AM exists as a loyalty test.
4. YOU MAY NOT: reverse engineer this wizard, click the close box with expectation of success, or live in Mountain Time without commenting about it.
5. NO WARRANTY. This software is provided "AS IS," which in 1995 meant "good luck."
6. By clicking Next you certify you are a Boger, married to a Boger, or have accepted the consequences.
7. The commissioner may ignore this form and pick Sunday anyway.`

function overlayView(): string {
  if (!state.overlay) return ''
  if (state.overlay === 'help') {
    return overlayWin('Windows Help', `<pre class="help-pre">${esc(HELP)}</pre>`, [
      { label: 'OK', act: 'overlay-ok', def: true },
    ])
  }
  if (state.overlay === 'cantclose') {
    return overlayWin(
      'Boger Bowl Setup',
      `<p>You cannot quit Setup. Choose Next to continue.</p><p>The close box is decorative, like a screen saver of fish.</p>`,
      [{ label: 'OK', act: 'overlay-ok', def: true }],
    )
  }
  if (state.overlay === 'exit') {
    return overlayWin('Exit Setup', `<p>Are you sure you want to exit Setup?</p><p>If you exit now, the commissioner will not know when you can draft. He will guess. He will guess wrong.</p>`, [
      { label: 'Yes', act: 'exit-yes' },
      { label: 'No', act: 'overlay-ok', def: true },
    ])
  }
  if (state.overlay === 'exit-no') {
    return overlayWin('Exit Setup', `<p>You cannot exit Setup.</p>`, [
      { label: 'OK', act: 'overlay-ok', def: true },
    ])
  }
  if (state.overlay === 'run') {
    return overlayWin(
      'Run',
      `<div class="field-row-stacked"><label>Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.</label><input value="C:\\WINDOWS\\BOGER.EXE" data-act="run-path" /></div>`,
      [
        { label: 'OK', act: 'run-ok', def: true },
        { label: 'Cancel', act: 'overlay-ok' },
      ],
    )
  }
  if (state.overlay === 'shutdown') {
    return overlayWin(
      'Shut Down Windows',
      `<p>It's now safe to turn off your computer.</p><p>It is not safe to turn off this wizard. Your draft times have not been saved.</p>`,
      [
        { label: 'Yes, I meant that', act: 'overlay-ok' },
        { label: 'No, continue Setup', act: 'overlay-ok', def: true },
      ],
    )
  }
  return ''
}

function desktopIcons(): string {
  return `
    <button type="button" class="desk-icon" data-act="my-computer">
      <span class="pic pc"></span>
      <span>My Computer</span>
    </button>
    <button type="button" class="desk-icon" data-act="recycle">
      <span class="pic bin"></span>
      <span>Recycle Bin</span>
    </button>
    <button type="button" class="desk-icon" data-act="open-wizard">
      <span class="pic exe"></span>
      <span>Draft Times<br>Setup.exe</span>
    </button>
    <button type="button" class="desk-icon" data-act="printout">
      <span class="pic txt"></span>
      <span>Availability<br>.txt</span>
    </button>`
}

function startMenu(): string {
  if (!state.startOpen) return ''
  return `
    <div class="start-menu">
      <div class="start-banner">Windows 95</div>
      <button type="button" data-act="open-wizard">Programs › Boger Bowl › Draft Wizard</button>
      <button type="button" disabled>Settings</button>
      <button type="button" disabled>Find</button>
      <button type="button" data-act="help">Help</button>
      <button type="button" data-act="run">Run...</button>
      <hr>
      <button type="button" data-act="shutdown">Shut Down...</button>
    </div>`
}

function taskButtons(): string {
  if (state.step === 'boot' || state.step === 'desktop' || state.step === 'bsod') return ''
  const title = state.step === 'results' ? 'Notepad - Availability.txt' : 'Boger Bowl Setup'
  return `<button type="button" class="task ${state.minimized ? '' : 'active'}" data-act="restore">${esc(title)}</button>`
}

function chrome(): string {
  if (state.step === 'boot') {
    return `<div class="boot-screen"><div class="boot-logo">${winFlag()}</div><p>Starting Windows 95...</p></div>`
  }
  if (state.step === 'bsod') {
    return `<div class="bsod" data-act="bsod-key"><p>Windows</p><p>A fatal exception 0E has occurred at 0028:C0001BAD in VXD BOGER(01) + 000006PM. The current application will be terminated.</p><p>* Press any key to continue _</p></div>`
  }
  return `
    <div class="desktop">
      <div class="icons">${desktopIcons()}</div>
      <div class="windows-layer ${state.minimized ? 'hidden' : ''}" id="wins">${currentView()}</div>
      ${overlayView()}
      ${startMenu()}
      <div class="taskbar">
        <button type="button" class="start-btn ${state.startOpen ? 'active' : ''}" data-act="start">${winFlag()} Start</button>
        <div class="tasks">${taskButtons()}</div>
        <div class="tray">11:59 AM</div>
      </div>
    </div>`
}

function bumpDialog(): void {
  state.dialogs += 1
}

function setStep(step: Step): void {
  clearTimers()
  state.step = step
  state.overlay = null
  state.minimized = false
  state.startOpen = false
  if (step !== 'boot' && step !== 'desktop' && step !== 'copy' && step !== 'bsod') bumpDialog()
  if (step === 'day') {
    const day = DAYS[state.dayIndex]
    state.pending = new Set(day ? day.slots.filter((s) => state.selected.has(s.id)).map((s) => s.id) : [])
  }
  render()
  if (step === 'copy') runCopy()
  if (step === 'bsod') {
    later(() => {
      void transmit()
    }, 1600)
  }
}

function render(): void {
  const app = document.getElementById('app')
  if (!app) return
  app.innerHTML = chrome()
}

function nextDayOrConfirm(): void {
  state.dayIndex += 1
  if (state.dayIndex >= DAYS.length) setStep('confirm')
  else setStep('day')
}

function runCopy(): void {
  state.progress = 0
  const files = ['BOGER.EXE', 'TIMES.DRV', 'BOGER32.DLL', 'SETUP.BMP', 'README.TXT', 'TIMES.DAT']
  let i = 0
  const tick = () => {
    if (state.step !== 'copy') return
    state.progress = Math.min(99, state.progress + 7 + (i % 3))
    const bar = document.getElementById('bar')
    const label = document.getElementById('copy-file')
    const file = files[i % files.length]
    if (label) label.textContent = `Copying: C:\\Program Files\\BogerBowl\\${file}`
    if (bar) bar.style.width = `${state.progress}%`
    const status = document.querySelector('.status-bar-field')
    if (status) status.textContent = `${state.progress}% complete`
    i += 1
    if (state.progress >= 99) {
      later(() => setStep('writeprotect'), 400)
      return
    }
    later(tick, 180)
  }
  later(tick, 200)
}

async function transmit(): Promise<void> {
  if (state.sending) return
  state.sending = true
  try {
    await submitAvailability({
      display_name: state.name.trim(),
      member_key: slug(state.name),
      available_slot_ids: [...state.selected],
      gauntlet_seconds: Math.max(1, Math.round((Date.now() - state.startedAt) / 1000)),
      rage_clicks: state.rage,
      bowling_throws: state.dialogs,
    })
    state.results = await listResponses()
    setStep('results')
  } catch (err) {
    chordSad()
    state.sending = false
    state.error = err instanceof Error ? err.message : 'unknown'
    state.overlay = null
    setStep('writeprotect')
    later(() => {
      state.overlay = 'help'
      render()
      const copy = document.querySelector('.overlay-win .dlg-copy')
      if (copy) copy.innerHTML = `<p>LINE BUSY</p><p>${esc(state.error)}</p>`
    }, 0)
  }
}

function resetVisit(): void {
  state.name = ''
  state.pending = new Set()
  state.selected = new Set()
  state.dayIndex = 0
  state.dllTries = 0
  state.copyTries = 0
  state.progress = 0
  state.restartNow = true
  state.noAgree = false
  state.tzOk = false
  state.rage = 0
  state.dialogs = 0
  state.startedAt = Date.now()
  state.results = null
  state.error = ''
  state.sending = false
  state.minimized = false
}

function handle(act: string, el: HTMLElement): void {
  switch (act) {
    case 'start':
      state.startOpen = !state.startOpen
      render()
      break
    case 'open-wizard':
      unlockAudio()
      ding()
      if (state.step === 'desktop' || state.step === 'results' || state.step === 'boot') {
        resetVisit()
        setStep('welcome')
      } else {
        state.minimized = false
        state.startOpen = false
        render()
      }
      break
    case 'my-computer':
      state.overlay = 'help'
      render()
      later(() => {
        const copy = document.querySelector('.overlay-win .dlg-copy')
        if (copy) copy.innerHTML = `<p>These are not the times you are looking for.</p>`
      }, 0)
      break
    case 'recycle':
      state.overlay = 'help'
      render()
      later(() => {
        const copy = document.querySelector('.overlay-win .dlg-copy')
        if (copy) copy.innerHTML = `<p>The Recycle Bin is empty. Your patience is not.</p>`
      }, 0)
      break
    case 'printout':
      void (async () => {
        try {
          state.results = await listResponses()
          state.name = state.name || 'Commissioner'
          setStep('results')
        } catch {
          chordSad()
        }
      })()
      break
    case 'run':
      state.startOpen = false
      state.overlay = 'run'
      render()
      break
    case 'run-ok':
      state.overlay = 'help'
      render()
      later(() => {
        const copy = document.querySelector('.overlay-win .dlg-copy')
        if (copy) copy.innerHTML = `<p>Cannot find the file 'C:\\WINDOWS\\BOGER.EXE' (or one of its components). Make sure the path and filename are correct and that all required libraries are available.</p>`
      }, 0)
      break
    case 'shutdown':
      state.startOpen = false
      state.overlay = 'shutdown'
      render()
      break
    case 'min':
      state.minimized = true
      render()
      break
    case 'restore':
      state.minimized = false
      render()
      break
    case 'max':
      document.querySelector('.dialog-win, .notepad')?.classList.toggle('maxed')
      break
    case 'x':
    case 'try-exit':
      ding()
      state.overlay = 'exit'
      render()
      break
    case 'exit-yes':
      chordSad()
      state.overlay = 'exit-no'
      render()
      break
    case 'overlay-ok':
    case 'overlay-x':
      state.overlay = null
      render()
      break
    case 'help':
      ding()
      state.overlay = 'help'
      render()
      break
    case 'noop':
      break
    case 'to-hang':
      ding()
      setStep('hang')
      break
    case 'details': {
      document.getElementById('details')?.classList.toggle('hidden')
      break
    }
    case 'to-license':
      ding()
      setStep('license')
      break
    case 'fake-agree':
      ;(el as HTMLInputElement).checked = false
      chordSad()
      state.overlay = 'help'
      render()
      later(() => {
        const copy = document.querySelector('.overlay-win .dlg-copy')
        if (copy) copy.innerHTML = `<p>That checkbox is a lie. Use the other one.</p>`
      }, 0)
      break
    case 'no-agree':
      state.noAgree = (el as HTMLInputElement).checked
      render()
      break
    case 'to-name':
      if (!state.noAgree) return
      ding()
      setStep('name')
      break
    case 'browse':
      state.overlay = 'help'
      render()
      later(() => {
        const copy = document.querySelector('.overlay-win .dlg-copy')
        if (copy) copy.innerHTML = `<p>Browse is not available in this evaluation copy of Windows.</p>`
      }, 0)
      break
    case 'to-mean': {
      const input = document.getElementById('name') as HTMLInputElement | null
      if (input) state.name = input.value
      if (state.name.trim().length < 2) {
        chordSad()
        state.overlay = 'help'
        render()
        later(() => {
          const copy = document.querySelector('.overlay-win .dlg-copy')
          if (copy) copy.innerHTML = `<p>The commissioner requires more letters than that.</p>`
        }, 0)
        return
      }
      ding()
      setStep('didyoumean')
      break
    }
    case 'mean-yes':
      state.name = mangled(state.name)
      ding()
      setStep('dll')
      break
    case 'mean-no':
      ding()
      setStep('dll')
      break
    case 'dll-retry':
      state.dllTries += 1
      ding()
      render()
      bumpDialog()
      break
    case 'dll-abort':
      state.overlay = 'cantclose'
      render()
      break
    case 'dll-ignore':
      ding()
      setStep('modem')
      break
    case 'modem-yes':
      chordSad()
      state.overlay = 'help'
      render()
      later(() => {
        const copy = document.querySelector('.overlay-win .dlg-copy')
        if (copy) copy.innerHTML = `<p>No modem was found on COM1. If you are using a laptop, try walking around with it.</p><p>The correct answer was No.</p>`
      }, 0)
      break
    case 'modem-no':
      ding()
      setStep('timezone')
      break
    case 'tz':
      state.tzOk = true
      break
    case 'tz-apply':
      ding()
      break
    case 'to-days':
      if (!state.tzOk) {
        chordSad()
        state.overlay = 'help'
        render()
        later(() => {
          const copy = document.querySelector('.overlay-win .dlg-copy')
          if (copy) copy.innerHTML = `<p>Please select Pacific Time. Apply is decorative. OK is not, but only after you click the Pacific radio.</p>`
        }, 0)
        return
      }
      ding()
      state.dayIndex = 0
      setStep('day')
      break
    case 'toggle': {
      const id = el.dataset.id ?? ''
      if (state.pending.has(id)) state.pending.delete(id)
      else state.pending.add(id)
      break
    }
    case 'day-yes': {
      const day = DAYS[state.dayIndex]
      if (!day) return
      const pick = state.pending.size ? [...state.pending] : eveningIds(day)
      for (const id of pick) state.selected.add(id)
      ding()
      nextDayOrConfirm()
      break
    }
    case 'day-no':
      ding()
      nextDayOrConfirm()
      break
    case 'day-all': {
      for (let i = state.dayIndex; i < DAYS.length; i += 1) {
        const d = DAYS[i]
        if (d) for (const id of eveningIds(d)) state.selected.add(id)
      }
      ding()
      setStep('confirm')
      break
    }
    case 'day-none':
      if (state.selected.size < 1) {
        chordSad()
        state.overlay = 'help'
        render()
        later(() => {
          const copy = document.querySelector('.overlay-win .dlg-copy')
          if (copy) copy.innerHTML = `<p>You must select at least one time. No to All has been ignored out of spite.</p>`
        }, 0)
        return
      }
      ding()
      setStep('confirm')
      break
    case 'confirm-no':
      chordSad()
      state.dayIndex = 0
      setStep('day')
      break
    case 'to-copy':
      if (state.selected.size < 1) {
        chordSad()
        state.overlay = 'help'
        render()
        later(() => {
          const copy = document.querySelector('.overlay-win .dlg-copy')
          if (copy) copy.innerHTML = `<p>The commissioner requires at least one window.</p>`
        }, 0)
        return
      }
      ding()
      setStep('copy')
      break
    case 'wp-abort':
      state.overlay = 'cantclose'
      render()
      break
    case 'wp-retry':
      state.copyTries += 1
      if (state.copyTries >= 2) {
        ding()
        setStep('finish')
      } else {
        ding()
        setStep('copy')
      }
      break
    case 'wp-ignore':
      ding()
      setStep('finish')
      break
    case 'rs-yes':
      state.restartNow = true
      break
    case 'rs-no':
      state.restartNow = false
      break
    case 'finish':
      ding()
      if (state.restartNow) setStep('bsod')
      else void transmit()
      break
    case 'again':
      resetVisit()
      setStep('desktop')
      break
    case 'bsod-key':
      void transmit()
      break
    default:
      break
  }
}

export function mount(el: HTMLElement): void {
  el.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement
    if (t.closest('[data-act="start"]') === null && state.startOpen && !t.closest('.start-menu')) {
      state.startOpen = false
      render()
    }
    const actEl = t.closest<HTMLElement>('[data-act]')
    if (!actEl) {
      if (!t.closest('input, textarea, button, label, .window')) state.rage += 1
      return
    }
    const act = actEl.dataset.act ?? ''
    if (act === 'name' || act === 'run-path' || act === 'toggle' || act === 'tz' || act === 'rs-yes' || act === 'rs-no' || act === 'no-agree') {
      handle(act, actEl)
      return
    }
    ev.preventDefault()
    handle(act, actEl)
  })

  el.addEventListener('input', (ev) => {
    const t = ev.target as HTMLElement
    if (t.id === 'name') state.name = (t as HTMLInputElement).value
  })

  el.addEventListener('pointerdown', (ev) => {
    const bar = (ev.target as HTMLElement).closest('[data-drag]')
    const win = bar?.closest<HTMLElement>('[data-window]')
    if (!bar || !win || ev.button !== 0) return
    const r = win.getBoundingClientRect()
    drag = { dx: ev.clientX - r.left, dy: ev.clientY - r.top }
    win.style.position = 'absolute'
    win.style.left = `${r.left}px`
    win.style.top = `${r.top}px`
    const move = (m: PointerEvent) => {
      if (!drag) return
      win.style.left = `${m.clientX - drag.dx}px`
      win.style.top = `${m.clientY - drag.dy}px`
    }
    const up = () => {
      drag = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  })

  el.addEventListener('keydown', (ev) => {
    if (state.step === 'bsod') {
      void transmit()
    }
    if (ev.key === 'F1') {
      ev.preventDefault()
      handle('help', el)
    }
    if (ev.key === 'Escape') handle('try-exit', el)
  })

  render()
  later(() => {
    chord()
    setStep('desktop')
    later(() => setStep('welcome'), 600)
  }, 1400)
}
