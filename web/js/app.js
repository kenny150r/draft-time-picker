import {
  BOOT_MS,
  FAST,
  HOLD_MS,
  HOURS,
  INSTALL_MULT,
  OATH,
  PRIMES,
  ROSTER,
  SLOT_IDS,
  SLOTS,
  TIMEZONE,
  TZ_OPTIONS,
  WEEKS,
  isPrime,
} from './config.js';
import { fetchResponses, saveResponse } from './db.js';
import { mountBowling } from './bowling.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function coarse() {
  return window.matchMedia('(pointer: coarse)').matches;
}

const STEP_IDS = [
  'cookies',
  'corgi',
  'tos',
  'quiz',
  'name',
  'bowl',
  'zone',
  'decoy',
  'avail',
  'hold',
  'oath',
  'install',
];

const LIE_STEPS = ['1 of 3', '2 of 3', '2 of 4', '3 of 4', '3 of 12', '7 of 4', '4 of 4', '5 of 4', '4 of 4', '99 of 4', '4 of 4', '4 of 4'];

const CLIPPY = {
  cookies: 'Accept cookies, cinnamon-roll tracking, and one Packers pixel. Uncheck the crimes against Lynn and Aaron’s Airbnb record.',
  corgi: 'Click the corgi that stole the cinnamon roll. He has more cardio than Darien’s brick workout.',
  tos: 'Scroll. Legal added an amendment. Santi—wait, wrong league. Timmy will still finish it. He’s grandma’s favorite.',
  quiz: 'Lynn does not say Rodgers. Kenny cannot be wrong. Both of these are in the bylaws.',
  name: 'Pick your people. If you type Rodgers, Lynn will appear. If you type Kenny, you are correct.',
  bowl: 'Elf Bowling. A strike is the only CAPTCHA answer. Spares are for cowards and Vikings fans.',
  zone: 'Board time is Pacific. Minnesota is 8pm. Jacksonville is 9pm. Steven is almost Pacific and still has to say it.',
  decoy: 'Minutes must be prime. Kenny decided this, therefore it is correct, therefore Bryan cannot math it otherwise.',
  avail: 'Every Wed–Sun 6 or 7pm PT you can actually do. Double-click. Jack: do not fill this out for Amy unless she asked.',
  hold: 'Hold. This is not an Airbnb checkout. Aaron, leave the sockets alone.',
  oath: 'ALL CAPS. Like Lynn yelling Aaron’s name at Lambeau.',
  install: 'Warming cinnamon rolls, counting corgis, installing a slot machine, and hiding spare sockets from Aaron.',
};

const state = {
  step: 0,
  name: '',
  memberKey: null,
  rel: '',
  timezone: '',
  avail: new Set(),
  rage: 0,
  startedAt: 0,
  tosRead: false,
  tosExtended: false,
  oathFails: 0,
  z: 20,
  selectAllLies: true,
  singleClicks: 0,
  allowSingleToggle: false,
  bowlingThrows: 0,
  struck: false,
};

let holdTimer = null;
let bowlGame = null;
let powerTimer = null;

function rage(n = 1) {
  state.rage += n;
}

function clippy(text) {
  const box = $('#clippy');
  const el = $('#clippy-text');
  if (!box || !el) return;
  el.textContent = text;
  box.classList.add('show');
}

function tickClock() {
  const el = $('#clock');
  if (!el) return;
  const d = new Date();
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = d.getHours() >= 12 ? 'PM' : 'AM';
  el.textContent = `${h}:${m} ${ap}`;
}

function roastName(name) {
  const hit = ROSTER.find((r) => r.re.test(name.toLowerCase()));
  return hit || null;
}

function bootText() {
  return `BOGER-BIOS v4.0  CHRISTMAS/VEGAS BUILD
Copyright (C) 1997-2026 Boger Bowl LLC

CPU: Pentium II (Kenny, commissioner, California, infallible)
Memory Test: 65536K OK
Corgis detected: ........... a lot
Cinnamon rolls: ............ cooling

Barbara  Vegas     rolls / Christmas / corgis
Jimmy    Vegas     conservative BBQ, rough-houses Steven
Curt     Minnesota ancestry.com, bees, honey, gardens
Lynn     Minnesota Packers; Aaron is just Aaron
Timmy    Minnesota planes, trains, 3rd baby, grandma's favorite
Bryan    Wisconsin chess, baseball, civil, wins board games
Amy      Vegas     new house, 1yr old; Jack may be ghost-picking
Jack     Vegas     slot machines. Stop spinning the draft.
Cori     JAX       Miami → Jacksonville, baby Zoe
Darien   JAX       Ironman who still goes out
Lydia    Vegas     not a football person; house projects exist
Aaron    Vegas     party animal; sockets; Airbnb persona non grata
Steven   Phoenix   union pipe fitter, long blonde hair, guns, girl dad

Blocking last-name-Rodgers... OK
Starting Windows 98...`;
}

function makeDraggable(win) {
  const bar = win.querySelector('.title-bar');
  if (!bar) return;
  let dragging = false;
  let ox = 0;
  let oy = 0;
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true;
    win.style.zIndex = String(++state.z);
    const r = win.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    bar.setPointerCapture(e.pointerId);
    win.style.transform = 'none';
  });
  bar.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    win.style.left = `${Math.max(0, e.clientX - ox)}px`;
    win.style.top = `${Math.max(0, e.clientY - oy)}px`;
  });
  bar.addEventListener('pointerup', () => {
    dragging = false;
  });
}

function windowChrome(id, title, body, extraClass = '') {
  const el = document.createElement('div');
  el.className = `window ${extraClass}`.trim();
  el.id = `win-${id}`;
  el.style.zIndex = String(++state.z);
  el.innerHTML = `
    <div class="title-bar">
      <div class="title-bar-text">${esc(title)}</div>
      <div class="title-bar-controls">
        <button type="button" aria-label="Minimize" data-win-min="${id}"></button>
        <button type="button" aria-label="Maximize" data-win-max="${id}"></button>
        <button type="button" aria-label="Close" data-win-close="${id}"></button>
      </div>
    </div>
    ${body}
  `;
  makeDraggable(el);
  $('#window-layer').append(el);
  el.addEventListener('mousedown', () => {
    el.style.zIndex = String(++state.z);
  });
  return el;
}

function getWin(id) {
  return document.getElementById(`win-${id}`);
}

function showWin(id) {
  const el = getWin(id);
  if (!el) return;
  el.hidden = false;
  el.style.zIndex = String(++state.z);
}

