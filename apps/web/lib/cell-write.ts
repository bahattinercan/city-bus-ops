import { and, eq } from 'drizzle-orm'
import { RouteCode, parseSheetCell, type DayIndex, type SheetCell } from '@citybus/domain'
import { assignments, standbys, type Database } from '@citybus/db'

export type CellWriteOutcome = { readonly ok: true; readonly cell: SheetCell } | { readonly ok: false; readonly reason: string }

export type CellWriteInput = {
  readonly planVersionId: string
  readonly vehicleId: string
  readonly dayIndex: DayIndex
  readonly rawCode: string
  /** Route code -> route id for this organisation. */
  readonly routeIdByCode: ReadonlyMap<string, string>
  /**
   * The route a standby row points at. R9 rejects a standby without a route code, so the
   * caller passes the week's standby route (generated plans already use one).
   */
  readonly standbyRouteId: string | null
}

/**
 * Writes one plan cell with the operator's semantics: the text is parsed by the same rules
 * as the import, the assignment is marked `locked` so regeneration cannot overwrite it (R8),
 * and a standby row never outlives the day it belongs to.
 *
 * Both the manual cell editor and the bulk/AI proposal path go through here, so the two can
 * never drift apart.
 */
export async function writePlanCell(db: Database, input: CellWriteInput): Promise<CellWriteOutcome> {
  const cell = parseSheetCell(input.rawCode)
  const rawCode = cell.raw

  let status: 'duty' | 'standby' | 'idle' = 'duty'
  let routeId: string | null = null
  let extraDutyRouteId: string | null = null
  let firstTripMinute: number | null = null

  switch (cell.kind) {
    case 'duty': {
      const id = input.routeIdByCode.get(cell.route.value)
      if (id === undefined) return { ok: false, reason: `hat kodu tanımlı değil: ${cell.route.value}` }
      routeId = id
      break
    }
    case 'extraDuty': {
      const id = input.routeIdByCode.get(cell.route.value)
      if (id === undefined) return { ok: false, reason: `hat kodu tanımlı değil: ${cell.route.value}` }
      extraDutyRouteId = id
      break
    }
    case 'standby':
      status = 'standby'
      break
    case 'startTime':
      firstTripMinute = cell.minutes
      break
    case 'empty':
      status = 'idle'
      break
    case 'text': {
      // Never guessed: an unknown word becomes a route only if it really is one.
      try {
        const code = RouteCode.parse(cell.raw).value
        const id = input.routeIdByCode.get(code)
        if (id === undefined) return { ok: false, reason: `hat kodu tanımlı değil: ${code}` }
        routeId = id
      } catch {
        return { ok: false, reason: `hücre kodu anlaşılmadı: "${cell.raw}"` }
      }
      break
    }
  }

  const [existing] = await db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.planVersionId, input.planVersionId),
        eq(assignments.dayIndex, input.dayIndex),
        eq(assignments.vehicleId, input.vehicleId),
      ),
    )
    .limit(1)

  const keepsRoute = cell.kind === 'startTime'

  if (existing === undefined) {
    await db.insert(assignments).values({
      planVersionId: input.planVersionId,
      dayIndex: input.dayIndex,
      vehicleId: input.vehicleId,
      status,
      routeId,
      extraDutyRouteId,
      firstTripMinute,
      rawCode,
      locked: true,
    })
  } else {
    await db
      .update(assignments)
      .set({
        status: keepsRoute ? existing.status : status,
        routeId: keepsRoute ? existing.routeId : routeId,
        extraDutyRouteId,
        firstTripMinute: firstTripMinute ?? existing.firstTripMinute,
        dutyGroupId: keepsRoute ? existing.dutyGroupId : null,
        rawCode,
        locked: true,
      })
      .where(
        and(
          eq(assignments.planVersionId, input.planVersionId),
          eq(assignments.dayIndex, input.dayIndex),
          eq(assignments.vehicleId, input.vehicleId),
        ),
      )
  }

  // Only this day's standby is replaced: the vehicle keeps its other standby days (R9).
  await db
    .delete(standbys)
    .where(
      and(
        eq(standbys.planVersionId, input.planVersionId),
        eq(standbys.vehicleId, input.vehicleId),
        eq(standbys.dayIndex, input.dayIndex),
      ),
    )

  if (status === 'standby') {
    await db.insert(standbys).values({
      planVersionId: input.planVersionId,
      dayIndex: input.dayIndex,
      vehicleId: input.vehicleId,
      routeId: input.standbyRouteId,
      rawCode: rawCode === '' ? 'x' : rawCode,
    })
  }

  return { ok: true, cell }
}
