export type Slot = {
  id: string
  date: string
  weekday: string
  time: string
  hour: number
  week: number
  weekend: boolean
}

const WEEKDAYS = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

const WEEKS: string[][] = [
  ['2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'],
  ['2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'],
  ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'],
]

function hoursFor(dayIndex: number): number[] {
  return dayIndex >= 3 ? [9, 13, 18, 19] : [18, 19]
}

function labelHour(hour: number): string {
  if (hour === 9) return '9:00 AM'
  if (hour === 13) return '1:00 PM'
  if (hour === 18) return '6:00 PM'
  return '7:00 PM'
}

function buildSlots(): Slot[] {
  const slots: Slot[] = []
  WEEKS.forEach((days, week) => {
    days.forEach((date, dayIndex) => {
      for (const hour of hoursFor(dayIndex)) {
        const hh = String(hour).padStart(2, '0')
        slots.push({
          id: `${date}T${hh}:00`,
          date,
          weekday: WEEKDAYS[dayIndex],
          time: labelHour(hour),
          hour,
          week,
          weekend: dayIndex >= 3,
        })
      }
    })
  })
  return slots
}

export const SLOTS = buildSlots()
export const SLOTS_BY_ID = new Map(SLOTS.map((slot) => [slot.id, slot]))

export const WEEK_LABELS = [
  'Week of Aug 17',
  'Week of Aug 24',
  'Week of Aug 31',
] as const

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function prettyDate(date: string, weekday: string): string {
  const [, m, d] = date.split('-')
  return `${weekday.slice(0, 3)} ${MONTHS[Number(m) - 1]} ${Number(d)}`
}

export function formatSlot(id: string): string {
  const slot = SLOTS_BY_ID.get(id)
  if (!slot) return id
  return `${prettyDate(slot.date, slot.weekday)} · ${slot.time} PT`
}

export type Day = {
  date: string
  weekday: string
  slots: Slot[]
}

export function groupDays(): Day[] {
  const map = new Map<string, Slot[]>()
  for (const slot of SLOTS) {
    const list = map.get(slot.date) ?? []
    list.push(slot)
    map.set(slot.date, list)
  }
  return [...map.entries()].map(([date, slots]) => ({
    date,
    weekday: slots[0]?.weekday ?? '',
    slots,
  }))
}

if (SLOTS.length !== 42) {
  throw new Error(`Boger Bowl slot table is ${SLOTS.length}, expected 42`)
}