function closeWin(id) {
  const el = getWin(id);
  if (!el) return;
  if (id === 'wizard') {
    clippy('Closing is a Vikings tactic. Minimizing instead.');
    el.hidden = true;
    rage();
    return;
  }
  el.remove();
}

function openWizard() {
  state.startedAt = state.startedAt || Date.now();
  if (getWin('wizard')) {
    showWin('wizard');
    return;
  }
  windowChrome(
    'wizard',
    'Boger Bowl Draft Time Wizard 98',
    `
      <div class="window-body scroll">
        <div id="wizard-body"></div>
        <div class="status-bar status-row">
          <p class="status-bar-field" id="status-step">Step 1 of 3</p>
          <p class="status-bar-field" id="status-done">Document: Done (but are you?)</p>
        </div>
      </div>
    `,
    'wizard',
  );
  spawnAds();
  renderStep();
}

function openReadme() {
  if (getWin('readme')) return showWin('readme');
  windowChrome(
    'readme',
    'family.txt - Notepad',
    `<div class="window-body scroll">
      <pre style="white-space:pre-wrap;font-size:12px;margin:0">BOGER BOWL — 2026 DRAFT
========================
1. Kenny is commissioner (California) and can do no wrong.
2. Times are 6:00 or 7:00 PM Pacific, Wed–Sun.
3. Mark EVERY slot you can do.
4. Lynn: Packers players are first-name only. Aaron is Aaron.
5. A strike in Elf Bowling is required. This is in the bylaws now.

SCOUTING REPORTS
----------------
BARBARA  Vegas. Cinnamon rolls. Christmas at her house. Corgis.
         Lots of corgis. Zoning has given up.
JIMMY    Vegas. Conservative. Great barbecue. Rough-houses Steven.
CURT     Minnesota. Ancestry.com. Bees, honey, gardens. Has a tree
         that is also a cousin, probably.
LYNN     Minnesota. Biggest Packers fan alive. Would never call a
         Packer by last name. She and Aaron go way back.
TIMMY    Minnesota. Regional airline. Loves trains AND planes.
         Third baby on the way. Has always been grandma's favorite.
         This is not disputed.
BRYAN    Wisconsin. Chess, baseball, civil engineer. Wins every
         board game. We have hidden the Catan box.
AMY      Vegas. Jack's wife. New house, 1-year-old. Jack may be
         making her picks. We are watching, Jack.
JACK     Vegas. Works at a slot-machine company. Please do not
         add bonus rounds to the snake draft.
CORI     Jacksonville (just moved from Miami). Baby Zoe is a
         few months old. Naps &gt; 7pm PT sometimes.
DARIEN   Jacksonville. Ironman who also likes a good time.
         Both can be true. Hydrate twice.
LYDIA    Vegas. Not a huge football fan. Here to not think about
         house projects. This form is, unfortunately, a project.
AARON    Vegas. Party animal. Unplugs sockets at festivals.
         Banned from Airbnbs. Do not give him the Wi-Fi password.
STEVEN   Phoenix. Union pipe fitter, long blonde hair. Loves guns
         and unions. Girl dad. Jimmy is already circling.

- The Commissioner
  (sent from California, which is correct)</pre>
    </div>`,
    'small-dialog',
  );
}

function openRolls() {
  if (getWin('rolls')) return showWin('rolls');
  windowChrome(
    'rolls',
    'cinnamon.bmp - Paint',
    `<div class="window-body">
      <p style="font-size:42px;text-align:center;margin:8px">🧁🧁🧁</p>
      <p>Barbara’s cinnamon rolls. Christmas in Las Vegas. The corgis are underfoot. This is the official smell of the Boger Bowl.</p>
      <button type="button" data-win-close="rolls">I already ate three</button>
    </div>`,
    'small-dialog',
  );
}

function openCorgis() {
  if (getWin('corgis')) return showWin('corgis');
  windowChrome(
    'corgis',
    'corgis\\ - Windows Explorer',
    `<div class="window-body">
      <p>This folder contains too many corgis.</p>
      <p style="font-size:28px">🐕 🐕 🐕 🐕 🐕</p>
      <p class="hint">Barbara has not hit the corgi cap. There is no corgi cap.</p>
      <button type="button" data-win-close="corgis">OK</button>
    </div>`,
    'small-dialog',
  );
}

function openRecycle() {
  if (getWin('recycle')) return showWin('recycle');
  windowChrome(
    'recycle',
    'Recycle Bin',
    `<div class="window-body">
      <p>This folder is empty.</p>
      <p style="font-size:11px;color:#000080">Items previously deleted:</p>
      <ul style="font-size:12px">
        <li>Aaron Rodgers’ last name (Lynn threw it out)</li>
        <li>Aaron’s Airbnb reviews</li>
        <li>A fair board-game night vs Bryan</li>
        <li>Lydia’s weekend for house projects</li>
        <li>Steven’s hair ties (he does not use them)</li>
        <li>Jack’s “I didn’t pick for Amy” statement</li>
        <li>Spare sockets (Aaron found them)</li>
      </ul>
      <button type="button" data-win-close="recycle">OK</button>
    </div>`,
    'small-dialog',
  );
}

async function openResults() {
  let win = getWin('results');
  if (!win) {
    win = windowChrome(
      'results',
      'Boger Bowl Availability.xls',
      `<div class="window-body scroll" id="results-body"><p>Loading from the family mainframe...</p></div>`,
      'results',
    );
  } else {
    showWin('results');
  }
  const body = $('#results-body');
  try {
    const rows = await fetchResponses();
    body.innerHTML = renderResultsHtml(rows);
  } catch (err) {
    body.innerHTML = `<p class="err">Could not reach the database. ${esc(err.message || err)}</p>`;
  }
}

function latestByName(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(String(row.display_name).trim().toLowerCase(), row);
  }
  return [...map.values()];
}

