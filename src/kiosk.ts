import {
  beep,
  busySignal,
  faxHandshake,
  muteForever,
  sadBeep,
  slam,
  stampSound,
  startHoldMusic,
  stopHoldMusic,
  unlockAudio,
} from './audio.ts'
import { listResponses, submitAvailability, type DraftResponse } from './db.ts'
import { formatSlot, prettyDate, SLOTS, WEEK_LABELS } from './slots.ts'

type Stage =
  | 'attract'
  | 'boot'
  | 'ticket'
  | 'waiver'
  | 'name'
  | 'hold'
  | 'slots'
  | 'notary'
  | 'fax'
  | 'results'

type FaxPhase = 'dial' | 'nodial' | 'retry' | 'jam' | 'send' | 'error'

const KEYS = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
  ['O', 'P', 'Q', 'R', 'S', 'T', 'U'],
  ['V', 'W', 'X', 'Y', 'Z', '⌫'],
]

const BOOT_LINES = [
  'FAXNET 9000 BIOS 4.07  (c) 1987 Boger Heavy Industries',
  'CPU: 4.77 MHz of spite',
  'CHECKING TONER..............LOW, AS ALWAYS',
  'CHECKING DIAL TONE..........NO',
  'CHECKING DIAL TONE..........STILL NO',
  'CHECKING DIAL TONE..........USING CUP AND STRING',
  'MOUNTING LEAGUE BYLAWS......OK',
  'CALIBRATING GREASE SENSOR...OK',
  'CLOCK.......................12:00  12:00  12:00',
  'READY.',
]

const WAIVER = `BOGER BOWL FORM BB-19 (REV. 8/86)
STATEMENT OF TEMPORAL AVAILABILITY — READ NONE OF THIS

1. All times are Pacific. If you are not in Pacific, become Pacific.
2. "6:00 PM" is not "around 6." It is 6:00. The commissioner has a watch.
3. Saturday 9:00 AM exists as a test. Selecting it is a cry for help and will be honored.
4. The undersigned agrees that fantasy football is a legally binding family obligation, unlike RSVPs, gym memberships, or "I'll be there in 10."
5. Carbon copies of this form will be stored in a drawer that does not open.
6. Any attempt to select times in a normal user interface is punishable by being asked to bring chips.
7. Mountain Time people: we did the math. You are one hour later. Stop asking.
8. The FAXNET 9000 is not out of order. The handwritten sign is decorative.
9. If this kiosk eats your availability, please re-enter it. Then re-enter it again, but with feeling.
10. By pressing a button you certify you are a Boger, married to a Boger, or have accepted your fate.
11. The commissioner may change the draft time anyway. This form exists so everyone can be equally disappointed.
12. Hold music is mandatory. Enjoyment is optional.
13. Rubber stamps are the only legally recognized method of indicating availability. Checkboxes are a myth.
14. You have not read this. We respect that. Please indicate as much below.`

const QUEUE = [12, 13, 88, 46, 47]
const CLIP_SLOT = '2026-08-22T09:00'
const YOUR_TICKET = 47

type State = {
  stage: Stage
  startedAt: number
  rageClicks: number
  stamps: number
  slams: number
  nowServing: number
  queueIndex: number
  missed47: number
  name: string
  eStuck: boolean
  ink: number
  mode: 'available' | 'void'
  selected: Set<string>
  week: number
  clipGone: boolean
  clipTaps: number
  baggingDone: boolean
  continueNudge: number
  sigRejected: boolean
  faxPhase: FaxPhase
  faxError: string
  sending: boolean
  results: DraftResponse[] | null
  overlay: string | null
  hintShown: boolean
}

