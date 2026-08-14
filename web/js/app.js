import { MEMBERS } from "./members.js";
import { SLOTS, DAYS, HOURS, PROGRAMS, WEEKS, formatLocal, slotId } from "./slots.js";
import { sfx, unlock } from "./sfx.js";
import { mountBowling } from "./bowling.js";
import { saveAvailability } from "./db.js";

const $ = (id) => document.getElementById(id);

const state = {
  screen: "boot",
  member: null,
  jackProxy: false,
  selected: new Set(),
  throws: 0,
  rage: 0,
  lastClick: 0,
  started: Date.now(),
  cursor: 0,
  week: 0,
  hold: null,
  jammed: true,
  batteryDead: true,
  corgiHome: false,
  dishBusy: false,
  bowl: null,
};

function noteRage() {
  const now = performance.now();
  if (now - state.lastClick < 220) state.rage += 1;
  state.lastClick = now;
}

function show(id) {
  for (const el of document.querySelectorAll(".screen")) el.classList.toggle("on", el.id === id);
  state.screen = id.replace("scr-", "");
}

function bootMessages() {
  const lines = [
    "Defrosting lane…",
    "Asking Curt if we are related to these elves…",
    "Reserving Steven's union break…",
    "Unplugging Aaron's extension cords…",
    "Warming Barbara's cinnamon rolls…",
    "Recalculating Jacksonville (still not Miami)…",
    "Checking grandma's favorite cousin list… Timmy.",
    "BOGERMATIC 3000 ready.",
  ];
  const log = $("boot-log");
  let i = 0;
  const t = setInterval(() => {
    if (i < lines.length) {
      const p = document.createElement("div");
      p.textContent = "> " + lines[i];
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
      i += 1;
    } else {
      clearInterval(t);
      $("boot-go").disabled = false;
      $("boot-go").textContent = "Insert Disc 2 (there is no disc 2)";
    }
  }, 420);
}

function renderRoster() {
  const grid = $("roster");
  grid.innerHTML = "";
  for (const m of MEMBERS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "fighter";
    b.style.setProperty("--c", m.color);
    b.innerHTML = `<span class="who">${m.name}</span><span class="city">${m.city}</span><span class="tag">${m.tag}</span>`;
    b.addEventListener("click", () => {
      noteRage();
      sfx.click();
      pickMember(m);
    });
    grid.appendChild(b);
  }
}

function pickMember(m) {
  state.member = m;
  $("bio").innerHTML = `<strong>${m.title}</strong> — ${m.bio}<div class="spec">Special: ${m.special}</div>`;
  $("confirm-boger").disabled = false;
  $("amy-note").hidden = m.key !== "amy";
  for (const el of document.querySelectorAll(".fighter")) {
    el.classList.toggle("picked", el.querySelector(".who")?.textContent === m.name);
  }
}

function startBowl() {
  show("scr-bowl");
  $("bowl-who").textContent = `${state.member.name}  •  ${state.member.city}`;
  state.bowl?.destroy();
  const canvas = $("lane");
  state.bowl = mountBowling(canvas, {
    member: state.member,
    onThrow: (n) => {
      state.throws = n;
      $("throw-count").textContent = String(n);
    },
    onPass: () => {
      $("bowl-next").disabled = false;
      $("bowl-next").textContent = "Proceed to the Channel Guide (you earned this)";
      sfx.strike();
    },
    onRage: () => {
      state.rage += 1;
    },
  });
}

function renderGuide() {
  const week = WEEKS[state.week];
  const packs = $("week-packs");
  if (packs) {
    packs.innerHTML = "";
    WEEKS.forEach((w, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = i === state.week ? "good" : "";
      b.textContent = w.label;
      b.disabled = state.dishBusy;
      b.addEventListener("click", () => acquireDish(i));
      packs.appendChild(b);
    });
  }
  $("dish-name").textContent = week.dish;

  const grid = $("epg");
  grid.innerHTML = "";
  const head = document.createElement("div");
  head.className = "epg-row head";
  head.innerHTML =
    `<div class="ch">DAY</div>` +
    HOURS.map((h) => `<div class="cell hd">${h.weekendOnly ? h.label + " *" : h.label}</div>`).join("");
  grid.appendChild(head);

  DAYS.forEach((day, di) => {
    const row = document.createElement("div");
    row.className = "epg-row";
    row.innerHTML = `<div class="ch">${day.short}</div>`;
    HOURS.forEach((hour, hi) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      if (hour.weekendOnly && !day.weekend) {
        cell.classList.add("off");
        cell.disabled = true;
        cell.textContent = "Infomercial";
      } else {
        const id = slotId(week, day, hour);
        const slot = SLOTS.find((s) => s.id === id);
        cell.dataset.slot = id;
        cell.innerHTML = `<span class="show">${PROGRAMS[slot.pattern]}</span><span class="loc">${formatLocal(slot, state.member.tz)}</span>`;
        if (state.selected.has(id)) cell.classList.add("rec");
        cell.addEventListener("pointerdown", (e) => beginHold(e, id, cell));
        cell.addEventListener("pointerup", endHold);
        cell.addEventListener("pointerleave", endHold);
      }
      if (state.cursor === di * 4 + hi) cell.classList.add("cur");
      row.appendChild(cell);
    });
    grid.appendChild(row);
  });
  $("guide-who").textContent = `${state.member.name} in ${state.member.city} (${state.member.tz.replace("America/", "")})`;
  $("picked-n").textContent = String(state.selected.size);
}