function renderResultsHtml(rows) {
  const latest = latestByName(rows);
  const counts = Object.fromEntries(SLOTS.map((s) => [s.id, 0]));
  const namesBySlot = Object.fromEntries(SLOTS.map((s) => [s.id, []]));
  for (const row of latest) {
    for (const id of row.available_slot_ids || []) {
      if (counts[id] == null) continue;
      counts[id] += 1;
      namesBySlot[id].push(row.display_name);
    }
  }
  const max = Math.max(0, ...Object.values(counts));
  const bestIds = new Set(SLOTS.filter((s) => counts[s.id] === max && max > 0).map((s) => s.id));

  const heatWeeks = WEEKS.map((week) => {
    const rowsHtml = week.days
      .map((day) => {
        const cells = HOURS.map((h) => {
          const id = `${day.date}T${h.key}`;
          const n = counts[id];
          const title = (namesBySlot[id] || []).join(', ') || 'nobody';
          return `<td class="${bestIds.has(id) ? 'best' : ''}" title="${esc(title)}">
            <div class="cell-heat" style="background:rgba(32,55,49,${max ? 0.12 + 0.8 * (n / max) : 0.08});color:${max && n / max > 0.55 ? '#ffb612' : '#000'}">${n}</div>
          </td>`;
        }).join('');
        return `<tr><td class="day">${esc(day.short)}</td>${cells}</tr>`;
      })
      .join('');
    return `<table class="avail-table heat">
      <thead>
        <tr><th class="week-head" colspan="3">${esc(week.title)}</th></tr>
        <tr><th></th><th>6:00 PM PT</th><th>7:00 PM PT</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
  }).join('');

  const bestLabels = SLOTS.filter((s) => bestIds.has(s.id)).map((s) => s.label);
  const guest = [...rows]
    .reverse()
    .map(
      (r) => `<tr>
        <td>${esc(r.display_name)}</td>
        <td>${(r.available_slot_ids || []).length} slots</td>
        <td>${esc(new Date(r.created_at).toLocaleString())}</td>
      </tr>`,
    )
    .join('');

  return `
    <p class="construction">LIVE RESULTS — PACKERS GREEN, VEGAS GOLD</p>
    <p>People who finished: <strong>${latest.length}</strong> (submissions: ${rows.length})</p>
    <p>${max > 0 ? `Best overlap: <strong>${esc(bestLabels.join(' · '))}</strong> (${max} free)` : 'Nobody has survived Elf Bowling yet.'}</p>
    ${heatWeeks}
    <p class="hint">Latest submission per name. Hover a cell for who. If Amy and Jack both show: we need to talk.</p>
    <h4>Guestbook</h4>
    <table class="guestbook">
      <thead><tr><th>Name</th><th>Marked</th><th>When they suffered</th></tr></thead>
      <tbody>${guest || '<tr><td colspan="3">empty, like Aaron’s Airbnb inbox</td></tr>'}</tbody>
    </table>
  `;
}

function spawnAds() {
  if ($('#win-ad1')) return;
  windowChrome(
    'ad1',
    'CONGRATULATIONS',
    `<div class="window-body">
      <p class="blink">YOU ARE THE 1,000th BOGER</p>
      <p>Claim your free cinnamon roll and a corgi you cannot refuse!</p>
      <button type="button" id="ad-claim">CLAIM NOW</button>
      <button type="button" data-win-close="ad1">I’m full</button>
    </div>`,
    'small-dialog popup-ad',
  );
  const ad = getWin('ad1');
  if (ad) {
    ad.style.left = '24px';
    ad.style.top = '72px';
    ad.style.transform = 'none';
  }
  window.setTimeout(() => {
    if ($('#win-ad2') || !getWin('wizard')) return;
    windowChrome(
      'ad2',
      'AIRBNB — booking declined',
      `<div class="window-body">
        <p><strong>This guest unplugged a socket at a festival.</strong></p>
        <p style="font-size:12px">Aaron, this is a draft, not Burning Man. Leave the power strip alone.</p>
        <button type="button" data-win-close="ad2">I brought my own generator</button>
      </div>`,
      'small-dialog popup-ad',
    );
    const ad2 = getWin('ad2');
    if (ad2) {
      ad2.style.left = '48px';
      ad2.style.top = '210px';
      ad2.style.transform = 'none';
    }
  }, FAST ? 400 : 2000);
}

function cookieHtml() {
  return `
    <div class="construction">⚠️ COOKIE NOTICE — REQUIRED BY THE COMMISSIONER ⚠️</div>
    <p>This site uses cookies, corgi pixels, and the smell of Barbara’s kitchen at Christmas.</p>
    <fieldset>
      <legend>Manage cookies</legend>
      <div class="field-row"><input id="ck-need" type="checkbox" checked disabled /> <label for="ck-need">Strictly necessary (family spite)</label></div>
      <div class="field-row"><input id="ck-rolls" type="checkbox" /> <label for="ck-rolls">Cinnamon-roll telemetry</label></div>
      <div class="field-row"><input id="ck-jack" type="checkbox" /> <label for="ck-jack">Allow Jack to submit for Amy</label></div>
      <div class="field-row"><input id="ck-rodgers" type="checkbox" checked /> <label for="ck-rodgers">Refer to Packers by last name</label></div>
      <div class="field-row"><input id="ck-socket" type="checkbox" checked /> <label for="ck-socket">Let Aaron unplug something during the draft</label></div>
    </fieldset>
    <p class="err" id="ck-err"></p>
    <div class="field-row" style="justify-content:flex-end;gap:6px;display:flex">
      <button type="button" disabled title="Kenny needs these">Reject all</button>
      <button type="button" id="ck-accept-all">Accept all</button>
      <button type="button" id="ck-save">Save preferences</button>
    </div>
  `;
}

function corgiHtml() {
  return `
    <h2 class="rainbow">Human / Corgi Verification</h2>
    <p>Click the corgi that stole a cinnamon roll. He will flee. They always do. Darien could catch him. You cannot.</p>
    <div class="arena" id="arena">
      <button type="button" class="flee-btn" id="corgi-btn">🐕 I have the roll</button>
    </div>
    <p class="hint" id="corgi-hint"></p>
    <p><a class="skip-trap" href="./404.html">Skip (gutter ball) →</a></p>
  `;
}

function tosHtml() {
  return `
    <p>Please read the Boger Bowl Terms of Family in full.</p>
    <div class="tos" id="tos">${tosBody()}</div>
    <p class="err" id="tos-err"></p>
    <button type="button" id="tos-next" disabled>I have read nothing and I agree</button>
  `;
}

function tosBody() {
  return `
    <h4>1. Parties</h4>
    <p>You (“cousin”, “plus-one”, “Jack filling this out for Amy”) and the Boger Bowl (“Kenny’s spreadsheet”).</p>
    <h4>2. Time</h4>
    <p>All posted times Pacific. Minnesota and Wisconsin: add two hours. Jacksonville: add three. Phoenix: Steven already knows.</p>
    <h4>3. The commissioner</h4>
    <p>Kenny can do no wrong. If the time is bad, you marked the grid wrong.</p>
    <h4>4. Christmas</h4>
    <p>Barbara’s house in Las Vegas at Christmas is a recognized holy site. Cinnamon rolls are a sacrament. Corgis have voting shares.</p>
    <h4>5. Barbecue &amp; rough-housing</h4>
    <p>Jimmy shall provide barbecue. Jimmy and Steven may wrestle. Guns stay in Phoenix. Unions are discussed at a reasonable volume.</p>
    <h4>6. Ancestry</h4>
    <p>Curt may produce a leaf from Ancestry.com at any time. Honey from his bees may be used as a tie-breaker. Gardens are not draft picks.</p>
    <h4>7. Packers</h4>
    <p>Lynn is on a first-name basis with Aaron. Last names for Packers players are unsportsmanlike conduct.</p>
    <h4>8. Grandma’s favorite</h4>
    <p>Timmy is grandma’s favorite. This is settled law. He works for a regional airline and loves trains and planes. Third baby incoming. Congratulations, now mark your nights.</p>
    <h4>9. Board games</h4>
    <p>Bryan wins. Civil engineers always do. Chess and baseball references will be tolerated. Hiding Catan is allowed.</p>
    <h4>10. Ghost picks</h4>
    <p>If Jack submits for Amy, he must check the box like an adult. New house, one-year-old: we get it.</p>
    <h4>11. Slots</h4>
    <p>Jack may not add a bonus spin to the draft order even though he builds the machines.</p>
    <h4>12. Florida</h4>
    <p>Cori just moved from Miami to Jacksonville with baby Zoe. Darien is an Ironman who also likes a good time. Both of these people may be tired. Mark honestly.</p>
    <h4>13. House projects</h4>
    <p>Lydia is not a huge football fan. Attendance is a valid distraction from drywall. This wizard still counts as a project. Sorry.</p>
    <h4>14. Sockets</h4>
    <p>Aaron shall not unplug anything. Festival bans and Airbnb bans transfer to the draft Zoom if applicable.</p>
    <h4>15. Elf Bowling</h4>
    <p>A strike is required. Spares are a Christmas myth.</p>
  `;
}

function quizHtml() {
  return `
    <p>A short quiz, because we do not trust cousins.</p>
    <fieldset>
      <legend>1. Did you read every word of the terms?</legend>
      <div class="field-row"><input type="radio" name="q1" id="q1t" value="true" /> <label for="q1t">True</label></div>
      <div class="field-row"><input type="radio" name="q1" id="q1f" value="false" /> <label for="q1f">False</label></div>
    </fieldset>
    <fieldset>
      <legend>2. What last name does Lynn use for Aaron Rodgers?</legend>
      <div class="field-row"><input type="radio" name="q2" id="q2a" value="rodgers" /> <label for="q2a">Rodgers</label></div>
      <div class="field-row"><input type="radio" name="q2" id="q2b" value="aaron" /> <label for="q2b">She doesn’t. It’s just Aaron.</label></div>
      <div class="field-row"><input type="radio" name="q2" id="q2c" value="12" /> <label for="q2c">#12 is a last name</label></div>
    </fieldset>
    <fieldset>
      <legend>3. The commissioner (Kenny) can do no wrong.</legend>
      <div class="field-row"><input type="radio" name="q3" id="q3t" value="true" /> <label for="q3t">True (the only legal answer)</label></div>
      <div class="field-row"><input type="radio" name="q3" id="q3f" value="false" /> <label for="q3f">False (you will be traded to the Vikings)</label></div>
    </fieldset>
    <p class="err" id="quiz-err"></p>
    <button type="button" id="quiz-next">Grade me</button>
  `;
}

function nameHtml() {
  const opts = ROSTER.map((r) => `<option value="${esc(r.key)}">${esc(r.key[0].toUpperCase() + r.key.slice(1))}</option>`).join('');
  return `
    <div class="geo">
      <div class="marquee"><span>NO LAST NAMES FOR PACKERS · CORGIS HAVE THE RIGHT OF WAY · VISITORS: <b class="hit-counter" id="hits">000198</b> · CHRISTMAS IN VEGAS YEAR-ROUND ·</span></div>
      <h2>Identify yourself, cousin</h2>
      <div class="field-row">
        <label for="mgr-name">Name:</label>
        <input id="mgr-name" type="text" maxlength="80" style="width:100%" value="${esc(state.name)}" />
      </div>
      <div class="field-row">
        <label for="mgr-roster">Or pick from the roster:</label>
        <select id="mgr-roster">
          <option value="">-- optional --</option>
          ${opts}
        </select>
      </div>
      <div class="field-row">
        <label for="mgr-rel">Relationship to this circus:</label>
        <select id="mgr-rel">
          <option value="">-- choose --</option>
          <option value="blood">Blood Boger / cousin</option>
          <option value="married">Married in (you knew what you were doing)</option>
          <option value="jack-amy">I am Jack and I am helping Amy</option>
          <option value="football">I actually like football</option>
          <option value="rolls">I’m here for cinnamon rolls</option>
        </select>
      </div>
      <p class="err" id="name-err"></p>
      <button type="button" id="name-next">Continue</button>
    </div>
  `;
}

function bowlHtml() {
  return `
    <p><strong>CAPTCHA: throw a strike in Elf Bowling.</strong> Spares fail. Gutters fail. The elves are the pins.</p>
    <div class="bowl-wrap">
      <canvas id="bowl" width="340" height="400"></canvas>
      <div class="power-track"><div class="power-fill" id="power-fill"></div></div>
      <div class="bowl-hud">
        <span>1st tap: aim · 2nd tap: power</span>
        <span id="bowl-throws">throws: 0</span>
      </div>
    </div>
    <p class="hint" id="bowl-status">Lock aim, then power.</p>
    <p class="err" id="bowl-err"></p>
    <button type="button" id="bowl-next" disabled>I struck. Let me into the league.</button>
  `;
}

function zoneHtml() {
  const opts = TZ_OPTIONS.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
  return `
    <p>Times are posted in <strong>Pacific</strong> (Kenny / Vegas). Choose the timezone of record.</p>
    <select id="tz" style="width:100%">${opts}</select>
    <p class="err" id="tz-err"></p>
    <button type="button" id="tz-next">Set timezone</button>
  `;
}

function decoyHtml() {
  return `
    <p>Preferred local time (this will be discarded, but Curt’s bees demand a ritual).</p>
    <div class="field-row">
      <label>Time (mirrored, as a treat):</label>
      <input id="decoy-time" type="time" class="mirror" />
    </div>
    <div class="field-row">
      <label for="decoy-min">Minute (must be prime):</label>
      <input id="decoy-min" type="number" min="0" max="59" />
    </div>
    <p class="hint" id="decoy-hint"></p>
    <p class="err" id="decoy-err"></p>
    <button type="button" id="decoy-next">Submit preferred time</button>
  `;
}

function availHtml() {
  const weeks = WEEKS.map((week) => {
    const rows = week.days
      .map((day) => {
        const cells = HOURS.map((h) => {
          const id = `${day.date}T${h.key}`;
          const on = state.avail.has(id) ? 'on' : '';
          return `<td><button type="button" class="cell ${on}" data-slot="${id}">${state.avail.has(id) ? 'YES' : '—'}</button></td>`;
        }).join('');
        return `<tr><td class="day">${esc(day.short)}</td>${cells}</tr>`;
      })
      .join('');
    return `
      <table class="avail-table">
        <thead>
          <tr><th class="week-head" colspan="3">${esc(week.title)}</th></tr>
          <tr><th>Day</th><th>6:00 PM PT</th><th>7:00 PM PT</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }).join('');

  return `
    <p><strong>Check every slot you can do.</strong> Wed–Sun, 6pm or 7pm Pacific. Minnesota: that’s 8/9pm. Jacksonville: 9/10pm.</p>
    <div class="week-tools">
      <button type="button" id="sel-6">Select all 6pm</button>
      <button type="button" id="sel-7">Select all 7pm</button>
      <button type="button" id="sel-none">Select none</button>
    </div>
    ${weeks}
    <p class="hint" id="avail-hint">${coarse() || state.allowSingleToggle ? 'Tap a cell to toggle.' : 'Double-click a cell (Windows 98 certified).'}</p>
    <p class="err" id="avail-err"></p>
    <button type="button" id="avail-next">These nights work</button>
  `;
}