const state: State = {
  stage: 'attract',
  startedAt: Date.now(),
  rageClicks: 0,
  stamps: 0,
  slams: 0,
  nowServing: QUEUE[0],
  queueIndex: 0,
  missed47: 0,
  name: '',
  eStuck: true,
  ink: 0,
  mode: 'available',
  selected: new Set(),
  week: 0,
  clipGone: false,
  clipTaps: 0,
  baggingDone: false,
  continueNudge: 0,
  sigRejected: false,
  faxPhase: 'dial',
  faxError: '',
  sending: false,
  results: null,
  overlay: null,
  hintShown: false,
}

let timers: number[] = []
let idleTimer: number | null = null
let sigLen = 0
let drawing = false

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function later(fn: () => void, ms: number): void {
  timers.push(window.setTimeout(fn, ms))
}

function clearTimers(): void {
  for (const id of timers) {
    window.clearTimeout(id)
    window.clearInterval(id)
  }
  timers = []
}

function toast(msg: string, ms = 1800): void {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg
  el.classList.add('show')
  window.setTimeout(() => el.classList.remove('show'), ms)
}

function bumpIdle(): void {
  if (idleTimer !== null) window.clearTimeout(idleTimer)
  if (state.stage === 'attract' || state.stage === 'results') return
  idleTimer = window.setTimeout(() => {
    if (state.stage === 'slots' && !state.hintShown) {
      state.hintShown = true
      toast('OPERATOR: have you tried putting ink on the stamp. that is the whole thing.')
    }
  }, 16000)
}

function setStage(stage: Stage): void {
  clearTimers()
  stopHoldMusic()
  state.stage = stage
  state.overlay = null
  renderStage()
  bindStage()
  bumpIdle()
}

function pad3(n: number): string {
  return String(n).padStart(3, '0')
}

function inkBar(): string {
  const filled = state.ink
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, 2 - filled))
}

