'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  blocksPublishing,
  generateWeeklyPlan,
  validatePlan,
  type AssignmentRef,
  type DayIndex,
} from '@citybus/domain'
import { planVersions, routes, trips, vehicles } from '@citybus/db'
import { recordAudit } from '@/lib/audit'
import { writePlanCell } from '@/lib/cell-write'
import { getDb, getOrganisation } from '@/lib/db'
import { loadPlan, mondayOf, savePlan, saveViolations, standbyRouteIdOf } from '@/lib/plan'

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

  const tripRows = await db
    .select({
      id: trips.id,
      routeId: trips.routeId,
      dayType: trips.dayType,
      startMinute: trips.startMinute,
      endMinute: trips.endMinute,
    })
    .from(trips)

  const tripsByRouteDay = new Map<string, { id: string; startMinute: number; endMinute: number }[]>()
  for (const trip of tripRows) {
    const key = `${trip.routeId}:${trip.dayType}`
    const list = tripsByRouteDay.get(key) ?? []
    list.push({ id: trip.id, startMinute: trip.startMinute, endMinute: trip.endMinute })
    tripsByRouteDay.set(key, list)
  }

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
    tripsByRouteDay,
  })

  const saved = await savePlan(db, organisation.id, result.snapshot, result.violations, null)
  await recordAudit(db, {
    organisationId: organisation.id,
    actorUserId: null,
    action: 'plan.generate',
    entity: 'plan_version',
    entityId: saved.id,
    payload: {
      weekStart,
      assignments: result.snapshot.assignments.length,
      standbys: result.snapshot.standbys.length,
      violations: result.violations.length,
      notices: result.notices,
    },
  })

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
    fail(weekStart, 'planMissing')
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

  await recordAudit(db, {
    organisationId: organisation.id,
    actorUserId: null,
    action: 'plan.publish',
    entity: 'plan_version',
    entityId: current.version.id,
    payload: { weekStart, hardViolations: 0, softViolations: violations.length },
  })

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
    fail(weekStart, 'vehicleAndDay')
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
    fail(weekStart, 'generateWeekFirst')
  }

  const routeRows = await db.select().from(routes).where(eq(routes.organisationId, organisation.id))
  const routeByCode = new Map(routeRows.map((route) => [route.code, route.id]))

  const outcome = await writePlanCell(db, {
    planVersionId: current.version.id,
    vehicleId: vehicle.id,
    dayIndex: dayIndexValue as DayIndex,
    rawCode,
    routeIdByCode: routeByCode,
    standbyRouteId: standbyRouteIdOf(current.snapshot),
  })
  if (!outcome.ok) {
    fail(weekStart, outcome.reason)
  }

  const refreshed = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, weekStart)
  await saveViolations(db, current.version.id, validatePlan(refreshed.snapshot))

  await recordAudit(db, {
    organisationId: organisation.id,
    actorUserId: null,
    action: 'plan.cell.edit',
    entity: 'assignment',
    entityId: `${weekStart}:${plate}:${dayIndexValue}`,
    payload: { rawCode, kind: outcome.cell.kind },
  })

  revalidatePath('/plan')
  redirect(`/plan?week=${weekStart}&edited=${encodeURIComponent(plate)}`)
}
