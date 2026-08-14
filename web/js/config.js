const SUPABASE_URL = "https://gcqjjpbshoogojsozflp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcWpqcGJzaG9vZ29qc296ZmxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTIzNDgsImV4cCI6MjA5Njg2ODM0OH0.FgqYBf93jkHI1vblJUWM8npPx5usKrTVohUOQFFOGx0";

const WEEK_STARTS = [
  {
    key: "A",
    label: "Schedule A",
    start: "2026-08-19",
    joke: "The early week. Subject to Timmy's trip sequence and Barbara preheating the oven.",
  },
  {
    key: "B",
    label: "Schedule B",
    start: "2026-08-26",
    joke: "A respectable week. Bryan has already simulated the snake draft on a napkin.",
  },
  {
    key: "C",
    label: "Schedule C",
    start: "2026-09-02",
    joke: "Labor Day weekend. Darien may be training. Lydia may be at Home Depot. Both still have to pick.",
  },
];

const DAY_NAMES = ["Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = [9, 13, 18, 19];

const MEMBERS = [
  {
    key: "kenny",
    name: "Kenny",
    city: "California",
    tz: "PT",
    title: "Commissioner",
    blurb: "All times are Pacific because he lives there and because arguing about it is not a bylaw.",
    phrase: "commissioner",
    hint: "his unpaid job title",
  },
  {
    key: "barbara",
    name: "Barbara",
    city: "Las Vegas",
    tz: "PT",
    title: "Host of Christmas",
    blurb: "Cinnamon rolls, Christmas in Vegas, and more corgis than a bye week has meaning.",
    phrase: "corgi",
    hint: "the house mascot. there are several. any singular will do.",
  },
  {
    key: "jimmy",
    name: "Jimmy",
    city: "Las Vegas",
    tz: "PT",
    title: "Pitmaster",
    blurb: "Conservative politics, serious barbecue, and a lifetime ban from gentle rough-housing with Steven.",
    phrase: "brisket",
    hint: "the meat, not the talking points",
  },
  {
    key: "curt",
    name: "Curt",
    city: "Minnesota",
    tz: "CT",
    title: "Chief Genealogist",
    blurb: "If he is late, check Ancestry.com, the bee boxes, or whether a tomato needed a pep talk.",
    phrase: "bees",
    hint: "they already have a union",
  },
  {
    key: "lynn",
    name: "Lynn",
    city: "Minnesota",
    tz: "CT",
    title: "Packers Liaison",
    blurb: "Largest Packers fan in the league. She is on a first-name basis with Aaron. Last names are for NFC North rivals.",
    phrase: "aaron",
    hint: "first name only. you know which one.",
  },
  {
    key: "timmy",
    name: "Timmy",
    city: "Minnesota",
    tz: "CT",
    title: "Grandma's Favorite",
    blurb: "Regional airline. Trains. Planes. Third baby on approach. The favorite-cousin ranking was never a contest.",
    phrase: "grandma",
    hint: "who already knows he is picking first",
  },
  {
    key: "bryan",
    name: "Bryan",
    city: "Wisconsin",
    tz: "CT",
    title: "Board-Game Champ",
    blurb: "Civil engineer. Chess. Baseball. Has never lost a board game, a claim entered into evidence by Bryan.",
    phrase: "checkmate",
    hint: "how game night ends",
  },
  {
    key: "amy",
    name: "Amy",
    city: "Las Vegas",
    tz: "PT",
    title: "New House, New Boss",
    blurb: "Jack's wife. New house. One-year-old at home. If this form is in all caps, Jack filled it out.",
    phrase: "not jack",
    hint: "two words, a boundary",
  },
  {
    key: "jack",
    name: "Jack",
    city: "Las Vegas",
    tz: "PT",
    title: "Slot Adjacent",
    blurb: "Works at a Las Vegas company that makes slot machines. Please do not tilt the kiosk. It will tilt you.",
    phrase: "777",
    hint: "the only acceptable jackpot",
  },
  {
    key: "cori",
    name: "Cori",
    city: "Jacksonville",
    tz: "ET",
    title: "Newly Eastern",
    blurb: "Just moved from Miami. Baby Zoe is a few months old and does not recognize commissioner time.",
    phrase: "zoe",
    hint: "the new general manager",
  },
  {
    key: "darien",
    name: "Darien",
    city: "Jacksonville",
    tz: "ET",
    title: "Ironman, Off-Duty",
    blurb: "Ironman athlete who also loves a good time. The 9am Pacific slot is a warm-up. The 7pm slot is the good time.",
    phrase: "ironman",
    hint: "his other, sweatier league",
  },
  {
    key: "lydia",
    name: "Lydia",
    city: "Las Vegas",
    tz: "PT",
    title: "Project Avoidance",
    blurb: "Not a huge football fan. Will attend anything that postpones another house project.",
    phrase: "house",
    hint: "the opponent this season",
  },
  {
    key: "aaron",
    name: "Aaron",
    city: "Las Vegas",
    tz: "PT",
    title: "Festival Alumni",
    blurb: "Party animal. Known to unplug sockets at festivals and collect AirBnB bans like loyalty points.",
    phrase: "unplug",
    hint: "what not to do to this kiosk, or anyone's fridge",
  },
  {
    key: "steven",
    name: "Steven",
    city: "Phoenix",
    tz: "AZ",
    title: "Girl Dad, Union Man",
    blurb: "Union pipe fitter. Long blonde hair. Loves guns and unions. Girl dad. Jimmy is not invited to wrestle during the snake.",
    phrase: "girl dad",
    hint: "his strongest local",
  },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function isWeekend(dayIndex) {
  return dayIndex >= 3;
}

function hourAllowed(dayIndex, hour) {
  if (hour === 18 || hour === 19) return true;
  return isWeekend(dayIndex) && (hour === 9 || hour === 13);
}

function buildSlots() {
  const slots = [];
  for (const week of WEEK_STARTS) {
    for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
      const date = addDays(week.start, dayIndex);
      for (const hour of HOURS) {
        if (!hourAllowed(dayIndex, hour)) continue;
        slots.push({
          id: `${date}T${pad2(hour)}:00`,
          week: week.key,
          date,
          dayIndex,
          hour,
        });
      }
    }
  }
  return slots;
}

const SLOTS = buildSlots();

function formatClock(hour) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${suffix}`;
}

function tzOffsetHours(tz) {
  if (tz === "CT") return 2;
  if (tz === "ET") return 3;
  return 0;
}

function localClock(hour, tz) {
  const local = (hour + tzOffsetHours(tz)) % 24;
  return formatClock(local);
}

function normalizePhrase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
