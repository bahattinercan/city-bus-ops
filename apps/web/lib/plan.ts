import { and, asc, eq, inArray } from 'drizzle-orm'
import {
  blocksPublishing,
  dayIndex,
  rotationDayIndex,
  DAY_TYPES,
  type AssignmentRef,
  type DayRef,
  type DayType,
  type GroupPlanRef,
  type PlanSnapshot,
  type RosterRef,
  type StandbyRef,
  type Violation,
} from '@citybus/domain'
import {
  absences,
  assignments,
  dutyGroups,
  planVersions,
  rosterEntries,
  routes,
  ruleViolations,
  standbys,
  vehicles,
  type Database,
} from '@citybus/db'

export type PlanRow = {
  readonly id: string
  readonly weekStart: string
  readonly weekOffset: number
  readonly status: 'draft' | 'published' | 'archived'
  readonly publishedAt: Date | null
}

export type LoadedPlan = {
  readonly version: PlanRow | null
  readonly snapshot: PlanSnapshot
  readonly violations: Violation[]
}

export function mondayOf(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay()
  date.setUTCDate(date.getUTCDate() - (weekday - 1))
  return date.toISOString().slice(0, 10)
}

export function weeksBetween(anchorMonday: string, targetMonday: string): number {
  const anchor = Date.parse(`${anchorMonday}T00:00:00Z`)
  const target = Date.parse(`${targetMonday}T00:00:00Z`)
  const days = Math.round((target - anchor) / (24 * 60 * 60 * 1000))
  if (days % 7 !== 0) {
    throw new Error('Both dates must be Mondays')
  }
  return days / 7
}

