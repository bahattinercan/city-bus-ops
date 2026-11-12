'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  RouteCode,
  blocksPublishing,
  generateWeeklyPlan,
  parseSheetCell,
  validatePlan,
  type AssignmentRef,
} from '@citybus/domain'
import { assignments, planVersions, routes, standbys, vehicles } from '@citybus/db'
import { getDb, getOrganisation } from '@/lib/db'
import { loadPlan, mondayOf, savePlan, saveViolations } from '@/lib/plan'

function fail(week: string, message: string): never {
  redirect(`/plan?week=${week}&error=${encodeURIComponent(message)}`)
}

function week(form: FormData): string {
  const value = form.get('week')
  return mondayOf(typeof value === 'string' && value !== '' ? value : new Date().toISOString().slice(0, 10))
}

export async function generatePlanAction(form: FormData): Promise<void> {
  const organisation = await getOrganisation()
  const weekStart = week(form)
  const db = getDb()

  const current = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, weekStart)

  const locked = current.snapshot.assignments
    .filter((assignment) => assignment.locked)
    .map<AssignmentRef>((assignment) => ({ ...assignment }))

  const standbyRouteId = current.snapshot.routes[0]?.id ?? null
  const result = generateWeeklyPlan({
    weekStart: current.snapshot.weekStart,
    weekOffset: current.snapshot.weekOffset,
    days: current.snapshot.days,
    vehicles: current.snapshot.vehicles,
    routes: current.snapshot.routes,
    groups: current.snapshot.groups,
    lockedAssignments: locked,
    standby: standbyRouteId === null ? undefined : { perDay: 1, routeId: standbyRouteId },
  })

  await savePlan(db, organisation.id, result.snapshot, result.violations, null)

  const query = new URLSearchParams({ week: weekStart })
  if (result.notices.length > 0) {
    query.set('notices', result.notices.join(' | '))
  }
  revalidatePath('/plan')
  redirect(`/plan?${query.toString()}`)
}

export async function publishPlanAction(form: FormData): Promise<void> {
  const organisation = await getOrganisation()
  const weekStart = week(form)
  const db = getDb()

  const current = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, weekStart)
  if (current.version === null) {
    fail(weekStart, 'Bu hafta için plan yok.')
  }

  const violations = validatePlan(current.snapshot)
  await saveViolations(db, current.version.id, violations)

  if (blocksPublishing(violations)) {
    const hard = violations.filter((violation) => violation.severity === 'hard')
    fail(weekStart, `Plan yayınlanamaz: ${hard.length} sert kural ihlali var.`)
  }

  await db
    .update(planVersions)
    .set({ status: 'published', publishedAt: new Date() })
    .where(eq(planVersions.id, current.version.id))

  revalidatePath('/plan')
  redirect(`/plan?week=${weekStart}&published=1`)
}

/**
 * Manual cell edit (legacy K4). The cell text is parsed by the same rules as the import,
 * and the edit is locked so regeneration cannot overwrite it (R8).
 */
export async function setCellAction(form: FormData): Promise<void> {
  const organisation = await getOrganisation()
  const weekStart = week(form)
  const db = getDb()

  const plate = String(form.get('plate') ?? '').trim()
  const dayIndexValue = Number.parseInt(String(form.get('dayIndex') ?? ''), 10)
  const rawCode = String(form.get('code') ?? '').trim()

  if (plate === '' || dayIndexValue < 1 || dayIndexValue > 7) {
    fail(weekStart, 'Araç ve gün seçilmeli.')
  }

  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.organisationId, organisation.id), eq(vehicles.plateNumber, plate)))
    .limit(1)
  if (vehicle === undefined) {
    fail(weekStart, `Araç bulunamadı: ${plate}`)
  }

  const current = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, weekStart)
  if (current.version === null) {
    fail(weekStart, 'Önce haftayı üretin, sonra hücre düzenleyin.')
  }

  const routeRows = await db.select().from(routes).where(eq(routes.organisationId, organisation.id))
  const routeByCode = new Map(routeRows.map((route) => [route.code, route.id]))

  const cell = parseSheetCell(rawCode)
  let status: 'duty' | 'standby' | 'idle' = 'duty'
  let routeId: string | null = null
  let extraDutyRouteId: string | null = null
  let firstTripMinute: number | null = null

  switch (cell.kind) {
    case 'duty':
      routeId = routeByCode.get(cell.route.value) ?? null
      break
    case 'extraDuty':
      extraDutyRouteId = routeByCode.get(cell.route.value) ?? null
      routeId = null
      break
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
      try {
        routeId = routeByCode.get(RouteCode.parse(cell.raw).value) ?? null
      } catch {
        fail(weekStart, `Hücre kodu anlaşılmadı: "${cell.raw}"`)
      }
      break
    }
  }

  const existing = current.snapshot.assignments.find(
    (assignment) => assignment.dayIndex === dayIndexValue && assignment.vehicleId === vehicle.id,
  )

  if (existing === undefined) {
    await db.insert(assignments).values({
      planVersionId: current.version.id,
      dayIndex: dayIndexValue,
      vehicleId: vehicle.id,
      status,
      routeId,
      extraDutyRouteId,
      firstTripMinute,
      rawCode,
      locked: true,
    })
  } else {
    const nextStatus = cell.kind === 'startTime' ? existing.status : status
    const nextRouteId = cell.kind === 'startTime' ? existing.routeId : routeId
    await db
      .update(assignments)
      .set({
        status: nextStatus,
        routeId: nextRouteId,
        extraDutyRouteId,
        firstTripMinute: firstTripMinute ?? existing.firstTripMinute,
        dutyGroupId: cell.kind === 'startTime' ? existing.groupId : null,
        rawCode,
        locked: true,
      })
      .where(
        and(
          eq(assignments.planVersionId, current.version.id),
          eq(assignments.dayIndex, dayIndexValue),
          eq(assignments.vehicleId, vehicle.id),
        ),
      )
  }

  await db
    .delete(standbys)
    .where(and(eq(standbys.planVersionId, current.version.id), eq(standbys.vehicleId, vehicle.id)))

  if (status === 'standby') {
    await db.insert(standbys).values({
      planVersionId: current.version.id,
      dayIndex: dayIndexValue,
      vehicleId: vehicle.id,
      routeId: null,
      rawCode: rawCode === '' ? 'x' : rawCode,
    })
  }

  const refreshed = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, weekStart)
  await saveViolations(db, current.version.id, validatePlan(refreshed.snapshot))

  revalidatePath('/plan')
  redirect(`/plan?week=${weekStart}&edited=${encodeURIComponent(plate)}`)
}