function resetVisit(): void {
  state.name = ''
  state.eStuck = true
  state.ink = 0
  state.mode = 'available'
  state.selected = new Set()
  state.week = 0
  state.clipGone = false
  state.clipTaps = 0
  state.baggingDone = false
  state.continueNudge = 0
  state.sigRejected = false
  state.faxPhase = 'dial'
  state.faxError = ''
  state.sending = false
  state.results = null
  state.hintShown = false
  state.queueIndex = 0
  state.nowServing = QUEUE[0]
  state.missed47 = 0
  state.rageClicks = 0
  state.stamps = 0
  state.slams = 0
  state.startedAt = Date.now()
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

function chrome(): string {
  return `
    <div class="room">
      <div class="fluorescent"></div>
      <div class="kiosk">
        <div class="nameplate">
          <span class="screws"></span>
          FAXNET 9000
          <span class="vcr">12:00</span>
        </div>
        <p class="subtitle">Boger Bowl Temporal Affairs · Model BB-19</p>
        <div class="bezel">
          <div class="crt" id="crt">
            <div class="stage" id="stage"></div>
            <div class="scanlines"></div>
            <div class="dirt"></div>
          </div>
        </div>
        <div class="led-row">
          <span class="led on">PWR</span>
          <span class="led blink">FAX</span>
          <span class="led warn">TONER LOW</span>
          <span class="led">ONLINE?</span>
        </div>
        <p class="badge">PROPERTY OF THE COMMISSIONER · DO NOT UNPLUG · HIT SIDE IF FROZEN</p>
      </div>
      <div id="toast" class="toast"></div>
      <div id="modal" class="modal hidden"></div>
    </div>
  `
}

function renderStage(): void {
  const stage = document.getElementById('stage')
  const crt = document.getElementById('crt')
  if (!stage || !crt) return
  crt.classList.toggle('paper', ['waiver', 'name', 'slots', 'notary', 'results'].includes(state.stage))
  crt.classList.toggle('attracting', state.stage === 'attract')
  stage.innerHTML = view()
}

function view(): string {
  switch (state.stage) {
    case 'attract':
      return attractView()
    case 'boot':
      return `<pre class="boot" id="boot"></pre>`
    case 'ticket':
      return ticketView()
    case 'waiver':
      return waiverView()
    case 'name':
      return nameView()
    case 'hold':
      return holdView()
    case 'slots':
      return slotsView()
    case 'notary':
      return notaryView()
    case 'fax':
      return faxView()
    case 'results':
      return resultsView()
    default:
      return ''
  }
}

function attractView(): string {
  return `
    <div class="attract">
      <div class="flyer">▬▬ FAX ▬▬</div>
      <h1>TOUCH THE GREASE<br>TO BEGIN</h1>
      <p class="fine">authorized personnel only (this is you)</p>
      <button type="button" class="deco" data-act="fake-begin">BEGIN</button>
      <p class="deco-cap">this button is decorative</p>
      <button type="button" class="grease" data-act="start" aria-label="greasy spot"></button>
      <button type="button" class="ghost-link" data-act="printout">commissioner printout</button>
    </div>
  `
}

function ticketView(): string {
  return `
    <div class="ticket">
      <p class="kicker">PLEASE TAKE A NUMBER</p>
      <p class="your">YOUR TICKET</p>
      <div class="big-num">${pad3(YOUR_TICKET)}</div>
      <p class="kicker">NOW SERVING</p>
      <div class="serving" id="serving">${pad3(state.nowServing)}</div>
      <button type="button" class="btn primary" data-act="claim">THAT'S ME</button>
      <p class="fine">if your number is skipped, that is the policy</p>
    </div>
  `
}

function waiverView(): string {
  return `
    <div class="paper-form">
      <h2>FORM BB-19</h2>
      <p class="carbon">carbon copy · do not fold · do not read</p>
      <div class="bylaws">${esc(WAIVER)}</div>
      <button type="button" class="btn" data-act="liar">I HAVE READ EVERY WORD</button>
      <button type="button" class="btn primary" data-act="honest">I HAVE NOT READ THIS AND THAT IS FINE</button>
    </div>
  `
}

function nameView(): string {
  const ghost = esc(state.name) || '<span class="blink">_</span>'
  return `
    <div class="paper-form">
      <h2>PRINT NAME LEGIBLY</h2>
      <p class="carbon">use the provided keyboard. the real one is for looking at.</p>
      <div class="nameplate-field">
        <div class="carbon-ghost">${esc(state.name)}</div>
        <div class="name-live">${ghost}</div>
      </div>
      <p class="caps">CAPS LOCK IS ON · it does not matter</p>
      <div class="kb">
        ${KEYS.map(
          (row) =>
            `<div class="kb-row">${row
              .map((k) => `<button type="button" class="key" data-act="key" data-key="${k}">${k}</button>`)
              .join('')}</div>`,
        ).join('')}
        <div class="kb-row">
          <button type="button" class="key space" data-act="key" data-key=" ">SPACE (DO NOT USE)</button>
        </div>
        <button type="button" class="btn primary" data-act="named">ACCEPT NAME (F7)</button>
      </div>
    </div>
  `
}

function holdView(): string {
  return `
    <div class="hold">
      <p class="kicker">AVAILABILITY SERVICES</p>
      <p class="hold-line">please wait while we connect you</p>
      <p class="wait" id="wait">estimated wait: 47 minutes</p>
      <div class="eq" id="eq"><i></i><i></i><i></i><i></i><i></i></div>
      <p class="muzak">♪ you are a valued league member ♪</p>
      <div class="pad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', '0', '#']
          .map((n) => `<button type="button" class="key pad-key" data-act="digit" data-digit="${n}">${n}</button>`)
          .join('')}
      </div>
      <p class="fine">press 0 for an operator who is at lunch</p>
    </div>
  `
}

function slotsView(): string {
  const days = [...new Set(SLOTS.filter((s) => s.week === state.week).map((s) => s.date))]
  const slots = SLOTS.filter((s) => s.week === state.week)
  return `
    <div class="paper-form slots-form">
      <div class="stamp-tray">
        <button type="button" class="ink-pad ${state.ink ? 'wet' : ''}" data-act="ink">
          <span>INK PAD</span>
          <small>${inkBar()}</small>
        </button>
        <div class="stamp-meta">
          <p>MODE: <strong>${state.mode === 'available' ? 'AVAILABLE' : 'VOID'}</strong></p>
          <button type="button" class="btn tiny" data-act="mode">FLIP STAMP</button>
          <p class="fine">ink, then stamp. stamp dries after two hits.</p>
        </div>
      </div>
      <div class="tabs">
        ${WEEK_LABELS.map(
          (label, i) =>
            `<button type="button" class="tab ${i === state.week ? 'on' : ''}" data-act="week" data-week="${i}">${label}</button>`,
        ).join('')}
      </div>
      <div class="days">
        ${days
          .map((date) => {
            const daySlots = slots.filter((s) => s.date === date)
            const weekday = daySlots[0]?.weekday ?? ''
            return `
              <section class="day">
                <h3>${prettyDate(date, weekday)}${daySlots[0]?.weekend ? ' · cosmic hours' : ''}</h3>
                <div class="slot-row">
                  ${daySlots
                    .map((s) => {
                      const on = state.selected.has(s.id)
                      const clip = s.id === CLIP_SLOT && !state.clipGone
                      return `
                        <button type="button" class="slot ${on ? 'stamped' : ''} ${state.mode === 'void' && on ? 'voiding' : ''}" data-act="slot" data-id="${s.id}">
                          <span class="slot-time">${s.time} PT</span>
                          ${on ? `<span class="mark">${state.mode === 'void' ? 'VOID?' : 'AVAILABLE'}</span>` : ''}
                          ${clip ? `<span class="clip" data-act="clip">📎</span>` : ''}
                        </button>`
                    })
                    .join('')}
                </div>
              </section>`
          })
          .join('')}
      </div>
      <p class="count">${state.selected.size} window${state.selected.size === 1 ? '' : 's'} notarized</p>
      <button type="button" class="btn" data-act="easy">SELECT ALL WEEKNIGHTS</button>
      <button type="button" class="btn" data-act="never">I AM AVAILABLE NEVER</button>
      <button type="button" class="btn primary" data-act="tonotary">CONTINUE TO NOTARY</button>
    </div>
  `
}

function notaryView(): string {
  return `
    <div class="paper-form">
      <h2>NOTARY BLOCK</h2>
      <p class="carbon">sign in the box. do not use a real pen on the monitor. we have asked before.</p>
      <canvas id="sig" class="sig" width="640" height="220" data-act="sig"></canvas>
      <div class="row">
        <button type="button" class="btn" data-act="clear-sig">CLEAR</button>
        <button type="button" class="btn primary" data-act="notarize">WITNESS MY HAND</button>
      </div>
    </div>
  `
}

function faxView(): string {
  if (state.faxPhase === 'nodial') {
    return `
      <div class="fax">
        <p class="kicker">NO DIAL TONE</p>
        <p>please replace the handset, then slam it, then try again</p>
        <button type="button" class="btn primary" data-act="slam">REPLACE HANDSET</button>
      </div>`
  }
  if (state.faxPhase === 'jam') {
    return `
      <div class="fax">
        <p class="kicker">PAPER JAM IN BIN 2</p>
        <p>drag the sheet out. or yank it. the machine deserves it.</p>
        <div class="jam-slot">
          <div class="jam-sheet" id="jam"></div>
        </div>
        <button type="button" class="btn" data-act="yank">YANK PAPER</button>
      </div>`
  }
  if (state.faxPhase === 'error') {
    return `
      <div class="fax">
        <p class="kicker">LINE BUSY</p>
        <p class="fine">${esc(state.faxError)}</p>
        <button type="button" class="btn primary" data-act="refax">RETRY TRANSMISSION</button>
      </div>`
  }
  const label =
    state.faxPhase === 'dial'
      ? 'DIALING LEAGUE HEADQUARTERS'
      : state.faxPhase === 'retry'
        ? 'REDIALING… PLEASE DO NOT HANG UP'
        : 'TRANSMITTING FORM BB-19'
  return `
    <div class="fax">
      <p class="kicker">${label}</p>
      <div class="bar"><div class="bar-fill" id="bar"></div></div>
      <p class="fine" id="faxpct">0%</p>
      <p class="fine">handshake tones mean it is working, probably</p>
    </div>
  `
}

function resultsView(): string {
  const rows = state.results ?? []
  const counts = new Map<string, string[]>()
  for (const slot of SLOTS) counts.set(slot.id, [])
  for (const row of rows) {
    for (const id of row.available_slot_ids) {
      counts.get(id)?.push(row.display_name)
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length
    return a[0].localeCompare(b[0])
  })
  const best = ranked.find(([, names]) => names.length > 0)
  const body = ranked
    .map(([id, names]) => {
      const n = names.length
      const bar = n ? '▓'.repeat(n) + '░'.repeat(Math.max(0, 6 - n)) : '░░░░░░'
      return `<div class="heat ${n ? 'has' : 'none'}">
        <span class="heat-time">${esc(formatSlot(id))}</span>
        <span class="heat-bar">${bar} ${n}</span>
        <span class="heat-names">${n ? esc(names.join(', ')) : '—'}</span>
      </div>`
    })
    .join('')
  return `
    <div class="printout">
      <p class="kicker">*** LEAGUE HEADQUARTERS ***</p>
      <h2>AVAILABILITY PRINTOUT</h2>
      <p>submitted as ${esc(state.name)} · ${state.selected.size} windows · ${state.rageClicks} rage clicks</p>
      ${
        best
          ? `<div class="pick"><strong>COMMISSIONER'S TENTATIVE PICK</strong><br>${esc(formatSlot(best[0]))}<br>${esc(best[1].join(', ') || 'just you') }</div>`
          : `<div class="pick">you are the first victim. congratulations.</div>`
      }
      <div class="heat-list">${body}</div>
      <button type="button" class="btn primary" data-act="again">FILE ANOTHER (DO NOT)</button>
    </div>
  `
}

function showModal(html: string): void {
  const modal = document.getElementById('modal')
  if (!modal) return
  modal.innerHTML = `<div class="modal-card">${html}</div>`
  modal.classList.remove('hidden')
}

function hideModal(): void {
  document.getElementById('modal')?.classList.add('hidden')
}

function bindStage(): void {
  if (state.stage === 'attract') {
    later(() => {
      document.querySelector('.grease')?.classList.add('find-me')
      toast('the painted button does nothing. press the fingerprint.')
    }, 4500)
  }

  if (state.stage === 'boot') {
    const box = document.getElementById('boot')
    let i = 0
    const write = () => {
      if (!box) return
      if (i < BOOT_LINES.length) {
        box.textContent = `${box.textContent ?? ''}${BOOT_LINES[i]}\n`
        box.scrollTop = box.scrollHeight
        i += 1
        later(write, 260)
      } else {
        later(() => setStage('ticket'), 650)
      }
    }
    write()
  }

  if (state.stage === 'ticket') {
    const tickQueue = () => {
      const stay = state.nowServing === YOUR_TICKET ? 2600 : 720
      later(() => {
        state.queueIndex += 1
        if (state.queueIndex >= QUEUE.length) {
          state.missed47 += 1
          if (state.missed47 >= 2) {
            toast('the commissioner has waived you forward. this is not a kindness.')
            later(() => setStage('waiver'), 900)
            return
          }
          state.queueIndex = 0
          toast('please see the front desk. the front desk is this kiosk.')
        }
        state.nowServing = QUEUE[state.queueIndex]
        const el = document.getElementById('serving')
        if (el) el.textContent = pad3(state.nowServing)
        tickQueue()
      }, stay)
    }
    tickQueue()
  }

  if (state.stage === 'hold') {
    startHoldMusic()
    let secs = 12
    const wait = document.getElementById('wait')
    const tickWait = () => {
      later(() => {
        secs -= 1
        if (wait) wait.textContent = `estimated wait: ${Math.max(secs, 0)} minutes`
        if (secs <= 0) {
          toast('transferring you to someone who also cannot help')
          later(() => setStage('slots'), 800)
          return
        }
        tickWait()
      }, 1000)
    }
    tickWait()
  }

  if (state.stage === 'notary') bindSignature()
  if (state.stage === 'fax') bindFax()
  if (state.stage === 'slots') bindClip()
}

function bindClip(): void {
  const clip = document.querySelector('.clip')
  if (!clip) return
  let startX = 0
  let startY = 0
  const onDown = (ev: Event) => {
    const p = 'clientX' in ev ? (ev as PointerEvent) : (ev as TouchEvent).touches[0]
    startX = p.clientX
    startY = p.clientY
  }
  const onUp = (ev: Event) => {
    const p =
      'clientX' in ev
        ? (ev as PointerEvent)
        : (ev as TouchEvent).changedTouches[0]
    const dx = p.clientX - startX
    const dy = p.clientY - startY
    if (Math.hypot(dx, dy) > 36) {
      state.clipGone = true
      toast('paperclip has been relocated to another dimension')
      renderStage()
      bindStage()
    }
  }
  clip.addEventListener('pointerdown', onDown)
  clip.addEventListener('pointerup', onUp)
}

function bindSignature(): void {
  const canvas = document.getElementById('sig') as HTMLCanvasElement | null
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.floor(rect.width * ratio)
    canvas.height = Math.floor(rect.height * ratio)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }
  resize()
  sigLen = 0
  drawing = false
  let last: { x: number; y: number } | null = null
  const pos = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    return { x: ev.clientX - r.left, y: ev.clientY - r.top }
  }
  canvas.addEventListener('pointerdown', (ev) => {
    drawing = true
    last = pos(ev)
    canvas.setPointerCapture(ev.pointerId)
  })
  canvas.addEventListener('pointermove', (ev) => {
    if (!drawing || !last) return
    const p = pos(ev)
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    sigLen += Math.hypot(p.x - last.x, p.y - last.y)
    last = p
  })
  canvas.addEventListener('pointerup', () => {
    drawing = false
    last = null
  })
}

function setBar(pct: number): void {
  const bar = document.getElementById('bar')
  const label = document.getElementById('faxpct')
  if (bar) bar.style.width = `${pct}%`
  if (label) label.textContent = `${Math.round(pct)}%`
}

function animateBar(from: number, to: number, ms: number, done: () => void): void {
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms)
    setBar(from + (to - from) * t)
    if (t < 1) requestAnimationFrame(step)
    else done()
  }
  requestAnimationFrame(step)
}

function bindFax(): void {
  if (state.faxPhase === 'dial') {
    faxHandshake()
    animateBar(0, 23, 1400, () => {
      sadBeep()
      state.faxPhase = 'nodial'
      renderStage()
      bindStage()
    })
  }
  if (state.faxPhase === 'retry') {
    faxHandshake()
    animateBar(23, 87, 1600, () => {
      state.faxPhase = 'jam'
      renderStage()
      bindStage()
    })
  }
  if (state.faxPhase === 'jam') {
    const sheet = document.getElementById('jam')
    if (!sheet) return
    let y0 = 0
    let dy = 0
    sheet.addEventListener('pointerdown', (ev) => {
      y0 = ev.clientY
      sheet.setPointerCapture(ev.pointerId)
    })
    sheet.addEventListener('pointermove', (ev) => {
      if (y0 === 0) return
      dy = ev.clientY - y0
      sheet.style.transform = `translateY(${Math.max(0, dy)}px) rotate(${dy / 40}deg)`
    })
    sheet.addEventListener('pointerup', () => {
      if (dy > 70) clearJam()
      else sheet.style.transform = ''
      y0 = 0
      dy = 0
    })
  }
  if (state.faxPhase === 'send') {
    animateBar(87, 100, 900, () => {
      void transmit()
    })
  }
}

function clearJam(): void {
  toast('bin 2 is now empty. bin 1 is still haunted.')
  state.faxPhase = 'send'
  renderStage()
  bindStage()
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
      rage_clicks: state.rageClicks,
      bowling_throws: state.stamps + state.slams,
    })
    const rows = await listResponses()
    state.results = rows
    setStage('results')
  } catch (err) {
    busySignal()
    state.sending = false
    state.faxPhase = 'error'
    state.faxError = err instanceof Error ? err.message : 'unknown line fault'
    renderStage()
    bindStage()
  }
}

function onKey(key: string): void {
  if (key === '⌫') {
    state.name = state.name.slice(0, -1)
  } else if (key === ' ') {
    if (state.name.length === 0 || state.name.endsWith(' ')) {
      toast('we told you not to use space. we are allowing it anyway.')
    }
    if (state.name.length < 80) state.name += ' '
  } else if (key === 'E' && state.eStuck) {
    state.eStuck = false
    toast('KEY STUCK — hit E harder')
    sadBeep()
    return
  } else if (state.name.length < 80) {
    state.name += key
  }
  beep()
  renderStage()
  bindStage()
}

function stampSlot(id: string): void {
  if (id === CLIP_SLOT && !state.clipGone) {
    state.clipTaps += 1
    if (state.clipTaps >= 3) {
      state.clipGone = true
      toast('FINE. the paperclip is your problem now.')
      renderStage()
      bindStage()
    } else {
      toast('there is a paperclip on that. pick it off. drag it. suffer.')
    }
    return
  }
  if (state.mode === 'void') {
    if (!state.selected.has(id)) {
      toast('cannot void a window that was never real')
      return
    }
    if (state.ink <= 0) {
      toast('OUT OF INK — press the pad, obviously')
      sadBeep()
      return
    }
    state.selected.delete(id)
    state.ink -= 1
    state.stamps += 1
    stampSound()
    renderStage()
    bindStage()
    return
  }
  if (state.selected.has(id)) {
    toast('already stamped. flip the stamp to VOID if you regret this.')
    return
  }
  if (state.ink <= 0) {
    toast('OUT OF INK — ink the stamp. this is not a metaphor.')
    sadBeep()
    return
  }
  state.selected.add(id)
  state.ink -= 1
  state.stamps += 1
  stampSound()
  if (!state.baggingDone && state.selected.size === 4) {
    state.baggingDone = true
    showModal(
      `<p class="kicker">UNEXPECTED ITEM IN BAGGING AREA</p><p>please wait for assistance</p><p class="fine" id="assist">searching for an employee…</p>`,
    )
    later(() => {
      const a = document.getElementById('assist')
      if (a) a.textContent = 'assistance is unavailable. proceeding out of spite.'
    }, 1400)
    later(() => hideModal(), 2600)
  }
  renderStage()
  bindStage()
}

function handleAct(act: string, el: HTMLElement): void {
  bumpIdle()
  switch (act) {
    case 'fake-begin':
      toast('that button is painted on. try the grease.')
      sadBeep()
      break
    case 'start':
      unlockAudio()
      beep()
      state.startedAt = Date.now()
      setStage('boot')
      break
    case 'claim':
      if (state.nowServing === YOUR_TICKET) {
        beep()
        setStage('waiver')
      } else {
        sadBeep()
        toast(`that is ${pad3(state.nowServing)}. you are ${pad3(YOUR_TICKET)}. sit down.`)
      }
      break
    case 'liar':
      sadBeep()
      toast('LIAR. we watched you.')
      break
    case 'honest':
      beep()
      setStage('name')
      break
    case 'key':
      onKey(el.dataset.key ?? '')
      break
    case 'named':
      if (state.name.trim().length < 2) {
        sadBeep()
        toast('the commissioner requires more letters than that')
        return
      }
      beep()
      setStage('hold')
      break
    case 'digit': {
      const d = el.dataset.digit ?? ''
      if (d === '0') {
        stopHoldMusic()
        toast('operator is at lunch. sending you through anyway.')
        later(() => setStage('slots'), 700)
      } else if (d === '1') {
        toast('for English, press 1. for English, press 1.')
      } else {
        toast('invalid entry. the only valid entry is 0. we hid that.')
        sadBeep()
      }
      break
    }
    case 'ink':
      state.ink = 2
      beep()
      toast('stamp is wet. you have two impressions. do not waste them.')
      renderStage()
      bindStage()
      break
    case 'mode':
      state.mode = state.mode === 'available' ? 'void' : 'available'
      beep()
      renderStage()
      bindStage()
      break
    case 'week':
      state.week = Number(el.dataset.week ?? 0)
      toast('collating carbon copies…')
      renderStage()
      bindStage()
      break
    case 'slot':
      stampSlot(el.dataset.id ?? '')
      break
    case 'clip':
      state.clipTaps += 1
      if (state.clipTaps >= 3) {
        state.clipGone = true
        toast('FINE. the paperclip is your problem now.')
        renderStage()
        bindStage()
      } else {
        toast('there is a paperclip on that. pick it off. drag it. suffer.')
      }
      break
    case 'easy':
      toast('that would be too easy. stamp them yourself.')
      sadBeep()
      break
    case 'never':
      toast('then why are you at the kiosk. go home. stamp something.')
      sadBeep()
      break
    case 'tonotary':
      if (state.selected.size < 1) {
        sadBeep()
        toast('the commissioner requires at least one window')
        return
      }
      state.continueNudge += 1
      if (state.continueNudge < 2) {
        toast('PLEASE VERIFY YOUR SELECTIONS. then press it again. we do not trust you.')
        return
      }
      beep()
      setStage('notary')
      break
    case 'clear-sig':
      sigLen = 0
      renderStage()
      bindStage()
      break
    case 'notarize':
      if (sigLen < 140) {
        sadBeep()
        toast('that is a tap. this is a signature block. draw a mess.')
        return
      }
      if (!state.sigRejected) {
        state.sigRejected = true
        sadBeep()
        toast('SIGNATURE TOO LEGIBLE. please sign worse.')
        return
      }
      beep()
      state.faxPhase = 'dial'
      state.sending = false
      setStage('fax')
      break
    case 'slam':
      slam()
      state.slams += 1
      toast('cradle damaged. good.')
      state.faxPhase = 'retry'
      renderStage()
      bindStage()
      break
    case 'yank':
      slam()
      clearJam()
      break
    case 'refax':
      state.faxPhase = 'dial'
      state.sending = false
      renderStage()
      bindStage()
      break
    case 'again':
      resetVisit()
      toast('the machine is rebooting its contempt')
      setStage('attract')
      break
    case 'printout':
      void (async () => {
        try {
          const rows = await listResponses()
          state.results = rows
          state.name = 'Commissioner'
          setStage('results')
        } catch (err) {
          sadBeep()
          toast(err instanceof Error ? err.message : 'printout tray empty')
        }
      })()
      break
    case 'sig':
      break
    default:
      break
  }
}

export function mountKiosk(el: HTMLElement): void {
  const root = el
  root.innerHTML = chrome()
  renderStage()
  bindStage()

  root.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement
    const actEl = target.closest<HTMLElement>('[data-act]')
    if (!actEl) {
      state.rageClicks += 1
      return
    }
    ev.preventDefault()
    handleAct(actEl.dataset.act ?? '', actEl)
  })

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'm' && ev.metaKey) muteForever()
  })
}