function holdHtml() {
  const n = state.avail.size;
  return `
    <div class="hold-wrap">
      <p>You marked <strong>${n}</strong> slot${n === 1 ? '' : 's'}.</p>
      <p>Hold to commit. Letting go is an Airbnb cancellation.</p>
      <progress id="hold-bar" max="100" value="0"></progress>
      <p class="err" id="hold-err"></p>
      <button type="button" class="hold-btn" id="hold-btn">Hold to commit</button>
    </div>
  `;
}

function oathHtml() {
  return `
    <p>Type the following exactly (caps lock recommended):</p>
    <p><code>${esc(OATH)}</code></p>
    <input id="oath" type="text" autocomplete="off" autocorrect="off" spellcheck="false" style="width:100%" />
    <p class="hint" id="oath-hint"></p>
    <p class="err" id="oath-err"></p>
    <button type="button" id="oath-next">Swear it</button>
  `;
}

function installHtml() {
  return `
    <p id="install-label">Copying files...</p>
    <progress id="install-bar" max="100" value="0"></progress>
    <p class="hint">Do not turn off your computer. Do not unplug it either, Aaron.</p>
  `;
}

function destroyBowl() {
  bowlGame?.destroy();
  bowlGame = null;
  if (powerTimer) {
    clearInterval(powerTimer);
    powerTimer = null;
  }
}

