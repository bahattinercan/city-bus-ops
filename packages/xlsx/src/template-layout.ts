import type { DayType } from '@citybus/domain'

/**
 * Cell map of the operator's real weekly sheet (template v2.0).
 *
 * Source: 21 photographs of hand-filled sheets, cross-checked against a generated
 * workbook (legacy `04-excel-io.md` §2.7). These constants are the contract that
 * keeps the printed output identical to what the operator already uses — do not
 * "tidy" them into an abstract grid model.
 */
export const TEMPLATE_VERSION = '2.0'

/** Monday-first day columns: verified against the real sheet, not assumed. */
const DAY_COLUMN_MAP: ReadonlyArray<readonly [DayType, string]> = [
  ['monday', 'C'],
  ['tuesday', 'D'],
  ['wednesday', 'E'],
  ['thursday', 'F'],
  ['friday', 'G'],
  ['saturday', 'H'],
  ['sunday', 'I'],
]

export const MATRIX_SHEET = {
  name: 'MATRIS',
  /** Two narrow summary rows above the header (printed totals live here). */
  summaryBand: 'A1:J2',
  headerRow: 3,
  sequenceColumn: 'A',
  plateColumn: 'B',
  firstDataRow: 4,
  lastDataRow: 48,
  dayColumns: DAY_COLUMN_MAP,
  standbyColumn: 'J',
  /** Daily vehicle counts, then the weekly total (e.g. =76) in the standby column. */
  totalsRow: 49,
} as const

export const ROTATION_SHEET = {
  name: 'ROTASYON',
} as const

/** Column letter for a day, or a hard error — a missing column would corrupt print output. */
export function dayColumn(day: DayType): string {
  const entry = DAY_COLUMN_MAP.find(([mapped]) => mapped === day)
  if (entry === undefined) {
    throw new Error(`No column mapped for day: ${day}`)
  }
  return entry[1]
}