function acquireDish(i) {
  if (i === state.week || state.dishBusy) return;
  state.dishBusy = true;
  renderGuide();
  $("dish-name").textContent = "Acquiring satellite… Curt is checking if this dish is a relative.";
  sfx.boot();
  setTimeout(() => {
    state.week = i;
    state.dishBusy = false;
    sfx.ok();
    renderGuide();
  }, 1100);
}

function beginHold(e, id, cell) {
  noteRage();
  if (state.batteryDead) {
    $("battery-msg").hidden = false;
    sfx.bad();
    return;
  }
  e.currentTarget.setPointerCapture?.(e.pointerId);
  const need = 850;
  const start = performance.now();
  cell.classList.add("holding");
  state.hold = {
    id,
    cell,
    raf: requestAnimationFrame(function loop(t) {
      const p = Math.min(1, (t - start) / need);
      cell.style.setProperty("--hold", String(p));
      if (p >= 1) {
        toggleSlot(id);
        endHold();
        return;
      }
      state.hold.raf = requestAnimationFrame(loop);
    }),
  };
}

function endHold() {
  if (!state.hold) return;
  cancelAnimationFrame(state.hold.raf);
  state.hold.cell.classList.remove("holding");
  state.hold.cell.style.removeProperty("--hold");
  state.hold = null;
}

function toggleSlot(id) {
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  sfx.ok();
  renderGuide();
}

function moveCursor(dx, dy) {
  const col = state.cursor % 4;
  const row = Math.floor(state.cursor / 4);
  const nc = Math.max(0, Math.min(3, col + dx));
  const nr = Math.max(0, Math.min(4, row + dy));
  state.cursor = nr * 4 + nc;
  renderGuide();
}

function receiptLines() {
  const slots = SLOTS.filter((s) => state.selected.has(s.id));
  return slots.map((s) => `${s.pacific}  →  ${formatLocal(s, state.member.tz)}`);
}

function renderFax() {
  $("fax-who").textContent = state.member.name;
  $("fax-body").textContent = receiptLines().join("\n") || "(none — the commish will be annoyed)";
  $("sign-hint").textContent = signHint();
  $("fax-go").disabled = state.selected.size < 1;
}

function signHint() {
  const k = state.member.key;
  if (k === "lynn") return 'Type "Lynn" (last names are for NFC North rivals)';
  if (k === "amy") return 'Type "Amy" (Jack: yes, still type Amy)';
  if (k === "kenny") return 'Type "Kenny" (commissioner privileges do not skip captcha)';
  if (k === "aaron") return 'Type "Aaron" (the cousin, not the quarterback)';
  return `Type "${state.member.name}" exactly`;
}

async function sendFax() {
  const typed = $("sign").value.trim();
  if (typed !== state.member.name) {
    sfx.bad();
    $("sign-err").textContent = "Signature mismatch. The notary elf is unimpressed.";
    state.rage += 1;
    return;
  }
  if (state.jammed) {
    sfx.bad();
    $("jam").hidden = false;
    return;
  }
  $("fax-go").disabled = true;
  $("fax-go").textContent = "Handshaking…";
  sfx.fax();
  try {
    await saveAvailability({
      display_name: state.jackProxy ? `${state.member.name} (via Jack)` : state.member.name,
      member_key: state.member.key,
      available_slot_ids: [...state.selected],
      gauntlet_seconds: Math.round((Date.now() - state.started) / 1000),
      rage_clicks: state.rage,
      bowling_throws: state.throws,
    });
    $("done-lines").textContent = receiptLines().join("\n");
    $("done-stats").textContent = `${state.throws} throws  •  ${state.rage} rage-clicks  •  ${Math.round((Date.now() - state.started) / 1000)}s of your life`;
    show("scr-done");
    sfx.ok();
  } catch (err) {
    $("sign-err").textContent = err.message || "Fax failed. Try unplugging Aaron from the router.";
    $("fax-go").disabled = false;
    $("fax-go").textContent = "FAX TO THE COMMISH";
    sfx.bad();
  }
}

