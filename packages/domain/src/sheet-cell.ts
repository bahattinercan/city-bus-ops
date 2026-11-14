import { RouteCode } from './route-code'

/**
 * One cell of the weekly plan, classified.
 *
 * The legacy sheets mix five different meanings in the same cell. Every meaning below
 * is backed by an operator decision recorded in `docs/legacy-domain-analysis.md`
 * (O1, O3, S14, S15):
 *
 * - `duty`      single route number = that route's duty for the vehicle (O1)
 * - `extraDuty` negative route number (`-20`) = an additional duty on route 20 (S14)
 * - `standby`   `x` = this vehicle is on standby that day (O3)
 * - `startTime` `12.00`, `20.30` = the vehicle's first departure that day (S15)
 * - `text`      anything else (`otogar`, `Demirci`, ...) — kept raw, never guessed (S13)
 *
 * `raw` is always preserved so no information is lost when a code is later explained.
 */
export type SheetCell =
  | { readonly kind: 'empty'; readonly raw: string }
  | { readonly kind: 'duty'; readonly route: RouteCode; readonly raw: string }
  | { readonly kind: 'extraDuty'; readonly route: RouteCode; readonly raw: string }
  | { readonly kind: 'standby'; readonly raw: string }
  | { readonly kind: 'startTime'; readonly minutes: number; readonly raw: string }
  | { readonly kind: 'text'; readonly raw: string }

const TIME_PATTERN = /^(\d{1,2})[.:](\d{2})$/
const EXTRA_DUTY_PATTERN = /^-\s*(\d{1,3}[A-Za-z]{0,2})$/
const STANDBY_MARKERS = new Set(['x', 'X', '×', '*'])
/**
 * `YAT` is the operator's explicit "idle vehicle" marker (legacy TD-04: an explicit idle
 * row, distinct from an empty cell which means "no record"). It carries no route data, so
 * it parses to an empty cell and `raw` keeps the word for the printed sheet.
 */
const IDLE_MARKER = 'YAT'

/** Parses plan cell content; never throws, unknown content becomes `text`. */
export function parseSheetCell(input: string): SheetCell {
  const raw = input.trim()
  if (raw === '') {
    return { kind: 'empty', raw }
  }

  if (STANDBY_MARKERS.has(raw)) {
    return { kind: 'standby', raw }
  }

  if (normalizeUppercase(raw) === IDLE_MARKER) {
    return { kind: 'empty', raw }
  }

  const extra = EXTRA_DUTY_PATTERN.exec(raw)
  if (extra?.[1] !== undefined) {
    return { kind: 'extraDuty', route: RouteCode.parse(extra[1]), raw }
  }

  const time = TIME_PATTERN.exec(raw)
  if (time?.[1] !== undefined && time[2] !== undefined) {
    const hours = Number.parseInt(time[1], 10)
    const minutes = Number.parseInt(time[2], 10)
    if (hours <= 23 && minutes <= 59) {
      return { kind: 'startTime', minutes: hours * 60 + minutes, raw }
    }
  }

  try {
    return { kind: 'duty', route: RouteCode.parse(raw), raw }
  } catch {
    return { kind: 'text', raw }
  }
}

/** True when the cell assigns work (duty or extra duty) — used by plan validation. */
export function assignsWork(cell: SheetCell): boolean {
  return cell.kind === 'duty' || cell.kind === 'extraDuty'
}

function normalizeUppercase(value: string): string {
  return value.toLocaleUpperCase('tr-TR')
}
