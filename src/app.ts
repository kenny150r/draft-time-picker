import {
  chord,
  chordSad,
  ding,
  sfxClear,
  sfxLand,
  sfxLose,
  sfxMove,
  sfxRotate,
  sfxVirus,
  sfxWin,
  startMusic,
  stopMusic,
  unlockAudio,
} from './audio.ts'
import { clippySvg, loseTip, resetClippyTalk, tipFor, virusTip } from './clippy.ts'
import { listResponses, memberKey, submitAvailability, type DraftResponse } from './db.ts'
import {
  drawGame,
  drawNext,
  fitScale,
  giveUp,
  hudOf,
  newGame,
  press,
  release,
  tick,
  type Game,
  type Hud,
  type Input,
  type Sfx,
} from './drmario.ts'
import { formatSlot, groupDays, prettyDate, SLOTS, WEEK_LABELS, type Day } from './slots.ts'

type Step = 'boot' | 'desktop' | 'welcome' | 'name' | 'slots' | 'drmario' | 'finish' | 'results'

type Overlay = 'help' | 'cantclose' | 'exit' | 'exit-no' | 'run' | 'shutdown' | 'computer' | null

const DAYS = groupDays()
const FUNERAL_ID = '2026-09-06T18:00'
const HELP_PAGES = [
  'Cannot open Help file.\n\nC:\\WINDOWS\\HELP\\BOGER.HLP\n\nClippit could not find the file either. Press F1 again if you enjoy this message.',
  'Dr. Boger says: match four of the same color in a row. Viruses count. You only need four of them gone.\n\nIf you fail, Setup continues. This is still not a draft timezone in Kansas.',
  'This is still not help.\n\nF1 has been retired for the rest of this session. Try surviving Setup instead.',
] as const

type State = {
  step: Step
  overlay: Overlay
  minimized: boolean
  startOpen: boolean
  name: string
  selected: Set<string>
  results: DraftResponse[] | null
  error: string
  sending: boolean
  clippyOn: boolean
  clippyBalloon: boolean
  clippyTip: string
  helpAt: number
  weeknightsBetrayed: boolean
  slotsNote: string
  rage: number
  dialogs: number
  startedAt: number
  clock: string
  marioHud: Hud | null
}

const state: State = {
  step: 'boot',
  overlay: null,
  minimized: false,
  startOpen: false,
  name: '',
  selected: new Set(),
  results: null,
  error: '',
  sending: false,
  clippyOn: true,
  clippyBalloon: true,
  clippyTip: '',
  helpAt: 0,
  weeknightsBetrayed: false,
  slotsNote: '',
  rage: 0,
  dialogs: 0,
  startedAt: Date.now(),
  clock: '11:59 AM',
  marioHud: null,
}

let timers: number[] = []
let drag: { dx: number; dy: number } | null = null
let game: Game | null = null
let gameRaf = 0
let lastTs = 0
let gamePaused = false