function wire() {
  document.addEventListener("click", () => unlock(), { once: true });
  document.addEventListener("pointerdown", noteRage, true);

  $("boot-go").addEventListener("click", () => {
    sfx.boot();
    show("scr-rules");
  });

  const corgi = $("corgi");
  let drag = null;
  corgi.addEventListener("pointerdown", (e) => {
    const r = corgi.getBoundingClientRect();
    const parent = (corgi.offsetParent || corgi.parentElement).getBoundingClientRect();
    drag = { ox: e.clientX - r.left, oy: e.clientY - r.top, parent };
    corgi.setPointerCapture(e.pointerId);
  });
  corgi.addEventListener("pointermove", (e) => {
    if (!drag) return;
    corgi.style.left = `${e.clientX - drag.parent.left - drag.ox}px`;
    corgi.style.top = `${e.clientY - drag.parent.top - drag.oy}px`;
    const a = corgi.getBoundingClientRect();
    const b = $("rolls").getBoundingClientRect();
    const hit = !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    if (hit) {
      state.corgiHome = true;
      $("corgi-msg").textContent = "Corgi secured. Rolls accepted as legal tender.";
      $("rules-go").disabled = false;
      sfx.ok();
      drag = null;
    }
  });
  corgi.addEventListener("pointerup", () => {
    drag = null;
  });

  $("agree").addEventListener("change", () => {
    if (!state.corgiHome) {
      $("agree").checked = false;
      $("corgi-msg").textContent = "The corgi is sitting on the bylaws. Move the corgi onto the cinnamon rolls.";
      sfx.bad();
    }
  });

  $("rules-go").addEventListener("click", () => {
    if (!$("agree").checked || !state.corgiHome) return;
    sfx.click();
    renderRoster();
    show("scr-roster");
  });

  $("confirm-boger").addEventListener("click", () => {
    if (!state.member) return;
    state.jackProxy = $("jack-proxy")?.checked || false;
    sfx.click();
    startBowl();
  });

  $("bowl-next").addEventListener("click", () => {
    sfx.click();
    state.bowl?.destroy();
    renderGuide();
    show("scr-guide");
  });

  $("remote-up").addEventListener("click", () => moveCursor(0, -1));
  $("remote-down").addEventListener("click", () => moveCursor(0, 1));
  $("remote-left").addEventListener("click", () => moveCursor(-1, 0));
  $("remote-right").addEventListener("click", () => moveCursor(1, 0));
  $("remote-rec").addEventListener("click", () => {
    const day = DAYS[Math.floor(state.cursor / 4)];
    const hour = HOURS[state.cursor % 4];
    if (hour.weekendOnly && !day.weekend) {
      sfx.bad();
      return;
    }
    if (state.batteryDead) {
      $("battery-msg").hidden = false;
      sfx.bad();
      return;
    }
    toggleSlot(slotId(WEEKS[state.week], day, hour));
  });
  $("battery").addEventListener("click", () => {
    state.batteryDead = false;
    $("battery-msg").hidden = true;
    $("battery").textContent = "Fresh Christmas-tree battery (stolen from Barbara)";
    sfx.ok();
    renderGuide();
  });
  $("select-bryan").addEventListener("pointerdown", () => {
    noteRage();
    let held = false;
    const t = setTimeout(() => {
      held = true;
      for (const s of SLOTS) state.selected.add(s.id);
      sfx.strike();
      renderGuide();
    }, 1600);
    const cancel = () => {
      clearTimeout(t);
      if (!held) {
        $("hold-hint").textContent = "Hold like a slot spin. Jack would know.";
        sfx.bad();
      }
    };
    $("select-bryan").addEventListener("pointerup", cancel, { once: true });
    $("select-bryan").addEventListener("pointerleave", cancel, { once: true });
  });
  $("clear-aaron").addEventListener("click", () => {
    state.selected.clear();
    sfx.gutter();
    renderGuide();
  });
  $("guide-next").addEventListener("click", () => {
    if (state.selected.size < 1) {
      sfx.bad();
      $("hold-hint").textContent = "Hold-record at least one timeslot. This is not optional, Lydia. It is still not a house project.";
      return;
    }
    renderFax();
    show("scr-fax");
  });

  $("clear-jam").addEventListener("click", () => {
    state.jammed = false;
    $("jam").hidden = true;
    $("jam-note").textContent = "Bees relocated. Printer humbled.";
    sfx.ok();
  });
  $("fax-go").addEventListener("click", sendFax);

  bootMessages();
  show("scr-boot");
}

wire();