export function daysOfWeek(weekStart: string): DayRef[] {
  const start = Date.parse(`${weekStart}T00:00:00Z`)
  return DAY_TYPES.map((dayType: DayType, index) => ({
    dayIndex: dayIndex(dayType),
    dayType,
    date: new Date(start + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }))
}

/** Reads everything the rule engine needs for one week. */
export async function loadPlan(
  db: Database,
  organisationId: string,
  anchorWeek: string,
  weekStartInput: string,
): Promise<LoadedPlan> {
  const weekStart = mondayOf(weekStartInput)
  const weekOffset = weeksBetween(mondayOf(anchorWeek), weekStart)
  const days = daysOfWeek(weekStart)

  const [vehicleRows, routeRows, groupRows] = await Promise.all([
    db.select().from(vehicles).where(eq(vehicles.organisationId, organisationId)).orderBy(asc(vehicles.plateNumber)),
    db.select().from(routes).where(eq(routes.organisationId, organisationId)).orderBy(asc(routes.code)),
    db.select().from(dutyGroups).where(eq(dutyGroups.organisationId, organisationId)).orderBy(asc(dutyGroups.code)),
  ])

  const [version] = await db
    .select()
    .from(planVersions)
    .where(and(eq(planVersions.organisationId, organisationId), eq(planVersions.weekStart, weekStart)))
    .limit(1)

  const assignmentRows =
    version === undefined
      ? []
      : await db.select().from(assignments).where(eq(assignments.planVersionId, version.id))
  const standbyRows =
    version === undefined ? [] : await db.select().from(standbys).where(eq(standbys.planVersionId, version.id))
  const rosterRows =
    version === undefined
      ? []
      : await db.select().from(rosterEntries).where(eq(rosterEntries.planVersionId, version.id))
  const absenceRows = await db.select().from(absences).where(eq(absences.organisationId, organisationId))

  const historyStart = new Date(Date.parse(`${weekStart}T00:00:00Z`) - 6 * 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const historyVersions = await db
    .select({ id: planVersions.id, weekStart: planVersions.weekStart })
    .from(planVersions)
    .where(and(eq(planVersions.organisationId, organisationId), eq(planVersions.status, 'published')))
  const historyIds = historyVersions
    .filter((row) => row.weekStart >= historyStart && row.weekStart < weekStart)
    .map((row) => row.id)
  const historyStandbys =
    historyIds.length === 0
      ? []
      : await db
          .select({ vehicleId: standbys.vehicleId, dayIndex: standbys.dayIndex, planVersionId: standbys.planVersionId })
          .from(standbys)
          .where(inArray(standbys.planVersionId, historyIds))
  const weekStartByVersion = new Map(historyVersions.map((row) => [row.id, row.weekStart]))

  const snapshot: PlanSnapshot = {
    weekStart,
    weekOffset,
    days,
    vehicles: vehicleRows.map((row) => ({
      id: row.id,
      plate: row.plateNumber,
      lowFloor: row.lowFloor,
      airConditioned: row.airConditioned,
      status: row.status,
    })),
    routes: routeRows.map((row) => ({
      id: row.id,
      code: row.code,
      requiredLowFloor: row.requiredLowFloor,
      requiredAc: row.requiredAc,
    })),
    groups: groupRows.map<GroupPlanRef>((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      vehicleCount: row.vehicleCount,
      referenceDayIndex: row.referenceDayIndex as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      routeId: null,
    })),
    assignments: assignmentRows.map<AssignmentRef>((row) => ({
      dayIndex: row.dayIndex as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      vehicleId: row.vehicleId,
      status: row.status,
      groupId: row.dutyGroupId,
      routeId: row.routeId,
      extraDutyRouteId: row.extraDutyRouteId,
      firstTripMinute: row.firstTripMinute,
      locked: row.locked,
      rawCode: row.rawCode,
    })),
    standbys: standbyRows.map<StandbyRef>((row) => ({
      dayIndex: row.dayIndex as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      vehicleId: row.vehicleId,
      routeId: row.routeId,
      rawCode: row.rawCode,
    })),
    roster: rosterRows.map<RosterRef>((row) => ({
      dayIndex: row.dayIndex as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      driverId: row.driverId,
      vehicleId: row.vehicleId,
      startMinute: row.startMinute,
      endMinute: row.endMinute,
      drivingMinutes: row.drivingMinutes,
      breakMinutes: row.breakMinutes,
    })),
    absences: absenceRows.map((row) => ({
      subject: row.driverId === null ? 'vehicle' : 'driver',
      subjectId: row.driverId ?? row.vehicleId ?? '',
      dateFrom: row.dateFrom,
      dateTo: row.dateTo,
    })),
    standbyHistory: historyStandbys.flatMap((row) => {
      const start = weekStartByVersion.get(row.planVersionId)
      if (start === undefined) return []
      return [{ vehicleId: row.vehicleId, weekStart: start, dayIndex: row.dayIndex as 1 | 2 | 3 | 4 | 5 | 6 | 7 }]
    }),
    reportedWeeklyVehicleDays: version?.reportedWeeklyVehicleDays ?? undefined,
  }

  const violations =
    version === undefined
      ? []
      : await db
          .select()
          .from(ruleViolations)
          .where(eq(ruleViolations.planVersionId, version.id))
          .then((rows) =>
            rows.map<Violation>((row) => ({
              code: row.code,
              severity: row.severity,
              message: row.message,
              dayIndex: (row.dayIndex ?? undefined) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | undefined,
              vehicleId: row.vehicleId ?? undefined,
              driverId: row.driverId ?? undefined,
              groupId: row.dutyGroupId ?? undefined,
            })),
          )

  return {
    version:
      version === undefined
        ? null
        : {
            id: version.id,
            weekStart: version.weekStart,
            weekOffset: version.weekOffset,
            status: version.status,
            publishedAt: version.publishedAt,
          },
    snapshot,
    violations,
  }
}

/** Persists a generated snapshot and its violations, replacing the previous draft content. */
export async function savePlan(
  db: Database,
  organisationId: string,
  snapshot: PlanSnapshot,
  violations: readonly Violation[],
  userId: string | null,
): Promise<PlanRow> {
  const [version] = await db
    .insert(planVersions)
    .values({
      organisationId,
      weekStart: snapshot.weekStart,
      weekOffset: snapshot.weekOffset,
      status: 'draft',
      createdBy: userId,
    })
    .onConflictDoUpdate({
      target: [planVersions.organisationId, planVersions.weekStart],
      set: { weekOffset: snapshot.weekOffset, status: 'draft', publishedAt: null },
    })
    .returning()

  if (version === undefined) {
    throw new Error('Plan version could not be saved')
  }

  await db.delete(assignments).where(eq(assignments.planVersionId, version.id))
  await db.delete(standbys).where(eq(standbys.planVersionId, version.id))
  await db.delete(ruleViolations).where(eq(ruleViolations.planVersionId, version.id))

  if (snapshot.assignments.length > 0) {
    await db.insert(assignments).values(
      snapshot.assignments.map((assignment) => ({
        planVersionId: version.id,
        dayIndex: assignment.dayIndex,
        vehicleId: assignment.vehicleId,
        status: assignment.status,
        dutyGroupId: assignment.groupId,
        routeId: assignment.routeId,
        extraDutyRouteId: assignment.extraDutyRouteId,
        firstTripMinute: assignment.firstTripMinute,
        rawCode: assignment.rawCode,
        locked: assignment.locked,
      })),
    )
  }

  if (snapshot.standbys.length > 0) {
    await db.insert(standbys).values(
      snapshot.standbys.map((standby) => ({
        planVersionId: version.id,
        dayIndex: standby.dayIndex,
        vehicleId: standby.vehicleId,
        routeId: standby.routeId,
        rawCode: standby.rawCode,
      })),
    )
  }

  await saveViolations(db, version.id, violations)

  return {
    id: version.id,
    weekStart: version.weekStart,
    weekOffset: version.weekOffset,
    status: version.status,
    publishedAt: version.publishedAt,
  }
}

export async function saveViolations(
  db: Database,
  planVersionId: string,
  violations: readonly Violation[],
): Promise<void> {
  await db.delete(ruleViolations).where(eq(ruleViolations.planVersionId, planVersionId))
  if (violations.length === 0) return

  await db.insert(ruleViolations).values(
    violations.map((violation) => ({
      planVersionId,
      code: violation.code,
      severity: violation.severity,
      message: violation.message,
      dayIndex: violation.dayIndex ?? null,
      vehicleId: violation.vehicleId ?? null,
      driverId: violation.driverId ?? null,
      dutyGroupId: violation.groupId ?? null,
    })),
  )
}

export function canPublish(violations: readonly Violation[]): boolean {
  return !blocksPublishing(violations)
}

/** Rotation weekday a group must fall on, for the plan header. */
export function groupDayForWeek(referenceDayIndex: number, weekOffset: number): number {
  return rotationDayIndex(referenceDayIndex as 1 | 2 | 3 | 4 | 5 | 6 | 7, weekOffset)
}
