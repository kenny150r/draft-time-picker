let ctx: AudioContext | null = null
let holdTimer: number | null = null
let muted = false

function audio(): AudioContext | null {
  if (muted) return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function unlockAudio(): void {
  audio()
}

function tone(freq: number, duration: number, type: OscillatorType, gain = 0.05, delay = 0): void {
  const ac = audio()
  if (!ac) return
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.value = gain
  osc.connect(g)
  g.connect(ac.destination)
  const start = ac.currentTime + delay
  osc.start(start)
  g.gain.setTargetAtTime(0, start + duration * 0.7, 0.04)
  osc.stop(start + duration)
}

export function beep(): void {
  tone(880, 0.08, 'square', 0.04)
}

export function sadBeep(): void {
  tone(180, 0.22, 'square', 0.05)
  tone(140, 0.28, 'square', 0.04, 0.12)
}

export function stampSound(): void {
  tone(90, 0.09, 'square', 0.08)
  tone(220, 0.05, 'triangle', 0.03, 0.02)
}

export function slam(): void {
  tone(70, 0.18, 'sawtooth', 0.09)
  tone(50, 0.3, 'square', 0.06, 0.04)
}

export function busySignal(): void {
  for (let i = 0; i < 4; i += 1) {
    tone(480, 0.35, 'square', 0.05, i * 0.7)
    tone(620, 0.35, 'square', 0.03, i * 0.7)
  }
}

export function faxHandshake(): void {
  const ac = audio()
  if (!ac) return
  for (let i = 0; i < 12; i += 1) {
    tone(1650 + (i % 3) * 80, 0.08, 'sine', 0.04, i * 0.09)
  }
  tone(2100, 0.6, 'sine', 0.03, 1.1)
}

const HOLD = [261.63, 329.63, 392.0, 349.23, 329.63, 293.66, 261.63, 196.0]

export function startHoldMusic(): void {
  stopHoldMusic()
  let i = 0
  const tick = () => {
    const n = HOLD[i % HOLD.length]
    if (n) tone(n, 0.28, 'triangle', 0.035)
    i += 1
  }
  tick()
  holdTimer = window.setInterval(tick, 320)
}

export function stopHoldMusic(): void {
  if (holdTimer !== null) {
    window.clearInterval(holdTimer)
    holdTimer = null
  }
}

export function muteForever(): void {
  muted = true
  stopHoldMusic()
  void ctx?.suspend()
}
