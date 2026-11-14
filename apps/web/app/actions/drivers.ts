'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { validatePlan } from '@citybus/domain'
import {
  absences,
  defectReports,
  drivers,
  rosterEntries,
  swapRequests,
  trips,
  vehicles,
} from '@citybus/db'
import { requireSession } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { getDb, getOrganisation } from '@/lib/db'
import { loadPlan, mondayOf, saveViolations } from '@/lib/plan'
import { buildRoster, type DriverAbsence, type TripWindow } from '@/lib/roster'

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`)
}

function week(form: FormData, fallback = new Date().toISOString().slice(0, 10)): string {
  const value = form.get('week')
  return mondayOf(typeof value === 'string' && value !== '' ? value : fallback)
}

export async function generateRosterAction(form: FormData): Promise<void> {
  await requireSession(['admin', 'planner', 'dispatcher'])
  const organisation = await getOrganisation()
  const weekStart = week(form)
  const db = getDb()

  const plan = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, weekStart)
  const version = plan.version
  if (version === null) {
    fail(`/drivers?week=${weekStart}`, 'generateFirst')
  }

  const driverRows = await db
    .select()
    .from(drivers)
    .where(eq(drivers.organisationId, organisation.id))
  const absenceRows = await db
    .select()
    .from(absences)
    .where(and(eq(absences.organisationId, organisation.id)))

  const tripRows = await db
    .select({
      id: trips.id,
      routeId: trips.routeId,
      dayType: trips.dayType,
      startMinute: trips.startMinute,
      endMinute: trips.endMinute,
    })
    .from(trips)

  const tripsByRouteDay = new Map<string, TripWindow[]>()
  const tripsById = new Map<string, TripWindow>()
  for (const trip of tripRows) {
    const key = `${trip.routeId}:${trip.dayType}`
    const list = tripsByRouteDay.get(key) ?? []
    const window = { startMinute: trip.startMinute, endMinute: trip.endMinute }
    list.push(window)
    tripsByRouteDay.set(key, list)
    tripsById.set(trip.id, window)
  }

  const driverAbsences: DriverAbsence[] = absenceRows.flatMap((row) =>
    row.driverId === null ? [] : [{ driverId: row.driverId, dateFrom: row.dateFrom, dateTo: row.dateTo }],
  )

  const roster = buildRoster({
    snapshot: plan.snapshot,
    drivers: driverRows.map((row) => ({ id: row.id, fullName: row.fullName, active: row.active })),
    tripsByRouteDay,
    tripsById,
    absences: driverAbsences,
  })

  await db.delete(rosterEntries).where(eq(rosterEntries.planVersionId, version.id))
  if (roster.entries.length > 0) {
    await db.insert(rosterEntries).values(
      roster.entries.map((entry) => ({
        planVersionId: version.id,
        dayIndex: entry.dayIndex,
        driverId: entry.driverId,
        vehicleId: entry.vehicleId,
        startMinute: entry.startMinute,
        endMinute: entry.endMinute,
        drivingMinutes: entry.drivingMinutes,
        breakMinutes: entry.breakMinutes,
      })),
    )
  }

  const refreshed = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, weekStart)
  await saveViolations(db, version.id, validatePlan(refreshed.snapshot))

  await recordAudit(db, {
    organisationId: organisation.id,
    actorUserId: null,
    action: 'roster.generate',
    entity: 'roster_entry',
    entityId: version.id,
    payload: { weekStart, entries: roster.entries.length, notices: roster.notices },
  })

  revalidatePath('/drivers')
  const query = new URLSearchParams({ week: weekStart, roster: String(roster.entries.length) })
  if (roster.notices.length > 0) query.set('notices', roster.notices.join(' | '))
  redirect(`/drivers?${query.toString()}`)
}

export async function createDriverAction(form: FormData): Promise<void> {
  await requireSession(['admin', 'planner'])
  const organisation = await getOrganisation()
  const employeeNo = String(form.get('employeeNo') ?? '').trim()
  const fullName = String(form.get('fullName') ?? '').trim()
  const licenceClass = String(form.get('licenceClass') ?? 'D').trim() || 'D'

  if (employeeNo === '' || fullName === '') {
    fail('/drivers', 'Sicil no ve ad zorunlu.')
  }

  await getDb()
    .insert(drivers)
    .values({ organisationId: organisation.id, employeeNo, fullName, licenceClass })
    .onConflictDoNothing()

  revalidatePath('/drivers')
}

export async function requestSwapAction(form: FormData): Promise<void> {
  const session = await requireSession(['driver'])
  if (session.driverId === null) {
    fail('/driver', 'driverNotLinked')
  }

  const weekStart = week(form)
  const dayIndex = Number.parseInt(String(form.get('dayIndex') ?? ''), 10)
  const note = String(form.get('note') ?? '').trim()

  if (dayIndex < 1 || dayIndex > 7) {
    fail('/driver', 'dayRequired')
  }

  const db = getDb()
  const plan = await loadPlan(db, session.organisationId, await anchorWeek(), weekStart)
  if (plan.version === null) {
    fail('/driver', 'noPublishedPlan')
  }

  const [entry] = await db
    .select()
    .from(rosterEntries)
    .where(
      and(
        eq(rosterEntries.planVersionId, plan.version.id),
        eq(rosterEntries.driverId, session.driverId),
        eq(rosterEntries.dayIndex, dayIndex),
      ),
    )
    .limit(1)

  if (entry === undefined) {
    fail('/driver', 'noDutyThatDay')
  }

  await db.insert(swapRequests).values({
    planVersionId: plan.version.id,
    dayIndex,
    fromDriverId: session.driverId,
    status: 'pending',
    note: note === '' ? null : note,
  })

  revalidatePath('/driver')
  revalidatePath('/drivers')
  redirect('/driver?requested=1')
}

export async function decideSwapAction(form: FormData): Promise<void> {
  const session = await requireSession(['admin', 'planner', 'dispatcher'])
  const requestId = String(form.get('requestId') ?? '')
  const decision = String(form.get('decision') ?? '')
  const db = getDb()

  const [request] = await db.select().from(swapRequests).where(eq(swapRequests.id, requestId)).limit(1)
  if (request === undefined) {
    fail('/drivers', 'swapNotFound')
  }

  if (decision !== 'approved') {
    await db
      .update(swapRequests)
      .set({ status: 'rejected', decidedBy: session.userId, decidedAt: new Date() })
      .where(eq(swapRequests.id, request.id))
    revalidatePath('/drivers')
    return
  }

  const [entry] = await db
    .select()
    .from(rosterEntries)
    .where(
      and(
        eq(rosterEntries.planVersionId, request.planVersionId),
        eq(rosterEntries.driverId, request.fromDriverId),
        eq(rosterEntries.dayIndex, request.dayIndex),
      ),
    )
    .limit(1)

  if (entry === undefined) {
    fail('/drivers', 'dutyGone')
  }

  // A swap without a named counterpart is "excused": the duty is released for reassignment.
  await db
    .update(swapRequests)
    .set({ status: 'approved', decidedBy: session.userId, decidedAt: new Date() })
    .where(eq(swapRequests.id, request.id))

  await recordAudit(db, {
    organisationId: (await getOrganisation()).id,
    actorUserId: session.userId,
    action: 'swap.decide',
    entity: 'swap_request',
    entityId: request.id,
    payload: { decision, dayIndex: request.dayIndex },
  })

  if (request.toDriverId !== null) {
    await db
      .update(rosterEntries)
      .set({ driverId: request.toDriverId })
      .where(eq(rosterEntries.id, entry.id))
  } else {
    await db.delete(rosterEntries).where(eq(rosterEntries.id, entry.id))
  }

  revalidatePath('/drivers')
  revalidatePath('/driver')
}

export async function reportDefectAction(form: FormData): Promise<void> {
  const session = await requireSession(['driver', 'dispatcher', 'admin'])
  const plate = String(form.get('plate') ?? '').trim()
  const description = String(form.get('description') ?? '').trim()
  const severity = String(form.get('severity') ?? 'medium')

  if (plate === '' || description === '') {
    fail('/driver', 'plateAndDescription')
  }

  const db = getDb()
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.organisationId, session.organisationId), eq(vehicles.plateNumber, plate)))
    .limit(1)

  if (vehicle === undefined) {
    fail('/driver', `Araç bulunamadı: ${plate}`)
  }

  await recordAudit(db, {
    organisationId: session.organisationId,
    actorUserId: session.userId,
    action: 'defect.report',
    entity: 'defect_report',
    entityId: vehicle.id,
    payload: { plate, severity, description },
  })

  await db.insert(defectReports).values({
    organisationId: session.organisationId,
    vehicleId: vehicle.id,
    driverId: session.driverId,
    severity: severity === 'low' || severity === 'high' ? severity : 'medium',
    description,
  })

  revalidatePath('/driver')
  revalidatePath('/drivers')
  redirect('/driver?defect=1')
}

export async function closeDefectAction(form: FormData): Promise<void> {
  await requireSession(['admin', 'planner', 'dispatcher'])
  const defectId = String(form.get('defectId') ?? '')
  if (defectId === '') return

  await getDb()
    .update(defectReports)
    .set({ status: 'closed', closedAt: new Date() })
    .where(eq(defectReports.id, defectId))

  revalidatePath('/drivers')
}

export async function markAbsenceAction(form: FormData): Promise<void> {
  await requireSession(['admin', 'planner', 'dispatcher'])
  const organisation = await getOrganisation()
  const driverId = String(form.get('driverId') ?? '')
  const dateFrom = String(form.get('dateFrom') ?? '')
  const dateTo = String(form.get('dateTo') ?? dateFrom)
  const type = String(form.get('type') ?? 'leave')

  if (driverId === '' || dateFrom === '') {
    fail('/drivers', 'driverAndDate')
  }

  await getDb()
    .insert(absences)
    .values({
      organisationId: organisation.id,
      driverId,
      dateFrom,
      dateTo,
      type: type === 'sick' ? 'sick' : type === 'other' ? 'other' : 'leave',
    })

  revalidatePath('/drivers')
}

async function anchorWeek(): Promise<string> {
  const organisation = await getOrganisation()
  return organisation.rotationAnchorWeek
}
