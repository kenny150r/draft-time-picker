export const SUPABASE_URL = 'https://gcqjjpbshoogojsozflp.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcWpqcGJzaG9vZ29qc296ZmxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTIzNDgsImV4cCI6MjA5Njg2ODM0OH0.FgqYBf93jkHI1vblJUWM8npPx5usKrTVohUOQFFOGx0';

export const FAST = ['localhost', '127.0.0.1'].includes(location.hostname);
export const HOLD_MS = FAST ? 700 : 5200;
export const BOOT_MS = FAST ? 600 : 3400;
export const INSTALL_MULT = FAST ? 0.15 : 1;

export const OATH = 'I WILL SHOW UP FOR THE BOGER BOWL';
export const TIMEZONE = 'America/Los_Angeles';

export const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59];

export function isPrime(n) {
  return PRIMES.includes(Number(n));
}

/** Wednesday–Sunday, 6:00 PM or 7:00 PM Pacific. */
export const HOURS = [
  { hour: 18, key: '18:00', label: '6:00 PM PT' },
  { hour: 19, key: '19:00', label: '7:00 PM PT' },
];

export const WEEKS = [
  {
    title: 'Week of Aug 17',
    days: [
      { date: '2026-08-19', dow: 'Wed', short: 'Wed Aug 19' },
      { date: '2026-08-20', dow: 'Thu', short: 'Thu Aug 20' },
      { date: '2026-08-21', dow: 'Fri', short: 'Fri Aug 21' },
      { date: '2026-08-22', dow: 'Sat', short: 'Sat Aug 22' },
      { date: '2026-08-23', dow: 'Sun', short: 'Sun Aug 23' },
    ],
  },
  {
    title: 'Week of Aug 24',
    days: [
      { date: '2026-08-26', dow: 'Wed', short: 'Wed Aug 26' },
      { date: '2026-08-27', dow: 'Thu', short: 'Thu Aug 27' },
      { date: '2026-08-28', dow: 'Fri', short: 'Fri Aug 28' },
      { date: '2026-08-29', dow: 'Sat', short: 'Sat Aug 29' },
      { date: '2026-08-30', dow: 'Sun', short: 'Sun Aug 30' },
    ],
  },
  {
    title: 'Week of Aug 31 (Labor Day wknd)',
    days: [
      { date: '2026-09-02', dow: 'Wed', short: 'Wed Sep 2' },
      { date: '2026-09-03', dow: 'Thu', short: 'Thu Sep 3' },
      { date: '2026-09-04', dow: 'Fri', short: 'Fri Sep 4' },
      { date: '2026-09-05', dow: 'Sat', short: 'Sat Sep 5' },
      { date: '2026-09-06', dow: 'Sun', short: 'Sun Sep 6' },
    ],
  },
];

export const SLOTS = WEEKS.flatMap((week) =>
  week.days.flatMap((day) =>
    HOURS.map((h) => ({
      id: `${day.date}T${h.key}`,
      date: day.date,
      dow: day.dow,
      hour: h.hour,
      week: week.title,
      label: `${day.short} · ${h.label}`,
      start: `${day.date}T${h.key}:00-07:00`,
    })),
  ),
);

export const SLOT_IDS = new Set(SLOTS.map((s) => s.id));

export const TZ_OPTIONS = [
  { value: '', label: '-- select your temporal prison --' },
  { value: 'America/Los_Angeles', label: 'Pacific (Kenny / most of Vegas — board time)' },
  { value: 'America/Phoenix', label: 'Arizona (Steven, no DST, still has to say Pacific)' },
  { value: 'America/Chicago', label: 'Central (Minnesota / Wisconsin — 6pm PT is 8pm you)' },
  { value: 'America/New_York', label: 'Eastern (Jacksonville / formerly Miami)' },
  { value: 'Packers', label: 'Lambeau Time (Lynn; Aaron is already there)' },
  { value: 'Corgi', label: 'Corgi Standard (Barbara; cinnamon-roll o’clock)' },
  { value: 'Ancestry', label: 'Ancestry.com Genealogical Time (Curt, 1847)' },
  { value: 'Slots', label: 'Slot-machine time (Jack; one more spin)' },
  { value: 'Festival', label: 'Unplugged-socket time (Aaron; currently banned)' },
  { value: 'Ironman', label: 'Ironman split (Darien; also happy hour)' },
  { value: 'Zoe', label: 'Baby Zoe nap schedule (Cori)' },
  { value: 'Union', label: 'Union break (Steven; guns & pipes, in that order)' },
];

export const ROSTER = [
  { key: 'kenny', re: /\bkenny\b/, roast: 'Commissioner detected. California time is correct because you said so. The cinnamon rolls are not a bribe. They are a tax.' },
  { key: 'barbara', re: /\bbarb(ara)?\b/, roast: 'Barbara. Cinnamon rolls, Christmas in Vegas, and more corgis than zoning allows. The elves already set a place for you.' },
  { key: 'jimmy', re: /\bjimmy\b|\bjames\b/, roast: 'Jimmy. Fire up the barbecue. Conservative talking points are a free agent. Rough-housing Steven is a contact sport.' },
  { key: 'curt', re: /\bcurt\b|\bcurtis\b/, roast: 'Curt. Ancestry.com has a new leaf. The bees already voted. Please do not draft a honey badger.' },
  { key: 'lynn', re: /\blynn\b/, roast: 'Lynn. Aaron is in. We do not use last names for Packers. That man is family.' },
  { key: 'timmy', re: /\btimmy\b|\btim\b/, roast: 'Timmy. Grandma’s favorite, regional-airline royalty, trains AND planes, third baby incoming. Sit wherever you want.' },
  { key: 'bryan', re: /\bbryan\b|\bbrian\b/, roast: 'Bryan. Civil engineer, chess, baseball, and you will win Settlers. We have stopped playing you in Monopoly.' },
  { key: 'amy', re: /\bamy\b/, roast: 'Amy. New house, one-year-old at home. If Jack is filling this out: we see you. If you are actually Amy: respect.' },
  { key: 'jack', re: /\bjack\b/, roast: 'Jack. Slot-machine guy. Please do not add bonus spins to the draft order. Also stop making Amy’s picks unless she asked.' },
  { key: 'cori', re: /\bcori\b|\bcorey\b/, roast: 'Cori. Jacksonville now, Miami in the rearview, baby Zoe on the roster. Naps override 7pm. We understand.' },
  { key: 'darien', re: /\bdarien\b|\bdarian\b/, roast: 'Darien. Ironman by day, good time by night. Hydrate, then hydrate for different reasons.' },
  { key: 'lydia', re: /\blydia\b/, roast: 'Lydia. Not a huge football person, which is valid. Anything beats the house project. This form still counts as a house project. Sorry.' },
  { key: 'aaron', re: /\baaron\b/, roast: 'Aaron. Party animal. If a socket is plugged in, you are looking at it. Airbnb has you in a folder labeled “no.”' },
  { key: 'steven', re: /\bsteven\b|\bstephen\b/, roast: 'Steven. Union pipe fitter, Phoenix, long blonde hair, guns AND unions, girl dad. Jimmy already stretched for the rough-housing.' },
];
