import { sfx } from "./sfx.js";

const PIN_SPOTS = [
  { n: 1, x: 0, z: 0.0 },
  { n: 2, x: -0.11, z: 0.09 },
  { n: 3, x: 0.11, z: 0.09 },
  { n: 4, x: -0.22, z: 0.18 },
  { n: 5, x: 0, z: 0.18 },
  { n: 6, x: 0.22, z: 0.18 },
  { n: 7, x: -0.33, z: 0.27 },
  { n: 8, x: -0.11, z: 0.27 },
  { n: 9, x: 0.11, z: 0.27 },
  { n: 10, x: 0.33, z: 0.27 },
];

function makePins() {
  return PIN_SPOTS.map((p, i) => ({
    ...p,
    i,
    up: true,
    rot: 0,
    vx: 0,
    vz: 0,
    wobble: Math.random() * Math.PI * 2,
    dodge: 0,
  }));
}

export function mountBowling(canvas, { member, onThrow, onPass, onRage }) {
  const ctx = canvas.getContext("2d");
  let w = 0;
  let h = 0;
  let dpr = 1;
  let pins = makePins();
  let ball = null;
  let mode = "aim"; // aim | power | roll | settle
  let aim = 0;
  let powerT = 0;
  let power = 0;
  let throws = 0;
  let ballInFrame = 0;
  let framePinsStart = 10;
  let mercy = false;
  let passed = false;
  let taunt = "Prove you are not a robot. Robots cannot bowl. (Citation: Kenny.)";
  let frogX = 0.08;
  let frogDir = 1;
  let lights = 0;
  let exitX = 0.86;
  let hoveringExit = false;
  let last = performance.now();
  let settleT = 0;
  let pointer = { x: 0.5, y: 0.5, down: false };
  let raf = 0;
  let destroyed = false;

  function resize() {
    const rec = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(320, rec.width);
    h = Math.max(280, rec.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function project(x, z) {
    const top = 78;
    const bot = h - 58;
    const y = top + (1 - z) * (bot - top);
    const halfNear = w * 0.28;
    const halfFar = w * 0.055;
    const half = halfFar + (1 - z) * (halfNear - halfFar);
    const cx = w * 0.34;
    return { x: cx + x * half * 1.15, y, s: 0.35 + (1 - z) * 1.1, half, cx };
  }

  function resetPins(keepDown) {
    const next = makePins();
    if (keepDown) {
      for (let i = 0; i < 10; i++) next[i].up = pins[i].up;
    }
    pins = next;
  }

  function standing() {
    return pins.filter((p) => p.up).length;
  }

  function throwBall() {
    if (mode !== "power") return;
    mode = "roll";
    throws += 1;
    ballInFrame += 1;
    onThrow?.(throws);
    const jitter = (Math.random() - 0.5) * (mercy ? 0.02 : 0.08);
    const ice = mercy ? 0.04 : 0.12 + Math.random() * 0.1;
    ball = {
      x: aim * 0.55,
      z: 0.02,
      r: mercy ? 0.07 : 0.055,
      vx: jitter,
      vz: 0.55 + power * 0.85,
      ice,
      spin: (Math.random() - 0.5) * (mercy ? 0.05 : 0.22),
    };
    sfx.roll();
  }

  function collidePins() {
    if (!ball) return;
    for (const p of pins) {
      if (!p.up) continue;
      const px = p.x + p.dodge;
      const pz = 0.78 + p.z;
      const dx = ball.x - px;
      const dz = ball.z - pz;
      const dist = Math.hypot(dx, dz);
      const hitR = ball.r + 0.07;
      if (dist < hitR) {
        p.up = false;
        p.vx = dx > 0 ? -0.8 - Math.random() : 0.8 + Math.random();
        p.vz = 0.4 + Math.random();
        p.rot = 0.2;
        ball.vx += dx * 0.4;
        ball.vz *= 0.92;
        sfx.pins();
      }
    }
    // chain
    for (let n = 0; n < 3; n++) {
      for (const a of pins) {
        if (a.up) continue;
        for (const b of pins) {
          if (!b.up) continue;
          const dx = a.x - b.x;
          const dz = a.z - b.z;
          if (Math.hypot(dx, dz) < 0.14 && Math.random() < (mercy ? 0.85 : 0.55)) {
            b.up = false;
            b.vx = -dx * 4;
            b.rot = 0.3;
          }
        }
      }
    }
  }

  function pocketStrike(impactX, pwr) {
    const pocket = impactX > -0.04 && impactX < 0.14;
    const goodP = pwr > 0.42 && pwr < 0.92;
    if (pocket && goodP) {
      const chance = mercy ? 0.92 : 0.62;
      if (Math.random() < chance) {
        for (const p of pins) p.up = false;
      }
    }
  }

  function finishBall() {
    const left = standing();
    const knocked = framePinsStart - left;
    if (ballInFrame === 1 && left === 0) {
      taunt = "STRIKE. The elves have filed a grievance.";
      sfx.strike();
      passed = true;
      onPass?.({ throws, strike: true });
      mode = "aim";
      ball = null;
      return;
    }
    if (ballInFrame === 2 && left === 0) {
      taunt = "Spare. Barely. Captcha considers this 'human enough'.";
      sfx.ok();
      passed = true;
      onPass?.({ throws, strike: false });
      mode = "aim";
      ball = null;
      return;
    }
    if (ballInFrame === 1 && left > 0) {
      taunt =
        knocked === 0
          ? `${member.taunt} Gutter energy.`
          : `${knocked} elves down. Convert the spare, ${member.name}.`;
      if (knocked === 0) sfx.gutter();
      else sfx.laugh();
      mode = "aim";
      ball = null;
      framePinsStart = left;
      resetPins(true);
      return;
    }
    // end of frame, failed
    taunt = left === 10 ? "The elves remain. Again." : `Open frame. ${left} still mocking you.`;
    sfx.laugh();
    ballInFrame = 0;
    framePinsStart = 10;
    if (throws >= 6) mercy = true;
    resetPins(false);
    mode = "aim";
    ball = null;
    if (mercy && throws === 6) taunt = "Handicap: Barbara's rum balls have been deployed. The elves are wobbly.";
  }

  function tick(dt) {
    lights += dt;
    frogX += frogDir * dt * 0.12;
    if (frogX > 0.28) frogDir = -1;
    if (frogX < -0.28) frogDir = 1;
    for (const p of pins) p.wobble += dt * (mercy ? 8 : 3);

    if (mode === "power") {
      powerT += dt * (mercy ? 1.6 : 2.6 + Math.sin(lights * 3) * 0.7);
      power = (Math.sin(powerT) + 1) / 2;
    }

    if (mode === "aim" && !passed) {
      // elves dodge a little while waiting
      for (const p of pins) {
        if (p.up && p.i > 0 && Math.random() < 0.002) p.dodge = (Math.random() - 0.5) * (mercy ? 0.02 : 0.08);
      }
    }

    if (mode === "roll" && ball) {
      ball.vx += ball.spin * dt * 0.35;
      ball.vx += (Math.random() - 0.5) * ball.ice * dt;
      ball.x += ball.vx * dt;
      ball.z += ball.vz * dt * 0.55;
      if (Math.abs(ball.x - frogX) < 0.07 && ball.z > 0.38 && ball.z < 0.5) {
        ball.vx += frogX > 0 ? 0.35 : -0.35;
        taunt = "The frog. Of course the frog.";
      }
      if (Math.abs(ball.x) > 0.92 && ball.z > 0.2) {
        ball.z = 1.2;
        ball.gutter = true;
      }
      if (ball.z > 0.76 && ball.z < 1.05 && !ball.gutter) {
        collidePins();
        if (!ball.pocketed) {
          ball.pocketed = true;
          pocketStrike(ball.x, power);
        }
      }
      if (ball.z > 1.15) {
        mode = "settle";
        settleT = 0;
        if (ball.gutter) {
          for (const p of pins) {
            /* leave standing */
          }
        }
      }
    }

    if (mode === "settle") {
      settleT += dt;
      for (const p of pins) {
        if (!p.up) p.rot += dt * 4;
      }
      if (settleT > 0.7) finishBall();
    }

    if (hoveringExit) exitX = 0.72 + Math.sin(lights * 9) * 0.12;
  }

  function drawElf(x, y, s, pin, face) {
    ctx.save();
    ctx.translate(x, y);
    if (!pin.up) ctx.rotate(Math.min(pin.rot, 1.5) * (pin.vx >= 0 ? 1 : -1));
    ctx.scale(s, s);
    // boots
    ctx.fillStyle = "#e07020";
    ctx.beginPath();
    ctx.ellipse(-7, 22, 7, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(7, 22, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // tunic
    ctx.fillStyle = "#1f8a38";
    ctx.beginPath();
    ctx.moveTo(-12, 6);
    ctx.lineTo(12, 6);
    ctx.lineTo(9, 20);
    ctx.lineTo(-9, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f3efe4";
    ctx.fillRect(-12, 5, 24, 3);
    // beard
    ctx.fillStyle = "#f6f1e4";
    ctx.beginPath();
    ctx.moveTo(-8, 4);
    ctx.quadraticCurveTo(0, 18, 8, 4);
    ctx.fill();
    // face
    ctx.fillStyle = "#f0c9a8";
    ctx.beginPath();
    ctx.arc(0, -2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a1a12";
    ctx.fillRect(-4, -4, 2, 2);
    ctx.fillRect(2, -4, 2, 2);
    ctx.fillStyle = "#c45c5c";
    ctx.fillRect(-2, 0, 4, 1);
    if (face && pin.i === 0 && pin.up) {
      ctx.fillStyle = "#f0c9a8";
      ctx.fillRect(6, -1, 5, 2);
      ctx.fillStyle = "#e8b39a";
      ctx.beginPath();
      ctx.arc(11, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // hat
    ctx.fillStyle = "#d42b2b";
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.lineTo(9, -6);
    ctx.lineTo(0, -22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f3efe4";
    ctx.beginPath();
    ctx.arc(0, -22, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-9, -8, 18, 3);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    g.addColorStop(0, "#3a1a5a");
    g.addColorStop(1, "#6b3d8a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w * 0.68, h);

    // cave
    ctx.fillStyle = "#1a1020";
    ctx.beginPath();
    ctx.ellipse(w * 0.34, 86, 52, 36, 0, 0, Math.PI * 2);
    ctx.fill();

    // ice field
    ctx.fillStyle = "#9fd4ea";
    ctx.fillRect(0, h * 0.28, w * 0.68, h);

    // lane trapezoid
    const near = project(0, 0);
    const far = project(0, 1);
    ctx.fillStyle = "#3aa0d8";
    ctx.beginPath();
    ctx.moveTo(near.cx - near.half, near.y);
    ctx.lineTo(near.cx + near.half, near.y);
    ctx.lineTo(far.cx + far.half, far.y);
    ctx.lineTo(far.cx - far.half, far.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(near.cx, near.y);
    ctx.lineTo(far.cx, far.y);
    ctx.stroke();
    // gutters
    ctx.fillStyle = "#2b6f96";
    ctx.beginPath();
    ctx.moveTo(near.cx - near.half - 18, near.y);
    ctx.lineTo(near.cx - near.half, near.y);
    ctx.lineTo(far.cx - far.half, far.y);
    ctx.lineTo(far.cx - far.half - 8, far.y);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(near.cx + near.half, near.y);
    ctx.lineTo(near.cx + near.half + 18, near.y);
    ctx.lineTo(far.cx + far.half + 8, far.y);
    ctx.lineTo(far.cx + far.half, far.y);
    ctx.fill();

    // aim marker
    if (mode === "aim" || mode === "power") {
      const a = project(aim * 0.55, 0.08);
      ctx.strokeStyle = "#ffef8a";
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const b = project(aim * 0.55, 0.75);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // frog
    const fr = project(frogX, 0.44);
    ctx.fillStyle = "#2faf3a";
    ctx.beginPath();
    ctx.ellipse(fr.x, fr.y, 10 * fr.s, 7 * fr.s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d42b2b";
    ctx.beginPath();
    ctx.moveTo(fr.x - 6, fr.y - 6);
    ctx.lineTo(fr.x + 6, fr.y - 6);
    ctx.lineTo(fr.x, fr.y - 16);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(fr.x, fr.y - 16, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // pins far
    const sorted = [...pins].sort((a, b) => a.z - b.z);
    for (const p of sorted) {
      const pr = project(p.x + p.dodge + Math.sin(p.wobble) * (mercy ? 0.03 : 0.006), 0.78 + p.z);
      drawElf(pr.x, pr.y, 0.55 * pr.s, p, false);
    }

    // ball
    if (ball) {
      const br = project(ball.x, Math.min(ball.z, 1));
      ctx.fillStyle = "#c62828";
      ctx.beginPath();
      ctx.ellipse(br.x, br.y, 11 * br.s, 9 * br.s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f2ead8";
      ctx.beginPath();
      ctx.arc(br.x - 3, br.y - 3, 2.2 * br.s, 0, Math.PI * 2);
      ctx.fill();
    }

    // santa bowler
    ctx.fillStyle = "#f3efe4";
    ctx.beginPath();
    ctx.ellipse(w * 0.34, h - 18, 28, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d42b2b";
    ctx.beginPath();
    ctx.moveTo(w * 0.34 - 22, h - 28);
    ctx.lineTo(w * 0.34 + 18, h - 22);
    ctx.lineTo(w * 0.34 + 6, h - 52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f3efe4";
    ctx.beginPath();
    ctx.arc(w * 0.34 + 6, h - 52, 5, 0, Math.PI * 2);
    ctx.fill();

    // right panel elves
    ctx.fillStyle = "#2b1848";
    ctx.fillRect(w * 0.68, 0, w * 0.32, h);
    ctx.fillStyle = "#1a0e2e";
    ctx.fillRect(w * 0.68, h * 0.62, w * 0.32, h * 0.38);
    const formation = [
      [0.5, 0.78],
      [0.38, 0.62],
      [0.62, 0.62],
      [0.26, 0.46],
      [0.5, 0.46],
      [0.74, 0.46],
      [0.14, 0.3],
      [0.38, 0.3],
      [0.62, 0.3],
      [0.86, 0.3],
    ];
    pins.forEach((p, i) => {
      const [fx, fy] = formation[i];
      const x = w * 0.68 + fx * w * 0.32;
      const y = 70 + fy * (h - 140);
      drawElf(x, y, 1.15, p, true);
    });

    // top wood HUD
    ctx.fillStyle = "#6b4423";
    ctx.fillRect(0, 0, w, 44);
    ctx.fillStyle = "#5a381c";
    ctx.fillRect(0, 40, w, 6);
    const cols = ["#d42b2b", "#2faf3a", "#3aa0d8", "#f2d04a"];
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = cols[i % 4];
      ctx.beginPath();
      ctx.arc(16 + i * ((w - 32) / 21), 14 + Math.sin(lights * 6 + i) * 1.5, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f6f1e4";
    ctx.font = "italic 16px Georgia, serif";
    ctx.fillText("Santa", 12, 36);
    ctx.font = "12px Trebuchet MS, sans-serif";
    ctx.fillStyle = "#f2d04a";
    ctx.fillText("BOGERMATIC  •  instormomatic", w * 0.28, 36);
    ctx.fillStyle = "#ff7a18";
    const ex = exitX * w;
    ctx.fillRect(ex, 10, 52, 22);
    ctx.fillStyle = "#2a1a12";
    ctx.font = "bold 12px Trebuchet MS, sans-serif";
    ctx.fillText("EXIT", ex + 12, 26);

    // bottom pin map
    const mapX = w * 0.34 - 40;
    const mapY = h - 42;
    ctx.fillStyle = "#1a1020";
    ctx.fillRect(mapX - 8, mapY - 28, 96, 46);
    const mapPos = [
      [40, 4],
      [28, 14],
      [52, 14],
      [16, 24],
      [40, 24],
      [64, 24],
      [4, 34],
      [28, 34],
      [52, 34],
      [76, 34],
    ];
    pins.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(mapX + mapPos[i][0], mapY - 28 + mapPos[i][1], 4, 0, Math.PI * 2);
      ctx.fillStyle = p.up ? "#d42b2b" : "#222";
      ctx.fill();
    });

    // power meter
    if (mode === "power" || mode === "aim") {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(12, h - 52, 18, 40);
      const ph = 36 * (mode === "power" ? power : 0);
      ctx.fillStyle = power > 0.85 || power < 0.2 ? "#d42b2b" : power > 0.45 && power < 0.8 ? "#2faf3a" : "#f2d04a";
      ctx.fillRect(14, h - 14 - ph, 14, ph);
    }

    // caption
    ctx.fillStyle = "rgba(20,8,30,0.75)";
    ctx.fillRect(8, 52, w * 0.66 - 16, 28);
    ctx.fillStyle = "#f6f1e4";
    ctx.font = "12px Trebuchet MS, sans-serif";
    ctx.fillText(taunt, 14, 70);
    ctx.fillStyle = "#f2d04a";
    ctx.fillText(
      mercy ? "RUM-BALL HANDICAP" : `CAPTCHA  •  spare or strike  •  throws ${throws}`,
      14,
      88
    );
  }

  function loop(t) {
    if (destroyed) return;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    tick(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function canvasPos(e) {
    const rec = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rec.left) / rec.width, y: (src.clientY - rec.top) / rec.height };
  }

  function onPtr(e) {
    const p = canvasPos(e);
    pointer = { ...p, down: true };
    if (p.y < 0.1 && p.x > 0.78) {
      hoveringExit = true;
      onRage?.();
      taunt = `Draft dodging is a foul, ${member.name}.`;
      sfx.bad();
      return;
    }
    hoveringExit = false;
    if (passed) return;
    if (p.x > 0.68) return;
    if (mode === "aim") {
      aim = Math.max(-1, Math.min(1, (p.x - 0.34) / 0.28));
      mode = "power";
      powerT = Math.random() * 4;
      sfx.click();
    } else if (mode === "power") {
      throwBall();
    }
  }

  function onMove(e) {
    const p = canvasPos(e);
    if (p.y < 0.1 && p.x > 0.78) hoveringExit = true;
    else hoveringExit = false;
    if (mode === "aim" && p.x < 0.68) {
      aim = Math.max(-1, Math.min(1, (p.x - 0.34) / 0.28));
    }
  }

  function onKey(e) {
    if (passed) return;
    if (e.key === "ArrowLeft") aim = Math.max(-1, aim - 0.08);
    if (e.key === "ArrowRight") aim = Math.min(1, aim + 0.08);
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (mode === "aim") {
        mode = "power";
        powerT = Math.random() * 4;
      } else if (mode === "power") throwBall();
    }
  }

  resize();
  requestAnimationFrame(resize);
  window.addEventListener("resize", resize);
  canvas.addEventListener("pointerdown", onPtr);
  canvas.addEventListener("pointermove", onMove);
  window.addEventListener("keydown", onKey);
  raf = requestAnimationFrame(loop);

  return {
    getThrows: () => throws,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPtr);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
    },
  };
}
