let ctx: AudioContext | null = null

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
