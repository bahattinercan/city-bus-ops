import { DAY_TYPES, dayIndex, parseDayLabel, printLabel, type DayType } from './day-type'
import type { DayIndex } from './rotation'
import { parseSheetCell, type SheetCell } from './sheet-cell'

/**
 * One change to a single plan cell, authored by an operator or by a model.
 *
 * Nothing here touches the database or the rule engine: a proposal is data, and the
 * caller decides what to do with it. `code` is the raw cell text, so the parse rules are
 * exactly the import rules (`parseSheetCell`) — a proposal can never introduce a cell
 * shape the engine has not seen before.
 */
export type PlanEdit = {
  readonly plate: string
  readonly dayIndex: DayIndex
  readonly code: string
  readonly reason?: string
}

/** Guard rail: a single request may never rewrite the week (blast radius). */
export const MAX_EDITS_PER_REQUEST = 20

export type EditLineError = { readonly line: string; readonly reason: string }

export type EditRejection = { readonly edit: PlanEdit; readonly reason: string }

export type ResolvedEdit = {
  readonly edit: PlanEdit
  readonly vehicleId: string
  readonly cell: SheetCell
}

export type EditTargets = {
  readonly vehicles: readonly { readonly id: string; readonly plate: string }[]
  readonly routeCodes: readonly string[]
}

export type EditResolution = {
  readonly resolved: readonly ResolvedEdit[]
  readonly rejected: readonly EditRejection[]
}

/**
 * Short day spellings an operator (or a model) actually types: `pzt`, `car`, `carsamba`.
 * Built in three passes so the explicit abbreviations win over the prefixes (`paz` means
 * Sunday, not the first three letters of Monday).
 */
const DAY_ALIASES: ReadonlyMap<string, DayType> = new Map([
  ...DAY_TYPES.map((day) => [normalizeToken(printLabel(day)), day] as const),
  ...DAY_TYPES.map((day) => [normalizeToken(printLabel(day).slice(0, 3)), day] as const),
  ...DAY_TYPES.map((day) => [normalizeToken(shortLabel(day)), day] as const),
])

function shortLabel(day: DayType): string {
  switch (day) {
    case 'monday':
      return 'PZT'
    case 'tuesday':
      return 'SAL'
    case 'wednesday':
      return 'CAR'
    case 'thursday':
      return 'PER'
    case 'friday':
      return 'CUM'
    case 'saturday':
      return 'CMT'
    case 'sunday':
      return 'PAZ'
  }
}

/** `pazartesi`, `pzt`, `1`, `ÇARŞAMBA`, `carsamba` all resolve to the same day. */
export function parseEditDay(token: string): DayIndex | undefined {
  const raw = token.trim()
  if (raw === '') return undefined

  if (/^[1-7]$/.test(raw)) {
    return Number.parseInt(raw, 10) as DayIndex
  }

  const named = DAY_ALIASES.get(normalizeToken(raw)) ?? parseDayLabel(raw)
  return named === undefined ? undefined : dayIndex(named)
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ç/g, 'C')
    .replace(/Ö/g, 'O')
    .replace(/Ü/g, 'U')
}

/**
 * Parses the operator's bulk-edit text, one cell per line:
 *
 * ```
 * 003 cuma 9A        # vehicle 003, Friday, route 9A duty
 * 030 pzt -20        # extra duty on route 20
 * 042 cmt x          # standby
 * 050 pazar YAT      # explicit idle row
 * 060 sal            # no code -> empty cell (no record)
 * ```
 *
 * Unknown lines are reported, never guessed: the operator sees exactly which line was
 * not understood and why.
 */
export function parseEditText(text: string): {
  readonly edits: readonly PlanEdit[]
  readonly errors: readonly EditLineError[]
} {
  const edits: PlanEdit[] = []
  const errors: EditLineError[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue

    const tokens = line.split(/\s+/)
    const plate = tokens[0]
    if (plate === undefined) continue

    if (tokens.length < 2) {
      errors.push({ line, reason: 'gün eksik: "plaka gün kod" biçiminde yazın' })
      continue
    }

    const dayToken = tokens[1] as string
    const day = parseEditDay(dayToken)
    if (day === undefined) {
      errors.push({ line, reason: `gün anlaşılmadı: "${dayToken}"` })
      continue
    }

    edits.push({
      plate: plate.trim(),
      dayIndex: day,
      code: tokens.slice(2).join(' ').trim(),
    })
  }

  return { edits, errors }
}

/**
 * Maps proposals onto real vehicles and route codes. Everything the engine cannot honour
 * is rejected with a Turkish reason instead of being silently dropped.
 */
export function resolveEdits(edits: readonly PlanEdit[], targets: EditTargets): EditResolution {
  const resolved: ResolvedEdit[] = []
  const rejected: EditRejection[] = []
  const seen = new Map<string, PlanEdit>()

  if (edits.length > MAX_EDITS_PER_REQUEST) {
    for (const edit of edits) {
      rejected.push({ edit, reason: `tek istekte en fazla ${MAX_EDITS_PER_REQUEST} hücre değiştirilebilir` })
    }
    return { resolved, rejected }
  }

  const vehicleByPlate = new Map(targets.vehicles.map((vehicle) => [vehicle.plate.trim().toUpperCase(), vehicle]))
  const routeCodeSet = new Set(targets.routeCodes.map((code) => code.trim().toUpperCase()))

  for (const edit of edits) {
    const key = `${edit.plate.trim().toUpperCase()}:${edit.dayIndex}`
    const duplicate = seen.get(key)
    if (duplicate !== undefined) {
      rejected.push({ edit, reason: 'aynı hücre bu istekte iki kez geçiyor' })
      continue
    }
    seen.set(key, edit)

    const vehicle = vehicleByPlate.get(edit.plate.trim().toUpperCase())
    if (vehicle === undefined) {
      rejected.push({ edit, reason: `araç bulunamadı: ${edit.plate}` })
      continue
    }

    const cell = parseSheetCell(edit.code)
    if (cell.kind === 'text') {
      rejected.push({ edit, reason: `hücre kodu anlaşılmadı: "${cell.raw}"` })
      continue
    }
    if ((cell.kind === 'duty' || cell.kind === 'extraDuty') && !routeCodeSet.has(cell.route.value)) {
      rejected.push({ edit, reason: `hat kodu tanımlı değil: ${cell.route.value}` })
      continue
    }

    resolved.push({ edit, vehicleId: vehicle.id, cell })
  }

  return { resolved, rejected }
}
