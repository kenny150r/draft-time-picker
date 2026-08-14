/**
 * Elf Bowling CAPTCHA. A strike is required.
 * First throw is sabotaged (gutter). Second leaves a 10-pin.
 * After that the pocket is fair, then gets more generous so family can finish.
 */
export function mountBowling(canvas, { fast = false, onStatus, onStrike } = {}) {
  const W = 340;
  const H = 400;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const L = 78;
  const R = 262;
  const HEAD_X = 170;
  const HEAD_Y = 72;

  let throws = 0;
  let phase = 'aim'; // aim | power | rolling | settled
  let aimX = HEAD_X;
  let aimDir = 1;
  let power = 0.4;
  let powerDir = 1;
  let ball;
  let pins;
  let corgi = { x: -40, y: 210, vx: 0, show: false };
  let raf = 0;
  let alive = true;
  let status = 'Tap / click to lock aim. Elves are slippery.';

  function resetPins() {
    const dx = 15;
    const dy = 17;
    const rows = [[0], [-0.5, 0.5], [-1, 0, 1], [-1.5, -0.5, 0.5, 1.5]];
    pins = [];
    rows.forEach((row, r) => {
      row.forEach((k) => {
        const x = HEAD_X + k * dx * 2;
        const y = HEAD_Y + r * dy;
        pins.push({ x, y, ox: x, oy: y, r: 7.2, vx: 0, vy: 0, fallen: false });
      });
    });
  }

  function resetBall() {
    ball = { x: HEAD_X, y: 348, r: fast ? 11 : 9, vx: 0, vy: 0, rolling: false };
  }

  function setStatus(msg) {
    status = msg;
    onStatus?.(msg, throws);
  }

  function launch() {
    throws += 1;
    const p = 4.2 + power * 11;
    let vx = ((aimX - HEAD_X) / 90) * p;
    let vy = -p;
    if (!fast && throws === 1) {
      vx = aimX < HEAD_X ? -3.8 : 3.8;
      vy = -6.2;
      setStatus('Throw 1: the elves waxed the lane. Gutter. Typical Christmas.');
    } else {
      setStatus(`Throw ${throws}: ball’s out. Pray to Barbara’s corgis.`);
    }
    ball.vx = vx;
    ball.vy = vy;
    ball.rolling = true;
    phase = 'rolling';
    if (throws >= 3 && Math.random() < 0.35) {
      corgi = { x: -30, y: 200 + Math.random() * 40, vx: 2.4, show: true };
    }
  }

  function collide(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const min = a.r + b.r;
    if (dist >= min) return false;
    const overlap = min - dist;
    const nx = dx / dist;
    const ny = dy / dist;
    b.x += nx * overlap;
    b.y += ny * overlap;
    const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (rel > 0) {
      const impulse = rel * 0.92;
      b.vx += nx * impulse;
      b.vy += ny * impulse;
      a.vx -= nx * impulse * 0.35;
      a.vy -= ny * impulse * 0.25;
    }
    return true;
  }

  function pocketHit() {
    const head = pins[0];
    if (!head || head.fallen) return false;
    const d = Math.hypot(ball.x - head.x, ball.y - head.y);
    if (d > ball.r + head.r + 1) return false;
    const off = Math.abs(ball.x - head.x);
    const speed = Math.hypot(ball.vx, ball.vy);
    let pocket = 7;
    if (fast) pocket = 16;
    else if (throws === 1) pocket = 0;
    else if (throws === 2) pocket = 5;
    else if (throws >= 6) pocket = 22;
    else pocket = 8;
    return off < pocket && speed > 5.5;
  }

  function scatterAll() {
    pins.forEach((p, i) => {
      p.fallen = true;
      p.vx = (i % 2 ? 1 : -1) * (1.2 + Math.random() * 2.4);
      p.vy = -1.5 - Math.random() * 2;
    });
  }

  function settle() {
    const down = pins.filter((p) => p.fallen || Math.hypot(p.x - p.ox, p.y - p.oy) > 14).length;
    pins.forEach((p) => {
      if (Math.hypot(p.x - p.ox, p.y - p.oy) > 14) p.fallen = true;
    });
    let knocked = pins.filter((p) => p.fallen).length;

    if (!fast && throws === 2 && knocked >= 9) {
      const ten = pins[9];
      if (ten) {
        ten.fallen = false;
        ten.x = ten.ox;
        ten.y = ten.oy;
        ten.vx = 0;
        ten.vy = 0;
      }
      knocked = pins.filter((p) => p.fallen).length;
      setStatus('Nine. The 10-pin is an elf and he lives. Need a STRIKE.');
      phase = 'aim';
      resetPins();
      resetBall();
      return;
    }

    if (knocked === 10) {
      phase = 'settled';
      setStatus('STRIKE. The elves are down. Barbara brought cinnamon rolls for the bowling gods.');
      onStrike?.(throws);
      return;
    }

    setStatus(`${knocked} pin${knocked === 1 ? '' : 's'}. This CAPTCHA only accepts a strike. Resetting elves.`);
    phase = 'aim';
    resetPins();
    resetBall();
  }

  function step() {
    if (phase === 'aim') {
      const span = fast ? 36 : 72;
      aimX += aimDir * (fast ? 1.4 : 2.2);
      if (aimX > HEAD_X + span || aimX < HEAD_X - span) aimDir *= -1;
      ball.x = HEAD_X;
    }
    if (phase === 'power') {
      power += powerDir * (fast ? 0.018 : 0.028);
      if (power > 1 || power < 0.08) powerDir *= -1;
      power = Math.max(0.08, Math.min(1, power));
    }
    if (phase === 'rolling') {
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.vx *= 0.995;
      ball.vy *= 0.995;

      if (corgi.show) {
        corgi.x += corgi.vx;
        if (Math.hypot(corgi.x - ball.x, corgi.y - ball.y) < 22) {
          ball.vx += 1.8;
          corgi.show = false;
          setStatus('A corgi stole the pocket. Barbara says that’s bowling.');
        }
        if (corgi.x > W + 40) corgi.show = false;
      }

      if (ball.x < L + ball.r || ball.x > R - ball.r) {
        if (ball.y > 130) {
          ball.vx = 0;
          ball.vy = 0;
          ball.x = ball.x < L + ball.r ? L - 8 : R + 8;
          setTimeout(() => {
            if (!alive) return;
            setStatus('Gutter. The elves cheered. Strike required. Again.');
            phase = 'aim';
            resetPins();
            resetBall();
          }, 500);
          phase = 'settled';
          return;
        }
        ball.x = Math.max(L + ball.r, Math.min(R - ball.r, ball.x));
        ball.vx *= -0.4;
      }

      if (pocketHit()) scatterAll();

      pins.forEach((p) => {
        if (p.fallen) {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.98;
          p.vy *= 0.98;
          return;
        }
        if (collide(ball, p)) p.fallen = true;
      });
      for (let i = 0; i < pins.length; i++) {
        for (let j = i + 1; j < pins.length; j++) {
          if (pins[i].fallen || pins[j].fallen) collide(pins[i], pins[j]);
          if (pins[i].fallen && !pins[j].fallen && collide(pins[i], pins[j])) pins[j].fallen = true;
        }
      }

      const moving =
        Math.hypot(ball.vx, ball.vy) > 0.18 ||
        pins.some((p) => Math.hypot(p.vx, p.vy) > 0.18);
      if (ball.y < 28 || !moving) {
        settle();
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#d7b07a';
    ctx.fillRect(L, 20, R - L, 360);
    ctx.strokeStyle = '#c4a06a';
    for (let y = 20; y < 380; y += 18) {
      ctx.beginPath();
      ctx.moveTo(L, y);
      ctx.lineTo(R, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 20, L, 360);
    ctx.fillRect(R, 20, W - R, 360);
    ctx.fillStyle = '#c41e3a';
    ctx.fillRect(L, 338, R - L, 4);

    pins.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.fallen) ctx.rotate(0.9);
      ctx.beginPath();
      ctx.fillStyle = p.fallen ? '#7a3' : '#163';
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '11px Tahoma';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧝', 0, 1);
      ctx.restore();
    });

    if (corgi.show) {
      ctx.font = '22px Tahoma';
      ctx.fillText('🐕', corgi.x, corgi.y);
    }

    ctx.beginPath();
    ctx.fillStyle = '#111';
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb612';
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    if (phase === 'aim' || phase === 'power') {
      ctx.strokeStyle = '#c41e3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(HEAD_X, 348);
      ctx.lineTo(aimX, 250);
      ctx.stroke();
      ctx.fillStyle = '#c41e3a';
      ctx.beginPath();
      ctx.moveTo(aimX, 242);
      ctx.lineTo(aimX - 6, 254);
      ctx.lineTo(aimX + 6, 254);
      ctx.fill();
    }

    ctx.fillStyle = '#fff';
    ctx.font = '11px Tahoma';
    ctx.textAlign = 'left';
    ctx.fillText(`Elf Bowling 98  ·  throws: ${throws}  ·  need: STRIKE`, 8, 16);
  }

  function loop() {
    if (!alive) return;
    step();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function onPointer(e) {
    e.preventDefault();
    if (phase === 'aim') {
      phase = 'power';
      setStatus('Tap again to lock power. Green-gold is the Packers pocket.');
      return;
    }
    if (phase === 'power') {
      launch();
    }
  }

  resetPins();
  resetBall();
  canvas.addEventListener('pointerdown', onPointer);
  setStatus('Lock aim, then power. A strike is the only passing grade.');
  loop();

  return {
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointer);
    },
    getThrows() {
      return throws;
    },
    getPower() {
      return power;
    },
  };
}
