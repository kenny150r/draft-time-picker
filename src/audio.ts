let ctx: AudioContext | null = null
let musicTimer = 0
let musicStep = 0

function audio(): AudioContext | null {
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
  g.gain.setTargetAtTime(0.0001, start + duration * 0.65, 0.03)
  osc.stop(start + duration)
}

export function ding(): void {
  tone(880, 0.12, 'square', 0.04)
  tone(1320, 0.16, 'square', 0.03, 0.05)
}

export function chord(): void {
  tone(392, 0.55, 'sawtooth', 0.03)
  tone(494, 0.7, 'sawtooth', 0.025, 0.02)
  tone(587, 0.9, 'triangle', 0.03, 0.04)
  tone(784, 0.35, 'square', 0.02, 0.12)
}

export function chordSad(): void {
  tone(196, 0.35, 'square', 0.05)
  tone(165, 0.45, 'square', 0.04, 0.12)
}

export function sfxMove(): void {
  tone(220, 0.04, 'square', 0.02)
}

export function sfxRotate(): void {
  tone(440, 0.05, 'square', 0.025)
  tone(554, 0.06, 'square', 0.02, 0.03)
}

export function sfxLand(): void {
  tone(160, 0.07, 'square', 0.035)
}

export function sfxClear(): void {
  tone(523, 0.08, 'square', 0.03)
  tone(659, 0.1, 'square', 0.03, 0.06)
}

export function sfxVirus(): void {
  tone(392, 0.08, 'square', 0.04)
  tone(523, 0.1, 'square', 0.035, 0.07)
  tone(784, 0.14, 'square', 0.03, 0.14)
}

export function sfxLose(): void {
  tone(196, 0.18, 'square', 0.05)
  tone(165, 0.22, 'square', 0.04, 0.12)
  tone(131, 0.35, 'square', 0.04, 0.28)
}

export function sfxWin(): void {
  tone(523, 0.12, 'square', 0.04)
  tone(659, 0.12, 'square', 0.035, 0.12)
  tone(784, 0.12, 'square', 0.035, 0.24)
  tone(1046, 0.28, 'square', 0.03, 0.36)
}

const TUNE: [number, number][] = [
  [392, 140],
  [494, 140],
  [587, 140],
  [698, 210],
  [587, 140],
  [494, 140],
  [392, 280],
  [0, 80],
  [349, 140],
  [440, 140],
  [523, 140],
  [659, 210],
  [523, 140],
  [440, 140],
  [349, 280],
  [0, 120],
]

export function startMusic(): void {
  stopMusic()
  const beat = (): void => {
    const note = TUNE[musicStep % TUNE.length]
    musicStep += 1
    if (!note) return
    const [freq, ms] = note
    if (freq > 0) tone(freq, ms / 1000, 'square', 0.018)
    musicTimer = window.setTimeout(beat, ms)
  }
  beat()
}

export function stopMusic(): void {
  if (musicTimer) window.clearTimeout(musicTimer)
  musicTimer = 0
  musicStep = 0
}
