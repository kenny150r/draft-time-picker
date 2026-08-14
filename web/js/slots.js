/** Wall-clock Pacific times. Slot IDs match boger_bowl_responses check constraint. */
export const WEEKS = [
  {
    id: "w1",
    label: "Aug 19–23",
    dish: "Preseason I (the cinnamon-roll week)",
    dates: { wed: "2026-08-19", thu: "2026-08-20", fri: "2026-08-21", sat: "2026-08-22", sun: "2026-08-23" },
  },
  {
    id: "w2",
    label: "Aug 26–30",
    dish: "Preseason II (Timmy might have a trip)",
    dates: { wed: "2026-08-26", thu: "2026-08-27", fri: "2026-08-28", sat: "2026-08-29", sun: "2026-08-30" },
  },
  {
    id: "w3",
    label: "Sep 2–6",
    dish: "Labor Day Classic (Aaron's festival window)",
    dates: { wed: "2026-09-02", thu: "2026-09-03", fri: "2026-09-04", sat: "2026-09-05", sun: "2026-09-06" },
  },
];

export const DAYS = [
  { id: "wed", label: "Wednesday", short: "WED", weekend: false, offset: 0 },
  { id: "thu", label: "Thursday", short: "THU", weekend: false, offset: 1 },
  { id: "fri", label: "Friday", short: "FRI", weekend: false, offset: 2 },
  { id: "sat", label: "Saturday", short: "SAT", weekend: true, offset: 3 },
  { id: "sun", label: "Sunday", short: "SUN", weekend: true, offset: 4 },
];

export const HOURS = [
  { id: "09", hour: 9, label: "9:00 AM PT", weekendOnly: true, ch: "09" },
  { id: "13", hour: 13, label: "1:00 PM PT", weekendOnly: true, ch: "13" },
  { id: "18", hour: 18, label: "6:00 PM PT", weekendOnly: false, ch: "06" },
  { id: "19", hour: 19, label: "7:00 PM PT", weekendOnly: false, ch: "07" },
];

function pad(n) {
  return String(n).padStart(2, "0");
}

export function isoId(date, hour) {
  return `${date}T${pad(hour)}:00`;
}

export function dateFor(week, day) {
  return week.dates[day.id];
}

export function slotId(week, day, hour) {
  return isoId(dateFor(week, day), hour.hour);
}

export function allSlots() {
  const out = [];
  for (const week of WEEKS) {
    for (const day of DAYS) {
      for (const hour of HOURS) {
        if (hour.weekendOnly && !day.weekend) continue;
        const id = slotId(week, day, hour);
        out.push({
          id,
          week,
          day,
          hour,
          pacific: `${week.label} ${day.label} ${hour.label}`,
          pattern: `${day.id}-${hour.id}`,
        });
      }
    }
  }
  return out;
}

export const SLOTS = allSlots();

export function slotsForWeek(weekId) {
  return SLOTS.filter((s) => s.week.id === weekId);
}

export function slotAsDate(slot) {
  return new Date(`${slot.id}:00-07:00`);
}

export function formatLocal(slot, timeZone) {
  const d = slotAsDate(slot);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

export const PROGRAMS = {
  "wed-18": "Corgi Hour (Unmuted)",
  "wed-19": "Jimmy & Steven: Grill Off",
  "thu-18": "Who Do You Think You Are: Curt",
  "thu-19": "Packers Pregame w/ Aaron, Jordan & the Guys",
  "fri-18": "Local 469 / Girl-Dad Dinner",
  "fri-19": "Not a House Project with Lydia",
  "sat-09": "Timmy's Preflight + Train Cam",
  "sat-13": "Darien Brick Workout, Then Snacks",
  "sat-18": "Zoe's Nap Window (Jax, Not Miami)",
  "sat-19": "Jack's Floor: Slots Going Cold",
  "sun-09": "Barbara's Rolls & Three Trains",
  "sun-13": "NFL in the New House (Amy/Jack)",
  "sun-18": "Aaron's Maybe-Flight Home",
  "sun-19": "Commissioner's Call (Kenny, PT)",
};
