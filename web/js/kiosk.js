(() => {
  const ITEM_H = 56;
  const REEL_COPIES = 8;
  const LEDGER_PHRASE = "cinnamonrolls";
  const startedAt = Date.now();

  const state = {
    screen: "boot",
    member: null,
    marks: new Map(),
    rage: 0,
    lastClick: 0,
    certAttempts: 0,
    week: "A",
    spinning: false,
    stopArmed: false,
    offset: 0,
    velocity: 0,
    reelIndex: 0,
    holdStamp: null,
    faxing: false,
  };

  const els = {
    screens: [...document.querySelectorAll(".screen")],
    bootLog: document.getElementById("boot-log"),
    bootSkip: document.getElementById("boot-skip"),
    yourTicket: document.getElementById("your-ticket"),
    nowServing: document.getElementById("now-serving"),
    servingNote: document.getElementById("serving-note"),
    dmvStatus: document.getElementById("dmv-status"),
    dmvContinue: document.getElementById("dmv-continue"),
    dmvBribe: document.getElementById("dmv-bribe"),
    reel: document.getElementById("reel"),
    lever: document.getElementById("lever"),
    reelStop: document.getElementById("reel-stop"),
    slotCallout: document.getElementById("slot-callout"),
    passForm: document.getElementById("pass-form"),
    passName: document.getElementById("pass-name"),
    passHint: document.getElementById("pass-hint"),
    passphrase: document.getElementById("passphrase"),
    passError: document.getElementById("pass-error"),
    memberBanner: document.getElementById("member-banner"),
    weekTabs: document.getElementById("week-tabs"),
    weekJoke: document.getElementById("week-joke"),
    scantron: document.getElementById("scantron"),
    markToast: document.getElementById("mark-toast"),
    pacificCert: document.getElementById("pacific-cert"),
    btnNone: document.getElementById("btn-none"),
    btnCloud: document.getElementById("btn-cloud"),
    btnFax: document.getElementById("btn-fax"),
    scanError: document.getElementById("scan-error"),
    stamp: document.getElementById("stamp"),
    stampMeter: document.querySelector("#stamp-meter span"),
    faxLog: document.getElementById("fax-log"),
    faxError: document.getElementById("fax-error"),
    receiptName: document.getElementById("receipt-name"),
    receiptId: document.getElementById("receipt-id"),
    receiptSlots: document.getElementById("receipt-slots"),
    receiptStats: document.getElementById("receipt-stats"),
    btnLedger: document.getElementById("btn-ledger"),
    btnAgain: document.getElementById("btn-again"),
    ledgerGate: document.getElementById("ledger-gate"),
    ledgerPass: document.getElementById("ledger-pass"),
    ledgerGateError: document.getElementById("ledger-gate-error"),
    ledgerBody: document.getElementById("ledger-body"),
    ledgerSummary: document.getElementById("ledger-summary"),
    heatmap: document.getElementById("heatmap"),
    ledgerList: document.getElementById("ledger-list"),
    clock: document.getElementById("clock"),
    rage: document.getElementById("rage"),
    exitBtn: document.getElementById("exit-btn"),
  };

  function showScreen(name) {
    state.screen = name;
    for (const screen of els.screens) {
      screen.classList.toggle("active", screen.dataset.screen === name);
    }
  }

  function ticketNumber() {
    return `B-${String(40 + Math.floor(Math.random() * 40)).padStart(3, "0")}`;
  }

  function beep(freq, duration, type = "square") {
    try {
      const ctx = beep.ctx || (beep.ctx = new AudioContext());
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      /* autoplay limits are part of the joke */
    }
  }

  function countRage(event) {
    if (event.pointerType === "mouse" || event.pointerType === "touch" || event.type === "click") {
      const now = Date.now();
      if (now - state.lastClick < 220) state.rage += 1;
      state.lastClick = now;
      els.rage.textContent = `rage clicks: ${state.rage}`;
    }
  }

  function selectedIds() {
    return [...state.marks.entries()].filter(([, v]) => v === "filled").map(([id]) => id);
  }

  function slotById(id) {
    return SLOTS.find((slot) => slot.id === id);
  }

  function roast(member, slot) {
    if (!member || !slot) return "";
    if (member.key === "aaron" && slot.hour >= 18) return "Quiet hours at the AirBnB are a rumor.";
    if (member.key === "lynn") return "As long as Aaron is not playing. He is not. You may proceed.";
    if (member.key === "cori" && slot.hour === 9) return "Zoe might have other plans. Noted anyway.";
    if (member.key === "darien" && slot.hour === 9) return "That is a warm-up, not a conflict.";
    if (member.key === "lydia") return "This still beats sanding a banister.";
    if (member.key === "timmy") return "Subject to crew rest, trains, and being grandma's favorite.";
    if (member.key === "amy") return "If Jack is hovering, close the laptop.";
    if (member.key === "steven" && slot.hour >= 18) return "After work. The local would approve.";
    if (member.key === "bryan") return "Logged. He will still win the side games.";
    if (member.key === "jimmy") return "Steven has not been notified. Keep it that way.";
    if (member.key === "barbara") return "Corgis will provide moral support and crumbs.";
    if (member.key === "jack") return "House edge on a Saturday night is terrible. Good slot.";
    if (member.key === "curt" && slot.hour >= 18) return "Bees should be in for the evening.";
    if (member.key === "kenny") return "Commissioner availability is whatever he decides later.";
    return "Marked, pending the commissioner's mercy.";
  }

  function renderReel() {
    const items = [];
    for (let copy = 0; copy < REEL_COPIES; copy += 1) {
      for (const member of MEMBERS) {
        const div = document.createElement("div");
        div.className = "reel-item";
        div.innerHTML = `<strong>${member.name}</strong><small>${member.city} · ${member.title}</small>`;
        items.push(div);
      }
    }
    els.reel.replaceChildren(...items);
    els.reel.style.transform = `translateY(${-state.offset}px)`;
  }

  function centeredMember() {
    const idx = Math.round(state.offset / ITEM_H) + 1;
    return MEMBERS[((idx % MEMBERS.length) + MEMBERS.length) % MEMBERS.length];
  }

  function snapReel() {
    const idx = Math.round(state.offset / ITEM_H);
    state.offset = idx * ITEM_H;
    const cycle = MEMBERS.length * ITEM_H;
    state.offset = ((state.offset % cycle) + cycle) % cycle;
    els.reel.style.transform = `translateY(${-state.offset}px)`;
    return centeredMember();
  }

  let lastTs = 0;
  function spinLoop(ts) {
    if (!state.spinning) return;
    const dt = Math.min(32, ts - lastTs || 16);
    lastTs = ts;
    state.offset += state.velocity * dt;
    const cycle = MEMBERS.length * ITEM_H;
    state.offset = ((state.offset % cycle) + cycle) % cycle;
    if (state.stopArmed) {
      state.velocity *= 0.965;
      if (state.velocity < 0.12) {
        state.spinning = false;
        state.stopArmed = false;
        els.reelStop.disabled = true;
        els.lever.disabled = false;
        const landed = snapReel();
        onLand(landed);
        return;
      }
    }
    els.reel.style.transform = `translateY(${-state.offset}px)`;
    requestAnimationFrame(spinLoop);
  }

  function onLand(member) {
    beep(180, 0.08);
    state.reelIndex += 1;
    const drunk = state.reelIndex < 3 && Math.random() < 0.35;
    if (drunk) {
      els.slotCallout.textContent = `The cabinet selected ${member.name}. That is probably wrong. Pull again. Jack would call this a loose reel.`;
      els.passForm.classList.add("hidden");
      return;
    }
    els.slotCallout.textContent = `${member.name} of ${member.city}. ${member.blurb}`;
    els.passName.textContent = member.name;
    els.passHint.textContent = `Hint: ${member.hint}`;
    els.passForm.classList.remove("hidden");
    els.passphrase.value = "";
    els.passError.hidden = true;
    state.pendingMember = member;
    els.passphrase.focus();
  }

  function startSpin() {
    if (state.spinning) return;
    els.passForm.classList.add("hidden");
    state.pendingMember = null;
    state.spinning = true;
    state.stopArmed = false;
    state.velocity = 1.6 + Math.random() * 0.7;
    els.lever.disabled = true;
    els.reelStop.disabled = false;
    els.slotCallout.textContent = "Spinning. Hitting STOP too early is how Aaron gets banned from AirBnBs.";
    lastTs = performance.now();
    beep(90, 0.12, "sawtooth");
    requestAnimationFrame(spinLoop);
  }

  function stopSpin() {
    if (!state.spinning || state.stopArmed) return;
    state.stopArmed = true;
    state.velocity += 0.35;
    els.reelStop.disabled = true;
  }

  function renderWeekTabs() {
    els.weekTabs.replaceChildren(
      ...WEEK_STARTS.map((week) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = week.label;
        btn.classList.toggle("active", week.key === state.week);
        btn.addEventListener("click", () => {
          state.week = week.key;
          renderWeekTabs();
          renderScantron();
        });
        return btn;
      })
    );
  }

  function renderScantron() {
    const week = WEEK_STARTS.find((item) => item.key === state.week);
    els.weekJoke.textContent = week.joke;
    const table = document.createElement("table");
    const head = document.createElement("tr");
    head.innerHTML = `<th></th>${HOURS.map((hour) => `<th>${formatClock(hour)} PT</th>`).join("")}`;
    table.append(head);

    for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
      const date = addDays(week.start, dayIndex);
      const tr = document.createElement("tr");
      const dayCell = document.createElement("td");
      dayCell.className = "day-cell";
      dayCell.textContent = `${DAY_SHORT[dayIndex]} ${date.slice(5).replace("-", "/")}`;
      tr.append(dayCell);

      for (const hour of HOURS) {
        const td = document.createElement("td");
        const allowed = hourAllowed(dayIndex, hour);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "bubble";
        if (!allowed) {
          btn.classList.add("blocked");
          btn.title = "The commissioner does not wake up for Wednesday mornings.";
          btn.addEventListener("click", () => {
            els.markToast.hidden = false;
            els.markToast.textContent =
              "Nice try. Weekday mornings are for work, bees, babies, and not this.";
          });
        } else {
          const id = `${date}T${pad2(hour)}:00`;
          const mark = state.marks.get(id);
          if (mark === "light") btn.classList.add("light");
          if (mark === "filled") btn.classList.add("filled");
          btn.title = `${DAY_NAMES[dayIndex]} ${formatClock(hour)} PT`;
          btn.addEventListener("click", () => toggleMark(id, btn));
          const local = document.createElement("span");
          local.className = "local";
          if (state.member && tzOffsetHours(state.member.tz) !== 0) {
            local.textContent = localClock(hour, state.member.tz);
            td.append(local);
          }
        }
        td.prepend(btn);
        tr.append(td);
      }
      table.append(tr);
    }
    els.scantron.replaceChildren(table);
  }

  function toggleMark(id, btn) {
    const current = state.marks.get(id);
    if (!current) {
      state.marks.set(id, "light");
      btn.classList.add("light");
      els.markToast.hidden = false;
      els.markToast.textContent = "Practice mark. Too light. The machine cannot see it. Tap again.";
      return;
    }
    if (current === "light") {
      state.marks.set(id, "filled");
      btn.classList.remove("light");
      btn.classList.add("filled");
      els.markToast.hidden = false;
      els.markToast.textContent = roast(state.member, slotById(id));
      return;
    }
    state.marks.delete(id);
    btn.classList.remove("filled");
    els.markToast.hidden = false;
    els.markToast.textContent = "Erased. Lynn would never quit on Aaron like that.";
  }

  function enterScantron(member) {
    state.member = member;
    els.memberBanner.textContent = `${member.name} · ${member.city} · ${member.title}. Times below are Pacific. Your local clock, if any, is the tiny print.`;
    renderWeekTabs();
    renderScantron();
    showScreen("scantron");
  }

  function showError(node, message) {
    node.hidden = false;
    node.textContent = message;
  }

  function validateScantron() {
    els.scanError.hidden = true;
    const ids = selectedIds();
    if (ids.length < 1) {
      showError(els.scanError, "Fill at least one bubble until it is actually black. Light gray does not count.");
      return null;
    }
    if (!els.pacificCert.checked) {
      state.certAttempts += 1;
      if (state.certAttempts === 1) {
        showError(
          els.scanError,
          "You missed the certification box. Minnesota is not Pacific. Jacksonville is not Pacific. The box is Pacific."
        );
        return null;
      }
      showError(els.scanError, "Check the box. It is the long one. It mentions Phoenix on purpose.");
      return null;
    }
    return ids;
  }

  async function submitResponse(ids) {
    const body = {
      display_name: state.member.name,
      member_key: state.member.key,
      available_slot_ids: ids,
      timezone: "America/Los_Angeles",
      gauntlet_seconds: Math.round((Date.now() - startedAt) / 1000),
      rage_clicks: state.rage,
      bowling_throws: 0,
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/boger_bowl_responses`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || res.statusText);
    }
    const rows = await res.json();
    return { body, row: rows[0] };
  }

  function renderReceipt(result, ids) {
    els.receiptName.textContent = `${state.member.name.toUpperCase()} · ${state.member.city}`;
    els.receiptId.textContent = result.row?.id
      ? `CONF ${result.row.id.slice(0, 8).toUpperCase()}`
      : "CONF PENDING";
    els.receiptSlots.replaceChildren(
      ...ids.map((id) => {
        const slot = slotById(id);
        const li = document.createElement("li");
        const local =
          state.member && tzOffsetHours(state.member.tz)
            ? ` (${localClock(slot.hour, state.member.tz)} your time)`
            : "";
        li.textContent = `${DAY_NAMES[slot.dayIndex]} ${slot.date} ${formatClock(slot.hour)} PT${local}`;
        return li;
      })
    );
    els.receiptStats.textContent = `Gauntlet ${result.body.gauntlet_seconds}s · rage clicks ${result.body.rage_clicks}`;
    els.btnLedger.classList.toggle("hidden", state.member.key !== "kenny");
    showScreen("receipt");
  }

  async function runFax(ids) {
    if (state.faxing) return;
    state.faxing = true;
    els.faxError.hidden = true;
    els.faxLog.classList.remove("hidden");
    const lines = [
      "ATDT 1-702-BOG-ERBB",
      "DIALING...",
      "CARRIER",
      "sKRchHhHh  *handshake*  ksssh",
      "SENDING FORM BB-1040 TO THE COMMISSIONER",
      "waiting for a corgi to stamp RECEIVED",
    ];
    els.faxLog.textContent = "";
    for (const line of lines) {
      els.faxLog.textContent += `${line}\n`;
      beep(140 + Math.random() * 400, 0.07, "sawtooth");
      await new Promise((resolve) => setTimeout(resolve, 420));
    }
    try {
      const result = await submitResponse(ids);
      els.faxLog.textContent += "OK\n";
      renderReceipt(result, ids);
    } catch (error) {
      showError(
        els.faxError,
        `The fax went to /dev/null. Screenshot this and text Kenny:\n${error.message}`
      );
    } finally {
      state.faxing = false;
    }
  }

  function latestByMember(rows) {
    const map = new Map();
    const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const row of sorted) {
      map.set(row.member_key || row.display_name, row);
    }
    return [...map.values()];
  }

  function renderHeatmap(rows) {
    const latest = latestByMember(rows);
    const counts = new Map(SLOTS.map((slot) => [slot.id, 0]));
    for (const row of latest) {
      for (const id of row.available_slot_ids || []) {
        if (counts.has(id)) counts.set(id, counts.get(id) + 1);
      }
    }
    const max = Math.max(1, ...counts.values());
    const wrap = document.createElement("div");
    for (const week of WEEK_STARTS) {
      const title = document.createElement("p");
      title.innerHTML = `<strong>${week.label}</strong>`;
      const table = document.createElement("table");
      const head = document.createElement("tr");
      head.innerHTML = `<th></th>${HOURS.map((hour) => `<th>${formatClock(hour)}</th>`).join("")}`;
      table.append(head);
      for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
        const date = addDays(week.start, dayIndex);
        const tr = document.createElement("tr");
        tr.innerHTML = `<th>${DAY_SHORT[dayIndex]}</th>`;
        for (const hour of HOURS) {
          const td = document.createElement("td");
          if (!hourAllowed(dayIndex, hour)) {
            td.textContent = "—";
          } else {
            const id = `${date}T${pad2(hour)}:00`;
            const n = counts.get(id) || 0;
            const bucket = n === 0 ? 0 : Math.min(4, 1 + Math.floor((n / max) * 3));
            td.className = `heat-${bucket}`;
            td.textContent = String(n);
          }
          tr.append(td);
        }
        table.append(tr);
      }
      wrap.append(title, table);
    }
    els.heatmap.replaceChildren(wrap);

    const ranked = SLOTS.map((slot) => ({ slot, n: counts.get(slot.id) || 0 }))
      .sort((a, b) => b.n - a.n)
      .filter((item) => item.n > 0)
      .slice(0, 3);
    const names = latest.map((row) => row.display_name).join(", ") || "nobody yet";
    els.ledgerSummary.textContent = latest.length
      ? `${latest.length} cousin${latest.length === 1 ? "" : "s"} in: ${names}. Hottest overlap: ${
          ranked[0]
            ? `${DAY_NAMES[ranked[0].slot.dayIndex]} ${formatClock(ranked[0].slot.hour)} PT (${ranked[0].n})`
            : "none"
        }.`
      : "The ledger is empty. Go yell in the group chat.";

    els.ledgerList.replaceChildren(
      ...latest.map((row) => {
        const div = document.createElement("div");
        const when = (row.available_slot_ids || [])
          .map((id) => {
            const slot = slotById(id);
            return slot ? `${DAY_SHORT[slot.dayIndex]} ${formatClock(slot.hour)}` : id;
          })
          .join(", ");
        div.innerHTML = `<strong>${row.display_name}</strong> · ${when || "no slots"} · ${row.gauntlet_seconds || "?"}s · rage ${row.rage_clicks || 0}`;
        return div;
      })
    );
  }

  async function loadLedger() {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/boger_bowl_responses?select=*&order=created_at.asc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!res.ok) throw new Error(await res.text());
    renderHeatmap(await res.json());
  }

  function bootSequence() {
    const lines = [
      "BOGERSOFT SCHEDULING BIOS 4.98",
      "detecting corgis...........  lots",
      "detecting Packers fandom...  CRITICAL",
      "detecting bees.............. OK",
      "detecting AirBnB bans....... 1 or more",
      "syncing Ancestry.com........ please wait",
      "rejecting weekday 9am....... DONE",
      "timezone locked............. AMERICA/LOS_ANGELES",
      "ready.",
    ];
    let i = 0;
    els.bootLog.textContent = "";
    const timer = setInterval(() => {
      els.bootLog.textContent += `${lines[i]}\n`;
      beep(220 + i * 40, 0.04);
      i += 1;
      if (i === 3) els.bootSkip.classList.remove("hidden");
      if (i >= lines.length) {
        clearInterval(timer);
        setTimeout(() => showScreen("dmv"), 400);
      }
    }, 280);
    els.bootSkip.addEventListener(
      "click",
      () => {
        clearInterval(timer);
        showScreen("dmv");
      },
      { once: true }
    );
  }

  function runDmv() {
    const yours = ticketNumber();
    els.yourTicket.textContent = yours;
    const bits = [
      ["A-012", "Cori (Zoe has a note)"],
      ["C-003", "someone who brought cinnamon rolls"],
      ["B-041", "a man arguing with a bee"],
      ["777", "Jack's cabinet, out of order"],
      [yours, "Boger, party of one, plus opinions"],
    ];
    let i = 0;
    const tick = () => {
      const [num, note] = bits[i];
      els.nowServing.textContent = num;
      els.servingNote.textContent = note;
      els.dmvStatus.textContent =
        i < bits.length - 1
          ? "Please wait. Looking at your phone will not make Minnesota move faster."
          : "Window 2. Bring your patience and a #2 pencil.";
      if (i === bits.length - 1) {
        els.dmvContinue.disabled = false;
        return;
      }
      i += 1;
      setTimeout(tick, 900);
    };
    tick();
  }

  function tickClock() {
    const now = new Date();
    const pt = now.toLocaleTimeString("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      minute: "2-digit",
    });
    els.clock.textContent = `${pt} PT`;
  }

  document.addEventListener("click", countRage, true);
  els.dmvContinue.addEventListener("click", () => showScreen("identity"));
  els.dmvBribe.addEventListener("click", () => {
    els.dmvContinue.disabled = false;
    els.dmvStatus.textContent = "The clerk has been fed. Barbara would like her pan back.";
    els.nowServing.textContent = els.yourTicket.textContent;
    els.servingNote.textContent = "bribery successful";
  });
  els.lever.addEventListener("click", startSpin);
  els.reelStop.addEventListener("click", stopSpin);
  els.passForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const member = state.pendingMember;
    if (!member) return;
    const ok = normalizePhrase(els.passphrase.value) === normalizePhrase(member.phrase);
    if (!ok) {
      els.passError.hidden = false;
      if (member.key === "amy") {
        els.passError.textContent = "Jack, let Amy type.";
      } else if (member.key === "lynn") {
        els.passError.textContent = "Last names will not be tolerated. Try the first name.";
      } else {
        els.passError.textContent = "Incorrect. The hint is not a riddle. It is a roast.";
      }
      return;
    }
    enterScantron(member);
  });
  els.pacificCert.addEventListener("click", (event) => {
    if (state.certAttempts < 1 && els.pacificCert.checked) {
      event.preventDefault();
      els.pacificCert.checked = false;
      state.certAttempts = 1;
      showError(els.scanError, "Read it first. Then check it. This is how Steven's union does minutes.");
    }
  });
  els.btnNone.addEventListener("click", () => {
    showError(els.scanError, "Incorrect. Try again. This is a family league.");
  });
  els.btnCloud.addEventListener("click", () => {
    showError(els.scanError, "Cloud unavailable. Please use the fax, like an adult from 1996.");
  });
  els.btnFax.addEventListener("click", () => {
    const ids = validateScantron();
    if (!ids) return;
    state.pendingIds = ids;
    showScreen("fax");
  });

  const stampHold = { t: 0, raf: 0 };
  function stampFrame(ts) {
    if (!stampHold.start) return;
    const p = Math.min(1, (ts - stampHold.start) / 1600);
    els.stampMeter.style.width = `${p * 100}%`;
    if (p >= 1) {
      stampHold.start = 0;
      els.stamp.textContent = "SEALED";
      runFax(state.pendingIds);
      return;
    }
    stampHold.raf = requestAnimationFrame(stampFrame);
  }
  function startStamp() {
    if (state.faxing || els.stamp.textContent === "SEALED") return;
    stampHold.start = performance.now();
    stampHold.raf = requestAnimationFrame(stampFrame);
  }
  function endStamp() {
    if (els.stamp.textContent === "SEALED") return;
    stampHold.start = 0;
    cancelAnimationFrame(stampHold.raf);
    els.stampMeter.style.width = "0%";
  }
  els.stamp.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startStamp();
  });
  els.stamp.addEventListener("pointerup", endStamp);
  els.stamp.addEventListener("pointerleave", endStamp);

  els.btnAgain.addEventListener("click", () => enterScantron(state.member));
  els.btnLedger.addEventListener("click", () => {
    showScreen("ledger");
    els.ledgerGate.classList.add("hidden");
    els.ledgerBody.classList.remove("hidden");
    loadLedger().catch((error) => showError(els.ledgerGateError, error.message));
  });
  els.ledgerGate.addEventListener("submit", (event) => {
    event.preventDefault();
    if (normalizePhrase(els.ledgerPass.value) !== LEDGER_PHRASE) {
      showError(els.ledgerGateError, "Wrong pastry. Think Christmas morning in Las Vegas.");
      return;
    }
    els.ledgerGate.classList.add("hidden");
    els.ledgerBody.classList.remove("hidden");
    loadLedger().catch((error) => showError(els.ledgerGateError, error.message));
  });
  els.exitBtn.addEventListener("click", () => {
    els.exitBtn.textContent = "NO";
    showError(
      els.scanError,
      "You can check out any time you like, but you still have to pick a draft slot. Also Aaron is not allowed to unplug this."
    );
  });

  if (location.hash === "#ledger") showScreen("ledger");
  else {
    renderReel();
    bootSequence();
    runDmv();
  }
  tickClock();
  setInterval(tickClock, 1000);
})();