const sfx: Sfx = {
  move: sfxMove,
  rotate: sfxRotate,
  land: sfxLand,
  clear: sfxClear,
  virus: () => {
    sfxVirus()
    if (game) speakMario()
  },
  lose: () => {
    sfxLose()
    state.clippyTip = loseTip()
    state.clippyBalloon = true
    state.clippyOn = true
    paintClippy()
    paintMarioChrome()
  },
  win: () => {
    sfxWin()
    state.clippyTip = virusTip(0)
    state.clippyBalloon = true
    state.clippyOn = true
    paintClippy()
    paintMarioChrome()
  },
}

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
  wide?: boolean
  klass?: string
}): string {
  const buttons = opts.buttons
    .map(
      (b) =>
        `<button type="button" class="${b.def ? 'default' : ''}" data-act="${b.act}" ${b.disabled ? 'disabled' : ''}>${esc(b.label)}</button>`,
    )
    .join('')
  return `
    <div class="window dialog-win ${opts.wide ? 'slots-win' : ''} ${opts.klass ?? ''}" data-window="main">
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

function overlayWin(
  title: string,
  body: string,
  buttons: { label: string; act: string; def?: boolean }[],
  klass = '',
): string {
  const btns = buttons
    .map((b) => `<button type="button" class="${b.def ? 'default' : ''}" data-act="${b.act}">${esc(b.label)}</button>`)
    .join('')
  return `
    <div class="modal-scrim">
      <div class="window overlay-win ${klass}">
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

function clockLabel(): string {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function marioStatus(): string {
  const hud = state.marioHud
  if (!hud) return 'Insert quarter (metaphorically)'
  if (hud.status === 'won') return 'All viruses cleared. You may continue Setup.'
  if (hud.status === 'lost') return 'Patient released against medical advice. Setup continues anyway.'
  return `${hud.virusesLeft} virus${hud.virusesLeft === 1 ? '' : 'es'} remaining · score ${hud.score}`
}

function marioView(): string {
  const hud = state.marioHud
  const over = hud?.status === 'won' || hud?.status === 'lost'
  const nextLabel = hud?.status === 'won' ? 'Next >' : 'Continue anyway'
  return `
    <div class="window dialog-win mario-win" data-window="main">
      <div class="title-bar" data-drag>
        <div class="title-bar-text">Dr. Boger (Evaluation Copy)</div>
        <div class="title-bar-controls">
          <button type="button" aria-label="Minimize" data-act="min"></button>
          <button type="button" aria-label="Maximize" data-act="max"></button>
          <button type="button" aria-label="Close" data-act="x"></button>
        </div>
      </div>
      <div class="window-body mario-body">
        <p class="mario-lead">Windows 98 detected <strong>4 viruses</strong>. Clear them with capsules. Same color, four in a row.</p>
        <div class="mario-stage">
          <canvas id="mario" class="mario-canvas" width="192" height="352" aria-label="Dr. Boger bottle"></canvas>
          <aside class="mario-hud">
            <div class="nes-panel">
              <div class="nes-label">VIRUS</div>
              <div class="nes-value" id="mario-virus">${String(hud?.virusesLeft ?? 4).padStart(2, '0')}</div>
            </div>
            <div class="nes-panel">
              <div class="nes-label">SCORE</div>
              <div class="nes-value" id="mario-score">${String(hud?.score ?? 0).padStart(6, '0')}</div>
            </div>
            <div class="nes-panel">
              <div class="nes-label">NEXT</div>
              <canvas id="mario-next" class="mario-next" width="84" height="42"></canvas>
            </div>
            <p class="mario-keys">← → move<br>↓ drop · ↑ rotate<br>Space hard drop</p>
          </aside>
        </div>
        <div class="mario-pad" aria-label="On-screen controls">
          <button type="button" data-act="m-left">◀</button>
          <button type="button" data-act="m-down">▼</button>
          <button type="button" data-act="m-right">▶</button>
          <button type="button" data-act="m-rot">↻</button>
          <button type="button" data-act="m-drop">DROP</button>
        </div>
        <p class="mario-msg" id="mario-msg">${esc(marioStatus())}</p>
        <div class="dlg-btns">
          <button type="button" data-act="mario-retry">New bottle</button>
          <button type="button" data-act="mario-quit">${over && hud?.status === 'lost' ? 'I am not a doctor' : 'I give up'}</button>
          <button type="button" class="default" data-act="mario-next" ${over ? '' : 'disabled'}>${nextLabel}</button>
        </div>
      </div>
      <div class="status-bar"><p class="status-bar-field" id="mario-status">${esc(marioStatus())}</p></div>
    </div>`
}

function slotsView(): string {
  const weeks = WEEK_LABELS.map((label, week) => {
    const days = DAYS.filter((d) => d.slots[0]?.week === week)
    const rows = days
      .map((day) => {
        const boxes = day.slots
          .map((s) => {
            const on = state.selected.has(s.id)
            const boxId = `slot-${s.id.replace(/[^a-zA-Z0-9]/g, '-')}`
            return `<div class="field-row time-check">
              <input id="${boxId}" type="checkbox" data-act="toggle" data-id="${s.id}" ${on ? 'checked' : ''}>
              <label for="${boxId}">${s.time}</label>
            </div>`
          })
          .join('')
        return `<div class="day-row"><span class="day-name">${prettyDate(day.date, day.weekday)}</span><span class="time-checks">${boxes}</span></div>`
      })
      .join('')
    return `<section class="week-block"><h3>${label}</h3>${rows}</section>`
  }).join('')
  return dialog({
    title: 'Available Draft Times',
    body: `<p>Check every window you can do. All times are <strong>Pacific</strong>. Weekends include 9:00 AM and 1:00 PM.</p><p class="inlaw-hint">Buy-ins may be higher for in-laws this year. Darien, Jack — filling out your wives' boards still counts.</p>`,
    extra: `<div class="slot-sheet">${weeks}</div>`,
    buttons: [
      { label: '< Back', act: 'to-name' },
      { label: 'Weeknights', act: 'weeknights' },
      { label: 'Clear', act: 'clear-slots' },
      { label: 'Next >', act: 'to-mario', def: true },
    ],
    status: `${state.selected.size} window${state.selected.size === 1 ? '' : 's'} checked · Pacific Time${state.slotsNote ? ` · ${state.slotsNote}` : ''}`,
    wide: true,
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
  const hud = state.marioHud
  const med =
    hud?.status === 'won'
      ? `Dr. Boger residency: PASSED (${hud.virusesCleared} viruses)`
      : `Dr. Boger residency: waived (${hud?.virusesCleared ?? 0} viruses, Setup took pity)`
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
        <textarea readonly class="notepad-text">BOGER BOWL — LEAGUE SECRETARY PRINTOUT
Windows 98 Workstation

Submitted as: ${state.name}
Windows checked: ${state.selected.size}
${med}

TENTATIVE PICK (subject to Sunday, cinnamon, and Kansas)
${best ? `${formatSlot(best[0])}\n${best[1].join(', ')}` : '(none yet — you are first. congratulations?)'}

${lines}
</textarea>
      </div>
    </div>`
}

function currentView(): string {
  switch (state.step) {
    case 'welcome':
      return dialog({
        title: 'Boger Bowl Draft Time Setup Wizard',
        icon: 'info',
        body: `<p>Welcome to the Boger Bowl Draft Time Setup Wizard, now running on <strong>Microsoft Windows 98</strong>.</p><p>This wizard will ask your name, when you can draft, and then require a short medical residency in Dr. Boger.</p><p>All times are Pacific. Click Next to continue.</p>`,
        buttons: [
          { label: '< Back', act: 'noop', disabled: true },
          { label: 'Cancel', act: 'try-exit' },
          { label: 'Next >', act: 'to-name', def: true },
        ],
        status: 'Clippit is already employed. Do not make eye contact.',
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
          { label: '< Back', act: 'to-welcome' },
          { label: 'Next >', act: 'to-slots', def: true },
          { label: 'Cancel', act: 'try-exit' },
        ],
      })
    case 'slots':
      return slotsView()
    case 'drmario':
      return marioView()
    case 'finish':
      return dialog({
        title: 'Copying Files',
        icon: 'info',
        body: `<p>Please wait while Setup dials League Headquarters and files your times.</p><p>${state.error ? esc(state.error) : 'Connecting to 1-800-BOGER...'}</p>`,
        extra: `<div class="progress-indicator segmented copy-bar"><span class="progress-indicator-bar" id="bar" style="width: ${state.sending ? 70 : 20}%"></span></div>`,
        buttons: [{ label: 'Cancel', act: 'try-exit' }],
        status: state.sending ? 'Saving...' : 'Ready',
      })
    case 'results':
      return resultsView()
    default:
      return ''
  }
}

function overlayView(): string {
  if (!state.overlay) return ''
  if (state.overlay === 'help') {
    const page = HELP_PAGES[Math.min(state.helpAt, HELP_PAGES.length - 1)] ?? HELP_PAGES[0]
    return overlayWin('Windows Help', `<pre class="help-pre">${esc(page)}</pre>`, [
      { label: 'OK', act: 'overlay-ok', def: true },
    ])
  }
  if (state.overlay === 'computer') {
    return overlayWin(
      'My Computer',
      `<p>Select a drive. None of these contain draft times.</p>
        <div class="drive-list">
          <div>A:  3½ Floppy (Truck) — media not ready</div>
          <div>C:  BOGER98 (Kansas, still sucks)</div>
          <div>D:  Cinnamon Rolls (read-only)</div>
          <div>E:  DrBoger.vxd — 4 viruses loaded</div>
        </div>`,
      [{ label: 'OK', act: 'overlay-ok', def: true }],
      'computer-win',
    )
  }
  if (state.overlay === 'cantclose') {
    return overlayWin(
      'Boger Bowl Setup',
      `<p>You cannot quit Setup. Choose Next to continue.</p><p>The close box is decorative, like Active Desktop.</p>`,
      [{ label: 'OK', act: 'overlay-ok', def: true }],
    )
  }
  if (state.overlay === 'exit') {
    return overlayWin(
      'Exit Setup',
      `<p>Are you sure you want to exit Setup?</p><p>If you exit now, the commissioner will not know when you can draft.</p>`,
      [
        { label: 'Yes', act: 'exit-yes' },
        { label: 'No', act: 'overlay-ok', def: true },
      ],
    )
  }
  if (state.overlay === 'exit-no') {
    return overlayWin('Exit Setup', `<p>You cannot exit Setup.</p>`, [{ label: 'OK', act: 'overlay-ok', def: true }])
  }
  if (state.overlay === 'run') {
    return overlayWin(
      'Run',
      `<div class="field-row-stacked"><label>Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.</label><input value="C:\\WINDOWS\\DRBOGER.EXE" data-act="run-path" /></div>`,
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
    <button type="button" class="desk-icon" data-act="open-mario">
      <span class="pic virus"></span>
      <span>Dr. Boger</span>
    </button>
    <button type="button" class="desk-icon" data-act="clippy-summon">
      <span class="pic clip"></span>
      <span>Clippit.exe</span>
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
      <div class="start-banner">Windows 98</div>
      <button type="button" data-act="open-wizard">Programs › Boger Bowl › Draft Wizard</button>
      <button type="button" data-act="open-mario">Programs › Accessories › Dr. Boger</button>
      <button type="button" data-act="clippy-summon">Programs › Office › Office Assistant</button>
      <button type="button" disabled>Settings</button>
      <button type="button" disabled>Find</button>
      <button type="button" data-act="help">Help</button>
      <button type="button" data-act="run">Run...</button>
      <hr>
      <button type="button" data-act="shutdown">Shut Down...</button>
    </div>`
}

function taskButtons(): string {
  if (state.step === 'boot' || state.step === 'desktop') return ''
  const title = state.step === 'results' ? 'Notepad - Availability.txt' : state.step === 'drmario' ? 'Dr. Boger' : 'Boger Bowl Setup'
  return `<button type="button" class="task ${state.minimized ? '' : 'active'}" data-act="restore">${esc(title)}</button>`
}

function clippyView(): string {
  if (state.step === 'boot') return ''
  if (!state.clippyOn) {
    return `<button type="button" class="clippy-peek" data-act="clippy-summon" title="Clippit">📎</button>`
  }
  return `
    <div class="clippy-dock">
      ${
        state.clippyBalloon
          ? `<div class="clippy-bubble">
              <p id="clippy-text">${esc(state.clippyTip)}</p>
              <div class="clippy-actions">
                <button type="button" data-act="clippy-next">Next tip</button>
                <button type="button" data-act="clippy-ok">OK</button>
                <button type="button" data-act="clippy-hide">Hide</button>
              </div>
            </div>`
          : ''
      }
      <button type="button" class="clippy-btn ${state.clippyBalloon ? 'talk' : ''}" data-act="clippy-next" aria-label="Clippit">
        ${clippySvg()}
      </button>
    </div>`
}

function chrome(): string {
  if (state.step === 'boot') {
    return `<div class="win98-splash" data-act="skip-boot" tabindex="0">
      <div class="clouds" aria-hidden="true"></div>
      <div class="splash-mark">
        <div class="splash-flag">${winFlag()}</div>
        <div class="splash-words">
          <span class="ms">Microsoft</span>
          <span class="win">Windows <em>98</em></span>
          <span class="sub">Boger Bowl Edition</span>
        </div>
      </div>
      <div class="splash-bar"><span class="splash-fill"></span></div>
      <p class="splash-hint">Starting Draft Setup... Click or press any key to skip.</p>
    </div>`
  }
  return `
    <div class="desktop ${state.step === 'drmario' ? 'mario-open' : ''}">
      <div class="icons">${desktopIcons()}</div>
      <div class="windows-layer ${state.minimized ? 'hidden' : ''}" id="wins">${currentView()}</div>
      ${overlayView()}
      ${clippyView()}
      ${startMenu()}
      <div class="taskbar">
        <button type="button" class="start-btn ${state.startOpen ? 'active' : ''}" data-act="start">${winFlag()} Start</button>
        <div class="tasks">${taskButtons()}</div>
        <div class="tray"><span class="tray-icon" title="Clippit">📎</span><span id="clock">${esc(state.clock)}</span></div>
      </div>
    </div>`
}

function speakClippy(step: string = state.step): void {
  state.clippyTip = tipFor(step, state.name, 'step')
  state.clippyBalloon = true
  state.clippyOn = true
}

function bumpClippy(): void {
  state.clippyTip = tipFor(state.step, state.name, 'next')
  state.clippyBalloon = true
  state.clippyOn = true
}

function speakMario(): void {
  if (!game) return
  state.clippyTip = virusTip(hudOf(game).virusesLeft)
  state.clippyBalloon = true
  state.clippyOn = true
  paintClippy()
}

function paintClippy(): void {
  const text = document.getElementById('clippy-text')
  if (text) text.textContent = state.clippyTip
}

function paintMarioChrome(): void {
  if (!game) return
  const hud = hudOf(game)
  state.marioHud = hud
  const virus = document.getElementById('mario-virus')
  const score = document.getElementById('mario-score')
  const msg = document.getElementById('mario-msg')
  const status = document.getElementById('mario-status')
  const nextBtn = document.querySelector<HTMLButtonElement>('[data-act="mario-next"]')
  const quitBtn = document.querySelector<HTMLButtonElement>('[data-act="mario-quit"]')
  if (virus) virus.textContent = String(hud.virusesLeft).padStart(2, '0')
  if (score) score.textContent = String(hud.score).padStart(6, '0')
  const line = marioStatus()
  if (msg) msg.textContent = line
  if (status) status.textContent = line
  if (nextBtn) {
    nextBtn.disabled = hud.status === 'playing'
    nextBtn.textContent = hud.status === 'won' ? 'Next >' : 'Continue anyway'
  }
  if (quitBtn) quitBtn.textContent = hud.status === 'lost' ? 'I am not a doctor' : 'I give up'
  const next = document.getElementById('mario-next') as HTMLCanvasElement | null
  if (next) drawNext(hud.next, next)
}

function stopGameLoop(): void {
  if (gameRaf) cancelAnimationFrame(gameRaf)
  gameRaf = 0
  lastTs = 0
  stopMusic()
}

function frame(ts: number): void {
  if (!game || state.step !== 'drmario') return
  const dt = lastTs ? Math.min(48, ts - lastTs) : 16
  lastTs = ts
  if (!gamePaused && !state.overlay && !state.minimized) {
    tick(game, dt, sfx)
    const canvas = document.getElementById('mario') as HTMLCanvasElement | null
    if (canvas) {
      const box = canvas.parentElement?.getBoundingClientRect()
      const scale = fitScale(box ? Math.min(280, box.width) : 220, Math.min(420, window.innerHeight - 260))
      drawGame(game, canvas, scale)
    }
    paintMarioChrome()
  }
  gameRaf = requestAnimationFrame(frame)
}

function attachGame(reset: boolean): void {
  stopGameLoop()
  if (reset || !game) {
    game = newGame()
    state.marioHud = hudOf(game)
  }
  gamePaused = Boolean(state.overlay)
  paintMarioChrome()
  startMusic()
  lastTs = 0
  gameRaf = requestAnimationFrame(frame)
}

function finishBoot(): void {
  if (state.step !== 'boot') return
  clearTimers()
  chord()
  setStep('desktop')
  later(() => setStep('welcome'), 800)
}

function setStep(step: Step): void {
  if (state.step === 'drmario' && step !== 'drmario') stopGameLoop()
  clearTimers()
  state.step = step
  state.overlay = null
  state.minimized = false
  state.startOpen = false
  if (step !== 'boot' && step !== 'desktop' && step !== 'finish') state.dialogs += 1
  if (step !== 'boot') speakClippy(step)
  render()
  if (step === 'drmario') attachGame(true)
  if (step === 'finish') void transmit()
}

function render(): void {
  const app = document.getElementById('app')
  if (!app) return
  app.innerHTML = chrome()
  if (state.step === 'drmario') {
    attachGame(false)
  }
  if (state.step === 'boot') {
    document.querySelector<HTMLElement>('.win98-splash')?.focus()
    later(finishBoot, 4200)
  }
  if (state.step === 'name') {
    document.getElementById('name')?.focus()
  }
}

async function transmit(): Promise<void> {
  if (state.sending) return
  state.sending = true
  render()
  const bar = document.getElementById('bar')
  if (bar) bar.style.width = '88%'
  try {
    await submitAvailability({
      display_name: state.name.trim(),
      member_key: memberKey(state.name),
      available_slot_ids: [...state.selected],
      gauntlet_seconds: Math.max(1, Math.round((Date.now() - state.startedAt) / 1000)),
      rage_clicks: state.rage,
      bowling_throws: state.marioHud?.virusesCleared ?? 0,
    })
    state.results = await listResponses()
    state.sending = false
    setStep('results')
  } catch (err) {
    chordSad()
    state.sending = false
    state.error = err instanceof Error ? err.message : 'unknown'
    setStep('slots')
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
  state.selected = new Set()
  state.results = null
  state.error = ''
  state.sending = false
  state.minimized = false
  state.clippyOn = true
  state.clippyBalloon = true
  state.clippyTip = ''
  state.helpAt = 0
  state.weeknightsBetrayed = false
  state.slotsNote = ''
  state.rage = 0
  state.dialogs = 0
  state.startedAt = Date.now()
  state.marioHud = null
  game = null
  resetClippyTalk()
}

function keyToInput(key: string): Input | null {
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') return 'left'
  if (key === 'ArrowRight' || key === 'd' || key === 'D') return 'right'
  if (key === 'ArrowDown' || key === 's' || key === 'S') return 'down'
  if (key === 'ArrowUp' || key === 'x' || key === 'X') return 'up'
  if (key === 'z' || key === 'Z') return 'rotccw'
  if (key === ' ' || key === 'Enter') return 'drop'
  return null
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
    case 'open-mario':
      unlockAudio()
      ding()
      if (state.step === 'desktop' || state.step === 'results') {
        if (!state.name.trim()) state.name = 'Commissioner'
        setStep('drmario')
      } else if (state.step === 'drmario') {
        state.minimized = false
        state.startOpen = false
        render()
      } else {
        state.startOpen = false
        setStep('drmario')
      }
      break
    case 'my-computer':
      ding()
      state.overlay = 'computer'
      render()
      break
    case 'recycle':
      state.overlay = 'help'
      render()
      later(() => {
        const copy = document.querySelector('.overlay-win .dlg-copy')
        if (copy)
          copy.innerHTML = `<p>Recycle Bin contains 1 item:</p><p><strong>AUNT.AVI</strong> — Windows Media Player cannot decode this file. A truck appears to have eaten the subject. This tape is famous. It will not help you pick a draft time.</p>`
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
      state.overlay = null
      ding()
      setStep('drmario')
      break
    case 'shutdown':
      state.startOpen = false
      state.overlay = 'shutdown'
      render()
      break
    case 'min':
      state.minimized = true
      gamePaused = true
      render()
      break
    case 'restore':
      state.minimized = false
      gamePaused = false
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
      gamePaused = false
      render()
      break
    case 'help':
      ding()
      state.overlay = 'help'
      render()
      if (state.helpAt < HELP_PAGES.length - 1) state.helpAt += 1
      break
    case 'skip-boot':
      finishBoot()
      break
    case 'noop':
      break
    case 'to-welcome':
      ding()
      setStep('welcome')
      break
    case 'to-name':
      ding()
      setStep('name')
      break
    case 'to-slots': {
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
      setStep('slots')
      break
    }
    case 'toggle': {
      const id = el.dataset.id ?? ''
      const on = el instanceof HTMLInputElement ? el.checked : false
      if (on) state.selected.add(id)
      else state.selected.delete(id)
      const status = document.querySelector('.status-bar-field')
      if (status) {
        status.textContent = `${state.selected.size} window${state.selected.size === 1 ? '' : 's'} checked · Pacific Time${state.slotsNote ? ` · ${state.slotsNote}` : ''}`
      }
      break
    }
    case 'weeknights':
      for (const day of DAYS) {
        for (const id of eveningIds(day)) state.selected.add(id)
      }
      if (!state.weeknightsBetrayed) {
        state.selected.delete(FUNERAL_ID)
        state.weeknightsBetrayed = true
        state.slotsNote = 'Sun Sep 6 6:00 PM is a funeral'
        chordSad()
      } else {
        state.slotsNote = ''
        ding()
      }
      render()
      break
    case 'clear-slots':
      state.selected = new Set()
      state.slotsNote = ''
      ding()
      render()
      break
    case 'to-mario':
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
      setStep('drmario')
      break
    case 'mario-retry':
      ding()
      attachGame(true)
      speakClippy('drmario')
      paintClippy()
      break
    case 'mario-quit':
      if (game && game.status === 'playing') giveUp(game, sfx)
      paintMarioChrome()
      break
    case 'mario-next':
      if (!game || game.status === 'playing') return
      ding()
      stopGameLoop()
      if (state.name.trim().length < 2) {
        setStep('name')
        break
      }
      if (state.selected.size < 1) {
        setStep('slots')
        break
      }
      setStep('finish')
      break
    case 'm-rot':
      if (game) press(game, 'rot', sfx)
      break
    case 'm-drop':
      if (game) press(game, 'drop', sfx)
      break
    case 'again':
      resetVisit()
      setStep('desktop')
      break
    case 'clippy-summon':
      state.clippyOn = true
      bumpClippy()
      render()
      break
    case 'clippy-next':
      bumpClippy()
      if (state.step === 'drmario' && document.getElementById('clippy-text')) paintClippy()
      else render()
      break
    case 'clippy-ok':
      state.clippyBalloon = false
      if (state.step === 'drmario') {
        document.querySelector('.clippy-bubble')?.remove()
        document.querySelector('.clippy-btn')?.classList.remove('talk')
      } else render()
      break
    case 'clippy-hide':
      state.clippyOn = false
      state.clippyBalloon = false
      render()
      window.setTimeout(() => {
        if (state.step === 'boot') return
        state.clippyOn = true
        state.clippyTip = 'I sensed you still needed me. Hide is more of a suggestion.'
        state.clippyBalloon = true
        render()
      }, 4200)
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
      if (!t.closest('input, textarea, button, label, .window, .clippy-dock, .clippy-peek, canvas')) state.rage += 1
      return
    }
    const act = actEl.dataset.act ?? ''
    if (act === 'toggle' || act === 'm-left' || act === 'm-right' || act === 'm-down') return
    if (act === 'name' || act === 'run-path') {
      handle(act, actEl)
      return
    }
    ev.preventDefault()
    handle(act, actEl)
  })

  el.addEventListener('change', (ev) => {
    const t = ev.target as HTMLElement
    if (t instanceof HTMLInputElement && t.dataset.act === 'toggle') handle('toggle', t)
  })

  el.addEventListener('input', (ev) => {
    const t = ev.target as HTMLElement
    if (t.id === 'name') state.name = (t as HTMLInputElement).value
  })

  el.addEventListener('pointerdown', (ev) => {
    const pad = (ev.target as HTMLElement).closest<HTMLElement>('[data-act^="m-"]')
    if (pad && game) {
      const act = pad.dataset.act ?? ''
      const map: Record<string, Input> = {
        'm-left': 'left',
        'm-right': 'right',
        'm-down': 'down',
        'm-rot': 'rot',
        'm-drop': 'drop',
      }
      const input = map[act]
      if (input && input !== 'drop' && input !== 'rot') {
        ev.preventDefault()
        press(game, input, sfx)
      }
      return
    }
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

  el.addEventListener('pointerup', (ev) => {
    const pad = (ev.target as HTMLElement).closest<HTMLElement>('[data-act^="m-"]')
    if (!pad || !game) return
    const act = pad.dataset.act ?? ''
    if (act === 'm-left') release(game, 'left')
    if (act === 'm-right') release(game, 'right')
    if (act === 'm-down') release(game, 'down')
  })

  window.addEventListener('keydown', (ev) => {
    if (state.step === 'boot') {
      ev.preventDefault()
      finishBoot()
      return
    }
    if (ev.key === 'F1') {
      ev.preventDefault()
      handle('help', el)
      return
    }
    if (ev.key === 'Escape') {
      handle('try-exit', el)
      return
    }
    if (state.step !== 'drmario' || !game || state.overlay || state.minimized) return
    if (ev.repeat && (ev.key === 'ArrowUp' || ev.key === 'x' || ev.key === 'X' || ev.key === 'z' || ev.key === 'Z' || ev.key === ' ' || ev.key === 'Enter')) {
      ev.preventDefault()
      return
    }
    const input = keyToInput(ev.key)
    if (!input) return
    ev.preventDefault()
    press(game, input, sfx)
  })

  window.addEventListener('keyup', (ev) => {
    if (state.step !== 'drmario' || !game) return
    const input = keyToInput(ev.key)
    if (input) release(game, input)
  })

  window.setInterval(() => {
    state.clock = clockLabel()
    const node = document.getElementById('clock')
    if (node) node.textContent = state.clock
  }, 1000)
  state.clock = clockLabel()

  render()
}
