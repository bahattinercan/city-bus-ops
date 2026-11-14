/**
 * The 7-week duty-group rotation law (legacy F1-F5, operator decision O4).
 *
 * Verified against 12 real cells in `docs/legacy-data-model-and-scheduler.md` §6.5:
 * a group's weekday moves one day earlier every week and returns to the same weekday
 * after seven weeks. This is a hard rule for publishing a plan (R7).
 */

export const ROTATION_CYCLE_WEEKS = 7

export type DayIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Mathematical modulo: always returns 0..6, even for negative values. */
function mod7(value: number): number {
  return ((value % ROTATION_CYCLE_WEEKS) + ROTATION_CYCLE_WEEKS) % ROTATION_CYCLE_WEEKS
}

/** F2 — position inside the 7-week cycle, 1..7. */
export function cyclePosition(weekOffset: number): DayIndex {
  return (mod7(weekOffset) + 1) as DayIndex
}

/**
 * F3 — the weekday a duty group falls on in the week `weekOffset` weeks after the anchor
 * week. `referenceDayIndex` is the group's weekday in the anchor week (legacy `g0`).
 */
export function rotationDayIndex(referenceDayIndex: DayIndex, weekOffset: number): DayIndex {
  return (mod7(referenceDayIndex - weekOffset - 1) + 1) as DayIndex
}

/** Midnight UTC of the Monday that starts the week containing `date`. */
export function weekStartOf(date: Date): Date {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = utc.getUTCDay() === 0 ? 7 : utc.getUTCDay()
  utc.setUTCDate(utc.getUTCDate() - (weekday - 1))
  return utc
}

/** F1 — whole weeks between two Mondays; negative before the anchor week. */
export function weekOffset(anchorWeekStart: Date, targetWeekStart: Date): number {
  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.round((targetWeekStart.getTime() - anchorWeekStart.getTime()) / dayMs)
  if (days % 7 !== 0) {
    throw new Error('Both dates must be the Monday of their week')
  }
  return days / 7
}

/** `YYYY-MM-DD`, the format used for service dates everywhere. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Parses a `YYYY-MM-DD` calendar date at UTC midnight.
 *
 * Returns `undefined` for anything that is not a real date, because the value usually comes
 * from a query string (`?week=…`) and a malformed one must not throw inside a page render.
 */
export function parseIsoDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined
  }
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }
  // Reject roll-overs such as 2026-02-31, which Date would silently turn into March.
  return isoDate(date) === value ? date : undefined
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

/** Day type per rotation index, so messages can print the operator's own weekday names. */
export const ROTATION_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const