function renderStep() {
  destroyBowl();
  const id = STEP_IDS[state.step];
  const body = $('#wizard-body');
  if (!body) return;
  const html = {
    cookies: cookieHtml,
    corgi: corgiHtml,
    tos: tosHtml,
    quiz: quizHtml,
    name: nameHtml,
    bowl: bowlHtml,
    zone: zoneHtml,
    decoy: decoyHtml,
    avail: availHtml,
    hold: holdHtml,
    oath: oathHtml,
    install: installHtml,
  }[id];
  body.innerHTML = html();
  $('#status-step').textContent = `Step ${LIE_STEPS[state.step] || '4 of 4'}`;
  clippy(CLIPPY[id]);
  bindStep(id, body);
  if (id === 'install') runInstall();
}

function nextStep() {
  state.step += 1;
  renderStep();
}

function bindStep(id, root) {
  if (id === 'cookies') bindCookies(root);
  if (id === 'corgi') bindCorgi(root);
  if (id === 'tos') bindTos(root);
  if (id === 'quiz') bindQuiz(root);
  if (id === 'name') bindName(root);
  if (id === 'bowl') bindBowl(root);
  if (id === 'zone') bindZone(root);
  if (id === 'decoy') bindDecoy(root);
  if (id === 'avail') bindAvail(root);
  if (id === 'hold') bindHold(root);
  if (id === 'oath') bindOath(root);
}

function bindCookies(root) {
  $('#ck-accept-all', root).addEventListener('click', () => {
    $('#ck-rolls', root).checked = true;
    $('#ck-jack', root).checked = true;
    $('#ck-rodgers', root).checked = true;
    $('#ck-socket', root).checked = true;
    rage();
    clippy('Accept all includes last-naming Aaron and letting festival-Aaron near the power strip. Uncheck those.');
  });
  $('#ck-save', root).addEventListener('click', () => {
    if ($('#ck-rodgers', root).checked) {
      $('#ck-err', root).textContent = 'Uncheck last names for Packers. Lynn is in the room. It is just Aaron.';
      shakeWizard();
      rage();
      return;
    }
    if ($('#ck-socket', root).checked) {
      $('#ck-err', root).textContent = 'Uncheck the socket. Aaron has lost enough Airbnbs.';
      shakeWizard();
      rage();
      return;
    }
    nextStep();
  });
}

function bindCorgi(root) {
  const btn = $('#corgi-btn', root);
  const arena = $('#arena', root);
  let dodges = 0;
  const flee = () => {
    dodges += 1;
    rage();
    const r = arena.getBoundingClientRect();
    btn.style.left = `${Math.random() * Math.max(20, r.width - 140)}px`;
    btn.style.top = `${Math.random() * Math.max(20, r.height - 40)}px`;
    $('#corgi-hint', root).textContent =
      dodges >= 4 ? 'He’s winded. (Short legs. Still faster than you.)' : `Dodges: ${dodges}. Typical corgi.`;
    if (dodges >= 4) clippy('Barbara would like the roll back. You may click him now.');
  };
  btn.addEventListener('pointerenter', () => {
    if (dodges < 4) flee();
  });
  btn.addEventListener('click', (e) => {
    if (dodges < 4) {
      e.preventDefault();
      flee();
      return;
    }
    nextStep();
  });
}

