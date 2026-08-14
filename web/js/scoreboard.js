import { MEMBERS } from "./members.js";
import { SLOTS, WEEKS, formatLocal } from "./slots.js";
import { loadResponses, latestByMember } from "./db.js";

const $ = (id) => document.getElementById(id);

function memberOf(row) {
  return MEMBERS.find((m) => m.key === row.member_key) || {
    name: row.display_name,
    city: "??",
    tz: "America/Los_Angeles",
    key: row.member_key || row.display_name,
  };
}

function weekTable(week, latest, byKey) {
  const slots = SLOTS.filter((s) => s.week.id === week.id);
  const counts = Object.fromEntries(slots.map((s) => [s.id, 0]));
  for (const r of latest) {
    for (const id of r.available_slot_ids || []) {
      if (id in counts) counts[id] += 1;
    }
  }
  const best = Math.max(0, ...Object.values(counts));
  const head =
    `<tr><th>${week.label}</th>` +
    slots
      .map((s) => {
        const n = counts[s.id];
        const cls = n === best && best > 0 ? "best" : "";
        return `<th class="${cls}">${s.day.short}<br>${s.hour.label.replace(" PT", "")}<br><small>${n}</small></th>`;
      })
      .join("") +
    `</tr>`;
  const body = MEMBERS.map((m) => {
    const r = byKey.get(m.key);
    const cells = slots
      .map((s) => {
        const on = r?.available_slot_ids?.includes(s.id);
        return `<td class="${on ? "yes" : r ? "no" : "miss"}">${on ? "Y" : r ? "—" : "?"}</td>`;
      })
      .join("");
    return `<tr><th>${m.name}<small>${m.city}</small></th>${cells}</tr>`;
  }).join("");
  const recs = slots.filter((s) => counts[s.id] === best && best > 0);
  const call = recs.length
    ? `Hottest in ${week.label}: ${recs.map((s) => `${s.day.short} ${s.hour.label}`).join(" / ")} (${best})`
    : `${week.label}: no faxes yet.`;
  return { head, body, call, counts };
}

function render(rows) {
  const latest = latestByMember(rows);
  const byKey = new Map(latest.map((r) => [r.member_key, r]));
  const missing = MEMBERS.filter((m) => !byKey.has(m.key));

  $("meta").textContent = `${latest.length} / ${MEMBERS.length} Bogers reported  •  ${rows.length} total faxes`;
  $("missing").textContent = missing.length
    ? "Still outstanding: " + missing.map((m) => m.name).join(", ")
    : "Every Boger has suffered. The commish may now pick a time.";

  const wrap = $("weeks");
  wrap.innerHTML = "";
  const allHot = [];
  for (const week of WEEKS) {
    const t = weekTable(week, latest, byKey);
    allHot.push(t.call);
    const sec = document.createElement("section");
    sec.innerHTML = `<h2>${week.dish}</h2><p class="tiny">${t.call}</p><div style="overflow:auto"><table class="board"><thead>${t.head}</thead><tbody>${t.body}</tbody></table></div>`;
    wrap.appendChild(sec);
  }
  $("call").textContent = allHot.join("  •  ");

  const log = $("log");
  log.innerHTML = latest
    .map((r) => {
      const m = memberOf(r);
      const when = new Date(r.created_at).toLocaleString();
      const slots = (r.available_slot_ids || [])
        .map((id) => SLOTS.find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => formatLocal(s, m.tz))
        .join(" · ");
      return `<li><strong>${r.display_name}</strong> <em>${when}</em><div>${slots}</div></li>`;
    })
    .join("");
}

$("reload").addEventListener("click", () => location.reload());

loadResponses()
  .then(render)
  .catch((err) => {
    $("call").textContent = err.message || "Scoreboard down. Blame the elves.";
  });
