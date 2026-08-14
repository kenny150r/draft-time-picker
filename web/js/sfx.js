let ctx;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function beep(freq, dur, type = "square", gain = 0.04, at = 0) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(c.destination);
  const t = c.currentTime + at;
  o.start(t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.stop(t + dur + 0.02);
}

export function unlock() {
  try {
    ac();
  } catch {
    /* ignore */
  }
}

export const sfx = {
  boot: () => {
    beep(140, 0.2, "sawtooth", 0.03);
    beep(220, 0.18, "square", 0.03, 0.12);
    beep(330, 0.3, "square", 0.04, 0.24);
  },
  click: () => beep(420, 0.04, "square", 0.03),
  bad: () => {
    beep(180, 0.12, "sawtooth", 0.05);
    beep(110, 0.2, "square", 0.05, 0.08);
  },
  ok: () => {
    beep(520, 0.08, "square", 0.04);
    beep(740, 0.12, "square", 0.04, 0.08);
  },
  roll: () => {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(90, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.8);
    g.gain.value = 0.03;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.85);
    o.stop(c.currentTime + 0.9);
  },
  pins: () => {
    beep(700, 0.05, "triangle", 0.05);
    beep(500, 0.08, "triangle", 0.04, 0.04);
    beep(820, 0.06, "square", 0.03, 0.09);
  },
  gutter: () => {
    beep(90, 0.35, "sawtooth", 0.06);
  },
  strike: () => {
    beep(392, 0.1, "square", 0.05);
    beep(523, 0.1, "square", 0.05, 0.1);
    beep(659, 0.12, "square", 0.05, 0.2);
    beep(784, 0.25, "square", 0.05, 0.32);
  },
  laugh: () => {
    beep(600, 0.07, "square", 0.04);
    beep(500, 0.07, "square", 0.04, 0.08);
    beep(650, 0.12, "square", 0.04, 0.16);
  },
  fax: () => {
    for (let i = 0; i < 8; i++) beep(1800 + (i % 2) * 400, 0.07, "square", 0.03, i * 0.08);
  },
};