function bindTos(root) {
  const tos = $('#tos', root);
  const btn = $('#tos-next', root);
  tos.addEventListener('scroll', () => {
    if (tos.scrollTop + tos.clientHeight < tos.scrollHeight - 6) return;
    if (!state.tosExtended) {
      state.tosExtended = true;
      tos.insertAdjacentHTML(
        'beforeend',
        `<h4>AMENDMENT A</h4><p>We rewrote the terms. Also Lynn would like it on record that it is just Aaron. Timmy already finished reading because he is grandma’s favorite.</p>
         <h4>AMENDMENT B</h4><p>Kenny reviewed this and found it correct. Continue is enabled. Probably.</p>`,
      );
      tos.scrollTop = 0;
      clippy('Legal updated the terms. Back to the top. Curt’s bees demanded a recount.');
      rage();
      return;
    }
    state.tosRead = true;
    btn.disabled = false;
  });
  btn.addEventListener('click', () => {
    if (!state.tosRead) {
      $('#tos-err', root).textContent = 'The scrollbar has seen more of the terms than you have.';
      shakeWizard();
      rage();
      return;
    }
    nextStep();
  });
}

function bindQuiz(root) {
  $('#quiz-next', root).addEventListener('click', () => {
    const q1 = root.querySelector('input[name="q1"]:checked')?.value;
    const q2 = root.querySelector('input[name="q2"]:checked')?.value;
    const q3 = root.querySelector('input[name="q3"]:checked')?.value;
    const err = $('#quiz-err', root);
    if (q1 === 'true') {
      err.textContent = 'No you didn’t. Honesty is the only passing grade.';
      rage();
      return;
    }
    if (q1 !== 'false') {
      err.textContent = 'Answer the questions. This is not optional, unlike Lydia’s interest in football.';
      rage();
      return;
    }
    if (q2 !== 'aaron') {
      err.textContent = 'Incorrect. Lynn does not use last names. He is Aaron. There is no Rodgers in this house.';
      rage();
      return;
    }
    if (q3 !== 'true') {
      err.textContent = 'Incorrect. Kenny is the commissioner. The commissioner can do no wrong. That is California law.';
      rage();
      return;
    }
    nextStep();
  });
}

function bindName(root) {
  $('#mgr-roster', root).addEventListener('change', () => {
    const key = $('#mgr-roster', root).value;
    const rec = ROSTER.find((r) => r.key === key);
    if (rec && !$('#mgr-name', root).value.trim()) {
      $('#mgr-name', root).value = rec.key[0].toUpperCase() + rec.key.slice(1);
    }
  });
  $('#name-next', root).addEventListener('click', () => {
    let name = $('#mgr-name', root).value.trim();
    const roster = $('#mgr-roster', root).value;
    const rel = $('#mgr-rel', root).value;
    const err = $('#name-err', root);
    if (roster && !name) name = roster[0].toUpperCase() + roster.slice(1);
    if (name.length < 2) {
      err.textContent = 'A name. Cousin is not specific enough. There are too many of you.';
      rage();
      return;
    }
    if (/rodgers/i.test(name)) {
      err.textContent = 'Lynn would like a word. First names only for Packers. Try again.';
      rage();
      return;
    }
    if (!rel) {
      err.textContent = 'Declare your relationship to this circus.';
      rage();
      return;
    }
    state.name = name;
    state.rel = rel;
    const hit = roastName(name) || ROSTER.find((r) => r.key === roster);
    state.memberKey = hit?.key || roster || null;
    if (hit) clippy(hit.roast);
    if (rel === 'jack-amy') clippy('Jack. We logged this. Amy still has to live with the roster.');
    nextStep();
  });
}

function bindBowl(root) {
  const canvas = $('#bowl', root);
  bowlGame = mountBowling(canvas, {
    fast: FAST,
    onStatus(msg, throws) {
      $('#bowl-status', root).textContent = msg;
      $('#bowl-throws', root).textContent = `throws: ${throws}`;
    },
    onStrike(throws) {
      state.struck = true;
      state.bowlingThrows = throws;
      $('#bowl-next', root).disabled = false;
      clippy('STRIKE. The elves are down. Cinnamon rolls for everyone except the 10-pin.');
    },
  });
  powerTimer = setInterval(() => {
    const fill = $('#power-fill', root);
    if (fill && bowlGame) fill.style.width = `${Math.round(bowlGame.getPower() * 100)}%`;
  }, 40);
  $('#bowl-next', root).addEventListener('click', () => {
    if (!state.struck) {
      $('#bowl-err', root).textContent = 'A strike. Not a spare. Not a split. Elf Bowling is a harsh god.';
      rage();
      return;
    }
    nextStep();
  });
}

function bindZone(root) {
  $('#tz-next', root).addEventListener('click', () => {
    const v = $('#tz', root).value;
    const err = $('#tz-err', root);
    if (v === 'America/Los_Angeles') {
      state.timezone = TIMEZONE;
      nextStep();
      return;
    }
    if (v === 'America/Phoenix') {
      err.textContent = 'Steven, in August the clocks match. The form still wants Pacific. Say Pacific.';
      rage();
      return;
    }
    if (v === 'America/Chicago') {
      err.textContent = 'That’s 8pm your time. The grid is still Pacific. Pick Pacific so Kenny’s spreadsheet doesn’t cry.';
      rage();
      return;
    }
    if (v === 'America/New_York') {
      err.textContent = 'Jacksonville math: +3 hours. The board is Pacific. Pick Pacific.';
      rage();
      return;
    }
    if (v === 'Packers') {
      err.textContent = 'Lynn, Lambeau is not an IANA zone. Aaron already knows what time it is. Pick Pacific.';
      rage();
      return;
    }
    if (!v) {
      err.textContent = 'Pick something. Time is a social construct but also 7:00 PM.';
      rage();
      return;
    }
    err.textContent = 'Funny. Board time is still Pacific. The commissioner is in California.';
    rage();
  });
}

function bindDecoy(root) {
  let fails = 0;
  $('#decoy-next', root).addEventListener('click', () => {
    const min = Number($('#decoy-min', root).value);
    const err = $('#decoy-err', root);
    if (!isPrime(min)) {
      fails += 1;
      err.textContent = 'Minutes must be prime. Composite minutes summon Vikings.';
      if (fails >= 2) $('#decoy-hint', root).textContent = `Primes under 60: ${PRIMES.join(', ')}`;
      rage();
      return;
    }
    clippy('Cute. Discarding that. The commissioner already decided it’s 6 or 7pm Pacific.');
    nextStep();
  });
}

function toggleSlot(id, btn) {
  if (!SLOT_IDS.has(id)) return;
  if (state.avail.has(id)) {
    state.avail.delete(id);
    btn.classList.remove('on');
    btn.textContent = '—';
  } else {
    state.avail.add(id);
    btn.classList.add('on');
    btn.textContent = 'YES';
  }
  $('#avail-err').textContent = '';
}

