/** Days of the operating week. Monday is day 1, matching the rotation law (F1-F5). */
export const DAY_TYPES = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type DayType = (typeof DAY_TYPES)[number]

export function dayIndex(day: DayType): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  return (DAY_TYPES.indexOf(day) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7
}

/**
 * Printable day heading as found on the operator's sheets.
 * The sheets are printed Sunday-first, so `printOrder` is intentionally separate
 * from `DAY_TYPES` (which follows the rotation law's Monday-first numbering).
 */
const PRINT_LABELS: Record<DayType, string> = {
  monday: 'PAZARTESİ',
  tuesday: 'SALI',
  wednesday: 'ÇARŞAMBA',
  thursday: 'PERŞEMBE',
  friday: 'CUMA',
  saturday: 'CUMARTESİ',
  sunday: 'PAZAR',
}

export function printLabel(day: DayType): string {
  return PRINT_LABELS[day]
}

/** Sheet order, top row first: Sunday ... Monday. */
export const PRINT_ORDER: readonly DayType[] = [
  'sunday',
  'saturday',
  'friday',
  'thursday',
  'wednesday',
  'tuesday',
  'monday',
]

const LABEL_LOOKUP: ReadonlyMap<string, DayType> = new Map(
  DAY_TYPES.map((day) => [normalize(PRINT_LABELS[day]), day]),
)

/** Accepts Turkish or ASCII spellings, any case: `pazartesi`, `SALI`, `Cuma`. */
export function parseDayLabel(label: string): DayType | undefined {
  return LABEL_LOOKUP.get(normalize(label))
}

function normalize(label: string): string {
  return label.trim().toLocaleUpperCase('tr-TR').replace(/İ/g, 'I')
}