function bindAvail(root) {
  const canSingle = coarse() || state.allowSingleToggle;
  const last = { id: null, t: 0 };
  $$('button.cell', root).forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.slot;
      if (canSingle) {
        toggleSlot(id, btn);
        return;
      }
      const now = Date.now();
      if (last.id === id && now - last.t < 650) {
        toggleSlot(id, btn);
        last.id = null;
        return;
      }
      last.id = id;
      last.t = now;
      state.singleClicks += 1;
      if (state.singleClicks >= 6) {
        state.allowSingleToggle = true;
        $('#avail-hint', root).textContent = 'Fine. Single click. Touch screens weren’t invited to Christmas but here we are.';
      } else {
        clippy('This is Windows 98. Double-click. Bryan would have already won this board game.');
      }
    });
  });
  $('#sel-6', root).addEventListener('click', () => {
    const hour = state.selectAllLies ? 19 : 18;
    setHour(hour, true);
    if (state.selectAllLies) {
      state.selectAllLies = false;
      clippy('Wait — other button. Occupational hazard. Like Jack adding a bonus spin.');
      rage();
    }
    refreshAvailButtons(root);
  });
  $('#sel-7', root).addEventListener('click', () => {
    const hour = state.selectAllLies ? 18 : 19;
    setHour(hour, true);
    state.selectAllLies = false;
    refreshAvailButtons(root);
  });
  $('#sel-none', root).addEventListener('click', () => {
    state.avail.clear();
    refreshAvailButtons(root);
  });
  $('#avail-next', root).addEventListener('click', () => {
    if (state.avail.size < 1) {
      $('#avail-err', root).textContent = 'Mark at least one night or we will schedule you during Zoe’s nap AND a house project.';
      shakeWizard();
      rage();
      return;
    }
    nextStep();
  });
}

function setHour(hour, on) {
  for (const slot of SLOTS) {
    if (slot.hour !== hour) continue;
    if (on) state.avail.add(slot.id);
    else state.avail.delete(slot.id);
  }
}

function refreshAvailButtons(root) {
  $$('button.cell[data-slot]', root).forEach((btn) => {
    const on = state.avail.has(btn.dataset.slot);
    btn.classList.toggle('on', on);
    btn.textContent = on ? 'YES' : '—';
  });
}

function bindHold(root) {
  const btn = $('#hold-btn', root);
  const bar = $('#hold-bar', root);
  const err = $('#hold-err', root);
  const start = () => {
    holdTimer && clearInterval(holdTimer);
    const t0 = Date.now();
    err.textContent = '';
    holdTimer = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - t0) / HOLD_MS) * 100);
      bar.value = pct;
      if (pct >= 100) {
        clearInterval(holdTimer);
        holdTimer = null;
        nextStep();
      }
    }, 50);
  };
  const cancel = () => {
    if (!holdTimer) return;
    clearInterval(holdTimer);
    holdTimer = null;
    bar.value = 0;
    err.textContent = 'Commitment issues. Aaron already cancelled this Airbnb.';
    rage();
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    start();
  });
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);
  btn.addEventListener('pointercancel', cancel);
}

function bindOath(root) {
  const input = $('#oath', root);
  input.addEventListener('paste', (e) => {
    if (state.oathFails < 3) {
      e.preventDefault();
      clippy('Pasting is for people who call Aaron “Rodgers.” Type it.');
      rage();
    }
  });
  $('#oath-next', root).addEventListener('click', () => {
    const v = input.value.trim();
    const err = $('#oath-err', root);
    if (v === OATH) {
      nextStep();
      return;
    }
    state.oathFails += 1;
    if (v === OATH.toLowerCase()) err.textContent = 'YELL IT. Like Lynn at Lambeau.';
    else err.textContent = 'Not even close.';
    if (state.oathFails >= 2) $('#oath-hint', root).textContent = OATH;
    rage();
  });
}

async function runInstall() {
  const bar = $('#install-bar');
  const label = $('#install-label');
  const stages = [
    { text: 'Copying files...', pct: 10, ms: 400 },
    { text: 'Counting Barbara’s corgis (still going)...', pct: 22, ms: 700 },
    { text: 'Proofing cinnamon rolls...', pct: 34, ms: 500 },
    { text: 'Syncing Curt’s Ancestry.com leaf...', pct: 46, ms: 600 },
    { text: 'First-name-only patch for Lynn...', pct: 55, ms: 500 },
    { text: 'Hiding Catan from Bryan...', pct: 64, ms: 500 },
    { text: 'Installing a slot machine (Jack)...', pct: 72, ms: 600 },
    { text: 'Baby Zoe nap schedule (Cori)...', pct: 80, ms: 500 },
    { text: 'Ironman brick + happy hour (Darien)...', pct: 86, ms: 500 },
    { text: 'Hiding sockets from Aaron...', pct: 91, ms: 500 },
    { text: 'Union break (Steven)...', pct: 96, ms: 400 },
    { text: 'Still almost done (Timmy’s plane is boarding)...', pct: 99, ms: 700 },
    { text: 'Kenny certified this install as correct...', pct: 100, ms: 400 },
  ];
  for (const stage of stages) {
    label.textContent = stage.text;
    await animateBar(bar, stage.pct, stage.ms * INSTALL_MULT);
  }
  await sleep(200 * INSTALL_MULT);
  showBsod();
}

function animateBar(bar, target, ms) {
  return new Promise((resolve) => {
    const start = Number(bar.value) || 0;
    const t0 = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / Math.max(ms, 1));
      bar.value = start + (target - start) * t;
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    tick();
  });
}

function showBsod() {
  const el = $('#bsod');
  el.textContent = `A problem has been detected and Windows has been shut down to prevent damage
to your family league.

ELF_BOWLING_IRQL_NOT_LESS_OR_EQUAL

If this is the first time you've seen this stop error screen, restart
your computer. If this screen appears again, follow these steps:

* Make sure you actually hate missing the draft
* Do not call Aaron Rodgers by his last name
* Put the sockets back
* Give the cinnamon roll back to the corgi
* Press any key to anyway continue

Technical information:
*** STOP: 0x0000000C (0xB0CEB000, 0x00000012, 0x00000000, 0x00000000)
`;
  el.classList.add('show');
  const done = async () => {
    window.removeEventListener('keydown', done);
    el.removeEventListener('click', done);
    el.classList.remove('show');
    await finishSave();
  };
  window.addEventListener('keydown', done);
  el.addEventListener('click', done);
}

async function finishSave() {
  const body = $('#wizard-body');
  body.innerHTML = `
    <p>Your availability has been recorded as:</p>
    <p class="fake-time" id="fake-time">CHRISTMAS EVE, BARBARA’S HOUSE, 4:17 AM<br/>Corgi pile, Las Vegas</p>
    <p class="hint" id="save-status">writing to disk...</p>
  `;
  clippy('Wait wait wait.');
  await sleep(FAST ? 400 : 1600);
  $('#fake-time').innerHTML = `${state.avail.size} Pacific evening${state.avail.size === 1 ? '' : 's'}<br/>Wed–Sun · 6pm or 7pm PT`;
  try {
    await saveResponse({
      display_name: state.name.slice(0, 80),
      member_key: state.memberKey,
      available_slot_ids: [...state.avail].filter((id) => SLOT_IDS.has(id)),
      timezone: TIMEZONE,
      gauntlet_seconds: Math.round((Date.now() - state.startedAt) / 1000),
      rage_clicks: state.rage,
      bowling_throws: state.bowlingThrows || 0,
    });
    $('#save-status').textContent = 'Saved. Kenny has reviewed this and found it correct.';
    confetti();
    const again = document.createElement('div');
    again.innerHTML = `<p><button type="button" id="see-results">View the spreadsheet</button>
      <button type="button" id="again">Suffer again</button></p>`;
    body.append(again);
    $('#see-results').addEventListener('click', () => openResults());
    $('#again').addEventListener('click', () => {
      state.step = 0;
      state.avail = new Set();
      state.oathFails = 0;
      state.tosExtended = false;
      state.tosRead = false;
      state.struck = false;
      state.bowlingThrows = 0;
      renderStep();
    });
    openResults();
  } catch (err) {
    $('#save-status').innerHTML = `<span class="err">Save failed: ${esc(err.message || err)}</span>
      <p><button type="button" id="retry-save">Retry</button></p>`;
    $('#retry-save')?.addEventListener('click', () => finishSave());
  }
}

function confetti() {
  const layer = $('#confetti');
  layer.hidden = false;
  layer.innerHTML = '';
  const words = ['STRIKE', 'AARON', 'CORGI', 'ROLLS', 'PACK', 'BOGER'];
  for (let i = 0; i < 28; i++) {
    const n = document.createElement('i');
    n.textContent = words[i % words.length];
    n.style.left = `${Math.random() * 100}%`;
    n.style.animationDuration = `${2 + Math.random() * 2.5}s`;
    n.style.animationDelay = `${Math.random() * 0.4}s`;
    layer.append(n);
  }
  setTimeout(() => {
    layer.hidden = true;
    layer.innerHTML = '';
  }, 4000);
}

function shakeWizard() {
  const win = getWin('wizard');
  if (!win) return;
  win.classList.remove('shake');
  void win.offsetWidth;
  win.classList.add('shake');
}

function onDesktopClick(e) {
  const open = e.target.closest('[data-open]')?.dataset.open;
  if (open === 'wizard') openWizard();
  if (open === 'results') openResults();
  if (open === 'readme') openReadme();
  if (open === 'rolls') openRolls();
  if (open === 'corgis') openCorgis();
  if (open === 'recycle') openRecycle();
}

function bindDesktop() {
  const icons = $$('.icon');
  const isCoarse = coarse();
  icons.forEach((icon) => {
    icon.addEventListener('click', () => {
      icons.forEach((i) => i.classList.remove('selected'));
      icon.classList.add('selected');
      if (isCoarse) icon.dispatchEvent(new Event('open-icon'));
    });
    icon.addEventListener('dblclick', () => icon.dispatchEvent(new Event('open-icon')));
    icon.addEventListener('open-icon', () => {
      const which = icon.dataset.open;
      if (which === 'wizard') openWizard();
      if (which === 'results') openResults();
      if (which === 'readme') openReadme();
      if (which === 'rolls') openRolls();
      if (which === 'corgis') openCorgis();
      if (which === 'recycle') openRecycle();
    });
  });

  document.addEventListener('click', (e) => {
    const close = e.target.closest('[data-win-close]')?.dataset.winClose;
    const min = e.target.closest('[data-win-min]')?.dataset.winMin;
    const max = e.target.closest('[data-win-max]')?.dataset.winMax;
    if (close) closeWin(close);
    if (min) {
      const w = getWin(min);
      if (w) w.hidden = true;
    }
    if (max) {
      const w = getWin(max);
      if (!w) return;
      w.style.width = '80px';
      w.style.height = '80px';
      rage();
      setTimeout(() => {
        w.style.width = '';
        w.style.height = '';
      }, 900);
    }
    if (e.target.id === 'ad-claim') {
      clippy('You won a cinnamon roll and also a corgi. Barbara does not take returns.');
      rage();
      getWin('ad1')?.remove();
    }
  });

  $('#start-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#start-menu').classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#start-menu') && e.target.id !== 'start-btn') {
      $('#start-menu').classList.remove('open');
    }
  });
  $('#start-menu').addEventListener('click', onDesktopClick);
  $('#start-run').addEventListener('click', () => {
    clippy('Run: C:\\BOGER\\DRAFT.EXE is already running. Kenny configured it correctly.');
  });
  $('#start-shutdown').addEventListener('click', () => {
    clippy('You can’t shut down the Boger Bowl. Grandma already said Timmy could stay.');
    rage();
  });
  $('#start-packers').addEventListener('click', () => {
    clippy('Absolutely not. His name is Aaron. Lynn is typing in all caps.');
    rage();
  });
  $('#start-airbnb').addEventListener('click', () => {
    clippy('Socket unplugged. You are banned from this desktop. And from three properties in Nevada.');
    rage();
  });
}

async function startBoot() {
  const boot = $('#boot');
  const full = bootText();
  if (FAST) {
    boot.textContent = full;
    await sleep(BOOT_MS);
  } else {
    boot.textContent = '';
    const parts = full.split(/(\s+)/);
    for (const part of parts) {
      boot.textContent += part;
      await sleep(12);
    }
    await sleep(600);
  }
  boot.hidden = true;
  $('#desktop').hidden = false;
  clippy(
    sessionStorage.getItem('boger-shame')
      ? 'Skipping was a gutter ball. Double-click Boger Bowl Draft.exe.'
      : 'Double-click Boger Bowl Draft.exe. Christmas lights are on. The corgis are ready.',
  );
  sessionStorage.removeItem('boger-shame');
  bindDesktop();
  tickClock();
  setInterval(tickClock, 1000);
}

startBoot();
